import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import { resources, type TranslationKey } from "./locales"
export type { TranslationKey } from "./locales"

export type Locale = "en-US" | "es-ES"
export type LanguagePreference = "auto" | Locale

export const languageOptions: { value: LanguagePreference; label: TranslationKey }[] = [
  { value: "auto", label: "common.auto" },
  { value: "es-ES", label: "common.spanish" },
  { value: "en-US", label: "common.english" },
]

export function resolveLocale(value: unknown): Locale {
  if (typeof value === "string" && /^es(?:$|[-_])/i.test(value)) return "es-ES"
  return "en-US"
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === "auto" || value === "es-ES" || value === "en-US"
}

export const i18n = i18next.createInstance()
void i18n.use(initReactI18next).init({
  resources: {
    "en-US": { translation: resources["en-US"] },
    "es-ES": { translation: resources["es-ES"] },
  },
  lng: "en-US",
  fallbackLng: "en-US",
  supportedLngs: ["en-US", "es-ES"],
  keySeparator: false,
  load: "currentOnly",
  initAsync: false,
  interpolation: { escapeValue: false },
})

export function setAppLocale(locale: Locale) {
  if (i18n.resolvedLanguage !== locale) void i18n.changeLanguage(locale)
  document.documentElement.lang = locale
}

export const t = (key: TranslationKey, values?: Record<string, string | number>) =>
  i18n.t(key, values)
