import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { t, type TranslationKey } from "../../../../shared/i18n"
import {
  defaultScreenSchedule,
  type DockConfig,
  type ScreenSchedule,
} from "../../../../shared/dock"

const days: TranslationKey[] = [
  "desktop.schedule.monday",
  "desktop.schedule.tuesday",
  "desktop.schedule.wednesday",
  "desktop.schedule.thursday",
  "desktop.schedule.friday",
  "desktop.schedule.saturday",
  "desktop.schedule.sunday",
]

const copy = (schedule: ScreenSchedule) => schedule.map((day) => ({ ...day }))

export function ScreenSchedulePage({
  config,
  onChange,
}: {
  config: DockConfig
  onChange: (config: DockConfig) => Promise<void>
}) {
  const [draft, setDraft] = useState<ScreenSchedule>(() =>
    copy(config.screenSchedule ?? defaultScreenSchedule),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  useEffect(
    () => setDraft(copy(config.screenSchedule ?? defaultScreenSchedule)),
    [config.screenSchedule],
  )

  function update(index: number, change: Partial<ScreenSchedule[number]>) {
    setDraft((current) =>
      current.map((day, position) => (position === index ? { ...day, ...change } : day)),
    )
    setSaved(false)
  }

  async function save() {
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/
    if (draft.some((day) => !time.test(day.on) || !time.test(day.off) || day.on === day.off)) {
      setError(t("desktop.schedule.invalid"))
      return
    }
    setSaving(true)
    setError("")
    try {
      await onChange({ ...config, screenSchedule: copy(draft) })
      setSaved(true)
    } catch (cause) {
      setError(String(cause))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="min-w-0 border-white/8 bg-[#141817]">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
          <Moon className="size-5" />
        </div>
        <CardTitle>{t("desktop.schedule.title")}</CardTitle>
        <CardDescription>{t("desktop.schedule.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-xl border border-white/8 bg-white/3 p-4 text-sm text-white/55">
          {t("desktop.schedule.method")}
        </div>
        <div className="space-y-2">
          {days.map((name, index) => {
            const day = draft[index] ?? defaultScreenSchedule[index]
            return (
              <div
                key={name}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-white/8 p-3 sm:gap-5"
              >
                <div className="flex min-w-32 flex-1 items-center gap-3">
                  <Switch
                    checked={day.enabled}
                    onCheckedChange={(enabled) => update(index, { enabled })}
                    aria-label={t(name)}
                  />
                  <span className="text-sm font-medium">{t(name)}</span>
                </div>
                <label className="flex items-center gap-2 text-xs text-white/60">
                  <Sun className="size-4" />
                  {t("desktop.schedule.on")}
                  <Input
                    type="time"
                    value={day.on}
                    disabled={!day.enabled}
                    onChange={(event) => update(index, { on: event.target.value })}
                    className="w-27 rounded-md border border-white/12 px-2"
                    aria-label={`${t(name)}: ${t("desktop.schedule.on")}`}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs text-white/60">
                  <Moon className="size-4" />
                  {t("desktop.schedule.off")}
                  <Input
                    type="time"
                    value={day.off}
                    disabled={!day.enabled}
                    onChange={(event) => update(index, { off: event.target.value })}
                    className="w-27 rounded-md border border-white/12 px-2"
                    aria-label={`${t(name)}: ${t("desktop.schedule.off")}`}
                  />
                </label>
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={save} disabled={saving} className="dock-accent-bg">
            {t("desktop.schedule.save")}
          </Button>
          {saved && (
            <span role="status" className="text-sm dock-accent-text">
              {t("desktop.schedule.saved")}
            </span>
          )}
          {error && (
            <span role="alert" className="text-sm text-red-300">
              {error}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
