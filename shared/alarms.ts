/** Alarm times and weekdays use the phone's local time zone (Monday = 0). */
export type Alarm = {
  id: string
  time: string
  days: number[]
  title: string
  message: string
  enabled: boolean
  tone: "system" | "classic" | "gentle" | "urgent"
  dismissMode: "tap" | "slide"
  snoozeMinutes: number
  /** Empty means every paired phone. */
  targetIds: string[]
  updatedAt: number
  deleted?: boolean
}

export type AlarmDevice = { id: string; name: string; connected: boolean }

export function mergeAlarms(local: Alarm[], remote: Alarm[]): Alarm[] {
  const merged = new Map(local.map((alarm) => [alarm.id, alarm]))
  for (const alarm of remote) {
    if ((merged.get(alarm.id)?.updatedAt ?? -1) < alarm.updatedAt) merged.set(alarm.id, alarm)
  }
  return [...merged.values()].sort((a, b) => a.time.localeCompare(b.time))
}

export function forDevice(alarms: Alarm[], deviceId: string): Alarm[] {
  return alarms.filter(
    (alarm) =>
      !alarm.deleted &&
      alarm.enabled &&
      (alarm.targetIds.length === 0 || alarm.targetIds.includes(deviceId)),
  )
}

export function newAlarm(): Alarm {
  return {
    id: crypto.randomUUID(),
    time: "07:00",
    days: [0, 1, 2, 3, 4, 5, 6],
    title: "",
    message: "",
    enabled: true,
    tone: "system",
    dismissMode: "slide",
    snoozeMinutes: 10,
    targetIds: [],
    updatedAt: Date.now(),
  }
}
