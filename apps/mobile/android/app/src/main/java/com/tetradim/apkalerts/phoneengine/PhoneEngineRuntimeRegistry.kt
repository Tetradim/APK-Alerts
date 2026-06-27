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
    return preferences(context).getBoolean(KEY_SERVICE_ENABLED, false)
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
    } else {
      "Native Discord and broker adapters are embedded but not configured."
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
    discordEngineReady = preferences.getBoolean(KEY_DISCORD_ENGINE_READY, false)
    brokerEngineReady = preferences.getBoolean(KEY_BROKER_ENGINE_READY, false)
    liveExecutionArmed = preferences.getBoolean(KEY_LIVE_EXECUTION_ARMED, false)
  }

  private fun preferences(context: Context) =
    context.applicationContext.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  private fun nowIso(): String = synchronized(isoFormatter) {
    isoFormatter.format(Date())
  }
}
