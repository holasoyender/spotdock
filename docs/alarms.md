# Alarmas de SpotDock

Las alarmas se pueden editar en **Alarmas** tanto en escritorio como en Android. Se guardan en el ordenador y en cada móvil emparejado. Un móvil sigue ejecutando sus alarmas aunque pierda la conexión con el ordenador: Android las programa en su propio `AlarmManager`. Si se cambia una alarma sin conexión, se sincroniza al reconectar. Cada teléfono usa su propia zona horaria.

En **Sonar en**, la opción «Todos los móviles» incluye los futuros teléfonos emparejados. También se puede elegir uno o varios móviles conocidos. El escritorio conserva sus nombres para poder seleccionar los que estén desconectados. El botón **Enviar alarma de prueba** solo aparece en el escritorio, por cada teléfono conectado.

## Permisos en Android

En Android 13 o posterior, SpotDock usa el permiso de despertador `USE_EXACT_ALARM`, que se concede al instalar la aplicación. En Android 12, el botón **Permitir alarmas exactas** abre el ajuste **Alarmas y recordatorios**. Si se revoca ese permiso, la alarma se programa de forma aproximada hasta que se vuelva a conceder; Android puede retrasarla, sobre todo en reposo. Al volver de Ajustes, SpotDock vuelve a programar las alarmas guardadas.

También conviene permitir **alarmas a pantalla completa** para que la pantalla se encienda y muestre los controles cuando la aplicación está en segundo plano. SpotDock pide el permiso de notificaciones al guardar la primera alarma. En un dock administrado, la aplicación sale temporalmente del modo bloqueado al abrir los ajustes de permisos y vuelve a él al regresar.

La opción «Tono del móvil» usa el sonido de alarma configurado en Android. Los tonos **Clásico**, **Suave** y **Urgente** se incluyen en el APK y funcionan sin descargar archivos. La vibración usa el vibrador del teléfono; su intensidad depende de la configuración del sistema.

La repetición es semanal. «Posponer» admite 5, 10, 15, 20 o 30 minutos, o se puede desactivar. La pantalla nativa de alarma permite apagarla tocando cualquier parte o mediante un gesto de izquierda a derecha, según la opción de cada alarma. El botón Posponer queda separado de ese gesto.

Después de reiniciar o actualizar la aplicación, Android restaura las alarmas programadas. Las alarmas se disparan aunque SpotDock muestre su pantalla negra programada. El APK debug conserva el comportamiento normal del móvil de pruebas; las alarmas funcionan en ambas variantes.
