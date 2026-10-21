package com.spotdock.mobile

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.time.ZonedDateTime

internal object AlarmScheduler {
  private const val PREFS = "spotdock_alarms"
  private const val KEY = "alarms"
  const val ACTION_FIRE = "com.spotdock.mobile.ALARM_FIRE"
  const val ACTION_SNOOZE = "com.spotdock.mobile.ALARM_SNOOZE"
  const val EXTRA_ALARM = "alarm"

  fun stored(context: Context): JSONArray = try {
    JSONArray(context.getSharedPreferences(PREFS, 0).getString(KEY, "[]"))
  } catch (_: Exception) { JSONArray() }

  fun exactAllowed(context: Context): Boolean {
    val manager = context.getSystemService(AlarmManager::class.java)
    return Build.VERSION.SDK_INT < 31 || manager.canScheduleExactAlarms()
  }

  fun replace(context: Context, alarms: JSONArray) {
    val old = stored(context)
    val activeIds = (0 until alarms.length()).mapNotNull { alarms.optJSONObject(it) }
      .filter { it.optBoolean("enabled") }.map { it.optString("id") }.toSet()
    for (index in 0 until old.length()) old.optJSONObject(index)?.let {
      context.getSystemService(AlarmManager::class.java).cancel(intent(context, it, ACTION_FIRE))
      if (it.optString("id") !in activeIds) cancelSnooze(context, it)
    }
    context.getSharedPreferences(PREFS, 0).edit().putString(KEY, alarms.toString()).apply()
    for (index in 0 until alarms.length()) alarms.optJSONObject(index)?.let {
      schedule(context, it)
      restoreSnooze(context, it)
    }
  }

  fun restore(context: Context) {
    val alarms = stored(context)
    for (index in 0 until alarms.length()) alarms.optJSONObject(index)?.let {
      schedule(context, it)
      restoreSnooze(context, it)
    }
  }

  private fun intent(context: Context, alarm: JSONObject, action: String): PendingIntent {
    val id = alarm.getString("id")
    val trigger = Intent(context, AlarmReceiver::class.java).apply {
      this.action = action
      data = Uri.parse("spotdock://alarm/$id/$action")
      putExtra(EXTRA_ALARM, alarm.toString())
    }
    return PendingIntent.getBroadcast(context, 0, trigger,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun showIntent(context: Context, alarm: JSONObject): PendingIntent =
    PendingIntent.getActivity(context, alarm.getString("id").hashCode(),
      Intent(context, MainActivity::class.java).apply {
        action = Intent.ACTION_MAIN
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  private fun cancelSnooze(context: Context, alarm: JSONObject) {
    context.getSystemService(AlarmManager::class.java).cancel(intent(context, alarm, ACTION_SNOOZE))
    context.getSharedPreferences(PREFS, 0).edit().remove("snooze_${alarm.optString("id")}").apply()
  }

  private fun restoreSnooze(context: Context, alarm: JSONObject) {
    val id = alarm.optString("id")
    val at = context.getSharedPreferences(PREFS, 0).getLong("snooze_$id", 0L)
    if (at <= System.currentTimeMillis() || !alarm.optBoolean("enabled")) {
      if (at > 0) cancelSnooze(context, alarm)
      return
    }
    val pending = intent(context, alarm, ACTION_SNOOZE)
    scheduleAt(context, alarm, at, pending)
  }

  fun schedule(context: Context, alarm: JSONObject) {
    val days = alarm.optJSONArray("days") ?: return
    if (!alarm.optBoolean("enabled") || days.length() == 0) return
    val parts = alarm.optString("time").split(":")
    if (parts.size != 2) return
    val hour = parts[0].toIntOrNull() ?: return
    val minute = parts[1].toIntOrNull() ?: return
    val now = ZonedDateTime.now()
    val monday = now.dayOfWeek.value - 1
    val selected = (0 until days.length()).map { days.optInt(it, -1) }.toSet()
    val next = (0..7).map { offset ->
      now.plusDays(offset.toLong()).withHour(hour).withMinute(minute).withSecond(0).withNano(0)
    }.firstOrNull { it.isAfter(now) && ((monday + java.time.temporal.ChronoUnit.DAYS.between(now.toLocalDate(), it.toLocalDate()).toInt()) % 7) in selected }
      ?: return
    val pending = intent(context, alarm, ACTION_FIRE)
    scheduleAt(context, alarm, next.toInstant().toEpochMilli(), pending)
  }

  fun snooze(context: Context, alarm: JSONObject) {
    val minutes = alarm.optInt("snoozeMinutes", 0)
    if (minutes <= 0) return
    val pending = intent(context, alarm, ACTION_SNOOZE)
    val at = System.currentTimeMillis() + minutes * 60_000L
    context.getSharedPreferences(PREFS, 0).edit().putLong("snooze_${alarm.optString("id")}", at).apply()
    scheduleAt(context, alarm, at, pending)
  }

  private fun scheduleAt(context: Context, alarm: JSONObject, at: Long, pending: PendingIntent) {
    val manager = context.getSystemService(AlarmManager::class.java)
    if (exactAllowed(context)) {
      try {
        manager.setAlarmClock(AlarmManager.AlarmClockInfo(at, showIntent(context, alarm)), pending)
        return
      } catch (_: SecurityException) {
        // The special access can be revoked between checking and scheduling.
      }
    }
    // Still ring if exact access is unavailable; Android may delay this fallback in Doze.
    manager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending)
  }
}

class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    when (intent.action) {
      Intent.ACTION_BOOT_COMPLETED, Intent.ACTION_TIME_CHANGED,
      Intent.ACTION_TIMEZONE_CHANGED, Intent.ACTION_MY_PACKAGE_REPLACED,
      AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED ->
        try { AlarmScheduler.restore(context) }
        catch (error: RuntimeException) { Log.e("SpotDock", "Could not restore alarms", error) }
      AlarmScheduler.ACTION_FIRE, AlarmScheduler.ACTION_SNOOZE -> {
        val alarm = try { JSONObject(intent.getStringExtra(AlarmScheduler.EXTRA_ALARM) ?: "") }
          catch (_: Exception) { return }
        // The next weekly occurrence is registered before the alarm UI starts.
        if (intent.action == AlarmScheduler.ACTION_FIRE) {
          try { AlarmScheduler.schedule(context, alarm) }
          catch (error: RuntimeException) {
            Log.e("SpotDock", "Could not schedule next alarm occurrence", error)
          }
        }
        else context.getSharedPreferences("spotdock_alarms", 0).edit()
          .remove("snooze_${alarm.optString("id")}").apply()
        val service = Intent(context, AlarmService::class.java).apply {
          action = AlarmService.ACTION_START
          putExtra(AlarmScheduler.EXTRA_ALARM, alarm.toString())
        }
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service)
        else context.startService(service)
      }
    }
  }
}
