# SpotDock

Dock para un móvil Android colocado en horizontal junto a un PC Windows. En reposo muestra un reloj digital o analógico, fecha y tiempo actual. Al tocar el reloj o al empezar una canción, muestra un reproductor. También incluye una botonera personalizable para ejecutar acciones en el PC. La aplicación de escritorio lee primero la sesión multimedia mediante **Windows GSMTC**. Si Spotify no la publica, puede usar opcionalmente la **Spotify Web API**. El estado llega al móvil por WebSocket en la red local. El móvil se empareja escaneando un QR que contiene la IP del ordenador y una clave aleatoria de 128 bits.

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

1. Abre SpotDock Desktop. Permite la red privada en el firewall de Windows si se solicita.
   Si la IP detectada pertenece a una VPN, escribe la IP Wi‑Fi del PC en **Ajustes** para regenerar el QR.
2. En **Reloj y tiempo**, elige reloj digital o analógico, formato de hora, segundos, ciudad y °C/°F. La ubicación inicial es Madrid y se puede cambiar mediante búsqueda.
3. En **Botonera**, añade hasta 24 botones. Puedes elegir texto, icono, imagen cuadrada y color de fondo. Cada botón puede abrir una web, abrir un `.exe` o `.lnk`, enviar un atajo a la ventana activa de Windows, controlar la música o cambiar de vista en el móvil.
4. Abre SpotDock en Android y escanea el QR del escritorio una vez. La dirección y la clave quedan guardadas en el móvil; este se reconecta automáticamente tras reiniciar cualquiera de los dispositivos. Si cambia la IP del PC, el móvil lo busca en la red local. También puedes pegar manualmente la dirección desde **Ajustes**.

El móvil arranca en la vista de reloj. Al tocarla abre el reproductor, y también puede abrirlo automáticamente cuando empiece a sonar música. Si la reproducción está pausada, vuelve al reloj tras el tiempo configurado. La barra superior aparece al tocar la pantalla y desaparece tras cinco segundos sin interacción. Permite cambiar entre reloj, música y botonera. Android oculta las barras de estado y navegación mientras el dock está en primer plano; un gesto desde el borde puede mostrarlas temporalmente. En el reproductor se puede reproducir/pausar, ir a la canción anterior o siguiente, desplazarse por la pista, activar aleatorio y cambiar la repetición. En Ajustes del móvil se pueden cambiar el brillo de la interfaz, la vista compacta y el bloqueo de pantalla activa. Estas preferencias se guardan localmente.

La barra superior de escritorio permite arrastrar, minimizar, maximizar/restaurar y cerrar la ventana. La navegación lateral abre **Reproducción**, **Reloj y tiempo**, **Botonera**, **Dispositivos** y **Ajustes**. En Ajustes se puede elegir un color de acento predefinido o personalizado; el cambio llega en directo a los móviles conectados. En Android, los títulos largos se desplazan para que puedan leerse completos y la carátula aporta un fondo difuminado y tenue.

## Si Spotify no aparece en el escritorio

En **Reproducción**, SpotDock muestra el error de Windows cuando no encuentra una sesión de Spotify. Puedes abrir **Ajustes → Spotify en este ordenador** para activar la conexión alternativa:

1. Crea una aplicación en [Spotify for Developers](https://developer.spotify.com/dashboard) y registra `http://127.0.0.1/callback` como URI de redirección. Spotify permite que el puerto de una dirección loopback sea dinámico.
2. Copia su **Client ID** en SpotDock y pulsa **Conectar Spotify**. Termina la autorización en el navegador que se abre.
3. La app consulta la reproducción activa de tu cuenta de Spotify y envía los controles por la API cuando la sesión de Windows no funciona. La cuenta autorizada debe estar incluida entre los usuarios permitidos de la aplicación en modo desarrollo. El propietario de la aplicación necesita Spotify Premium para que esa modalidad funcione.

La conexión alternativa requiere Internet en el PC y se actualiza cada 10 segundos durante la reproducción, o cada 20 segundos cuando está inactiva. Spotify puede imponer límites de consultas. SpotDock respeta `Retry-After` y espera más tiempo si se supera la cuota.

## Diseño y seguridad

- Dos aplicaciones Tauri 2 con React, Tailwind CSS 4 y componentes de shadcn/ui. Se aplican los presets `b1oVxsfY` (escritorio) y `bbVJxYW` (móvil).
- El servidor escucha en TCP 47917. La clave del QR se conserva en la configuración del escritorio y puede renovarse manualmente; al renovarla, hay que emparejar de nuevo el móvil. Se valida la clave antes de abrir el WebSocket. Tras instalar esta versión, los emparejamientos hechos con versiones anteriores requieren un último escaneo porque antes la clave no se guardaba.
- Para recuperar un cambio de IP, el móvil envía una consulta por UDP 47918 y acepta únicamente una respuesta autenticada con la clave guardada. El firewall y el router deben permitir ese tráfico local; con la misma IP guardada, la reconexión directa no depende del descubrimiento.
- El móvil envía únicamente el ID de un botón. El PC ejecuta la acción almacenada en su configuración; nunca recibe una ruta o un comando arbitrario del móvil.
- El tiempo y la búsqueda de ciudades se consultan en [Open-Meteo](https://open-meteo.com/) desde el PC y se envían al móvil. La edición gratuita de su API es para uso no comercial. La consulta meteorológica se repite cada 15 minutos.
- El cliente móvil solo acepta direcciones SpotDock en IP privadas con el puerto y la ruta esperados.
- El canal entre PC y móvil permanece en la LAN; el PC consulta Open-Meteo y, si se configura, Spotify por HTTPS. La conexión local `ws://` no cifra los datos; para redes no confiables se necesita una capa TLS o VPN.
- La conexión opcional de Spotify usa Authorization Code con PKCE, sin secreto de cliente. La clave de renovación se cifra con DPAPI para la cuenta de Windows antes de guardarse en el directorio de configuración de la app. **Desconectar** la elimina. Spotify puede limitar algunos controles en la API o en Windows GSMTC.

## Comprobaciones

```powershell
bun run check
cd desktop/src-tauri; cargo check
```
