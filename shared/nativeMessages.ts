import spanish from "./locales/es-ES.json"
import type { TranslationKey } from "./locales"
import { t } from "./i18n"

const exact = new Map<string, TranslationKey>()
for (const [key, value] of Object.entries(spanish)) {
  if (key.startsWith("native.")) exact.set(value, key as TranslationKey)
}
exact.set("cancelled", "native.scannerCancelled")
exact.set("Something went wrong configuring the BarcodeScanner", "native.scannerConfig")
exact.set("No permission to use camera. Did you request it yet?", "native.scannerPermission")

const patterns: [RegExp, TranslationKey, string][] = [
  [
    /^Spotify no aparece entre las sesiones multimedia de Windows \((.*)\)$/,
    "native.spotifyNotInSessions",
    "sources",
  ],
  [
    /^No se pudo recuperar la conexión guardada de Spotify: (.*)$/,
    "native.spotifySavedFailed",
    "error",
  ],
  [/^Spotify rechazó la autorización \((.*)\)$/, "native.spotifyAuthRejected", "status"],
  [/^No se pudo renovar Spotify: (.*)$/, "native.spotifyRefreshFailed", "error"],
  [/^Spotify rechazó la renovación \((.*)\)$/, "native.spotifyRefreshRejected", "status"],
  [/^No se pudo consultar Spotify: (.*)$/, "native.spotifyQueryFailed", "error"],
  [/^Spotify ha limitado las consultas durante (.*) s$/, "native.spotifyRateLimit", "seconds"],
  [/^Spotify Web API devolvió (.*)$/, "native.spotifyApiStatus", "status"],
  [/^Spotify no pudo ejecutar la acción \((.*)\)$/, "native.spotifyActionFailed", "status"],
]

/** Translate known native messages while preserving unknown platform diagnostics. */
export function localizeNativeMessage(value: unknown): string {
  const original = String(value)
  const message = original.startsWith("Error: ") ? original.slice(7) : original
  const windowsFirst = message.match(/^Windows: (.*)\. API de Spotify: (.*)$/)
  if (windowsFirst)
    return t("native.windowsAndApi", {
      windows: localizeNativeMessage(windowsFirst[1]),
      api: localizeNativeMessage(windowsFirst[2]),
    })
  const apiFirst = message.match(/^API de Spotify: (.*)\. Windows: (.*)$/)
  if (apiFirst)
    return t("native.apiAndWindows", {
      api: localizeNativeMessage(apiFirst[1]),
      windows: localizeNativeMessage(apiFirst[2]),
    })
  const key = exact.get(message)
  if (key) return t(key)
  for (const [pattern, translationKey, parameter] of patterns) {
    const match = message.match(pattern)
    if (match) return t(translationKey, { [parameter]: match[1] })
  }
  return original
}
