import { useId } from "react"
import { Checkbox } from "@base-ui/react/checkbox"
import { Dialog } from "@base-ui/react/dialog"
import { Radio } from "@base-ui/react/radio"
import { RadioGroup } from "@base-ui/react/radio-group"
import { Select } from "@base-ui/react/select"
import { Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Alarm, AlarmDevice } from "../../../../shared/alarms"
import { t } from "../../../../shared/i18n"

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const
const fieldClass =
  "h-10 rounded-md border border-white/15 bg-[#101312] px-3 text-sm text-white focus-visible:border-[var(--dock-accent)] focus-visible:ring-2 focus-visible:ring-[var(--dock-accent)]/25"

type Props = {
  draft: Alarm
  devices: AlarmDevice[]
  isNew: boolean
  onChange: (alarm: Alarm) => void
  onSave: () => void
  onCancel: () => void
}

function DesktopAlarmSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Select.Root value={value} onValueChange={(next) => next && onChange(next)}>
      <Select.Trigger
        id={id}
        className={`${fieldClass} flex w-full items-center justify-between gap-3 text-left outline-none`}
      >
        <Select.Value>
          {(selected: string) => options.find((option) => option.value === selected)?.label ?? ""}
        </Select.Value>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-white/50" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={5} alignItemWithTrigger={false} className="z-[200]">
          <Select.Popup className="max-h-[min(240px,45dvh)] w-[var(--anchor-width)] overflow-y-auto rounded-md border border-white/15 bg-[#1b211e] p-1 text-sm text-white shadow-2xl outline-none">
            <Select.List>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  className="flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-sm px-3 py-2 outline-none data-highlighted:bg-white/10 data-selected:bg-white/5"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="dock-accent-text">
                    <Check className="size-4" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}

function EditorFields({ draft, devices, onChange }: Pick<Props, "draft" | "devices" | "onChange">) {
  const formId = useId()
  const targetMode = draft.targetIds.length === 0 ? "all" : "selected"
  return (
    <div className="grid gap-6 py-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-time`}>{t("alarms.time")}</Label>
          <Input
            id={`${formId}-time`}
            type="time"
            value={draft.time}
            onChange={(event) => onChange({ ...draft, time: event.target.value })}
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-snooze`}>{t("alarms.snooze")}</Label>
          <DesktopAlarmSelect
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

      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wide uppercase">{t("alarms.days")}</p>
        <div className="grid grid-cols-7 gap-1.5 rounded-md border border-white/10 bg-white/3 p-2">
          {days.map((day, index) => {
            const selected = draft.days.includes(index)
            return (
              <Button
                key={day}
                type="button"
                size="xs"
                variant="outline"
                aria-pressed={selected}
                className={`min-w-0 px-1 ${selected ? "border-[var(--dock-accent)]/50 dock-accent-soft dock-accent-text" : "border-white/10 text-white/55"}`}
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
              </Button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-name`}>{t("alarms.name")}</Label>
          <Input
            id={`${formId}-name`}
            maxLength={80}
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            className={fieldClass}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-message`}>{t("alarms.message")}</Label>
          <Input
            id={`${formId}-message`}
            maxLength={300}
            value={draft.message}
            onChange={(event) => onChange({ ...draft, message: event.target.value })}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${formId}-tone`}>{t("alarms.tone")}</Label>
          <DesktopAlarmSelect
            id={`${formId}-tone`}
            value={draft.tone}
            options={(["system", "classic", "gentle", "urgent"] as const).map((tone) => ({
              value: tone,
              label: t(`alarms.tone.${tone}`),
            }))}
            onChange={(value) => onChange({ ...draft, tone: value as Alarm["tone"] })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${formId}-dismiss`}>{t("alarms.dismiss")}</Label>
          <DesktopAlarmSelect
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
        <div className="space-y-3 border-t border-white/10 pt-5">
          <p className="text-xs font-semibold tracking-wide uppercase">{t("alarms.devices")}</p>
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
                className="flex items-center gap-3 rounded-md border border-white/10 bg-[#101312] px-3"
              >
                <Radio.Root
                  id={`${formId}-${option.value}`}
                  value={option.value}
                  className="flex size-4 items-center justify-center rounded-full border border-white/40 outline-none data-checked:border-[var(--dock-accent)] focus-visible:ring-2 focus-visible:ring-[var(--dock-accent)]"
                >
                  <Radio.Indicator className="size-2 rounded-full bg-[var(--dock-accent)]" />
                </Radio.Root>
                <label
                  htmlFor={`${formId}-${option.value}`}
                  className="flex-1 cursor-pointer py-2.5 text-sm"
                >
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
                    className="flex items-center gap-3 rounded-md border border-white/10 bg-white/3 px-3"
                  >
                    <Checkbox.Root
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
                      className="flex size-4 shrink-0 items-center justify-center rounded-sm border border-white/40 outline-none data-checked:border-[var(--dock-accent)] data-checked:bg-[var(--dock-accent)] focus-visible:ring-2 focus-visible:ring-[var(--dock-accent)] data-disabled:opacity-40"
                    >
                      <Checkbox.Indicator>
                        <Check className="size-3 text-[#101312]" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <label
                      htmlFor={`${formId}-${device.id}`}
                      className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 py-2.5 text-sm"
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
    </div>
  )
}

export function DesktopAlarmEditor({ draft, devices, isNew, onChange, onSave, onCancel }: Props) {
  return (
    <Dialog.Root open onOpenChange={(open) => !open && onCancel()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-sm" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-[101] flex max-h-[calc(100dvh-2rem)] w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border border-white/15 bg-[#161c19] text-white shadow-2xl outline-none">
          <div className="border-b border-white/10 px-6 py-5">
            <Dialog.Title className="font-heading text-lg font-semibold tracking-wider uppercase">
              {isNew ? t("alarms.add") : t("alarms.edit")}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-white/50">
              {t("alarms.description")}
            </Dialog.Description>
          </div>
          <div className="min-h-0 overflow-y-auto px-6">
            <EditorFields draft={draft} devices={devices} onChange={onChange} />
          </div>
          <div className="flex justify-end gap-2 border-t border-white/10 px-6 py-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              disabled={!draft.time || draft.days.length === 0}
              onClick={onSave}
              className="dock-accent-bg"
            >
              {t("common.save")}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
