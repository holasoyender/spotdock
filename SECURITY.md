# Seguridad

Si encuentras una vulnerabilidad, usa **Report a vulnerability** en la pestaña Security de GitHub para comunicarla de forma privada. Incluye pasos para reproducirla, el impacto y las versiones afectadas. Evita publicar claves de emparejamiento, tokens o detalles explotables en un issue público.

SpotDock comunica el PC y el móvil dentro de la red local mediante WebSocket sin TLS. Usa una red de confianza. La clave de emparejamiento permite acceder al dock; si crees que se ha expuesto, renuévala desde la aplicación de escritorio y vuelve a emparejar los móviles.

Las dependencias y servicios externos (Spotify y Open-Meteo) tienen sus propias condiciones y políticas. Consulta [README.md](README.md) para los límites conocidos de la integración.
