import { describe, expect, test } from "bun:test"
import { defaultDockConfig, defaultScreenSchedule } from "../shared/dock"
import {
  clockSettingsFrom,
  mobileScheduledOff,
  resolveMobileConfig,
  validClockSettings,
  validScreenSchedule,
} from "../mobile/src/localSettings"

describe("independent mobile settings", () => {
  test("follows paired settings until the clock is customized locally", () => {
    const desktop = {
      ...defaultDockConfig,
      clockStyle: "analog" as const,
      weatherUnit: "F" as const,
    }
    expect(resolveMobileConfig(desktop, true, null, null).clockStyle).toBe("analog")
    expect(resolveMobileConfig(desktop, false, null, null).clockStyle).toBe("digital")
    const local = { ...clockSettingsFrom(desktop), clockStyle: "digital" as const }
    const overridden = resolveMobileConfig(desktop, true, local, null)
    expect(overridden.clockStyle).toBe("digital")
    expect(overridden.weatherUnit).toBe("F")
    expect(overridden.buttons).toBe(desktop.buttons)
  })

  test("local schedule takes precedence over the PC and works without it", () => {
    const local = defaultScreenSchedule.map((day, index) =>
      index === 0 ? { enabled: true, on: "08:00", off: "20:00" } : { ...day },
    )
    const mondayNight = new Date(2026, 9, 19, 21, 0)
    expect(mobileScheduledOff(local, local, true, false, mondayNight)).toBe(true)
    expect(mobileScheduledOff(defaultScreenSchedule, null, true, true, mondayNight)).toBe(true)
    expect(mobileScheduledOff(local, local, false, false, mondayNight)).toBe(true)
    expect(mobileScheduledOff(defaultScreenSchedule, null, false, true, mondayNight)).toBe(false)
  })

  test("rejects invalid persisted clock and weekly schedule values", () => {
    expect(validClockSettings(clockSettingsFrom(defaultDockConfig))).toBe(true)
    expect(
      validClockSettings({ ...clockSettingsFrom(defaultDockConfig), returnAfterSeconds: -1 }),
    ).toBe(false)
    expect(validScreenSchedule(defaultScreenSchedule)).toBe(true)
    expect(validScreenSchedule(defaultScreenSchedule.slice(0, 6))).toBe(false)
    expect(validScreenSchedule(Array(7))).toBe(false)
    expect(
      validScreenSchedule(
        defaultScreenSchedule.map((day, index) => (index === 0 ? { ...day, on: day.off } : day)),
      ),
    ).toBe(false)
  })
})
