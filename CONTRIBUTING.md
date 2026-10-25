# Contributing to SpotDock

Thanks for helping make SpotDock useful and maintainable. Bug reports, documentation fixes, translations, tests, and code changes are welcome. Please discuss large behavior or protocol changes in an issue before investing in a long implementation.

## Set up a development environment

SpotDock is a Bun workspace containing a Windows Tauri app and an Android Tauri app. Start with the [build guide](docs/building.md), which lists the Windows and Android toolchains. Use Rust **1.90 or newer**, Bun, the Windows MSVC build tools, and (for Android work) a JDK plus Android SDK/NDK. Run these from the repository root in PowerShell:

```powershell
bun install --frozen-lockfile
bun run dev:desktop
```

With an Android test phone connected through ADB, use another terminal for:

```powershell
bun run dev:mobile
```

Keep a debug app on the test phone. Its package ID differs from the release app and it does not register as a launcher or device owner. Do not test dedicated-device provisioning on a phone you need for everyday use.

## Repository map

| Path | Responsibility |
| --- | --- |
| `shared/dock.ts`, `shared/alarms.ts`, `shared/protocol.ts` | Shared configuration, alarm data, and messages exchanged between apps. |
| `shared/i18n.ts`, `shared/locales/`, `shared/nativeMessages.ts` | Translation setup, language JSON files, and native-error translation. |
| `desktop/src/` | Desktop React UI, settings pages, and Tauri command calls. |
| `desktop/src-tauri/src/` | Windows server, media sessions, Spotify fallback, notifications, persistence, tray/startup, and alarms. |
| `mobile/src/` | Android React UI, local preferences, connection handling, forecast requests, alarms, and dock views. |
| `mobile/src-tauri/src/` | Tauri-side Android commands and LAN discovery. |
| `mobile/src-tauri/gen/android/` | Android Gradle project and native integration, including alarms and dedicated mode. Edit this only for Android-specific changes; keep private signing files out of Git. |
| `tests/` | Bun tests for shared behavior and selected app logic. |

Read the [architecture guide](docs/architecture.md) before changing message handling or persistence. The desktop and phone can run different versions while an update is in progress, so preserve existing protocol fields and local storage keys whenever possible. If you introduce a field or change its meaning, update both apps, tests, and documentation together.

## Make a change

1. Create a focused branch and describe the user-visible problem and expected behavior in the pull request.
2. Keep UI text in the locale files instead of hard-coding strings. Add matching keys to `shared/locales/en-US.json` and `shared/locales/es-ES.json`, keeping placeholders such as `{{count}}` and plural suffixes intact. English is the fallback language. Native errors that reach the UI may also need an entry in `shared/nativeMessages.ts`.
3. Keep the desktop and mobile visual styles consistent with their respective existing designs. Their settings screens intentionally have different layouts.
4. For native Android changes, check both debug and release source sets. Release-only launcher and device-owner behavior must stay out of the debug variant. Preserve alarm scheduling across app restarts and updates.
5. Never commit Android keystores, `keystore.properties`, pairing tokens, Spotify refresh tokens, screenshots containing private messages, or other personal data.

Run the checks that apply to your change:

```powershell
bun run format:check
bun run check
bun run test
bun run build:frontends
cargo fmt --manifest-path desktop/src-tauri/Cargo.toml --check
cargo fmt --manifest-path mobile/src-tauri/Cargo.toml --check
```

`bun run format` applies the repository's TypeScript/JSON formatting. For desktop Rust changes, also run `cargo test --manifest-path desktop/src-tauri/Cargo.toml --locked` and a desktop Tauri build if the change affects native behavior. For Android-native changes, build the Android target and test on a physical phone when possible; a host Windows `cargo check` does not validate the Android integration. CI runs formatting, TypeScript checks, Bun tests, frontend builds, Rust formatting, and desktop Rust tests on Windows. It does not replace native device testing.

## Pull requests and reports

Use the [pull request template](.github/pull_request_template.md) to summarize the reason for the change, visible behavior, compatibility impact, and checks performed. Include before/after screenshots for visual changes, redacting personal content. If a check could not run, say why. A small, reviewable PR is easier to merge and maintain.

For a bug report, include the affected app version or commit, Windows/Android version, exact steps, expected and actual behavior, and relevant sanitized logs. For security issues, use the private process in [SECURITY.md](SECURITY.md).

By contributing, you agree that your contribution can be distributed under this repository's [MIT license](LICENSE).
