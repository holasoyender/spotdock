package com.spotdock.mobile

import android.Manifest
import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
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
  private var dedicatedModeConfigured = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    hideSystemBars()
    requestLocalNetworkAccess()
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    if (hasFocus) hideSystemBars()
  }

  override fun onResume() {
    super.onResume()
    hideSystemBars()
    enterDedicatedModeIfOwned()
  }

  private fun enterDedicatedModeIfOwned() {
    if (BuildConfig.DEBUG) return

    val policy = getSystemService(DevicePolicyManager::class.java)
    if (!policy.isDeviceOwnerApp(packageName)) return

    try {
      if (!dedicatedModeConfigured) {
        val admin = ComponentName(packageName, "$packageName.DockDeviceAdminReceiver")
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
    } catch (error: RuntimeException) {
      Log.e("SpotDock", "Could not enable dedicated-device mode", error)
    }
  }

  private fun hideSystemBars() {
    WindowCompat.setDecorFitsSystemWindows(window, false)
    WindowCompat.getInsetsController(window, window.decorView).apply {
      systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      hide(WindowInsetsCompat.Type.systemBars())
    }
  }

  private fun requestLocalNetworkAccess() {
    if (Build.VERSION.SDK_INT < 37) return
    if (checkSelfPermission(Manifest.permission.ACCESS_LOCAL_NETWORK) == PackageManager.PERMISSION_GRANTED) return
    requestPermissions(arrayOf(Manifest.permission.ACCESS_LOCAL_NETWORK), 1001)
  }
}
