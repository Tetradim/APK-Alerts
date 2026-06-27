package com.tetradim.apkalerts.phoneengine

import com.facebook.react.bridge.Promise
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
}
