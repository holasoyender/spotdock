import {
  defaultDockConfig,
  defaultScreenSchedule,
  isHexColor,
  isScreenOff,
  type DockConfig,
  type ScreenSchedule,
} from "../../shared/dock"

export type ClockSettings = Pick<
  DockConfig,
  | "clockStyle"
  | "digitalStyle"
  | "clockFont"
  | "customClockFont"
  | "hourFormat"
  | "showSeconds"
  | "showDate"
  | "showWeather"
  | "weatherUnit"
  | "returnAfterSeconds"
>

const clockKeys = [
  "clockStyle",
  "digitalStyle",
  "clockFont",
  "customClockFont",
  "hourFormat",
  "showSeconds",
  "showDate",
  "showWeather",
  "weatherUnit",
  "returnAfterSeconds",
] as const

export function clockSettingsFrom(config: DockConfig): ClockSettings {
  return Object.fromEntries(clockKeys.map((key) => [key, config[key]])) as ClockSettings
}

export function validClockSettings(value: unknown): value is ClockSettings {
  if (!value || typeof value !== "object") return false
  const settings = value as Partial<ClockSettings>
  return (
    (settings.clockStyle === "digital" || settings.clockStyle === "analog") &&
    (settings.digitalStyle === "bold" || settings.digitalStyle === "minimal") &&
    (settings.clockFont === undefined ||
      ["inter", "space-grotesk", "outfit", "jetbrains-mono", "custom"].includes(
        settings.clockFont,
      )) &&
    (settings.customClockFont === undefined ||
      settings.customClockFont === null ||
      (typeof settings.customClockFont.name === "string" &&
        settings.customClockFont.name.length <= 80 &&
        typeof settings.customClockFont.data === "string" &&
        settings.customClockFont.data.length <= 350_000 &&
        /^data:font\/(?:woff2|woff|ttf|otf);base64,[A-Za-z0-9+/]+={0,2}$/.test(
          settings.customClockFont.data,
        ))) &&
    (settings.clockFont !== "custom" || Boolean(settings.customClockFont)) &&
    (settings.hourFormat === "12" || settings.hourFormat === "24") &&
    typeof settings.showSeconds === "boolean" &&
    typeof settings.showDate === "boolean" &&
    typeof settings.showWeather === "boolean" &&
    (settings.weatherUnit === "C" || settings.weatherUnit === "F") &&
    typeof settings.returnAfterSeconds === "number" &&
    Number.isInteger(settings.returnAfterSeconds) &&
    settings.returnAfterSeconds >= 5 &&
    settings.returnAfterSeconds <= 300
  )
}

const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/

export function validScreenSchedule(value: unknown): value is ScreenSchedule {
  return (
    Array.isArray(value) &&
    value.length === 7 &&
    Array.from({ length: 7 }, (_, index) => value[index]).every(
      (day) =>
        day &&
        typeof day.enabled === "boolean" &&
        typeof day.on === "string" &&
        typeof day.off === "string" &&
        timePattern.test(day.on) &&
        timePattern.test(day.off) &&
        day.on !== day.off,
    )
  )
}

export function readLocalSetting<T>(
  key: string,
  validate: (value: unknown) => value is T,
): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    return validate(value) ? value : null
  } catch {
    return null
  }
}

export function validAccent(value: unknown): value is string {
  return typeof value === "string" && isHexColor(value)
}

/** A paired dock follows the PC until the user edits a block locally. */
export function resolveMobileConfig(
  desktop: DockConfig,
  paired: boolean,
  localClock: ClockSettings | null,
  localSchedule: ScreenSchedule | null,
): DockConfig {
  const base = paired ? desktop : defaultDockConfig
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(localClock ?? {}).filter(([, value]) => value !== undefined),
    ),
    screenSchedule: localSchedule ?? (paired ? base.screenSchedule : defaultScreenSchedule),
  }
}

export function mobileScheduledOff(
  schedule: ScreenSchedule,
  localSchedule: ScreenSchedule | null,
  connected: boolean,
  desktopScreenOff: boolean,
  now: Date,
): boolean {
  if (localSchedule) return isScreenOff(localSchedule, now)
  return connected ? desktopScreenOff : isScreenOff(schedule, now)
}
