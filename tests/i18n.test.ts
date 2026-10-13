import { expect, test } from "bun:test"
import { buttonDisplayLabel, type DeckButton } from "../shared/dock"
import { i18n, resolveLocale, t } from "../shared/i18n"
import { localizeNativeMessage } from "../shared/nativeMessages"
import english from "../shared/locales/en-US.json"
import spanish from "../shared/locales/es-ES.json"

test("locale files keep the same keys and interpolation variables", () => {
  const variables = (message: string) =>
    [...message.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).sort()

  expect(Object.keys(spanish).sort()).toEqual(Object.keys(english).sort())
  for (const key of Object.keys(english) as (keyof typeof english)[]) {
    expect(english[key].trim()).not.toBe("")
    expect(spanish[key].trim()).not.toBe("")
    expect(variables(spanish[key])).toEqual(variables(english[key]))
  }
})

test("Spanish variants resolve to Spain; unsupported languages fall back to US English", () => {
  expect(resolveLocale("es-MX")).toBe("es-ES")
  expect(resolveLocale("es-ES")).toBe("es-ES")
  expect(resolveLocale("fr-FR")).toBe("en-US")
  expect(resolveLocale(undefined)).toBe("en-US")
})

test("translations, plurals, and native errors switch language", async () => {
  await i18n.changeLanguage("es-ES")
  expect(t("desktop.pair.title")).toBe("Conecta tu móvil")
  expect(t("desktop.nav.connectedPhones", { count: 1 })).toBe("1 móvil conectado")
  expect(localizeNativeMessage("Botón no encontrado")).toBe("Botón no encontrado")

  await i18n.changeLanguage("en-US")
  expect(t("desktop.pair.title")).toBe("Connect your phone")
  expect(t("desktop.nav.connectedPhones", { count: 2 })).toBe("2 phones connected")
  expect(localizeNativeMessage("Botón no encontrado")).toBe("Button not found")
})

test("preset labels follow the viewer without changing custom button labels", async () => {
  const button: DeckButton = {
    id: "test",
    label: "Reproducir",
    icon: "play",
    image: null,
    color: "#1c2420",
    actionKind: "media",
    actionValue: "play_pause",
  }
  await i18n.changeLanguage("en-US")
  expect(buttonDisplayLabel(button)).toBe("Play")
  expect(buttonDisplayLabel({ ...button, label: "Mi botón" })).toBe("Mi botón")
})
