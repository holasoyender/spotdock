package com.spotdock.mobile

import android.Manifest
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Log
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
  companion object {
    private const val DOCK_PREFS = "spotdock_dedicated_mode"
    private const val KEY_ENABLED = "enabled"
  }

  private var dedicatedModeConfigured = false

  private fun devicePolicy() = getSystemService(DevicePolicyManager::class.java)

  private fun dockAdmin() = ComponentName(packageName, "$packageName.DockDeviceAdminReceiver")

  fun isDedicatedModeAvailable(): Boolean =
    !BuildConfig.DEBUG && devicePolicy().isDeviceOwnerApp(packageName)

  fun isDedicatedModeEnabled(): Boolean =
    isDedicatedModeAvailable() && getSharedPreferences(DOCK_PREFS, 0).getBoolean(KEY_ENABLED, true)

  fun isDedicatedModeLocked(): Boolean =
    getSystemService(ActivityManager::class.java).lockTaskModeState ==
      ActivityManager.LOCK_TASK_MODE_LOCKED

  fun setDedicatedModeEnabled(enabled: Boolean) {
    if (!isDedicatedModeAvailable()) {
      throw IllegalStateException("This phone is not a managed dock")
    }
    if (!getSharedPreferences(DOCK_PREFS, 0).edit().putBoolean(KEY_ENABLED, enabled).commit()) {
      throw IllegalStateException("Could not save dock mode")
    }
    if (enabled) {
      enterDedicatedModeIfOwned()
      updateSystemBars()
    } else {
      val policy = devicePolicy()
      policy.setLockTaskPackages(dockAdmin(), emptyArray())
      policy.clearPackagePersistentPreferredActivities(dockAdmin(), packageName)
      dedicatedModeConfigured = false
      updateSystemBars()
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    updateSystemBars()
    requestLocalNetworkAccess()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) updateSystemBars()
  }

  override fun onResume() {
    super.onResume()
    updateSystemBars()
    try {
      AlarmScheduler.restore(this)
    } catch (error: RuntimeException) {
      Log.e("SpotDock", "Could not restore alarms", error)
    }
    try {
      enterDedicatedModeIfOwned()
    } catch (error: RuntimeException) {
      Log.e("SpotDock", "Could not enable dedicated-device mode", error)
    }
  }

  /** System permission screens are outside the package allowed by lock task mode. */
  fun launchPermissionSettings(request: Intent, fallback: Intent? = null) {
    val wasLocked = isDedicatedModeAvailable() && isDedicatedModeLocked()
    if (wasLocked) stopLockTask()
    try {
      try {
        startActivity(request)
      } catch (error: ActivityNotFoundException) {
        if (fallback == null) throw error
        startActivity(fallback)
      }
    } catch (error: RuntimeException) {
      if (wasLocked) enterDedicatedModeIfOwned()
      throw error
    }
  }

  private fun enterDedicatedModeIfOwned() {
    if (!isDedicatedModeEnabled()) return

    val policy = devicePolicy()

    if (!dedicatedModeConfigured) {
      val admin = dockAdmin()
      policy.setLockTaskPackages(admin, arrayOf(packageName))
      val home = IntentFilter(Intent.ACTION_MAIN).apply {
        addCategory(Intent.CATEGORY_HOME)
        addCategory(Intent.CATEGORY_DEFAULT)
      }
      policy.addPersistentPreferredActivity(admin, home, ComponentName(this, MainActivity::class.java))
      dedicatedModeConfigured = true
    }

    val activityManager = getSystemService(ActivityManager::class.java)
    if (policy.isLockTaskPermitted(packageName) &&
        activityManager.lockTaskModeState == ActivityManager.LOCK_TASK_MODE_NONE) {
      startLockTask()
    }
  }

  private fun updateSystemBars() {
    val immersive = !isDedicatedModeAvailable() || isDedicatedModeEnabled()
    WindowCompat.setDecorFitsSystemWindows(window, !immersive)
    WindowCompat.getInsetsController(window, window.decorView).apply {
      systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      if (immersive) hide(WindowInsetsCompat.Type.systemBars())
      else show(WindowInsetsCompat.Type.systemBars())
    }
  }

  private fun requestLocalNetworkAccess() {
    if (Build.VERSION.SDK_INT < 37) return
    if (checkSelfPermission(Manifest.permission.ACCESS_LOCAL_NETWORK) == PackageManager.PERMISSION_GRANTED) return
    requestPermissions(arrayOf(Manifest.permission.ACCESS_LOCAL_NETWORK), 1001)
  }
}
