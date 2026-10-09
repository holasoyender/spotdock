# SpotDock

Control remoto de Spotify para un móvil Android colocado en horizontal. La aplicación de escritorio (Windows) lee la sesión multimedia de Spotify mediante **Windows GSMTC** y sirve el estado por WebSocket en la red local. El móvil se empareja escaneando un QR que contiene la IP del ordenador y una clave aleatoria de 128 bits.

## Requisitos

- Windows 10/11 con Spotify Desktop y WebView2.
- Android 7.0 o posterior, preferentemente ARM64, con cámara para el QR.
- Ambos dispositivos en la misma red Wi‑Fi; el router debe permitir comunicación entre clientes.
- [Bun](https://bun.sh/), Rust, Android SDK y NDK para compilar. **Android Studio no es necesario para ejecutar las órdenes siguientes.**

## Desarrollo

```powershell
bun install
bun run dev:desktop
```

En otra terminal:

```powershell
bun run dev:mobile
```

`tauri android dev` utiliza un dispositivo Android conectado por USB si está disponible. Para compilar un APK sin emulador:

```powershell
cd mobile
bun tauri android build --debug --target aarch64 --apk --ci
```

El APK de depuración se guarda bajo `mobile/src-tauri/gen/android/app/build/outputs/apk/`. Para Windows:

```powershell
cd desktop
bun tauri build --debug --no-bundle --ci
```

El ejecutable queda en `desktop/src-tauri/target/debug/spotdock-desktop.exe`.

## Uso

1. Abre Spotify Desktop y reproduce una canción.
2. Abre SpotDock Desktop. Permite la red privada en el firewall de Windows si se solicita.
   Si la IP detectada pertenece a una VPN, escribe la IP Wi‑Fi del PC en **Ajustes** para regenerar el QR.
3. Abre SpotDock en Android y pulsa **Escanear QR**. Apunta al código del ordenador.
4. El móvil se reconectará solo si la conexión se interrumpe. También puedes pegar manualmente la dirección desde **Ajustes**.

El móvil permite reproducir/pausar, ir a la canción anterior o siguiente, desplazarse por la pista, activar aleatorio y cambiar entre sin repetición, repetir lista y repetir canción. En Ajustes se pueden cambiar el brillo de la interfaz, el reloj, la vista compacta y el bloqueo de pantalla activa. Estas preferencias se guardan localmente.

La barra superior de escritorio permite arrastrar, minimizar, maximizar/restaurar y cerrar la ventana. La navegación lateral abre **Reproducción**, **Dispositivos** y **Ajustes**. En Ajustes se puede elegir un color de acento predefinido o personalizado; el cambio llega en directo a los móviles conectados. En Android, los títulos largos se desplazan para que puedan leerse completos y la carátula aporta un fondo difuminado y tenue.

## Diseño y seguridad

- Dos aplicaciones Tauri 2 con React, Tailwind CSS 4 y componentes de shadcn/ui. Se aplican los presets `b1oVxsfY` (escritorio) y `bbVJxYW` (móvil).
- El servidor escucha en TCP 47917. El QR cambia en cada inicio y puede renovarse desde el escritorio. Se valida la clave antes de abrir el WebSocket.
- El cliente móvil solo acepta direcciones SpotDock en IP privadas con el puerto y la ruta esperados.
- El tráfico permanece en la LAN. La conexión `ws://` no cifra los datos; para redes no confiables se necesita una capa TLS o VPN.
- No se usan credenciales ni la API Web de Spotify. Algunas funciones, en especial aleatorio y repetición, dependen de que Spotify las exponga a Windows GSMTC.

## Comprobaciones

```powershell
bun run check
cd desktop/src-tauri; cargo check
```
