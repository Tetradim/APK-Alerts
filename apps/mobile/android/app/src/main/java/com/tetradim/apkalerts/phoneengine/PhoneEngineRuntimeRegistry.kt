package com.tetradim.apkalerts.phoneengine

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import org.json.JSONObject
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

object PhoneEngineRuntimeRegistry {
  private const val PREFERENCES_NAME = "apk_alerts_phone_engine_runtime"
  private const val KEY_SERVICE_ENABLED = "service_enabled"
  private const val KEY_DISCORD_ENGINE_READY = "discord_engine_ready"
  private const val KEY_BROKER_ENGINE_READY = "broker_engine_ready"
  private const val KEY_LIVE_EXECUTION_ARMED = "live_execution_armed"
  private const val KEY_DISCORD_BOT_TOKEN = "discord_bot_token"
  private const val KEY_DISCORD_BOT_ENABLED = "discord_bot_enabled"
  private const val KEY_DISCORD_WEBVIEW_ENABLED = "discord_webview_enabled"
  private const val KEY_FOREGROUND_KEEPALIVE_ENABLED = "foreground_keepalive_enabled"
  private const val KEY_DISCORD_ROUTE_PRIORITY = "discord_route_priority"
  private const val KEY_DISCORD_GUILD_ID = "discord_guild_id"
  private const val KEY_DISCORD_CHANNEL_ALLOWLIST = "discord_channel_allowlist"
  private const val KEY_DISCORD_AUTHOR_ALLOWLIST = "discord_author_allowlist"
  private const val ROUTE_BOT_ENGINE = "bot_engine"
  private const val ROUTE_WEBVIEW = "webview"
  private const val ROUTE_FOREGROUND_SERVICE = "foreground_service"

  private val isoFormatter = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
  }

  private var nativeRuntimeAvailable = true
  private var serviceEnabled = false
  private var foregroundServiceActive = false
  private var discordEngineEmbedded = true
  private var brokerEngineEmbedded = true
  private var discordEngineReady = false
  private var brokerEngineReady = false
  private var liveExecutionArmed = false
  private var discordGatewayConnected = false
  private var discordIngestionEvidenceReady = false
  private var discordGatewayStatus = "not_started"
  private var discordLastAlertObservedAt = ""
  private var discordLastAlertReceivedAt = ""
  private var discordLastAlertMessageId = ""
  private var discordLastAlertGuildId = ""
  private var discordLastAlertChannelId = ""
  private var discordLastAlertAuthorId = ""
  private var discordLastAlertMessageUrl = ""
  private var discordLastAlertTextSha256 = ""
  private var peerAlertServerActive = false
  private var peerAlertServerStatus = "not_started"
  private var health = "offline"
  private var lastHeartbeatAt = ""
  private var blockingReason = "Foreground service stopped."

  @Synchronized
  fun initialize(context: Context) {
    if (foregroundServiceActive) {
      refreshAdapterState(context)
      return
    }

    serviceEnabled = preferences(context).getBoolean(KEY_SERVICE_ENABLED, false)
    refreshAdapterState(context)
    foregroundServiceActive = false
    health = if (serviceEnabled) "degraded" else "offline"
    blockingReason = if (serviceEnabled) {
      "Foreground service is enabled but not active."
    } else {
      "Foreground service stopped."
    }
  }

  @Synchronized
  fun shouldRestartAfterBoot(context: Context): Boolean {
    return preferences(context).getBoolean(KEY_SERVICE_ENABLED, false) &&
      preferences(context).getBoolean(KEY_FOREGROUND_KEEPALIVE_ENABLED, true)
  }

  @Synchronized
  fun configureDiscordIngestion(
    context: Context,
    botToken: String,
    guildId: String,
    channelAllowlist: String,
    authorAllowlist: String,
    webViewEnabled: Boolean,
    botEngineEnabled: Boolean,
    foregroundKeepaliveEnabled: Boolean,
    routePriority: String,
  ) {
    preferences(context).edit()
      .putString(KEY_DISCORD_BOT_TOKEN, botToken.trim())
      .putString(KEY_DISCORD_GUILD_ID, guildId.trim())
      .putString(KEY_DISCORD_CHANNEL_ALLOWLIST, channelAllowlist.trim())
      .putString(KEY_DISCORD_AUTHOR_ALLOWLIST, authorAllowlist.trim())
      .putBoolean(KEY_DISCORD_WEBVIEW_ENABLED, webViewEnabled)
      .putBoolean(KEY_DISCORD_BOT_ENABLED, botEngineEnabled)
      .putBoolean(KEY_FOREGROUND_KEEPALIVE_ENABLED, foregroundKeepaliveEnabled)
      .putString(KEY_DISCORD_ROUTE_PRIORITY, routePriority)
      .apply()
    refreshAdapterState(context)
  }

  @Synchronized
  fun markStartRequested(context: Context) {
    preferences(context).edit().putBoolean(KEY_SERVICE_ENABLED, true).apply()
    serviceEnabled = true
    foregroundServiceActive = false
    refreshAdapterState(context)
    health = "degraded"
    blockingReason = "Foreground service start requested; waiting for heartbeat."
  }

  @Synchronized
  fun markHeartbeat(context: Context) {
    serviceEnabled = true
    foregroundServiceActive = true
    refreshAdapterState(context)
    lastHeartbeatAt = nowIso()

    val adaptersReady = discordEngineEmbedded &&
      brokerEngineEmbedded &&
      discordEngineReady &&
      brokerEngineReady
    health = if (adaptersReady) "healthy" else "degraded"
    blockingReason = if (adaptersReady) {
      ""
    } else if (!discordEngineReady && !brokerEngineReady) {
      "Native Discord and broker adapters are not ready."
    } else if (!discordEngineReady) {
      "Native Discord adapter is not ready."
    } else {
      "Native broker adapter is not ready."
    }
  }

  @Synchronized
  fun markStopped(context: Context) {
    preferences(context).edit().putBoolean(KEY_SERVICE_ENABLED, false).apply()
    serviceEnabled = false
    foregroundServiceActive = false
    refreshAdapterState(context)
    health = "offline"
    blockingReason = "Foreground service stopped."
  }

  @Synchronized
  fun markDiscordGatewayState(context: Context, connected: Boolean, status: String, hasEvent: Boolean = false) {
    discordGatewayConnected = connected
    discordGatewayStatus = status
    if (hasEvent) {
      discordIngestionEvidenceReady = true
      discordLastAlertObservedAt = nowIso()
    }
    refreshAdapterState(context)
  }

  @Synchronized
  fun markDiscordAlertObserved(context: Context, message: JSONObject) {
    val observedAt = nowIso()
    val guildId = message.optString("guild_id")
    val channelId = message.optString("channel_id")
    val messageId = message.optString("id")
    val authorId = message.optJSONObject("author")?.optString("id").orEmpty()
    val content = message.optString("content")

    discordGatewayConnected = true
    discordIngestionEvidenceReady = true
    discordGatewayStatus = "message_create"
    discordLastAlertObservedAt = observedAt
    discordLastAlertReceivedAt = observedAt
    discordLastAlertGuildId = guildId
    discordLastAlertChannelId = channelId
    discordLastAlertMessageId = messageId
    discordLastAlertAuthorId = authorId
    discordLastAlertMessageUrl = discordMessageUrl(guildId, channelId, messageId)
    discordLastAlertTextSha256 = sha256(normalizeAlertText(content))
    refreshAdapterState(context)
  }

  @Synchronized
  fun markPeerAlertServerState(context: Context, active: Boolean, status: String) {
    peerAlertServerActive = active
    peerAlertServerStatus = status
    refreshAdapterState(context)
  }

  @Synchronized
  fun lastAlertSnapshotJson(): JSONObject? {
    if (discordLastAlertMessageId.isBlank() || discordLastAlertChannelId.isBlank()) {
      return null
    }

    val fingerprint = JSONObject()
      .put("eventId", "phone-discord:${discordLastAlertMessageId}")
      .put("discordMessageId", discordLastAlertMessageId)
      .put("channelId", discordLastAlertChannelId)
      .put("authorId", discordLastAlertAuthorId.ifBlank { JSONObject.NULL })
      .put("messageUrl", discordLastAlertMessageUrl)
      .put("normalizedTextSha256", discordLastAlertTextSha256)
      .put("sourceKey", discordLastAlertChannelId)
      .put("parserConfidence", "none")
      .put("decisionStatus", "unknown")
      .put("queuedAlertId", "")

    return JSONObject()
      .put("observedAt", discordLastAlertObservedAt)
      .put("receivedAt", discordLastAlertReceivedAt)
      .put("fingerprint", fingerprint)
  }

  @Synchronized
  fun discordBotToken(context: Context): String {
    return preferences(context).getString(KEY_DISCORD_BOT_TOKEN, "")?.trim().orEmpty()
  }

  @Synchronized
  fun discordBotEnabled(context: Context): Boolean {
    return preferences(context).getBoolean(KEY_DISCORD_BOT_ENABLED, true)
  }

  @Synchronized
  fun discordGuildId(context: Context): String {
    return preferences(context).getString(KEY_DISCORD_GUILD_ID, "")?.trim().orEmpty()
  }

  @Synchronized
  fun discordChannelAllowlist(context: Context): Set<String> {
    return csvSet(preferences(context).getString(KEY_DISCORD_CHANNEL_ALLOWLIST, "").orEmpty())
  }

  @Synchronized
  fun discordAuthorAllowlist(context: Context): Set<String> {
    return csvSet(preferences(context).getString(KEY_DISCORD_AUTHOR_ALLOWLIST, "").orEmpty())
  }

  @Synchronized
  fun snapshot(context: Context): WritableMap {
    refreshAdapterState(context)
    return Arguments.createMap().apply {
      putBoolean("nativeRuntimeAvailable", nativeRuntimeAvailable)
      putBoolean("serviceEnabled", serviceEnabled)
      putBoolean("foregroundServiceActive", foregroundServiceActive)
      putBoolean("discordEngineEmbedded", discordEngineEmbedded)
      putBoolean("brokerEngineEmbedded", brokerEngineEmbedded)
      putBoolean("discordEngineReady", discordEngineReady)
      putBoolean("discordGatewayConnected", discordGatewayConnected)
      putBoolean("discordIngestionEvidenceReady", discordIngestionEvidenceReady)
      putString("discordGatewayStatus", discordGatewayStatus)
      putString("discordLastAlertObservedAt", discordLastAlertObservedAt)
      putBoolean("peerAlertServerActive", peerAlertServerActive)
      putString("peerAlertServerStatus", peerAlertServerStatus)
      putInt("peerAlertServerPort", PeerAlertChallengeServer.PORT)
      putBoolean("brokerEngineReady", brokerEngineReady)
      putBoolean("liveExecutionArmed", liveExecutionArmed)
      putString("health", health)
      putString("lastHeartbeatAt", lastHeartbeatAt)
      putString("blockingReason", blockingReason)
    }
  }

  private fun refreshAdapterState(context: Context) {
    val preferences = preferences(context)
    discordEngineReady = preferences.getBoolean(KEY_DISCORD_ENGINE_READY, false) ||
      discordRoutePriority(preferences).any { routeReady(it, preferences) }
    brokerEngineReady = preferences.getBoolean(KEY_BROKER_ENGINE_READY, false)
    liveExecutionArmed = preferences.getBoolean(KEY_LIVE_EXECUTION_ARMED, false)
  }

  private fun discordRoutePriority(preferences: android.content.SharedPreferences): List<String> {
    val stored = preferences.getString(
      KEY_DISCORD_ROUTE_PRIORITY,
      "$ROUTE_BOT_ENGINE,$ROUTE_WEBVIEW,$ROUTE_FOREGROUND_SERVICE",
    ).orEmpty()
    val normalized = mutableListOf<String>()
    stored.split(",")
      .map { it.trim() }
      .filter { it == ROUTE_BOT_ENGINE || it == ROUTE_WEBVIEW || it == ROUTE_FOREGROUND_SERVICE }
      .forEach { route ->
        if (!normalized.contains(route)) {
          normalized.add(route)
        }
      }
    listOf(ROUTE_BOT_ENGINE, ROUTE_WEBVIEW, ROUTE_FOREGROUND_SERVICE).forEach { route ->
      if (!normalized.contains(route)) {
        normalized.add(route)
      }
    }
    return normalized
  }

  private fun routeReady(route: String, preferences: android.content.SharedPreferences): Boolean {
    return when (route) {
      ROUTE_BOT_ENGINE -> {
        val botEnabled = preferences.getBoolean(KEY_DISCORD_BOT_ENABLED, true)
        val botTokenPresent = preferences.getString(KEY_DISCORD_BOT_TOKEN, "")?.trim()?.isNotEmpty() == true
        botEnabled && botTokenPresent && discordGatewayConnected && discordIngestionEvidenceReady
      }
      ROUTE_WEBVIEW -> false
      ROUTE_FOREGROUND_SERVICE -> false
      else -> false
    }
  }

  private fun preferences(context: Context) =
    context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  private fun nowIso(): String = synchronized(isoFormatter) {
    isoFormatter.format(Date())
  }

  private fun discordMessageUrl(guildId: String, channelId: String, messageId: String): String {
    if (channelId.isBlank() || messageId.isBlank()) {
      return ""
    }
    val server = guildId.ifBlank { "@me" }
    return "https://discord.com/channels/$server/$channelId/$messageId"
  }

  private fun normalizeAlertText(value: String): String =
    value.trim().lowercase(Locale.US).replace(Regex("\\s+"), " ")

  private fun sha256(value: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(Charsets.UTF_8))
    return digest.joinToString("") { byte -> "%02x".format(byte) }
  }

  private fun csvSet(value: String): Set<String> =
    value.split(",")
      .map { it.trim() }
      .filter { it.isNotEmpty() }
      .toSet()
}
