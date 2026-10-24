package com.spotdock.mobile

import android.app.Activity
import android.content.Intent
import android.provider.Settings
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin

@TauriPlugin
class DedicatedModePlugin(private val activity: Activity) : Plugin(activity) {
  private fun dockActivity(): MainActivity = activity as MainActivity

  private fun status(): JSObject = JSObject().apply {
    put("available", dockActivity().isDedicatedModeAvailable())
    put("enabled", dockActivity().isDedicatedModeEnabled())
    put("locked", dockActivity().isDedicatedModeLocked())
  }

  @Command
  fun status(invoke: Invoke) {
    activity.runOnUiThread {
      try { invoke.resolve(status()) }
      catch (error: Exception) { invoke.reject(error.message ?: "Could not read dock mode") }
    }
  }

  @Command
  fun setEnabled(invoke: Invoke) {
    val enabled = invoke.getArgs().optBoolean("enabled")
    activity.runOnUiThread {
      try {
        dockActivity().setDedicatedModeEnabled(enabled)
        invoke.resolve(status())
      } catch (error: Exception) {
        invoke.reject(error.message ?: "Could not change dock mode")
      }
    }
  }

  @Command
  fun openWifi(invoke: Invoke) {
    openSettings(invoke, Intent(Settings.ACTION_WIFI_SETTINGS))
  }

  @Command
  fun openSystemSettings(invoke: Invoke) {
    openSettings(invoke, Intent(Settings.ACTION_SETTINGS))
  }

  private fun openSettings(invoke: Invoke, request: Intent) {
    activity.runOnUiThread {
      try {
        dockActivity().launchPermissionSettings(request, Intent(Settings.ACTION_SETTINGS))
        invoke.resolve()
      } catch (error: Exception) {
        invoke.reject(error.message ?: "Could not open Android settings")
      }
    }
  }
}
