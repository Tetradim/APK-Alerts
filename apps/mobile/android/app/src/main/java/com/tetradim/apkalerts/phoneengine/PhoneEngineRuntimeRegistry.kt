package com.tetradim.apkalerts.phoneengine

import android.content.Context
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
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
  private var discordGatewayReady = false
  private var discordGatewayStatus = "not_started"
  private var discordLastGatewayEventAt = ""
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
  fun markDiscordGatewayState(context: Context, ready: Boolean, status: String, hasEvent: Boolean = false) {
    discordGatewayReady = ready
    discordGatewayStatus = status
    if (hasEvent) {
      discordLastGatewayEventAt = nowIso()
    }
    refreshAdapterState(context)
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
      putBoolean("brokerEngineReady", brokerEngineReady)
      putBoolean("liveExecutionArmed", liveExecutionArmed)
      putString("health", health)
      putString("lastHeartbeatAt", lastHeartbeatAt)
      putString("blockingReason", blockingReason)
    }
  }

  private fun refreshAdapterState(context: Context) {
    val preferences = preferences(context)
    val botEnabled = preferences.getBoolean(KEY_DISCORD_BOT_ENABLED, true)
    val botTokenPresent = preferences.getString(KEY_DISCORD_BOT_TOKEN, "")?.trim()?.isNotEmpty() == true
    val webViewEnabled = preferences.getBoolean(KEY_DISCORD_WEBVIEW_ENABLED, true)
    val foregroundEnabled = preferences.getBoolean(KEY_FOREGROUND_KEEPALIVE_ENABLED, true)
    discordEngineReady = preferences.getBoolean(KEY_DISCORD_ENGINE_READY, false) ||
      (botEnabled && botTokenPresent && discordGatewayReady) ||
      webViewEnabled ||
      foregroundEnabled
    brokerEngineReady = preferences.getBoolean(KEY_BROKER_ENGINE_READY, false)
    liveExecutionArmed = preferences.getBoolean(KEY_LIVE_EXECUTION_ARMED, false)
  }

  private fun preferences(context: Context) =
    context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  private fun nowIso(): String = synchronized(isoFormatter) {
    isoFormatter.format(Date())
  }

  private fun csvSet(value: String): Set<String> =
    value.split(",")
      .map { it.trim() }
      .filter { it.isNotEmpty() }
      .toSet()
}
