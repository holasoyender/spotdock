# Alarmas de SpotDock

Las alarmas se pueden editar en **Alarmas** tanto en escritorio como en Android. Se guardan en el ordenador y en cada móvil emparejado. Un móvil sigue ejecutando sus alarmas aunque pierda la conexión con el ordenador: Android las programa en su propio `AlarmManager`. Si se cambia una alarma sin conexión, se sincroniza al reconectar. Cada teléfono usa su propia zona horaria.

En **Sonar en**, la opción «Todos los móviles» incluye los futuros teléfonos emparejados. También se puede elegir uno o varios móviles conocidos. El escritorio conserva sus nombres para poder seleccionar los que estén desconectados. El botón **Enviar alarma de prueba** solo aparece en el escritorio, por cada teléfono conectado.

## Permisos en Android

El móvil debe conceder **Alarmas y recordatorios** cuando SpotDock lo solicite. Sin este permiso, la lista se conserva pero Android no programa alarmas exactas. También debe permitir **alarmas a pantalla completa** para que la pantalla se encienda y muestre los controles cuando la aplicación está en segundo plano. SpotDock muestra un enlace directo a cada ajuste. Pide el permiso de notificaciones al guardar la primera alarma. En un dock administrado, conviene conceder los tres permisos antes de activar el modo bloqueado.

La opción «Tono del móvil» usa el sonido de alarma configurado en Android. Los tonos **Clásico**, **Suave** y **Urgente** se incluyen en el APK y funcionan sin descargar archivos. La vibración usa el vibrador del teléfono; su intensidad depende de la configuración del sistema.

La repetición es semanal. «Posponer» admite 5, 10, 15, 20 o 30 minutos, o se puede desactivar. La pantalla nativa de alarma permite apagarla tocando cualquier parte o mediante un gesto de izquierda a derecha, según la opción de cada alarma. El botón Posponer queda separado de ese gesto.

Después de reiniciar, Android restaura las alarmas programadas. El APK debug conserva el comportamiento normal del móvil de pruebas; las alarmas funcionan en ambas variantes.
