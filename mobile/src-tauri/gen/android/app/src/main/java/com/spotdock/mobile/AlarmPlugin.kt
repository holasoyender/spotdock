package com.spotdock.mobile

import android.app.Activity
import android.app.NotificationManager
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray
import org.json.JSONObject

@TauriPlugin
class AlarmPlugin(private val activity: Activity) : Plugin(activity) {
  private fun permissionStatus(): JSObject = JSObject().apply {
    put("exactAllowed", AlarmScheduler.exactAllowed(activity))
    put("fullScreenAllowed", Build.VERSION.SDK_INT < 34 ||
      activity.getSystemService(NotificationManager::class.java).canUseFullScreenIntent())
    put("notificationsAllowed", Build.VERSION.SDK_INT < 33 ||
      activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
  }

  @Command
  fun sync(invoke: Invoke) {
    try {
      val alarms = invoke.getArgs().getJSONArray("alarms")
      AlarmScheduler.replace(activity, alarms)
      if (Build.VERSION.SDK_INT >= 33 && alarms.length() > 0 &&
          activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
        activity.runOnUiThread { activity.requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1002) }
      }
      invoke.resolve(permissionStatus())
    } catch (error: Exception) { invoke.reject(error.message ?: "Could not schedule alarms") }
  }

  @Command
  fun status(invoke: Invoke) {
    invoke.resolve(permissionStatus())
  }

  @Command
  fun requestExact(invoke: Invoke) {
    AlarmScheduler.requestExactPermission(activity)
    invoke.resolve()
  }

  @Command
  fun requestFullScreen(invoke: Invoke) {
    if (Build.VERSION.SDK_INT >= 34 &&
        !activity.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()) {
      activity.startActivity(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT).apply {
        data = Uri.parse("package:${activity.packageName}")
      })
    }
    invoke.resolve()
  }

  @Command
  fun requestNotifications(invoke: Invoke) {
    if (Build.VERSION.SDK_INT >= 33 &&
        activity.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      activity.startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
        putExtra(Settings.EXTRA_APP_PACKAGE, activity.packageName)
      })
    }
    invoke.resolve()
  }

  @Command
  fun test(invoke: Invoke) {
    try {
      val alarm = invoke.getArgs().getJSONObject("alarm")
      val service = Intent(activity, AlarmService::class.java).apply {
        action = AlarmService.ACTION_START
        putExtra(AlarmScheduler.EXTRA_ALARM, alarm.toString())
      }
      if (Build.VERSION.SDK_INT >= 26) activity.startForegroundService(service)
      else activity.startService(service)
      invoke.resolve()
    } catch (error: Exception) { invoke.reject(error.message ?: "Could not test alarm") }
  }
}
