# Contribuir a SpotDock

Gracias por ayudar. Los errores, mejoras de documentación y propuestas de cambios son bienvenidos mediante issues y pull requests.

## Preparar el entorno

Consulta los requisitos y las órdenes de desarrollo en [README.md](README.md). Este repositorio es un monorepo Bun con dos aplicaciones Tauri. No edites archivos bajo `mobile/src-tauri/gen/android/` salvo que el cambio afecte directamente a la integración Android generada.

Antes de enviar un cambio:

```powershell
bun install --frozen-lockfile
bun run format:check
bun run check
bun run test
bun run build:frontends
cargo fmt --manifest-path desktop/src-tauri/Cargo.toml --check
cargo fmt --manifest-path mobile/src-tauri/Cargo.toml --check
```

Si cambias lógica Rust, ejecuta también `cargo check` en el proyecto afectado y con el target correspondiente; el plugin de cámara del móvil requiere un target Android. Para cambios de comportamiento, explica en el PR cómo los comprobaste en Windows o Android, según corresponda. La compilación del frontend verifica que los assets se generan, pero no sustituye una prueba de la aplicación Tauri en un dispositivo.

## Organización del código

- `shared/`: configuración y tipos del protocolo entre aplicaciones.
- `desktop/src/`: interfaz del PC. `App.tsx` coordina navegación y acciones; `ClockSettings.tsx` y `DeckSettings.tsx` agrupan sus ajustes; `components/desktop/` contiene componentes de presentación.
- `mobile/src/`: interfaz Android. `connection/` mantiene la conexión y el descubrimiento; `views/` contiene las tres pantallas; `components/dock/` contiene navegación y ajustes.
- `desktop/src-tauri/src/`: servidor, reproducción, configuración, Spotify y acciones del PC.
- `mobile/src-tauri/src/`: comandos nativos y descubrimiento del PC.

Mantén las claves de almacenamiento local, nombres de comandos Tauri y mensajes WebSocket compatibles entre ambas aplicaciones. Si cambias el protocolo, actualiza `shared/protocol.ts`, ambos extremos y el README en el mismo PR.

## Pull requests

Describe el motivo, los cambios visibles y las comprobaciones realizadas. Procura que cada PR tenga un alcance fácil de revisar. No incluyas claves de emparejamiento, tokens de Spotify, archivos de firma Android ni datos personales.
