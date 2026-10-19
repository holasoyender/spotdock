import { useState } from "react"
import { AlarmButton, AlarmSwitch } from "./MobileAlarmControls"
import { AlarmEditor } from "./MobileAlarmEditor"
import { newAlarm, type Alarm, type AlarmDevice } from "../../../../shared/alarms"
import { t } from "../../../../shared/i18n"

type Props = {
  alarms: Alarm[]
  devices: AlarmDevice[]
  onSave: (alarm: Alarm) => void
}

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

export function MobileAlarmPanel({ alarms, devices, onSave }: Props) {
  const [draft, setDraft] = useState<Alarm | null>(null)
  const active = alarms.filter((alarm) => !alarm.deleted)
  const save = (alarm: Alarm) =>
    onSave({ ...alarm, updatedAt: Math.max(Date.now(), alarm.updatedAt + 1) })

  return (
    <section className="flex min-w-0 flex-col gap-6 px-1 pb-6 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 px-1 py-1">
        <p className="max-w-2xl text-white/55">{t("alarms.description")}</p>
        <AlarmButton variant="primary" onClick={() => setDraft(newAlarm())}>
          {t("alarms.add")}
        </AlarmButton>
      </div>

      {active.length === 0 ? (
        <div className="mx-1 flex min-h-24 items-center justify-center rounded-xl border border-white/10 bg-white/3 px-6 py-8 text-center text-white/50">
          {t("alarms.empty")}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((alarm) => (
            <article
              key={alarm.id}
              className="min-w-0 rounded-xl border border-white/10 bg-white/4 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <strong className="text-2xl">{alarm.time}</strong>
                  <p className="truncate font-medium">{alarm.title || t("alarms.defaultTitle")}</p>
                  {alarm.message && (
                    <p className="mt-1 line-clamp-2 text-white/50">{alarm.message}</p>
                  )}
                </div>
                <AlarmSwitch
                  checked={alarm.enabled}
                  label={t("alarms.enabled")}
                  onCheckedChange={(enabled) => save({ ...alarm, enabled })}
                />
              </div>
              <p className="mt-4 text-xs text-white/50">
                {alarm.days.map((day) => t(`alarms.day.${days[day]}`)).join(" · ")}
              </p>
              <p className="mt-1 text-xs text-white/50">
                {alarm.targetIds.length
                  ? devices
                      .filter((device) => alarm.targetIds.includes(device.id))
                      .map((device) => device.name)
                      .join(", ") || t("alarms.selectedDevices")
                  : t("alarms.allDevices")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3">
                <AlarmButton variant="ghost" onClick={() => setDraft({ ...alarm })}>
                  {t("common.edit")}
                </AlarmButton>
                <AlarmButton variant="danger" onClick={() => save({ ...alarm, deleted: true })}>
                  {t("common.delete")}
                </AlarmButton>
              </div>
            </article>
          ))}
        </div>
      )}

      {draft && (
        <AlarmEditor
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
    </section>
  )
}
