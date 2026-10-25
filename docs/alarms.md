# Alarms

Create and edit alarms from the desktop **Alarms** page or the mobile **Alarms** page. Each alarm can have a time, weekdays, name, optional reminder, tone, vibration, dismissal method, and snooze duration. Choose **All phones** (including phones paired later) or select individual known phones; desktop device names help identify them. Only the desktop page can send a test alarm to a selected connected phone.

Alarms are synchronized between the PC and paired phones. Android schedules each phone's assigned alarms with its own `AlarmManager`, so a scheduled alarm can ring after the phone loses its PC connection. Times use the phone's local time zone. The native integration restores schedules after reboot or app update. A phone's locally stored alarms can also be edited while offline and synchronized when it reconnects.

## Android permissions and sound

On Android 13 and later, SpotDock declares `USE_EXACT_ALARM` for its alarm-clock feature. On Android 12, **Allow exact alarms** opens Android's **Alarms & reminders** setting. If exact scheduling is unavailable, SpotDock falls back to an inexact alarm that the system may delay. Returning from the permission screen refreshes the saved alarm schedule. See the [Android alarm documentation](https://developer.android.com/develop/background-work/services/alarms) for platform behavior.

Allow full-screen alarm presentation so the native alarm screen can appear over the lock screen or another activity. SpotDock requests notification permission when the first alarm is saved. On a managed dock, it temporarily leaves lock task mode while Android's permission screen is open and resumes afterward.

**Phone tone** uses the Android alarm sound selected on that device. **Classic**, **Soft**, and **Urgent** are bundled with the APK and require no download. Vibration depends on the device's motor and system settings. Snooze can be off or set to 5, 10, 15, 20, or 30 minutes. Dismissal can be a tap anywhere on the alarm screen or a full left-to-right swipe, depending on that alarm's setting; Snooze is a separate button.

The scheduled black dock view does not suspend alarm handling. The alarm screen, sound, and vibration can still activate while SpotDock displays black. For a production dock, test a real alarm both during normal display hours and during the black schedule on that exact phone model. If an alarm does not fire, verify that today's weekday is selected, the phone's clock/time zone is correct, the alarm is enabled and targets that phone, exact-alarm permission is granted where needed, and the operating system has not restricted the app's background behavior.
