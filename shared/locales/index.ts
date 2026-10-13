import english from "./en-US.json"
import spanish from "./es-ES.json"

export type TranslationKey = keyof typeof english

// Both directions are checked so missing or extra keys fail the TypeScript build.
export const resources = {
  "en-US": english satisfies Record<keyof typeof spanish, string>,
  "es-ES": spanish satisfies Record<TranslationKey, string>,
}
