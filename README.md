# SpotDock

Dock para un móvil Android colocado en horizontal junto a un PC Windows. En reposo muestra un reloj digital o analógico, fecha y tiempo actual. Al tocar el reloj o al empezar una canción, muestra un reproductor. También incluye una botonera personalizable para ejecutar acciones en el PC. La aplicación de escritorio lee primero la sesión multimedia mediante **Windows GSMTC**. Si Spotify no la publica, puede usar opcionalmente la **Spotify Web API**. El estado llega al móvil por WebSocket en la red local. El móvil se empareja escaneando un QR que contiene la IP del ordenador y una clave aleatoria de 128 bits.

Proyecto abierto bajo la [licencia MIT](LICENSE). Las contribuciones son bienvenidas; consulta [CONTRIBUTING.md](CONTRIBUTING.md). Para informar de un problema de seguridad, sigue [SECURITY.md](SECURITY.md).

## Requisitos

- Windows 10/11 con Spotify Desktop y WebView2.
- Android 7.0 o posterior, preferentemente ARM64, con cámara para el QR.
- Ambos dispositivos en la misma red Wi‑Fi; el router debe permitir comunicación entre clientes.
- [Bun](https://bun.sh/), Rust, Android SDK y NDK para compilar. En Windows, la compilación nativa también requiere las herramientas C++ de MSVC y, normalmente, NASM (consulta la alternativa sin ensamblador más abajo). **Android Studio no es necesario para ejecutar las órdenes siguientes.**
- Rust 1.90 o posterior, con `rustfmt` para la comprobación de formato.

## Desarrollo

```powershell
bun install
bun run dev:desktop
```

En otra terminal:

```powershell
bun run dev:mobile
```

`tauri android dev` utiliza un dispositivo Android conectado por USB si está disponible. Para generar un APK **release firmado** con `mobile/src-tauri/gen/android/spotdock.jks`, copia la plantilla de firma y rellena las contraseñas en el archivo local:

```powershell
if (!(Test-Path mobile/src-tauri/gen/android/keystore.properties)) {
  Copy-Item mobile/src-tauri/gen/android/keystore.properties.example mobile/src-tauri/gen/android/keystore.properties
}
# Edita keystore.properties: storePassword y keyPassword
bun run build:android
```

El alias del keystore incluido localmente es `spotdock`. `storePassword` es la contraseña del almacén y `keyPassword` la de la clave; si ambas son iguales, repite el valor. `storeFile=./spotdock.jks` apunta a `mobile/src-tauri/gen/android/spotdock.jks`. El archivo `.jks` y `keystore.properties` están ignorados por Git y deben conservarse en privado. También se pueden proporcionar `SPOTDOCK_STORE_PASSWORD`, `SPOTDOCK_KEY_PASSWORD`, `SPOTDOCK_KEY_ALIAS` y `SPOTDOCK_KEYSTORE_FILE` como variables de entorno; las propiedades locales tienen prioridad.

El APK firmado se guarda en `mobile/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`. El comando compila en modo release por defecto; `--release` no es una opción de `tauri android build`. Si el dispositivo ya tiene una versión `com.spotdock.mobile` firmada con otra clave, desinstálala antes de instalar este APK; conserva el mismo keystore para futuras actualizaciones. Para compilar un APK de depuración sin estas credenciales, usa `cd mobile; bun tauri android build --debug --target aarch64 --apk --ci`.

Para convertir un teléfono de producción en un dock que arranque solo y no pueda abandonarse con Inicio o Recientes, sigue [la preparación de Android como dispositivo dedicado](docs/android-dedicated-mode.md). Esta función solo está en la APK release; la variante debug sigue siendo una aplicación normal para pruebas.

Las alarmas se editan desde el móvil o el escritorio y se programan en cada teléfono. Consulta [alarmas, sonidos y permisos Android](docs/alarms.md).

Para Windows:

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

En **Dispositivos** del escritorio aparecen los móviles emparejados, incluso cuando están sin conexión. Puedes darles un nombre que se mostrará al elegir los destinos de una alarma, enviar una notificación o alarma de prueba a un móvil concreto y desconectarlo. **Desconectar** borra el emparejamiento guardado en ese teléfono; para volver a conectarlo, escanea el QR de nuevo. Las alarmas y ajustes locales del móvil permanecen en el teléfono.

En Android 17 o posterior, concede a SpotDock el permiso de acceso a la red local cuando el sistema lo solicite; es necesario para conectar con el PC y para descubrirlo si cambia su IP. Si lo denegaste, puedes activarlo en los permisos de la aplicación dentro de los ajustes de Android. Si se ha regenerado la clave de emparejamiento del escritorio, escanea de nuevo el QR: el descubrimiento automático actualiza la IP, pero no sustituye una clave antigua.

**Uso sin ordenador:** abre los ajustes desde la barra superior del móvil y selecciona una ciudad. En ese mismo panel puedes configurar el reloj (estilo, formato, fecha y segundos), mostrar u ocultar el tiempo, elegir °C/°F, cambiar el color de acento y fijar un horario de pantalla por día. Todo se guarda en el móvil. Si se empareja con un PC, cada bloque sigue inicialmente los ajustes compartidos; al editarlo en el móvil pasa a ser local y se puede volver a usar el del PC con un botón. El horario local utiliza la hora del teléfono y tiene prioridad sobre el del PC. En las horas de apagado SpotDock muestra negro; toca la pantalla para despertarlo un minuto y acceder a los ajustes.

El móvil arranca en la vista de reloj. Al tocarla abre el reproductor, y también puede abrirlo automáticamente cuando empiece a sonar música. Al tocar el bloque del tiempo abre una previsión con las próximas horas del día y siete días en total, incluido hoy; también se puede abrir desde **Tiempo** en la barra superior. Tras el tiempo configurado sin interacción, la previsión vuelve al reloj o al reproductor si hay música sonando. Si la reproducción está pausada, el reproductor vuelve al reloj tras ese mismo tiempo. La barra superior aparece al tocar la franja superior de la pantalla y desaparece tras cinco segundos sin interacción; los controles del reproductor no la abren. Permite cambiar entre reloj, música, tiempo y botonera. Android oculta las barras de estado y navegación mientras el dock está en primer plano; un gesto desde el borde puede mostrarlas temporalmente. En el reproductor se puede reproducir/pausar, ir a la canción anterior o siguiente, desplazarse por la pista, activar aleatorio y cambiar la repetición. En Ajustes del móvil se pueden cambiar el brillo de la interfaz, la vista compacta y el bloqueo de pantalla activa. Estas preferencias se guardan localmente.

La barra superior de escritorio permite arrastrar, minimizar, maximizar/restaurar y cerrar la ventana. La navegación lateral abre **Reproducción**, **Reloj y tiempo**, **Botonera**, **Dispositivos**, **Notificaciones**, **Horario de pantalla** y **Ajustes**. En Ajustes se puede elegir un color de acento predefinido o personalizado; el cambio llega en directo a los móviles conectados. En Android, los títulos largos se desplazan para que puedan leerse completos y la carátula aporta un fondo difuminado.

Al cerrar la ventana del escritorio, SpotDock permanece en la bandeja de Windows y mantiene activos el servidor y la conexión con el móvil. Haz clic derecho en su icono para **Abrir SpotDock** o **Salir de SpotDock**; salir detiene también el servidor. En **Ajustes → Inicio y segundo plano** puedes activar **Iniciar con Windows**. Al iniciar sesión, la aplicación arrancará oculta en la bandeja y atenderá al móvil sin abrir la ventana. Si ejecutas SpotDock manualmente mientras ya está funcionando, se abrirá la ventana existente.

## Notificaciones del ordenador

En **Notificaciones** del escritorio puedes activar el envío a todos los móviles conectados y permitir por separado Discord y WhatsApp. SpotDock lee los avisos que llegan al Centro de notificaciones de Windows, incluidos los de WhatsApp Web cuando el navegador los entrega a Windows. Cada móvil muestra un aviso animado durante unos cinco segundos con la aplicación, el remitente, el mensaje y el icono de la aplicación si Windows lo facilita. El permiso y el interruptor global están desactivados inicialmente. Los mensajes no se guardan ni se reenvían al reconectar. **Enviar prueba a todos los móviles** muestra cuántos móviles conectados han confirmado la recepción.

En **Horario de pantalla** puedes elegir, para cada día de la semana, la hora a la que todos los docks muestran contenido y la hora a la que pasan a negro. Si la hora de encendido es posterior a la de apagado, el intervalo visible cruza la medianoche. Los días desactivados permanecen visibles. Se usa la hora local del ordenador; si un móvil pierde temporalmente la conexión, sigue el horario guardado usando su propio reloj. La pantalla negra cubre la interfaz, pero el teléfono permanece encendido y conectado para poder mostrar el contenido automáticamente a la hora indicada. Para ese comportamiento deja activada la opción de mantener la pantalla despierta en los ajustes del móvil.

La API oficial de Windows devuelve texto e iconos de aplicación, pero no expone las fotos de perfil de los remitentes de otras aplicaciones. Tampoco puede leer mensajes que Discord, WhatsApp o un navegador no publiquen como notificación de Windows. Las notificaciones de WhatsApp Web deben estar permitidas tanto para `web.whatsapp.com` en el navegador como en la configuración de Windows. Para que el permiso de lectura funcione de forma fiable, el escritorio debe ejecutarse desde un **MSIX firmado** que declare `userNotificationListener`; el instalador MSI/NSIS o el ejecutable de desarrollo pueden obtener un estado de permiso sin recibir avisos.

Para generar el paquete MSIX en Windows necesitas el Windows SDK y un certificado de firma de código instalado con clave privada en `Cert:\CurrentUser\My`. El asunto del certificado se usa como `Publisher` del paquete. Ejecuta:

```powershell
.\scripts\build-desktop-msix.ps1 -CertificateThumbprint TU_HUELLA_SHA1_DE_40_CARACTERES
```

El paquete firmado se deja en `desktop/src-tauri/target/msix/`. El certificado debe ser de confianza en cada PC donde se instale; para pruebas locales se puede crear y confiar uno de desarrollo siguiendo la [guía de Microsoft para firmar MSIX](https://learn.microsoft.com/en-us/windows/msix/package/sign-msix-package-guide). `-Unsigned` solo genera un paquete para comprobar el manifiesto, no instalable. Mantén el mismo certificado y la misma identidad MSIX para futuras actualizaciones. Cierra por completo la instalación MSI/NSIS antes de abrir la MSIX para que no compitan por el puerto local. Para solicitar acceso, abre el paquete instalado, entra en **Notificaciones** y pulsa **Permitir acceso**. Windows permite revocar el acceso posteriormente en sus ajustes de privacidad.

## Idiomas

SpotDock incluye **Español (España)** e **Inglés (Estados Unidos)**. El escritorio detecta el idioma de Windows al arrancar, incluso si se inicia oculto, y envía el idioma efectivo al móvil por la conexión local. En **Ajustes → Idioma** del escritorio puedes elegir Automático, Español o Inglés; la elección se guarda junto con el resto de la configuración. En los ajustes del móvil hay un selector independiente: Automático sigue el idioma recibido del PC cuando está emparejado y usa el idioma del teléfono cuando funciona sin ordenador. Una elección explícita se guarda solo en ese móvil. Si el idioma detectado no está disponible, se utiliza inglés estadounidense.

La interfaz usa i18next. Cada idioma tiene su propio archivo JSON: `shared/locales/en-US.json` para inglés y `shared/locales/es-ES.json` para español. Para corregir una traducción, edita solo el texto a la derecha de su clave en el archivo correspondiente. Conserva las claves y los marcadores de variables como `{{language}}` y `{{count}}`. Las claves terminadas en `_one` y `_other` son variantes de singular y plural.

Para añadir un texto visible, crea la misma clave en ambos archivos y úsala mediante `t("clave")`. `shared/locales/index.ts` comprueba en TypeScript que los archivos tengan las mismas claves; `bun run check` y `bun run test` verifican las traducciones. Los datos del usuario, como nombres de canciones y etiquetas de botones personalizados, se muestran tal como se guardaron. Los textos de fecha y tiempo se formatean con el idioma efectivo. Los errores nativos conocidos se traducen en `shared/nativeMessages.ts`; si se añade un error nuevo en Rust, añade también su mensaje a ambos archivos de idioma.

## Si Spotify no aparece en el escritorio

Windows puede publicar la sesión de Spotify con un identificador opaco, por ejemplo `chromium.vkvj5sk7rdptev6t2xc23h4tqa`. SpotDock reconoce automáticamente ese caso cuando `Spotify.exe` está abierto y es la única sesión multimedia con una canción. Recuerda la sesión elegida en `media-source.json`, dentro del directorio de configuración de la aplicación. Si hay varias sesiones o Spotify cambia de identificador tras una actualización o reinstalación, reproduce una canción y elige la sesión correcta en **Ajustes → Spotify en este ordenador → Sesión multimedia de Spotify**. La opción **Detectar automáticamente** borra la elección anterior y vuelve a buscar. El identificador puede depender de la instalación o del perfil, así que se guarda como preferencia local, no como una identidad permanente de Spotify.

En **Reproducción**, SpotDock muestra el error de Windows cuando no encuentra la sesión elegida. Puedes abrir **Ajustes → Spotify en este ordenador** para activar la conexión alternativa:

1. Crea una aplicación en [Spotify for Developers](https://developer.spotify.com/dashboard) y registra `http://127.0.0.1/callback` como URI de redirección. Spotify permite que el puerto de una dirección loopback sea dinámico.
2. Copia su **Client ID** en SpotDock y pulsa **Conectar Spotify**. Termina la autorización en el navegador que se abre.
3. La app consulta la reproducción activa de tu cuenta de Spotify y envía los controles por la API cuando la sesión de Windows no funciona. La cuenta autorizada debe estar incluida entre los usuarios permitidos de la aplicación en modo desarrollo. El propietario de la aplicación necesita Spotify Premium para que esa modalidad funcione.

La conexión alternativa requiere Internet en el PC y se actualiza cada 10 segundos durante la reproducción, o cada 20 segundos cuando está inactiva. Spotify puede imponer límites de consultas. SpotDock respeta `Retry-After` y espera más tiempo si se supera la cuota.

## Diseño y seguridad

- Dos aplicaciones Tauri 2 con React, Tailwind CSS 4 y componentes de shadcn/ui. Se aplican los presets `b1oVxsfY` (escritorio) y `bbVJxYW` (móvil).
- El servidor escucha en TCP 47917. La clave del QR se conserva en la configuración del escritorio y puede renovarse manualmente; al renovarla, hay que emparejar de nuevo el móvil. Se valida la clave antes de abrir el WebSocket. Tras instalar esta versión, los emparejamientos hechos con versiones anteriores requieren un último escaneo porque antes la clave no se guardaba.
- Para recuperar un cambio de IP, el móvil envía una consulta por UDP 47918 y acepta únicamente una respuesta autenticada con la clave guardada. El firewall y el router deben permitir ese tráfico local; con la misma IP guardada, la reconexión directa no depende del descubrimiento.
- El móvil envía únicamente el ID de un botón. El PC ejecuta la acción almacenada en su configuración; nunca recibe una ruta o un comando arbitrario del móvil.
- Cada móvil consulta directamente en [Open-Meteo](https://open-meteo.com/) el tiempo actual y la previsión cada 15 minutos. El PC solo envía la ciudad configurada; en **Ajustes → Ubicación del tiempo** del móvil se puede elegir otra ciudad, que queda guardada localmente y permite usar el reloj y el tiempo sin emparejar ningún PC. La edición gratuita de la API es para uso no comercial.
- El cliente móvil solo acepta direcciones SpotDock en IP privadas con el puerto y la ruta esperados.
- El canal entre PC y móvil permanece en la LAN; el móvil consulta Open-Meteo y el PC consulta Spotify, si se configura, por HTTPS. La conexión local `ws://` no cifra los datos; para redes no confiables se necesita una capa TLS o VPN.
- La conexión opcional de Spotify usa Authorization Code con PKCE, sin secreto de cliente. La clave de renovación se cifra con DPAPI para la cuenta de Windows antes de guardarse en el directorio de configuración de la app. **Desconectar** la elimina. Spotify puede limitar algunos controles en la API o en Windows GSMTC.

## Comprobaciones

```powershell
bun run format:check
bun run check
bun run test
bun run build:frontends
cargo fmt --manifest-path desktop/src-tauri/Cargo.toml --check
cargo fmt --manifest-path mobile/src-tauri/Cargo.toml --check
cd desktop/src-tauri
cargo check
```

`bun run format` aplica el estilo TypeScript del repositorio. La CI ejecuta las comprobaciones del frontend, `rustfmt` y los tests Rust de escritorio en Windows; las compilaciones Tauri y las pruebas en hardware siguen siendo necesarias para validar el comportamiento nativo. El `cargo check` del cliente Android debe ejecutarse con un target Android configurado, no con el target Windows del host.

Si no tienes NASM al compilar el escritorio, puedes ejecutar `$env:AWS_LC_SYS_NO_ASM = "1"` en PowerShell antes de `cargo check` para compilar la dependencia criptográfica sin ensamblador.

## Estructura del repositorio

| Ruta | Responsabilidad |
| --- | --- |
| `shared/dock.ts` y `shared/protocol.ts` | Configuración, utilidades y contrato de mensajes entre PC y móvil. |
| `shared/i18n.ts`, `shared/locales/`, `shared/nativeMessages.ts` | Idiomas, traducciones y mensajes del proceso nativo. |
| `desktop/src/App.tsx` | Estado de la interfaz, navegación y llamadas a comandos Tauri. |
| `desktop/src/ClockSettings.tsx`, `DeckSettings.tsx`, `components/desktop/` | Ajustes y componentes visuales del escritorio. |
| `mobile/src/connection/` | Validación de direcciones, WebSocket, reconexión y descubrimiento. |
| `mobile/src/views/`, `components/dock/` | Reloj, reproductor, botonera, navegación y ajustes móviles. |
| `desktop/src-tauri/src/`, `mobile/src-tauri/src/` | Implementaciones nativas en Rust. |

Las claves locales `spotdock:*` y los campos de `shared/protocol.ts` forman parte de la compatibilidad entre versiones. Mantén las dos aplicaciones sincronizadas si los modificas.
