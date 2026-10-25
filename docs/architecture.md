# Architecture and compatibility

SpotDock has two Tauri 2 applications in one Bun workspace. The Windows app owns PC integration and a local server; each Android app renders the dock UI and can keep several features running independently. React/TypeScript handles the views and shared data shapes; Rust and Android native code handle OS integration.

## Data flow

```text
Windows media sessions ─┐
Spotify Web API (opt-in) ├─> Desktop app ── authenticated LAN WebSocket ──> Android dock(s)
Windows notifications ──┤       │                                  │
PC actions <─────────────┘       │                                  ├─> Open-Meteo HTTPS
                                 │                                  └─> Android AlarmManager
                         Shared settings and alarm sync
```

The desktop server listens on TCP **47917**. QR pairing supplies the PC address and a random 128-bit token. The phone stores them and reconnects automatically. If the saved IP stops working, UDP **47918** discovery can locate the paired PC; the phone only accepts a response authenticated with the saved token. The connection is local and uses `ws://`, so use a trusted LAN. The phone validates addresses before connecting. Pairing a new phone or rotating the token requires scanning the current QR code.

`shared/protocol.ts` defines the messages exchanged over WebSocket. State snapshots carry current media, shared dock settings, paired devices, and alarm data. Control messages request a defined operation; deck messages carry a configured button ID. The PC resolves that ID against its own stored deck, rather than accepting a raw executable path from the phone. Transient notification and alarm-test events are delivered to connected recipients and are not replayed after reconnection.

## Ownership of settings and work

| Area | Owner and behavior |
| --- | --- |
| Media | Windows GSMTC is the primary source. The optional Spotify Web API connection can provide playback data and controls when needed. An ambiguous GSMTC source can be selected manually and remembered locally on the PC. |
| Weather | Each phone requests current conditions and forecasts directly from Open-Meteo. The PC can share the configured location; a phone can override it and continue without the PC. |
| Clock, accent, screen schedule | The PC sends shared defaults. Each phone can override supported groups locally and switch back to shared values. The local schedule uses that phone's clock; the shared schedule uses the PC's local time while connected. |
| Alarms | Alarms can be edited on either side and synchronized. Each selected phone schedules its own alarms through Android `AlarmManager`, including after a temporary disconnection, reboot, or app update. Device targeting uses stable device IDs, while desktop aliases help people recognize phones. |
| Notifications | The PC reads permitted Windows notifications, filters enabled sources, and sends a temporary event to all currently connected phones. Neither app retains notification history. |
| Dedicated mode | Release-only Android source set declares the launcher and device-admin components. Device-owner policy enables lock task mode. Mobile settings provide temporary access to Wi-Fi/System Settings and a saved lock toggle for maintenance. |

The desktop keeps the server running when its window is hidden in the tray. Starting with Windows launches it hidden. Fully quitting from the tray stops the server.

## Where to change code

- `shared/dock.ts`, `shared/alarms.ts`, and `shared/protocol.ts` are the shared source of truth for configuration and wire types.
- `desktop/src/` holds desktop pages and Tauri command calls. `desktop/src-tauri/src/` holds the server, persistence, media, Spotify, notification, alarm, tray, and startup logic.
- `mobile/src/connection/` handles address validation, WebSocket reconnection, and discovery. `mobile/src/weather/` handles Open-Meteo data. `mobile/src/views/` and `mobile/src/components/dock/` render the dock and local settings.
- `mobile/src-tauri/src/` and `mobile/src-tauri/gen/android/app/src/` contain the Android-facing integration. Keep release-only launcher/device-owner declarations out of debug builds.
- `shared/locales/en-US.json` and `shared/locales/es-ES.json` contain the user-facing translations; `shared/i18n.ts` selects the effective locale.

## Compatibility rules for contributors

Desktop and phone updates may happen at different times. When changing `shared/protocol.ts`, handle absent/new fields deliberately, update both endpoints, and add meaningful tests for any compatibility behavior. Treat `spotdock:*` local storage keys and persisted native config fields as durable user data. Keep Android package IDs and release signing identity stable for in-place upgrades. Update the [README](../README.md) and relevant guide if a feature, requirement, port, permission, or build command changes.
