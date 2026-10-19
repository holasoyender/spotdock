import { useState } from "react"
import { BellRing, Plus, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { newAlarm, type Alarm, type AlarmDevice } from "../../../../shared/alarms"
import { t } from "../../../../shared/i18n"
import { DesktopAlarmEditor } from "./DesktopAlarmEditor"

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

export function DesktopAlarmsPage({
  alarms,
  devices,
  onSave,
  onTest,
}: {
  alarms: Alarm[]
  devices: AlarmDevice[]
  onSave: (alarm: Alarm) => void
  onTest: (deviceId: string) => void
}) {
  const [draft, setDraft] = useState<Alarm | null>(null)
  const active = alarms.filter((alarm) => !alarm.deleted)
  const save = (alarm: Alarm) =>
    onSave({ ...alarm, updatedAt: Math.max(Date.now(), alarm.updatedAt + 1) })

  function targetLabel(alarm: Alarm) {
    if (alarm.targetIds.length === 0) return t("alarms.allDevices")
    return (
      devices
        .filter((device) => alarm.targetIds.includes(device.id))
        .map((device) => device.name)
        .join(", ") || t("alarms.selectedDevices")
    )
  }

  return (
    <div className="grid min-w-0 gap-5">
      <Card className="min-w-0 border-white/8 bg-[#141817]">
        <CardHeader className="gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0">
            <div className="mb-3 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
              <BellRing className="size-5" aria-hidden="true" />
            </div>
            <CardTitle>{t("alarms.title")}</CardTitle>
            <CardDescription className="mt-1">{t("alarms.description")}</CardDescription>
          </div>
          <Button onClick={() => setDraft(newAlarm())} className="dock-accent-bg">
            <Plus className="size-4" /> {t("alarms.add")}
          </Button>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/3 px-6 py-10 text-center text-sm text-white/55">
              {t("alarms.empty")}
            </div>
          ) : (
            <div className="grid gap-3">
              {active.map((alarm) => (
                <div
                  key={alarm.id}
                  className="flex min-w-0 flex-wrap items-center gap-4 rounded-xl border border-white/8 bg-white/3 px-5 py-4"
                >
                  <div className="w-28 shrink-0 font-heading text-3xl font-semibold tabular-nums tracking-tight">
                    {alarm.time}
                  </div>
                  <div className="min-w-40 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {alarm.title || t("alarms.defaultTitle")}
                    </p>
                    {alarm.message && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-white/55">{alarm.message}</p>
                    )}
                    <p className="mt-1.5 text-xs text-white/45">
                      {alarm.days.map((day) => t(`alarms.day.${days[day]}`)).join(" · ")}
                      <span aria-hidden="true"> · </span>
                      {targetLabel(alarm)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      checked={alarm.enabled}
                      aria-label={t("alarms.enabled")}
                      onCheckedChange={(enabled) => save({ ...alarm, enabled })}
                    />
                    <Button size="sm" variant="outline" onClick={() => setDraft({ ...alarm })}>
                      {t("common.edit")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-rose-300 hover:bg-rose-400/10 hover:text-rose-200"
                      onClick={() => save({ ...alarm, deleted: true })}
                    >
                      {t("common.delete")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {devices.length > 0 && (
        <Card className="min-w-0 border-white/8 bg-[#141817]">
          <CardHeader>
            <CardTitle>{t("alarms.testTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/3 px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Smartphone aria-hidden="true" className="size-4 shrink-0 dock-accent-text" />
                  <span className="truncate text-sm">{device.name}</span>
                  <span className="shrink-0 text-xs text-white/40">
                    {device.connected ? t("common.connected") : t("common.offline")}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!device.connected}
                  onClick={() => onTest(device.id)}
                >
                  {t("alarms.sendTest")}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {draft && (
        <DesktopAlarmEditor
          draft={draft}
          devices={devices}
          isNew={!active.some((alarm) => alarm.id === draft.id)}
          onChange={setDraft}
          onSave={() => {
            save(draft)
            setDraft(null)
          }}
          onCancel={() => setDraft(null)}
        />
      )}
    </div>
  )
}
