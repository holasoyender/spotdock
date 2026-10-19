package com.spotdock.mobile

import android.app.Notification
import android.app.ActivityManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import org.json.JSONObject

class AlarmService : Service() {
  companion object {
    const val ACTION_START = "com.spotdock.mobile.ALARM_START"
    const val ACTION_STOP = "com.spotdock.mobile.ALARM_STOP"
    const val ACTION_SNOOZE = "com.spotdock.mobile.ALARM_SNOOZE_SERVICE"
    const val ACTION_ENDED = "com.spotdock.mobile.ALARM_ENDED"
    const val EXTRA_SLIDE_CONFIRMED = "slide_confirmed"
    private const val CHANNEL = "spotdock_alarm"
    private const val NOTIFICATION_ID = 8041
  }

  private var player: MediaPlayer? = null
  private var ringtone: Ringtone? = null
  private var vibrator: Vibrator? = null
  private var active: JSONObject? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        val alarm = try { JSONObject(intent.getStringExtra(AlarmScheduler.EXTRA_ALARM) ?: "") }
          catch (_: Exception) { stopSelf(); return START_NOT_STICKY }
        stopSound()
        active = alarm
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.alarm_channel),
          NotificationManager.IMPORTANCE_HIGH).apply {
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
          setSound(null, null)
          enableVibration(false)
        })
        val screen = Intent(this, AlarmActivity::class.java).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
          putExtra(AlarmScheduler.EXTRA_ALARM, alarm.toString())
        }
        val fullScreen = PendingIntent.getActivity(this, 0, screen,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = Notification.Builder(this, CHANNEL)
          .setSmallIcon(R.mipmap.ic_launcher)
          .setContentTitle(alarm.optString("title").ifBlank { getString(R.string.alarm_default_title) })
          .setContentText(alarm.optString("message").ifBlank { getString(R.string.alarm_default_title) })
          .setCategory(Notification.CATEGORY_ALARM)
          .setVisibility(Notification.VISIBILITY_PUBLIC)
          .setOngoing(true)
          .setContentIntent(fullScreen)
          .setFullScreenIntent(fullScreen, true)
        if (alarm.optString("dismissMode") == "tap") {
          builder.addAction(Notification.Action.Builder(null, getString(R.string.alarm_dismiss),
            actionIntent(ACTION_STOP)).build())
        }
        if (alarm.optInt("snoozeMinutes") > 0) {
          builder.addAction(Notification.Action.Builder(null, getString(R.string.alarm_snooze), actionIntent(ACTION_SNOOZE)).build())
        }
        if (Build.VERSION.SDK_INT >= 29)
          startForeground(NOTIFICATION_ID, builder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
        else startForeground(NOTIFICATION_ID, builder.build())
        play(alarm)
        val process = ActivityManager.RunningAppProcessInfo()
        ActivityManager.getMyMemoryState(process)
        if (process.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND) {
          try { startActivity(screen) } catch (_: Exception) { /* The full-screen intent remains available. */ }
        }
      }
      ACTION_STOP, ACTION_SNOOZE -> {
        if (intent.action == ACTION_SNOOZE) active?.let { AlarmScheduler.snooze(this, it) }
        stopSound()
        if (intent.getBooleanExtra(EXTRA_SLIDE_CONFIRMED, false)) confirmSlide()
        active = null
        sendBroadcast(Intent(ACTION_ENDED).setPackage(packageName))
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
      }
    }
    return START_NOT_STICKY
  }

  private fun actionIntent(action: String): PendingIntent {
    return PendingIntent.getService(this, action.hashCode(), Intent(this, AlarmService::class.java).apply {
      this.action = action
    }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun play(alarm: JSONObject) {
    val usage = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build()
    try {
      if (alarm.optString("tone") == "system") {
        val uri = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_ALARM)
          ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
        ringtone = RingtoneManager.getRingtone(this, uri)
        if (ringtone == null) playBundled(R.raw.alarm_classic, usage)
        else ringtone?.apply {
          audioAttributes = usage
          if (Build.VERSION.SDK_INT >= 28) isLooping = true
          play()
        }
      } else {
        val raw = when (alarm.optString("tone")) {
          "gentle" -> R.raw.alarm_gentle
          "urgent" -> R.raw.alarm_urgent
          else -> R.raw.alarm_classic
        }
        playBundled(raw, usage)
      }
    } catch (_: Exception) {
      stopSound()
      try { playBundled(R.raw.alarm_classic, usage) } catch (_: Exception) { /* Vibration still works. */ }
    }
    vibrator = if (Build.VERSION.SDK_INT >= 31)
      getSystemService(VibratorManager::class.java).defaultVibrator
    else @Suppress("DEPRECATION") getSystemService(VIBRATOR_SERVICE) as Vibrator
    val pattern = longArrayOf(0, 500, 450, 500, 1200)
    vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0))
  }

  private fun playBundled(raw: Int, usage: AudioAttributes) {
    resources.openRawResourceFd(raw)?.use { descriptor ->
      player = MediaPlayer().apply {
        setAudioAttributes(usage)
        setDataSource(descriptor.fileDescriptor, descriptor.startOffset, descriptor.length)
        isLooping = true
        prepare()
        start()
      }
    }
  }

  private fun stopSound() {
    ringtone?.stop(); ringtone = null
    player?.run { stop(); release() }; player = null
    vibrator?.cancel(); vibrator = null
  }

  private fun confirmSlide() {
    val haptic = if (Build.VERSION.SDK_INT >= 31)
      getSystemService(VibratorManager::class.java).defaultVibrator
    else @Suppress("DEPRECATION") getSystemService(VIBRATOR_SERVICE) as Vibrator
    if (Build.VERSION.SDK_INT >= 26)
      haptic.vibrate(VibrationEffect.createOneShot(45, VibrationEffect.DEFAULT_AMPLITUDE))
    else @Suppress("DEPRECATION") haptic.vibrate(45)
  }

  override fun onDestroy() {
    stopSound()
    super.onDestroy()
  }
}
