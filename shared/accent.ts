import type { TranslationKey } from "./locales"

export const accentPalette = [
  { name: "desktop.color.lime", color: "#b8ef64" },
  { name: "desktop.color.white", color: "#ffffff" },
  { name: "desktop.color.blue", color: "#91c7ff" },
  { name: "desktop.color.pink", color: "#ffb8d7" },
  { name: "desktop.color.amber", color: "#ffd18a" },
  { name: "desktop.color.purple", color: "#c3b3ff" },
] satisfies { name: TranslationKey; color: string }[]
