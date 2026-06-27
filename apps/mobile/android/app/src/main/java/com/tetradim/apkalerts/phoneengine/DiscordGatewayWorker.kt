package com.tetradim.apkalerts.phoneengine

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

object DiscordGatewayWorker {
  private const val GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json"
  private const val NORMAL_CLOSURE = 1000
  private const val DISCORD_INTENTS = 37376

  private val handler = Handler(Looper.getMainLooper())
  private val client = OkHttpClient.Builder()
    .pingInterval(30, TimeUnit.SECONDS)
    .retryOnConnectionFailure(true)
    .build()

  private var socket: WebSocket? = null
  private var heartbeatIntervalMs = 45_000L
  private var lastSequence: Long? = null
  private var connecting = false
  private var connected = false

  private val heartbeat = object : Runnable {
    override fun run() {
      socket?.send(JSONObject().put("op", 1).put("d", lastSequence).toString())
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
    PhoneEngineRuntimeRegistry.markDiscordGatewayState(appContext, false, "connecting")
    val request = Request.Builder().url(GATEWAY_URL).build()
    socket = client.newWebSocket(request, GatewayListener(appContext, token))
  }

  @Synchronized
  fun restart(context: Context) {
    stop(context)
    start(context)
  }

  @Synchronized
  fun stop(context: Context) {
    handler.removeCallbacks(heartbeat)
    socket?.close(NORMAL_CLOSURE, "phone engine stopped")
    socket = null
    connecting = false
    connected = false
    lastSequence = null
    PhoneEngineRuntimeRegistry.markDiscordGatewayState(context.applicationContext, false, "stopped")
  }

  private fun scheduleHeartbeat(intervalMs: Long) {
    heartbeatIntervalMs = intervalMs.coerceAtLeast(5_000L)
    handler.removeCallbacks(heartbeat)
    handler.postDelayed(heartbeat, heartbeatIntervalMs)
  }

  private fun identify(webSocket: WebSocket, token: String) {
    val properties = JSONObject()
      .put("os", "android")
      .put("browser", "apk-alerts")
      .put("device", "apk-alerts")
    val payload = JSONObject()
      .put("token", token)
      .put("intents", DISCORD_INTENTS)
      .put("properties", properties)
    webSocket.send(JSONObject().put("op", 2).put("d", payload).toString())
  }

  private class GatewayListener(
    private val context: Context,
    private val token: String,
  ) : WebSocketListener() {
    override fun onOpen(webSocket: WebSocket, response: Response) {
      synchronized(DiscordGatewayWorker) {
        connecting = false
        connected = true
      }
      PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, false, "socket_open")
    }

    override fun onMessage(webSocket: WebSocket, text: String) {
      val payload = runCatching { JSONObject(text) }.getOrNull() ?: return
      if (!payload.isNull("s")) {
        lastSequence = payload.optLong("s")
      }

      when (payload.optInt("op")) {
        10 -> {
          val interval = payload.optJSONObject("d")?.optLong("heartbeat_interval") ?: heartbeatIntervalMs
          scheduleHeartbeat(interval)
          identify(webSocket, token)
          PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, false, "identified")
        }
        7 -> restart(context)
        9 -> restart(context)
      }

      when (payload.optString("t")) {
        "READY" -> PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, true, "ready")
        "MESSAGE_CREATE" -> {
          if (messageAllowed(context, payload.optJSONObject("d"))) {
            PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, true, "message_create", hasEvent = true)
          }
        }
      }
    }

    override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
      synchronized(DiscordGatewayWorker) {
        socket = null
        connecting = false
        connected = false
      }
      handler.removeCallbacks(heartbeat)
      PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, false, "gateway_failure")
      handler.postDelayed({ start(context) }, 15_000L)
    }

    override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
      synchronized(DiscordGatewayWorker) {
        socket = null
        connecting = false
        connected = false
      }
      handler.removeCallbacks(heartbeat)
      PhoneEngineRuntimeRegistry.markDiscordGatewayState(context, false, "closed")
    }

    private fun messageAllowed(context: Context, message: JSONObject?): Boolean {
      if (message == null) {
        return false
      }

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
}
