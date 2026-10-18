import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import type { DockConfig } from "../../../../shared/dock"
import { t } from "../../../../shared/i18n"
import type { ClockSettings } from "@/localSettings.ts"

const selectClass =
  "w-full rounded-lg border border-white/15 bg-[#1d2321] px-3 py-2 text-sm text-white"

export function MobileClockSettings({
  config,
  local,
  paired,
  onChange,
  onReset,
}: {
  config: DockConfig
  local: ClockSettings | null
  paired: boolean
  onChange: (change: Partial<ClockSettings>) => void
  onReset: () => void
}) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/3 p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        {t("mobile.settings.clockSection")}
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-xs text-white/45">
          {local
            ? t("mobile.settings.localOverride")
            : paired
              ? t("mobile.settings.fromPc")
              : t("mobile.settings.localDefaults")}
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="mobile-clock-style">{t("desktop.clock.style")}</Label>
          <select
            id="mobile-clock-style"
            className={selectClass}
            value={config.clockStyle}
            onChange={(event) =>
              onChange({ clockStyle: event.target.value as ClockSettings["clockStyle"] })
            }
          >
            <option value="digital">{t("desktop.clock.digital")}</option>
            <option value="analog">{t("desktop.clock.analog")}</option>
          </select>
        </div>
        {config.clockStyle === "digital" && (
          <div className="space-y-1.5">
            <Label htmlFor="mobile-digital-style">{t("desktop.clock.digitalStyle")}</Label>
            <select
              id="mobile-digital-style"
              className={selectClass}
              value={config.digitalStyle}
              onChange={(event) =>
                onChange({ digitalStyle: event.target.value as ClockSettings["digitalStyle"] })
              }
            >
              <option value="bold">{t("desktop.clock.bold")}</option>
              <option value="minimal">{t("desktop.clock.minimal")}</option>
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="mobile-hour-format">{t("desktop.clock.timeFormat")}</Label>
          <select
            id="mobile-hour-format"
            className={selectClass}
            value={config.hourFormat}
            onChange={(event) =>
              onChange({ hourFormat: event.target.value as ClockSettings["hourFormat"] })
            }
          >
            <option value="24">{t("mobile.settings.hours24")}</option>
            <option value="12">{t("mobile.settings.hours12")}</option>
          </select>
        </div>
        {(["showSeconds", "showDate", "showWeather"] as const).map((key) => (
          <div key={key} className="flex items-center justify-between gap-3">
            <Label htmlFor={`mobile-${key}`}>
              {t(
                key === "showSeconds"
                  ? "desktop.clock.showSeconds"
                  : key === "showDate"
                    ? "desktop.clock.showDate"
                    : "desktop.clock.showWeather",
              )}
            </Label>
            <Switch
              id={`mobile-${key}`}
              checked={config[key]}
              onCheckedChange={(value) => onChange({ [key]: value })}
            />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="mobile-temperature-unit">{t("desktop.clock.temperatureUnit")}</Label>
          <select
            id="mobile-temperature-unit"
            className={selectClass}
            value={config.weatherUnit}
            onChange={(event) =>
              onChange({ weatherUnit: event.target.value as ClockSettings["weatherUnit"] })
            }
          >
            <option value="C">°C</option>
            <option value="F">°F</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mobile-return-after">{t("mobile.settings.returnAfter")}</Label>
          <Input
            id="mobile-return-after"
            type="number"
            min={5}
            max={300}
            value={config.returnAfterSeconds}
            onChange={(event) => {
              const value = Number(event.target.value)
              if (Number.isInteger(value) && value >= 5 && value <= 300)
                onChange({ returnAfterSeconds: value })
            }}
          />
        </div>
        {local && (
          <Button variant="outline" className="w-full border-white/15" onClick={onReset}>
            {paired ? t("mobile.settings.usePc") : t("mobile.settings.resetDefaults")}
          </Button>
        )}
      </div>
    </details>
  )
}
