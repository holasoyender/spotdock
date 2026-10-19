import { Dialog } from "@base-ui/react/dialog"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { useId } from "react"
import { AlarmButton, AlarmCheckbox, AlarmInput, AlarmSelect } from "./MobileAlarmControls"
import { type Alarm, type AlarmDevice } from "../../../../shared/alarms"
import { t } from "../../../../shared/i18n"

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const

type Props = {
  draft: Alarm
  devices: AlarmDevice[]
  isNew: boolean
  onChange: (alarm: Alarm) => void
  onSave: () => void
  onCancel: () => void
}

function EditorFields({ draft, devices, onChange, onSave, onCancel }: Omit<Props, "isNew">) {
  const formId = useId()
  const targetMode = draft.targetIds.length === 0 ? "all" : "selected"
  return (
    <div className="mt-5 flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-time`} className="font-medium text-white/85">
            {t("alarms.time")}
          </label>
          <AlarmInput
            id={`${formId}-time`}
            type="time"
            value={draft.time}
            onChange={(event) => onChange({ ...draft, time: event.target.value })}
            className="alarm-time-input"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-snooze`} className="font-medium text-white/85">
            {t("alarms.snooze")}
          </label>
          <AlarmSelect
            id={`${formId}-snooze`}
            value={String(draft.snoozeMinutes)}
            options={[0, 5, 10, 15, 20, 30].map((minutes) => ({
              value: String(minutes),
              label: minutes ? t("alarms.minutes", { count: minutes }) : t("alarms.disabled"),
            }))}
            onChange={(value) => onChange({ ...draft, snoozeMinutes: Number(value) })}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-medium text-white/85">{t("alarms.days")}</span>
        <div className="grid grid-cols-7 gap-2 rounded-xl border border-white/10 bg-white/3 p-2">
          {days.map((day, index) => {
            const selected = draft.days.includes(index)
            return (
              <AlarmButton
                key={day}
                variant="outline"
                aria-pressed={selected}
                className="min-w-0 px-1 text-xs sm:text-sm"
                style={
                  selected
                    ? {
                        borderColor: "var(--dock-accent)",
                        color: "var(--dock-accent)",
                        backgroundColor: "color-mix(in srgb, var(--dock-accent) 12%, transparent)",
                      }
                    : undefined
                }
                onClick={() =>
                  onChange({
                    ...draft,
                    days: selected
                      ? draft.days.filter((value) => value !== index)
                      : [...draft.days, index].sort(),
                  })
                }
              >
                {t(`alarms.day.${day}`)}
              </AlarmButton>
            )
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-name`} className="font-medium text-white/85">
            {t("alarms.name")}
          </label>
          <AlarmInput
            id={`${formId}-name`}
            maxLength={80}
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-message`} className="font-medium text-white/85">
            {t("alarms.message")}
          </label>
          <AlarmInput
            id={`${formId}-message`}
            maxLength={300}
            value={draft.message}
            onChange={(event) => onChange({ ...draft, message: event.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-tone`} className="font-medium text-white/85">
            {t("alarms.tone")}
          </label>
          <AlarmSelect
            id={`${formId}-tone`}
            value={draft.tone}
            options={(["system", "classic", "gentle", "urgent"] as const).map((tone) => ({
              value: tone,
              label: t(`alarms.tone.${tone}`),
            }))}
            onChange={(value) => onChange({ ...draft, tone: value as Alarm["tone"] })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor={`${formId}-dismiss`} className="font-medium text-white/85">
            {t("alarms.dismiss")}
          </label>
          <AlarmSelect
            id={`${formId}-dismiss`}
            value={draft.dismissMode}
            options={[
              { value: "tap", label: t("alarms.dismiss.tap") },
              { value: "slide", label: t("alarms.dismiss.slide") },
            ]}
            onChange={(value) => onChange({ ...draft, dismissMode: value as Alarm["dismissMode"] })}
          />
        </div>
      </div>

      {devices.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/3 p-4">
          <span className="font-medium text-white/85">{t("alarms.devices")}</span>
          <RadioGroup
            value={targetMode}
            onValueChange={(mode) =>
              onChange({
                ...draft,
                targetIds:
                  mode === "all" ? [] : draft.targetIds.length ? draft.targetIds : [devices[0].id],
              })
            }
            className="grid gap-2 sm:grid-cols-2"
          >
            {[
              { value: "all", label: t("alarms.allDevices") },
              { value: "selected", label: t("alarms.selectedDevices") },
            ].map((option) => (
              <div
                key={option.value}
                className="flex min-h-10 items-center gap-3 rounded-lg border border-white/10 bg-[#101715] px-3"
              >
                <Radio.Root
                  id={`${formId}-${option.value}`}
                  value={option.value}
                  className="flex size-5 shrink-0 items-center justify-center rounded-full border border-white/35 outline-none data-checked:border-[var(--dock-accent)] focus-visible:ring-2 focus-visible:ring-[var(--dock-accent)]"
                >
                  <Radio.Indicator className="size-2.5 rounded-full bg-[var(--dock-accent)]" />
                </Radio.Root>
                <label htmlFor={`${formId}-${option.value}`} className="flex-1 cursor-pointer py-2">
                  {option.label}
                </label>
              </div>
            ))}
          </RadioGroup>
          {targetMode === "selected" && (
            <div className="grid gap-2 sm:grid-cols-2">
              {devices.map((device) => {
                const checked = draft.targetIds.includes(device.id)
                return (
                  <div
                    key={device.id}
                    className="flex min-h-11 items-center gap-3 rounded-lg border border-white/10 bg-[#101715] px-3"
                  >
                    <AlarmCheckbox
                      id={`${formId}-${device.id}`}
                      checked={checked}
                      disabled={checked && draft.targetIds.length === 1}
                      onCheckedChange={(next) =>
                        onChange({
                          ...draft,
                          targetIds: next
                            ? [...draft.targetIds, device.id]
                            : draft.targetIds.filter((id) => id !== device.id),
                        })
                      }
                    />
                    <label
                      htmlFor={`${formId}-${device.id}`}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2"
                    >
                      <span className="truncate">{device.name}</span>
                      <span className="shrink-0 text-xs text-white/40">
                        {device.connected ? t("common.connected") : t("common.offline")}
                      </span>
                    </label>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
        <AlarmButton onClick={onCancel}>{t("common.cancel")}</AlarmButton>
        <AlarmButton
          variant="primary"
          disabled={!draft.time || draft.days.length === 0}
          onClick={onSave}
        >
          {t("common.save")}
        </AlarmButton>
      </div>
    </div>
  )
}

export function AlarmEditor({ draft, devices, isNew, onChange, onSave, onCancel }: Props) {
  const heading = isNew ? t("alarms.add") : t("alarms.edit")
  const fields = (
    <EditorFields
      draft={draft}
      devices={devices}
      onChange={onChange}
      onSave={onSave}
      onCancel={onCancel}
    />
  )
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[151] max-h-[calc(100dvh-2rem)] w-[min(92vw,780px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/20 bg-[#161c19] p-5 text-sm text-white shadow-2xl outline-none sm:p-6">
          <Dialog.Title className="text-lg font-semibold">{heading}</Dialog.Title>
          {fields}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
