import { describe, expect, test } from "bun:test"
import { defaultScreenSchedule, isScreenOff } from "../shared/dock"

describe("screen schedule", () => {
  test("an enabled day is black outside its on interval", () => {
    const schedule = defaultScreenSchedule.map((day) => ({ ...day }))
    schedule[0].enabled = true
    expect(isScreenOff(schedule, new Date(2026, 9, 19, 6, 59))).toBe(true)
    expect(isScreenOff(schedule, new Date(2026, 9, 19, 7, 0))).toBe(false)
    expect(isScreenOff(schedule, new Date(2026, 9, 19, 23, 0))).toBe(true)
  })

  test("disabled days stay visible", () => {
    expect(isScreenOff(defaultScreenSchedule, new Date(2026, 9, 20, 2, 0))).toBe(false)
  })

  test("an overnight on interval continues into the next enabled day", () => {
    const schedule = defaultScreenSchedule.map((day) => ({ ...day, enabled: true }))
    schedule[0] = { enabled: true, on: "20:00", off: "02:00" }
    expect(isScreenOff(schedule, new Date(2026, 9, 19, 19, 59))).toBe(true)
    expect(isScreenOff(schedule, new Date(2026, 9, 19, 20, 0))).toBe(false)
    expect(isScreenOff(schedule, new Date(2026, 9, 20, 1, 59))).toBe(false)
    expect(isScreenOff(schedule, new Date(2026, 9, 20, 2, 0))).toBe(true)
  })
})
