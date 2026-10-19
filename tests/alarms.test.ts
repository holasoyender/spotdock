import { describe, expect, test } from "bun:test"
import { forDevice, mergeAlarms, type Alarm } from "../shared/alarms"

const base: Alarm = {
  id: "a",
  time: "07:00",
  days: [0, 1, 2, 3, 4, 5, 6],
  title: "Wake up",
  message: "",
  enabled: true,
  tone: "system",
  dismissMode: "slide",
  snoozeMinutes: 10,
  targetIds: [],
  updatedAt: 1,
}

describe("alarm synchronization", () => {
  test("offline edits win over an older desktop copy", () => {
    const edited = { ...base, time: "08:00", updatedAt: 3 }
    expect(mergeAlarms([edited], [{ ...base, updatedAt: 2 }])).toEqual([edited])
  })

  test("a newer deletion stays deleted after reconnect", () => {
    const deleted = { ...base, deleted: true, updatedAt: 4 }
    expect(forDevice(mergeAlarms([base], [deleted]), "phone-a")).toEqual([])
  })

  test("selected targets ring only on those phones", () => {
    const targeted = { ...base, targetIds: ["phone-a"] }
    expect(forDevice([targeted], "phone-a")).toEqual([targeted])
    expect(forDevice([targeted], "phone-b")).toEqual([])
  })
})
