# Forwarding Windows notifications

SpotDock can forward selected notifications received by the Windows PC to **every connected phone**. Forwarding is off by default. Configure the global switch and the individual Discord and WhatsApp switches in desktop **Notifications**. The page includes a test notification for all connected phones and reports how many acknowledged it; desktop **Devices** can send a test notification to one phone.

Supported input is what the [Windows notification listener](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/notification-listener) exposes. For WhatsApp Web, allow notifications for `web.whatsapp.com` in the browser and in Windows; the browser must actually post them to Windows. The WhatsApp desktop app and Discord must likewise have Windows notifications enabled. SpotDock cannot read a message that never becomes a Windows notification.

Each phone displays an animated banner for a few seconds with the source app, sender when available, message text, and an application icon if Windows supplies it. Windows does not expose another app's sender profile image through this API, so a contact or Discord avatar is not available. Notifications are sent only to phones connected at that moment; they are not stored or replayed later. Consider whether message previews may be visible to people near each dock.

## Installation and permission

The listener requires an app package with the `userNotificationListener` capability and user consent. For reliable capture, install SpotDock Desktop as the **signed MSIX** described in the [build guide](building.md). The normal MSI/NSIS installer or development executable may report a permission state without delivering notifications. After installing MSIX, open desktop **Notifications**, request Windows access, and enable the desired sources. Windows privacy settings can revoke access later.

For diagnosis, send a test notification first. Then confirm that the source app posts a real notification to the Windows notification center, that its switch is enabled in SpotDock, that the phone is connected under **Devices**, and that the MSIX instance is the only running SpotDock Desktop process. The test event checks SpotDock delivery but does not prove that Windows is supplying notifications from Discord, WhatsApp, or the browser.
