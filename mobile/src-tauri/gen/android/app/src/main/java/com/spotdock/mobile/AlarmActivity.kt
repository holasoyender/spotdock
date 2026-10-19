package com.spotdock.mobile

import android.app.Activity
import android.animation.ValueAnimator
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ClipDrawable
import android.graphics.drawable.GradientDrawable
import android.graphics.drawable.LayerDrawable
import android.os.Build
import android.os.Bundle
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.SeekBar
import android.widget.TextView
import org.json.JSONObject

/** A native alarm screen remains usable when the Tauri WebView is sleeping. */
class AlarmActivity : Activity() {
  private var alarm = JSONObject()
  private val ended = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { finish() }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setShowWhenLocked(true)
    setTurnScreenOn(true)
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN or
      View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
    show(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    show(intent)
  }

  override fun onStart() {
    super.onStart()
    val filter = IntentFilter(AlarmService.ACTION_ENDED)
    if (Build.VERSION.SDK_INT >= 33) registerReceiver(ended, filter, RECEIVER_NOT_EXPORTED)
    else @Suppress("DEPRECATION") registerReceiver(ended, filter)
  }

  override fun onStop() {
    unregisterReceiver(ended)
    super.onStop()
  }

  private fun text(value: String, size: Float, alpha: Int = 255): TextView = TextView(this).apply {
    this.text = value
    textSize = size
    setTextColor(Color.argb(alpha, 255, 255, 255))
    gravity = Gravity.CENTER
  }

  private fun dp(value: Int): Int = (value * resources.displayMetrics.density + 0.5f).toInt()

  private fun slideControl(): SeekBar {
    val track = GradientDrawable().apply {
      setColor(Color.rgb(48, 57, 52))
      cornerRadius = dp(20).toFloat()
    }
    val fill = GradientDrawable().apply {
      setColor(Color.rgb(184, 239, 100))
      cornerRadius = dp(20).toFloat()
    }
    val layers = LayerDrawable(arrayOf(track, ClipDrawable(fill, Gravity.START, ClipDrawable.HORIZONTAL))).apply {
      setId(0, android.R.id.background)
      setId(1, android.R.id.progress)
      setLayerHeight(0, dp(24))
      setLayerHeight(1, dp(24))
      setLayerGravity(0, Gravity.CENTER_VERTICAL)
      setLayerGravity(1, Gravity.CENTER_VERTICAL)
    }
    val handle = GradientDrawable().apply {
      shape = GradientDrawable.OVAL
      setColor(Color.rgb(184, 239, 100))
      setStroke(dp(3), Color.WHITE)
      setSize(dp(72), dp(72))
    }
    return SeekBar(this).apply {
      max = 100
      progress = 0
      progressDrawable = layers
      thumb = handle
      thumbOffset = 0
      splitTrack = false
      contentDescription = getString(R.string.alarm_slide)
      var gestureStarted = false
      var completed = false
      setOnTouchListener { _, event ->
        when (event.actionMasked) {
          MotionEvent.ACTION_DOWN -> {
            gestureStarted = event.x <= dp(100)
            !gestureStarted
          }
          MotionEvent.ACTION_MOVE, MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> !gestureStarted
          else -> false
        }
      }
      setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
        override fun onProgressChanged(bar: SeekBar, value: Int, fromUser: Boolean) {
          if (fromUser && !completed && value >= 98) {
            completed = true
            finishAlarm(false, true)
          }
        }
        override fun onStartTrackingTouch(bar: SeekBar) {}
        override fun onStopTrackingTouch(bar: SeekBar) {
          gestureStarted = false
          if (!completed && bar.progress > 0) {
            ValueAnimator.ofInt(bar.progress, 0).apply {
              duration = 180
              addUpdateListener { bar.progress = it.animatedValue as Int }
              start()
            }
          }
        }
      })
    }
  }

  private fun show(intent: Intent) {
    alarm = try { JSONObject(intent.getStringExtra(AlarmScheduler.EXTRA_ALARM) ?: "") }
      catch (_: Exception) { JSONObject() }
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER
      setBackgroundColor(Color.rgb(9, 11, 11))
      setPadding(dp(32), dp(28), dp(32), dp(28))
    }
    root.addView(text(alarm.optString("time", "07:00"), 66f).apply {
      typeface = Typeface.DEFAULT_BOLD
    })
    root.addView(text(alarm.optString("title").ifBlank { getString(R.string.alarm_default_title) }, 27f))
    alarm.optString("message").takeIf { it.isNotBlank() }?.let {
      root.addView(text(it, 18f, 180))
    }
    val spacer = View(this)
    root.addView(spacer, LinearLayout.LayoutParams(1, 28))
    if (alarm.optString("dismissMode") == "tap") {
      root.addView(text(getString(R.string.alarm_tap), 17f, 190))
      root.setOnClickListener { finishAlarm(false) }
    } else {
      root.addView(text(getString(R.string.alarm_slide), 17f, 190))
      root.addView(slideControl(), LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(96)))
    }
    if (alarm.optInt("snoozeMinutes") > 0) {
      root.addView(text(getString(R.string.alarm_snooze_minutes, alarm.optInt("snoozeMinutes")), 19f).apply {
        setPadding(30, 20, 30, 20)
        setOnClickListener { finishAlarm(true) }
      })
    }
    setContentView(root)
  }

  private fun finishAlarm(snooze: Boolean, slideConfirmed: Boolean = false) {
    startService(Intent(this, AlarmService::class.java).apply {
      action = if (snooze) AlarmService.ACTION_SNOOZE else AlarmService.ACTION_STOP
      putExtra(AlarmService.EXTRA_SLIDE_CONFIRMED, slideConfirmed)
    })
    finish()
  }

  @Deprecated("Use the configured dismissal control")
  override fun onBackPressed() { /* An alarm needs an explicit dismissal gesture. */ }
}
