package com.tetradim.apkalerts.phoneengine

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class PhoneEngineBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val action = intent.action
    if (action != Intent.ACTION_BOOT_COMPLETED) {
      return
    }

    if (PhoneEngineRuntimeRegistry.shouldRestartAfterBoot(context)) {
      PhoneEngineForegroundService.start(context)
    }
  }
}
