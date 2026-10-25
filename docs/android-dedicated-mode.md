# Set up a dedicated Android dock

The **release** APK can act as an Android launcher so SpotDock starts after a reboot. To prevent leaving it with Home or Recents, the phone must also be provisioned as a managed **device owner** and use Android [lock task mode](https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode). Selecting a launcher by itself does not lock the phone.

The debug package (`com.spotdock.mobile.debug`) does not register a launcher or device administrator and does not start lock task mode. Use it for routine development on a test phone.

## Prepare each production phone

1. Back up anything you need from the phone. Device-owner provisioning can require a factory reset if the device is already provisioned or has accounts. Enable USB debugging and confirm `adb devices` lists the phone as `device`. See the [Android Debug Bridge guide](https://developer.android.com/tools/adb) if it does not.
2. Build a signed release APK with `bun run build:android` as described in the [build guide](building.md). Install it on the phone intended to be a dock:

   ```powershell
   adb install -r mobile/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
   ```

3. On an eligible device without user accounts, assign SpotDock as device owner:

   ```powershell
   adb shell dpm set-device-owner com.spotdock.mobile/.DockDeviceAdminReceiver
   ```

   Confirm Android reports `Success`. If it rejects the command, resolve the provisioning/account state before continuing. Android's [dedicated-device development setup](https://developer.android.com/work/dpc/dedicated-devices/cookbook#development-setup) describes ADB provisioning for testing. This repository does not implement enterprise QR/EMM enrollment.

4. Open SpotDock once so it can register its preferred Home activity and enable lock task mode:

   ```powershell
   adb shell am start -n com.spotdock.mobile/.MainActivity
   ```

5. Reboot and verify SpotDock reopens automatically and Home/Recents cannot leave it. Set your clock, weather, Wi-Fi, and schedule on the phone before placing it in a hard-to-reach mount.

Assign device ownership only once. Later updates use `adb install -r` with the **same app ID and signing key**. The black screen schedule leaves Android running, connected, and able to ring alarms; it does not power off the device.

## Wi-Fi changes and maintenance

In mobile **Settings → Device maintenance**, choose **Open Wi-Fi** to change networks or **Android Settings** for broader device settings. SpotDock temporarily leaves lock task mode for the Settings activity and returns to it afterward.

To use other apps, turn off **Lock this phone to SpotDock**. The choice persists across reboot and removes the lock task allowlist and preferred Home behavior while disabled. Turn it back on after maintenance. A release install without device-owner provisioning may still open as a launcher, but it cannot enforce lock task mode.

## Recovery

Keep physical access and a working ADB connection for maintenance. If an old SpotDock version lacks the maintenance controls, update it through USB with the same signing key; `adb install -r` keeps application data when Android accepts the update. If the app crashes, install a corrected build through ADB. If ADB is unavailable and no route to Android Settings works, manufacturer recovery or a factory reset may be needed, which erases data. Removing device ownership from a production phone commonly requires a reset; consult the [Android dedicated-device documentation](https://developer.android.com/work/dpc/dedicated-devices/) before provisioning.

Dedicated mode does not prevent physical power-off or manufacturer recovery. Test the full reboot and maintenance flow on each phone model before depending on it.
