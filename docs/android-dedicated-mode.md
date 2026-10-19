# Android como dock dedicado

La APK **release** de SpotDock puede actuar como aplicación de inicio (launcher). Android la abre al arrancar cuando está elegida como inicio predeterminado. Para impedir que se abandone con Inicio o Recientes hace falta además configurar el teléfono como **dispositivo administrado** y ejecutar SpotDock en [modo de tarea bloqueada](https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode). Ser launcher por sí solo no impide salir.

La APK **debug** (`com.spotdock.mobile.debug`) no declara el filtro de inicio ni el administrador del dispositivo y nunca inicia este modo. Úsala en el teléfono de pruebas.

## Preparar cada teléfono de producción

1. Guarda cualquier dato que necesites del teléfono. La configuración como dispositivo administrado puede exigir un restablecimiento de fábrica si el teléfono ya tiene cuentas o está provisionado. Activa la depuración USB y comprueba con `adb devices` que aparece como `device`.
2. Genera la APK firmada con `bun run build:android` e instálala en **el teléfono que será dock**:

   ```powershell
   adb install -r mobile/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
   ```

3. Con el teléfono sin cuentas, asígnale SpotDock como propietario mediante ADB:

   ```powershell
   adb shell dpm set-device-owner com.spotdock.mobile/.DockDeviceAdminReceiver
   ```

   Android debe responder `Success`. Si rechaza la orden, no continúes suponiendo que el teléfono está bloqueado: el estado de aprovisionamiento o una cuenta existente pueden impedirla. La [guía oficial de dispositivos dedicados](https://developer.android.com/work/dpc/dedicated-devices/cookbook#development-setup) describe esta vía con ADB para preparar y probar dispositivos sin cuentas. En despliegues gestionados a mayor escala, Android recomienda aprovisionamiento empresarial por QR o un EMM; este repositorio no incluye ese flujo.

4. Abre SpotDock una vez para registrar su actividad como inicio preferido y activar el modo de tarea bloqueada:

   ```powershell
   adb shell am start -n com.spotdock.mobile/.MainActivity
   ```

5. Reinicia el teléfono y comprueba que SpotDock vuelve a abrirse solo. Los gestos de Inicio y Recientes no deben sacarte de la aplicación. El teléfono debe permanecer encendido; el horario de SpotDock pone la pantalla negra, pero no apaga físicamente el dispositivo.

El propietario del dispositivo se asigna **una sola vez**. Las actualizaciones posteriores se instalan con `adb install -r` usando el mismo identificador y la misma clave de firma. Conviene configurar la Wi‑Fi, los permisos de cámara y de red local, y la ubicación del tiempo antes de dejar el teléfono sin supervisión.

## Recuperación y límites

Si instalas la APK release como launcher sin asignarle la propiedad del dispositivo, puede abrirse al arrancar, pero Android seguirá permitiendo salir y cambiar de aplicación. SpotDock comprueba que es propietario antes de activar el bloqueo; nunca inicia el modo de fijación de pantalla, del que el usuario podría salir.

Con el teléfono administrado, conserva acceso físico y ADB para mantenimiento. Una APK defectuosa o una configuración incorrecta puede dificultar el uso normal del teléfono. La retirada definitiva del propietario de un dispositivo de producción suele requerir un restablecimiento de fábrica; consulta la [documentación de Android](https://developer.android.com/work/dpc/dedicated-devices) antes de administrarlo. Este modo no evita que alguien apague físicamente o restablezca el teléfono mediante mecanismos del sistema o del fabricante.
