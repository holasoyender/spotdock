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

El propietario del dispositivo se asigna **una sola vez**. Las actualizaciones posteriores se instalan con `adb install -r` usando el mismo identificador y la misma clave de firma.

## Cambiar la Wi-Fi o hacer mantenimiento

En **Ajustes del dock → Mantenimiento del dispositivo**, toca **Abrir Wi-Fi** para cambiar de red. SpotDock sale temporalmente de la tarea bloqueada mientras usas Ajustes de Android y vuelve a bloquearse al regresar. **Ajustes de Android** abre la configuración completa del teléfono.

Para usar otras aplicaciones, apaga **Bloquear este móvil en SpotDock**. Esta elección se guarda en el teléfono y persiste tras reiniciar; retira la tarea bloqueada y la preferencia de SpotDock como inicio del sistema. Activa el interruptor de nuevo cuando hayas terminado. La APK debug no activa el bloqueo.

## Recuperación y límites

Si instalas la APK release como launcher sin asignarle la propiedad del dispositivo, puede abrirse al arrancar, pero Android seguirá permitiendo salir y cambiar de aplicación. SpotDock comprueba que es propietario antes de activar el bloqueo; nunca inicia el modo de fijación de pantalla, del que el usuario podría salir.

Si el móvil sigue con una versión anterior de SpotDock y no puedes abrir sus ajustes de Android, actualiza la APK por USB con ADB mediante el comando del paso 2. `adb install -r` conserva los datos de la aplicación siempre que se use la misma clave de firma. Después podrás usar el nuevo interruptor o **Abrir Wi-Fi**.

Conserva acceso físico y ADB para mantenimiento. Si la APK falla, instala una versión corregida por ADB. Si no hay acceso ADB ni ninguna ruta para abrir Ajustes, la recuperación física del fabricante o un restablecimiento de fábrica pueden ser necesarios; un restablecimiento borra los datos del teléfono. La retirada definitiva del propietario de un dispositivo de producción suele requerir un restablecimiento de fábrica; consulta la [documentación de Android](https://developer.android.com/work/dpc/dedicated-devices) antes de administrarlo. Este modo no evita que alguien apague físicamente o restablezca el teléfono mediante mecanismos del sistema o del fabricante.
