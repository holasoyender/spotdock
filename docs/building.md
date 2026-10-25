# Building and installing SpotDock

All commands below use PowerShell from the repository root unless a different directory is shown. The repository does not include a production signing key or a prebuilt release. Each distributor must create and protect their own signing credentials.

## Toolchains

Install [Bun](https://bun.sh/), Git, and Rust **1.90+** with `rustfmt`. SpotDock uses Tauri 2; follow the [official Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for the exact Windows and Android toolchain setup. On Windows this includes Microsoft C++ Build Tools with **Desktop development with C++** and WebView2. For Android, install a JDK, Android SDK, NDK, build tools, platform tools (`adb`), and command-line tools; Android Studio is a convenient installer but the commands below use the CLI. Set `JAVA_HOME`, `ANDROID_HOME`, and `NDK_HOME` as required by your local Tauri setup, and install the Rust Android target for the architecture you build.

The Android Gradle project currently uses **compile/target SDK 37** and supports Android **7.0+** (`minSdk 24`). Ensure that SDK platform is installed. A current Android toolchain is needed even if the target phone runs an older Android version.

Install workspace dependencies:

```powershell
git clone https://github.com/holasoyender/spotdock.git
cd spotdock
bun install --frozen-lockfile
```

## Windows desktop

For development:

```powershell
bun run dev:desktop
```

To build Tauri's Windows bundles:

```powershell
bun run build:desktop
```

Look under `desktop/src-tauri/target/release/bundle/` for the generated installers. Tauri supports [Windows MSI and NSIS installers](https://v2.tauri.app/distribute/windows-installer/). You can also make an unbundled debug executable with `bun run --cwd desktop tauri build --debug --no-bundle --ci`; it is written to `desktop/src-tauri/target/debug/`.

Closing the window hides the app in the Windows system tray and leaves the server running. Use the tray's **Quit SpotDock** action to stop it completely. The optional **Start with Windows** setting starts it hidden after sign-in.

### Notification-capable MSIX

SpotDock uses the Windows [notification listener](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/notification-listener) for opt-in forwarding. The project includes a separate MSIX manifest with the `userNotificationListener` capability. A signed MSIX installation is needed for reliable notification capture; an ordinary MSI/NSIS installation may show a permission state without delivering notifications.

Install the Windows SDK, then provide a **code-signing certificate with a private key** in `Cert:\CurrentUser\My`. The script uses that certificate's subject as the package publisher:

```powershell
.\scripts\build-desktop-msix.ps1 -CertificateThumbprint YOUR_40_CHARACTER_SHA1_THUMBPRINT
```

The package is written to `desktop/src-tauri/target/msix/`. The certificate must be trusted by each installing PC. For local testing, see Microsoft's [MSIX signing guide](https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide). `-Unsigned` only produces a package for manifest inspection and is not a usable installation. Keep the signing identity stable for updates. Fully quit an existing MSI/NSIS installation before opening MSIX so two desktop instances do not compete for the local port.

After installing MSIX, open **Notifications** in SpotDock Desktop, enable forwarding, and request Windows notification access. See [Notifications](notifications.md) for source-specific setup.

## Android debug app

Connect a test phone with USB debugging enabled. Confirm `adb devices` lists it as `device` (accept the authorization prompt on the phone). For live development:

```powershell
bun run dev:mobile
```

For a standalone debug APK without your release key:

```powershell
bun run --cwd mobile tauri android build --debug --target aarch64 --apk --ci
```

The debug package is `com.spotdock.mobile.debug`. It does not declare itself as a launcher or device administrator and does not enter dedicated mode. Choose a target matching your test device if it is not ARM64.

## Signed Android release APK

Create your own Android signing keystore and keep a private backup. For example, with the JDK's `keytool`:

```powershell
keytool -genkeypair -v -keystore mobile/src-tauri/gen/android/spotdock.jks -alias spotdock -keyalg RSA -keysize 3072 -validity 10000
Copy-Item mobile/src-tauri/gen/android/keystore.properties.example mobile/src-tauri/gen/android/keystore.properties
```

Edit the new `keystore.properties` and set `storePassword`, `keyPassword`, and `keyAlias` to the values you used. The template's `storeFile=./spotdock.jks` is resolved from `mobile/src-tauri/gen/android/`. If both passwords are the same, repeat the value. The release build also accepts `SPOTDOCK_STORE_PASSWORD`, `SPOTDOCK_KEY_PASSWORD`, `SPOTDOCK_KEY_ALIAS`, and `SPOTDOCK_KEYSTORE_FILE` environment variables; nonempty local properties take precedence. Never put passwords in a committed file or a shell command that will be saved in history.

Both `*.jks` and the real `keystore.properties` are Git-ignored. Verify before publishing:

```powershell
git status --short
git check-ignore mobile/src-tauri/gen/android/spotdock.jks mobile/src-tauri/gen/android/keystore.properties
```

Build and install:

```powershell
bun run build:android
adb install -r mobile/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

The build command already produces a release APK by default; do not add a `--release` flag. Gradle fails the release build if signing inputs are incomplete. Keep the **same keystore, alias, application ID, and compatible signing identity** for future in-place updates. If an existing installation uses a different certificate, Android will not update it in place. Preserve its data and device-owner status before considering any uninstall or reset. The release package is `com.spotdock.mobile`.

To make a phone a persistent, locked dock after installation, follow the separate [dedicated-device guide](android-dedicated-mode.md). This is optional and applies only to the release app.

## Verification

From the repository root:

```powershell
bun run format:check
bun run check
bun run test
bun run build:frontends
cargo fmt --manifest-path desktop/src-tauri/Cargo.toml --check
cargo fmt --manifest-path mobile/src-tauri/Cargo.toml --check
cargo test --manifest-path desktop/src-tauri/Cargo.toml --locked
```

If the desktop Rust build cannot find NASM, set `$env:AWS_LC_SYS_NO_ASM = "1"` in that PowerShell session and retry. The Android native code must be compiled for an Android target; a Windows-hosted Cargo check alone does not validate it.
