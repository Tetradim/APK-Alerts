package com.tetradim.sentinelnexus.phoneengine

import android.content.Context
import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

object DiscordGatewayWorker {
  private const val GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json"
  private const val NORMAL_CLOSURE = 1000
  private const val DISCORD_INTENTS = 33280

  private val handler = Handler(Looper.getMainLooper())
  private val client = OkHttpClient.Builder()
    .pingInterval(30, TimeUnit.SECONDS)
    .retryOnConnectionFailure(true)
    .build()

  private var socket: WebSocket? = null
  @Volatile private var heartbeatIntervalMs = 45_000L
  private val lastSequence = AtomicReference<Long?>(null)
  @Volatile private var sessionId: String? = null
  private var connecting = false
  private var connected = false
  private var reconnectAttempt = 0
  private var connectionGeneration = 0L

  private val heartbeat = object : Runnable {
    override fun run() {
      val sequence = lastSequence.get()
      socket?.send(
        JSONObject()
          .put("op", 1)
          .put("d", sequence ?: JSONObject.NULL)
          .toString(),
      )
      handler.postDelayed(this, heartbeatIntervalMs)
    }
  }

  @Synchronized
  fun start(context: Context) {
    val appContext = context.applicationContext
    if (!PhoneEngineRuntimeRegistry.discordBotEnabled(appContext)) {
      stop(appContext)
      PhoneEngineRuntimeRegistry.markDiscordGatewayState(appContext, false, "bot_engine_disabled")
      return
    }

    val token = PhoneEngineRuntimeRegistry.discordBotToken(appContext)
    if (token.isBlank()) {
      stop(appContext)
      PhoneEngineRuntimeRegistry.markDiscordGatewayState(appContext, false, "bot_token_missing")
      return
    }

    if (connected || connecting) {
      return
    }

    connecting = true
    val socketGeneration = ++connectionGeneration
    PhoneEngineRuntimeRegistry.markDiscordGatewayState(appContext, false, "connecting")
    val request = Request.Builder().url(GATEWAY_URL).build()
    socket = client.newWebSocket(request, GatewayListener(appContext, token, socketGeneration))
  }

  @Synchronized
  fun restart(context: Context, allowResume: Boolean = true) {
    stop(context, clearResume = !allowResume, markState = false)
    start(context)
  }

  @Synchronized
  fun stop(context: Context) {
    stop(context, clearResume = true, markState = true)
  }

  @Synchronized
  fun reconfigure(context: Context) {
    val appContext = context.applicationContext
    val shouldRestart = connected || connecting || PhoneEngineRuntimeRegistry.isForegroundServiceActive()
    if (!shouldRestart) {
      PhoneEngineRuntimeRegistry.markDiscordGatewayState(appContext, false, "configuration_updated")
      return
    }

    stop(appContext, clearResume = true, markState = false)
    start(appContext)
  }

  private fun stop(context: Context, clearResume: Boolean, markState: Boolean) {
    handler.removeCallbacks(heartbeat)
    socket?.close(NORMAL_CLOSURE, "phone engine stopped")
    socket = null
    connectionGeneration += 1
    connecting = false
    connected = false
    if (clearResume) {
      lastSequence.set(null)
      sessionId = null
    }
    reconnectAttempt = 0
    if (markState) {
      PhoneEngineRuntimeRegistry.markDiscordGatewayState(context.applicationContext, false, "stopped")
    }
  }

  private fun scheduleHeartbeat(intervalMs: Long) {
    heartbeatIntervalMs = intervalMs.coerceAtLeast(5_000L)
    handler.removeCallbacks(heartbeat)
    handler.postDelayed(heartbeat, heartbeatIntervalMs)
  }

  private fun identify(webSocket: WebSocket, token: String) {
    val properties = JSONObject()
      .put("os", "android")
      .put("browser", "sentinel-nexus")
      .put("device", "sentinel-nexus")
    val payload = JSONObject()
      .put("token", token)
      .put("intents", DISCORD_INTENTS)
      .put("properties", properties)
    webSocket.send(JSONObject().put("op", 2).put("d", payload).toString())
  }

  private fun resume(webSocket: WebSocket, token: String, currentSessionId: String, sequence: Long) {
    val payload = JSONObject()
      .put("token", token)
      .put("session_id", currentSessionId)
      .put("seq", sequence)
    webSocket.send(JSONObject().put("op", 6).put("d", payload).toString())
  }

  @Synchronized
  private fun currentSocket(webSocket: WebSocket, generation: Long): Boolean =
    socket == webSocket && connectionGeneration == generation

  @Synchronized
  private fun currentGeneration(generation: Long): Boolean =
    connectionGeneration == generation

  private class GatewayListener(
    private val context: Context,
    private val token: String,
    private val generation: Long,
  ) : WebSocketListener() {
    override fun onOpen(webSocket: WebSocket, response: Response) {
      synchronized(DiscordGatewayWorker) {
        if (!currentSocket(webSocket, generation)) {
          return
        }
        connecting = false
        connected = true
        reconnectAttempt = 0
      }
      PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, true, "socket_open")
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
      if (!currentSocket(webSocket, generation)) {
        return
      }
      val payload = runCatching { JSONObject(text) }.getOrNull() ?: return
      if (!payload.isNull("s")) {
        lastSequence.set(payload.optLong("s"))
      }

      when (payload.optInt("op")) {
        10 -> {
          val interval = payload.optJSONObject("d")?.optLong("heartbeat_interval") ?: heartbeatIntervalMs
          scheduleHeartbeat(interval)
          val currentSessionId = sessionId
          val sequence = lastSequence.get()
          if (!currentSessionId.isNullOrBlank() && sequence != null) {
            resume(webSocket, token, currentSessionId, sequence)
            PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, true, "resuming")
          } else {
            identify(webSocket, token)
            PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, true, "identified")
          }
        }
        7 -> restart(context, allowResume = true)
        9 -> {
          val resumable = payload.optBoolean("d", false)
          if (!resumable) {
            sessionId = null
            lastSequence.set(null)
          }
          restart(context, allowResume = resumable)
        }
      }

      when (payload.optString("t")) {
        "READY" -> {
          val readySessionId = payload.optJSONObject("d")?.optString("session_id").orEmpty()
          if (readySessionId.isNotBlank()) {
            sessionId = readySessionId
          }
          PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, true, "ready_waiting_for_alert")
        }
        "RESUMED" -> PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, true, "session_resumed")
        "MESSAGE_CREATE" -> {
          val message = payload.optJSONObject("d")
          if (message != null && messageAllowed(context, message)) {
            PhoneEngineRuntimeRegistry.markDiscordAlertObserved(context, message)
          }
        }
      }
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
      synchronized(DiscordGatewayWorker) {
        if (!currentSocket(webSocket, generation)) {
          return
        }
        socket = null
        connecting = false
        connected = false
      }
      handler.removeCallbacks(heartbeat)
      val delayMs = synchronized(DiscordGatewayWorker) { nextReconnectDelayMs() }
      PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, false, "gateway_failure_backoff_${delayMs}ms")
      handler.postDelayed(
        {
          if (currentGeneration(generation)) {
            start(context)
          }
        },
        delayMs,
      )
    }

    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
      synchronized(DiscordGatewayWorker) {
        if (!currentSocket(webSocket, generation)) {
          return
        }
        socket = null
        connecting = false
        connected = false
      }
      handler.removeCallbacks(heartbeat)
      PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, false, "closed")
    }

    private fun messageAllowed(context: Context, message: JSONObject): Boolean {
      val configuredGuild = PhoneEngineRuntimeRegistry.discordGuildId(context)
      if (configuredGuild.isNotBlank() && message.optString("guild_id") != configuredGuild) {
        return false
      }

      val allowedChannels = PhoneEngineRuntimeRegistry.discordChannelAllowlist(context)
      if (allowedChannels.isNotEmpty() && !allowedChannels.contains(message.optString("channel_id"))) {
        return false
      }

      val allowedAuthors = PhoneEngineRuntimeRegistry.discordAuthorAllowlist(context)
      if (allowedAuthors.isNotEmpty()) {
        val authorId = message.optJSONObject("author")?.optString("id").orEmpty()
        if (!allowedAuthors.contains(authorId)) {
          return false
        }
      }

      return message.optString("content").isNotBlank()
    }
  }

  @Synchronized
  private fun nextReconnectDelayMs(): Long {
    val delay = 15_000L * (1L shl reconnectAttempt.coerceAtMost(4))
    reconnectAttempt += 1
    return delay.coerceAtMost(300_000L)
  }
}
