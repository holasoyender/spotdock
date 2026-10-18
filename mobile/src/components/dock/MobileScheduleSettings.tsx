import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { ScreenSchedule } from "../../../../shared/dock"
import { t, type TranslationKey } from "../../../../shared/i18n"
import { validScreenSchedule } from "@/localSettings.ts"

const dayKeys: TranslationKey[] = [
  "desktop.schedule.monday",
  "desktop.schedule.tuesday",
  "desktop.schedule.wednesday",
  "desktop.schedule.thursday",
  "desktop.schedule.friday",
  "desktop.schedule.saturday",
  "desktop.schedule.sunday",
]

function copy(schedule: ScreenSchedule): ScreenSchedule {
  return schedule.map((day) => ({ ...day }))
}

export function MobileScheduleSettings({
  schedule,
  local,
  paired,
  onChange,
}: {
  schedule: ScreenSchedule
  local: ScreenSchedule | null
  paired: boolean
  onChange: (value: ScreenSchedule | null) => void
}) {
  const [draft, setDraft] = useState(() => copy(schedule))
  const [error, setError] = useState(false)
  useEffect(() => {
    setDraft(copy(schedule))
    setError(false)
  }, [schedule])
  function update(index: number, change: Partial<ScreenSchedule[number]>) {
    setDraft((current) =>
      current.map((day, position) => (position === index ? { ...day, ...change } : day)),
    )
    setError(false)
  }
  function save() {
    if (!validScreenSchedule(draft)) {
      setError(true)
      return
    }
    onChange(copy(draft))
    setError(false)
  }
  return (
    <details className="rounded-xl border border-white/10 bg-white/3 p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        {t("mobile.settings.scheduleSection")}
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-xs text-white/45">
          {local
            ? t("mobile.settings.localOverride")
            : paired
              ? t("mobile.settings.fromPc")
              : t("mobile.settings.localDefaults")}
        </p>
        <p className="text-xs text-white/55">{t("mobile.settings.scheduleHelp")}</p>
        <div className="space-y-3">
          {dayKeys.map((key, index) => {
            const day = draft[index]
            return (
              <div key={key} className="rounded-lg border border-white/8 bg-black/10 p-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(enabled) => update(index, { enabled })}
                    aria-label={t(key)}
                  />
                  <span className="text-sm font-medium">{t(key)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-xs text-white/55">
                    {t("desktop.schedule.on")}
                    <Input
                      type="time"
                      value={day.on}
                      disabled={!day.enabled}
                      onChange={(event) => update(index, { on: event.target.value })}
                      className="mt-1 min-w-0 px-1 text-xs"
                      aria-label={`${t(key)}: ${t("desktop.schedule.on")}`}
                    />
                  </label>
                  <label className="text-xs text-white/55">
                    {t("desktop.schedule.off")}
                    <Input
                      type="time"
                      value={day.off}
                      disabled={!day.enabled}
                      onChange={(event) => update(index, { off: event.target.value })}
                      className="mt-1 min-w-0 px-1 text-xs"
                      aria-label={`${t(key)}: ${t("desktop.schedule.off")}`}
                    />
                  </label>
                </div>
              </div>
            )
          })}
        </div>
        {error && (
          <p role="alert" className="text-xs text-rose-300">
            {t("desktop.schedule.invalid")}
          </p>
        )}
        <Button className="w-full dock-accent-bg" onClick={save}>
          {t("mobile.settings.saveSchedule")}
        </Button>
        {local && (
          <Button
            variant="outline"
            className="w-full border-white/15"
            onClick={() => onChange(null)}
          >
            {paired ? t("mobile.settings.usePc") : t("mobile.settings.resetDefaults")}
          </Button>
        )}
      </div>
    </details>
  )
}
