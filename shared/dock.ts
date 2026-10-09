export type Location = {
  name: string
  country: string
  admin1?: string | null
  latitude: number
  longitude: number
}
export type Weather = {
  temperatureC: number
  apparentC: number
  code: number
  isDay: boolean
  updatedAt: string
}
export type DeckButton = {
  id: string
  label: string
  icon: string
  image: string | null
  color: string
  actionKind: "url" | "app" | "shortcut" | "media" | "view"
  actionValue: string
}
export type DockConfig = {
  clockStyle: "digital" | "analog"
  digitalStyle: "bold" | "minimal"
  hourFormat: "12" | "24"
  showSeconds: boolean
  showDate: boolean
  showWeather: boolean
  weatherUnit: "C" | "F"
  weatherLocation: Location | null
  autoPlayer: boolean
  returnAfterSeconds: number
  buttons: DeckButton[]
}

export const defaultDockConfig: DockConfig = {
  clockStyle: "digital",
  digitalStyle: "bold",
  hourFormat: "24",
  showSeconds: false,
  showDate: true,
  showWeather: true,
  weatherUnit: "C",
  weatherLocation: {
    name: "Madrid",
    country: "España",
    admin1: "Comunidad de Madrid",
    latitude: 40.4168,
    longitude: -3.7038,
  },
  autoPlayer: true,
  returnAfterSeconds: 30,
  buttons: [],
}

export function weatherText(code: number, isDay: boolean) {
  if (code === 0) return isDay ? "Despejado" : "Noche despejada"
  if (code === 1 || code === 2) return "Poco nuboso"
  if (code === 3) return "Nublado"
  if (code === 45 || code === 48) return "Niebla"
  if (code >= 51 && code <= 57) return "Llovizna"
  if (code >= 61 && code <= 67) return "Lluvia"
  if (code >= 71 && code <= 77) return "Nieve"
  if (code >= 80 && code <= 82) return "Chubascos"
  if (code >= 85 && code <= 86) return "Nieve"
  if (code >= 95) return "Tormenta"
  return "Tiempo variable"
}

export function weatherTemperature(celsius: number, unit: "C" | "F") {
  return `${Math.round(unit === "F" ? (celsius * 9) / 5 + 32 : celsius)}°${unit}`
}

export function foregroundForColor(hex: string) {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.58 ? "#111714" : "#ffffff"
}

export function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}
