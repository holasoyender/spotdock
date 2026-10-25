# Security policy

## Report a vulnerability privately

Please use **Report a vulnerability** in the GitHub repository's **Security** tab. Include reproduction steps, expected and observed behavior, impact, affected versions or commits, and a proof of concept if useful. Do not publish exploitable details, pairing tokens, Spotify credentials, or private notification content in a public issue. General bugs can go through regular GitHub issues.

This project is maintained as an open-source project; there is no guaranteed response or fix timeline. A maintainer can coordinate disclosure and a fix through the private report.

## Security boundaries

- The desktop server accepts authenticated connections on the local network. The QR pairing token is a secret; anyone with it and network access may be able to interact with the dock. Regenerate it in desktop Settings and re-pair every phone if it leaks.
- The PC/phone WebSocket uses `ws://` without transport encryption. Use a trusted LAN and do not expose TCP port **47917** to the public internet. UDP **47918** is used for local discovery. Router port forwarding is not required.
- A phone sends configured action IDs; the desktop executes the matching action stored on the PC. Review control-deck actions before pairing an untrusted device.
- Optional Spotify authorization uses PKCE; its refresh token is protected with Windows DPAPI for the current user before storage. Do not share the desktop app's configuration directory.
- Windows notification forwarding is opt-in. Notifications may contain sensitive text and are displayed on every connected phone when enabled. Review the allowlist and physical placement of your docks.
- Android signing keys and `keystore.properties` must stay private. Losing the signing key can prevent an in-place update of a production or device-owner installation. See the [build guide](docs/building.md).

These boundaries do not make a hostile network safe. See the [architecture guide](docs/architecture.md) and [README](README.md) for data flow and external services.
