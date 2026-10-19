import { useEffect, useState } from "react"
import { CloudSun, MapPin, X } from "lucide-react"
import { WeatherIcon } from "../components/dock/WeatherIcon"
import { forecastForToday } from "../weather/forecast"
import { i18n, t } from "../../../shared/i18n"
import {
  weatherTemperature,
  weatherText,
  type DailyForecast,
  type DockConfig,
  type HourlyForecast,
  type Location,
  type WeatherForecast,
} from "../../../shared/dock"

function dayLabel(date: string, today: string) {
  if (date === today) return t("mobile.weather.today")
  const [year, month, day] = date.split("-").map(Number)
  return new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

function hourLabel(value: string, hourFormat: DockConfig["hourFormat"]) {
  const hour = Number(value.slice(11, 13))
  return new Intl.DateTimeFormat(i18n.resolvedLanguage, {
    hour: "numeric",
    minute: "2-digit",
    hour12: hourFormat === "12",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2020, 0, 1, hour)))
}

type Selection = { kind: "hour"; value: HourlyForecast } | { kind: "day"; value: DailyForecast }

export function WeatherView({
  now,
  config,
  location,
  forecast,
  loading,
  onLocationSettings,
  onActivity,
}: {
  now: Date
  config: DockConfig
  location: Location | null
  forecast: WeatherForecast | null
  loading: boolean
  onLocationSettings: () => void
  onActivity: () => void
}) {
  const [selection, setSelection] = useState<Selection | null>(null)
  const selected = forecast ? forecastForToday(forecast, now) : null
  function choose(next: Selection | null) {
    setSelection(next)
    onActivity()
  }
  useEffect(() => {
    if (!selection) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") choose(null)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [selection])
  return (
    <main
      className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-hidden py-1"
      onPointerDown={onActivity}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_15%,var(--dock-accent),transparent_60%)] opacity-[0.08]" />
      <button
        type="button"
        onClick={onLocationSettings}
        className="relative flex w-fit max-w-full items-center gap-1.5 rounded-lg px-2 py-1 text-xs dock-accent-text hover:bg-white/5"
      >
        <MapPin className="size-3.5 shrink-0" />
        <span className="truncate">{location?.name ?? t("mobile.weather.chooseLocation")}</span>
      </button>
      {!selected || (selected.hourly.length === 0 && selected.daily.length === 0) ? (
        <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-white/8 bg-white/3 text-center">
          <CloudSun className="size-9 text-white/35" />
          <p className="mt-3 text-sm text-white/50">
            {!location
              ? t("mobile.weather.chooseLocation")
              : loading
                ? t("common.loadingWeather")
                : t("mobile.weather.unavailable")}
          </p>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col gap-2">
          <section aria-label={t("mobile.weather.hourly")} className="flex min-h-0 flex-1 flex-col">
            <h2 className="mb-1 text-xs font-semibold text-white/65">
              {t("mobile.weather.hourly")}
            </h2>
            <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto pb-1">
              {selected.hourly.length ? (
                selected.hourly.map((hour, index) => (
                  <button
                    type="button"
                    onClick={() => choose({ kind: "hour", value: hour })}
                    key={`${hour.time}-${index}`}
                    className={`flex h-full min-w-22 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-1 transition-colors hover:bg-white/10 ${index === 0 ? "border-[var(--dock-accent)]/35 bg-white/8" : "border-white/8 bg-white/3"}`}
                  >
                    <span className="text-xs text-white/55">
                      {hourLabel(hour.time, config.hourFormat)}
                    </span>
                    <WeatherIcon
                      code={hour.code}
                      isDay={hour.isDay}
                      className="size-6 dock-accent-text"
                    />
                    <span className="text-base font-semibold tabular-nums">
                      {weatherTemperature(hour.temperatureC, config.weatherUnit)}
                    </span>
                  </button>
                ))
              ) : (
                <p className="py-4 text-sm text-white/45">{t("mobile.weather.noHours")}</p>
              )}
            </div>
          </section>
          <section aria-label={t("mobile.weather.weekly")} className="flex min-h-0 flex-1 flex-col">
            <h2 className="mb-1 text-xs font-semibold text-white/65">
              {t("mobile.weather.weekly")}
            </h2>
            <div className="flex min-h-0 flex-1 gap-2 overflow-x-auto pb-1">
              {selected.daily.map((day) => (
                <button
                  type="button"
                  onClick={() => choose({ kind: "day", value: day })}
                  key={day.date}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-white/8 bg-white/3 px-2 py-1 transition-colors hover:bg-white/10"
                >
                  <span className="text-xs capitalize text-white/60">
                    {dayLabel(day.date, selected.local.date)}
                  </span>
                  <WeatherIcon code={day.code} isDay className="size-6 dock-accent-text" />
                  <div className="flex gap-1.5 text-xs tabular-nums">
                    <strong>{weatherTemperature(day.maxC, config.weatherUnit)}</strong>
                    <span className="text-white/45">
                      {weatherTemperature(day.minC, config.weatherUnit)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {selection && (
        <WeatherDetail
          selection={selection}
          config={config}
          today={selected?.local.date ?? ""}
          onClose={() => choose(null)}
        />
      )}
    </main>
  )
}

function WeatherDetail({
  selection,
  config,
  today,
  onClose,
}: {
  selection: Selection
  config: DockConfig
  today: string
  onClose: () => void
}) {
  const hour = selection.kind === "hour" ? selection.value : null
  const day = selection.kind === "day" ? selection.value : null
  const title = hour ? hourLabel(hour.time, config.hourFormat) : dayLabel(day!.date, today)
  const code = hour?.code ?? day!.code
  const rows = hour
    ? [
        [
          t("mobile.weather.temperature"),
          weatherTemperature(hour.temperatureC, config.weatherUnit),
        ],
        [
          t("mobile.weather.feelsLike"),
          hour.apparentC === null ? "—" : weatherTemperature(hour.apparentC, config.weatherUnit),
        ],
        [
          t("mobile.weather.precipitation"),
          hour.precipitationProbability === null
            ? "—"
            : `${Math.round(hour.precipitationProbability)}%`,
        ],
        [
          t("mobile.weather.wind"),
          hour.windKmh === null ? "—" : `${Math.round(hour.windKmh)} km/h`,
        ],
      ]
    : [
        [t("mobile.weather.high"), weatherTemperature(day!.maxC, config.weatherUnit)],
        [t("mobile.weather.low"), weatherTemperature(day!.minC, config.weatherUnit)],
        [
          t("mobile.weather.precipitation"),
          day!.precipitationProbability === null
            ? "—"
            : `${Math.round(day!.precipitationProbability)}%`,
        ],
        [
          t("mobile.weather.wind"),
          day!.windKmh === null ? "—" : `${Math.round(day!.windKmh)} km/h`,
        ],
        [t("mobile.weather.sunrise"), day!.sunrise?.slice(11) ?? "—"],
        [t("mobile.weather.sunset"), day!.sunset?.slice(11) ?? "—"],
      ]
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl border border-white/15 bg-[#141817] p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <WeatherIcon
              code={code}
              isDay={hour?.isDay ?? true}
              className="size-10 dock-accent-text"
            />
            <div>
              <h2 className="text-lg font-semibold capitalize">{title}</h2>
              <p className="text-sm text-white/55">{weatherText(code, hour?.isDay ?? true)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("mobile.weather.closeDetails")}
            className="rounded-lg p-1 text-white/60 hover:bg-white/10"
          >
            <X className="size-5" />
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/5 px-3 py-2">
              <dt className="text-xs text-white/50">{label}</dt>
              <dd className="mt-0.5 font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}
