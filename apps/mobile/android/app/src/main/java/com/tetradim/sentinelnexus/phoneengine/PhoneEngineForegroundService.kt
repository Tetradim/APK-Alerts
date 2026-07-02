package com.tetradim.sentinelnexus.phoneengine

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import com.tetradim.sentinelnexus.R

class PhoneEngineForegroundService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var wakeLock: PowerManager.WakeLock? = null

  private val heartbeat = object : Runnable {
    override fun run() {
      PhoneEngineRuntimeRegistry.markHeartbeat(this@PhoneEngineForegroundService)
      handler.postDelayed(this, HEARTBEAT_INTERVAL_MS)
    }
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    PhoneEngineRuntimeRegistry.markStartRequested(this)
    startForeground(NOTIFICATION_ID, buildNotification())
    acquireWakeLock()
    PhoneEngineRuntimeRegistry.markHeartbeat(this)
    DiscordGatewayWorker.start(this)
    PeerAlertChallengeServer.start(this)
    handler.removeCallbacks(heartbeat)
    handler.postDelayed(heartbeat, HEARTBEAT_INTERVAL_MS)
    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(heartbeat)
    PeerAlertChallengeServer.stop(this)
    DiscordGatewayWorker.stop(this)
    releaseWakeLock()
    PhoneEngineRuntimeRegistry.markStopped(this)
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) {
      return
    }

    val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
    wakeLock = powerManager.newWakeLock(
      PowerManager.PARTIAL_WAKE_LOCK,
      "APKAlerts::PhoneEngineForegroundService",
    ).apply {
      setReferenceCounted(false)
      acquire()
    }
  }

  private fun releaseWakeLock() {
    val currentWakeLock = wakeLock
    if (currentWakeLock?.isHeld == true) {
      currentWakeLock.release()
    }
    wakeLock = null
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }

    val channel = NotificationChannel(
      CHANNEL_ID,
      "Sentinel Nexus phone engine",
      NotificationManager.IMPORTANCE_LOW,
    ).apply {
      description = "Keeps the Sentinel Nexus engine alive for alert ingestion and broker reconciliation."
      setShowBadge(false)
    }

    val notificationManager = getSystemService(NotificationManager::class.java)
    notificationManager.createNotificationChannel(channel)
  }

  private fun buildNotification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setContentTitle("Sentinel Nexus phone engine")
      .setContentText("Foreground runtime is supervising Discord and broker adapters.")
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setShowWhen(true)
      .build()
  }

  companion object {
    private const val CHANNEL_ID = "apk_alerts_phone_engine"
    private const val NOTIFICATION_ID = 42017
    private const val HEARTBEAT_INTERVAL_MS = 15_000L

    fun start(context: Context) {
      val intent = Intent(context, PhoneEngineForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(intent)
      } else {
        context.startService(intent)
      }
    }

    fun stop(context: Context) {
      val intent = Intent(context, PhoneEngineForegroundService::class.java)
      context.stopService(intent)
    }
  }
}
