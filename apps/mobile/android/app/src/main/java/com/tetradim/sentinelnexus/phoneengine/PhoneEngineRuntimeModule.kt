package com.tetradim.sentinelnexus.phoneengine

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class PhoneEngineRuntimeModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "PhoneEngineRuntime"

  @ReactMethod
  fun getStatus(promise: Promise) {
    PhoneEngineRuntimeRegistry.initialize(reactContext)
    promise.resolve(PhoneEngineRuntimeRegistry.snapshot(reactContext))
  }

  @ReactMethod
  fun start(promise: Promise) {
    try {
      PhoneEngineRuntimeRegistry.markStartRequested(reactContext)
      PhoneEngineForegroundService.start(reactContext)
      promise.resolve(PhoneEngineRuntimeRegistry.snapshot(reactContext))
    } catch (error: Exception) {
      PhoneEngineRuntimeRegistry.markStopped(reactContext)
      promise.reject("PHONE_ENGINE_START_FAILED", error)
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      PhoneEngineForegroundService.stop(reactContext)
      PhoneEngineRuntimeRegistry.markStopped(reactContext)
      promise.resolve(PhoneEngineRuntimeRegistry.snapshot(reactContext))
    } catch (error: Exception) {
      promise.reject("PHONE_ENGINE_STOP_FAILED", error)
    }
  }

  @ReactMethod
  fun configureDiscordIngestion(settings: ReadableMap, promise: Promise) {
    try {
      PhoneEngineRuntimeRegistry.configureDiscordIngestion(
        reactContext,
        stringValue(settings, "botToken"),
        stringValue(settings, "guildId"),
        stringValue(settings, "channelAllowlist"),
        stringValue(settings, "authorAllowlist"),
        booleanValue(settings, "webViewEnabled", true),
        booleanValue(settings, "botEngineEnabled", true),
        booleanValue(settings, "foregroundServiceEnabled", true),
        routePriorityValue(
          if (settings.hasKey("routePriority") && !settings.isNull("routePriority")) {
            settings.getArray("routePriority")
          } else {
            null
          },
        ),
      )
      DiscordGatewayWorker.reconfigure(reactContext)
      promise.resolve(PhoneEngineRuntimeRegistry.snapshot(reactContext))
    } catch (error: Exception) {
      promise.reject("PHONE_ENGINE_DISCORD_CONFIG_FAILED", error)
    }
  }

  private fun stringValue(settings: ReadableMap, key: String): String {
    return if (settings.hasKey(key) && !settings.isNull(key)) {
      settings.getString(key)?.trim().orEmpty()
    } else {
      ""
    }
  }

  private fun booleanValue(settings: ReadableMap, key: String, defaultValue: Boolean): Boolean {
    return if (settings.hasKey(key) && !settings.isNull(key)) {
      settings.getBoolean(key)
    } else {
      defaultValue
    }
  }

  private fun routePriorityValue(routePriority: ReadableArray?): String {
    if (routePriority == null) {
      return "bot_engine,webview"
    }

    val values = mutableListOf<String>()
    for (index in 0 until routePriority.size()) {
      val value = routePriority.getString(index)
      if (value == "bot_engine" || value == "webview") {
        values.add(value)
      }
    }
    listOf("bot_engine", "webview").forEach { route ->
      if (!values.contains(route)) {
        values.add(route)
      }
    }
    return values.joinToString(",")
  }
}
