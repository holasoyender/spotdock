import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { i18n, t } from "../../../shared/i18n"
import {
  type DockConfig,
  type Weather,
  weatherTemperature,
  weatherText,
} from "../../../shared/dock"

function WeatherIcon({ weather, className }: { weather: Weather; className?: string }) {
  const code = weather.code
  const Icon =
    code === 0
      ? weather.isDay
        ? Sun
        : Moon
      : code <= 2
        ? weather.isDay
          ? CloudSun
          : CloudMoon
        : code === 3
          ? Cloud
          : code <= 48
            ? CloudFog
            : code <= 57
              ? CloudDrizzle
              : code <= 67 || (code <= 82 && code >= 80)
                ? CloudRain
                : code <= 86
                  ? CloudSnow
                  : CloudLightning
  return <Icon className={className} strokeWidth={1.4} />
}

export function ClockView({
  now,
  config,
  weather,
  connected,
  paired,
  onOpenPlayer,
  onPair,
}: {
  now: Date
  config: DockConfig
  weather: Weather | null
  connected: boolean
  paired: boolean
  onOpenPlayer: () => void
  onPair: () => void
}) {
  const time = now.toLocaleTimeString(i18n.resolvedLanguage, {
    hour: "2-digit",
    minute: "2-digit",
    second: config.showSeconds ? "2-digit" : undefined,
    hour12: config.hourFormat === "12",
  })
  const date = now.toLocaleDateString(i18n.resolvedLanguage, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  const hour = ((now.getHours() % 12) + now.getMinutes() / 60) * 30
  const minute = (now.getMinutes() + now.getSeconds() / 60) * 6
  const second = now.getSeconds() * 6
  return (
    <main
      className="relative flex min-h-0 flex-1 items-center gap-4 overflow-hidden"
      onClick={onOpenPlayer}
      aria-label={t("mobile.clock.openPlayer")}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_32%_58%,var(--dock-accent),transparent_55%)] opacity-[0.055]" />
      <div className="relative flex min-w-0 flex-1 flex-col items-center justify-center py-3 text-center">
        {config.clockStyle === "analog" ? (
          <div className="relative aspect-square h-[min(62vh,360px)] max-h-full rounded-full border-2 border-white/20 bg-white/[0.025] shadow-[0_25px_90px_rgba(0,0,0,.35)]">
            <div className="absolute inset-[8%] rounded-full border border-white/8" />
            {Array.from({ length: 12 }, (_, index) => (
              <span
                key={index}
                className="absolute left-1/2 top-1/2 h-[42%] w-0.5 origin-bottom -translate-x-1/2 -translate-y-full"
                style={{ rotate: `${index * 30}deg` }}
              >
                <span
                  className={`block h-2 w-0.5 rounded-full ${index % 3 === 0 ? "bg-white/80" : "bg-white/30"}`}
                />
              </span>
            ))}
            <span
              className="absolute left-1/2 top-1/2 h-[27%] w-1.5 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-white"
              style={{ rotate: `${hour}deg` }}
            />
            <span
              className="absolute left-1/2 top-1/2 h-[37%] w-1 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-white"
              style={{ rotate: `${minute}deg` }}
            />
            {config.showSeconds && (
              <span
                className="absolute left-1/2 top-1/2 h-[40%] w-0.5 origin-bottom -translate-x-1/2 -translate-y-full dock-accent-bg"
                style={{ rotate: `${second}deg` }}
              />
            )}
            <span className="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full dock-accent-bg" />
          </div>
        ) : (
          <div
            className={`whitespace-nowrap tabular-nums leading-none text-white ${config.showSeconds || config.hourFormat === "12" ? (config.digitalStyle === "bold" ? "text-[clamp(2.8rem,8vw,7rem)] font-semibold tracking-[-0.065em]" : "text-[clamp(2.8rem,8vw,7rem)] font-light tracking-[-0.04em]") : config.digitalStyle === "bold" ? "text-[clamp(4rem,12vw,11rem)] font-semibold tracking-[-0.075em]" : "text-[clamp(4rem,11vw,10rem)] font-light tracking-[-0.055em]"}`}
          >
            {time}
          </div>
        )}
        {config.showDate && (
          <p className="mt-5 text-base capitalize text-white/55 sm:text-xl">{date}</p>
        )}
        {!connected && !paired && (
          <Button
            variant="outline"
            className="mt-5 gap-2 border-white/20"
            onClick={(event) => {
              event.stopPropagation()
              onPair()
            }}
          >
            {t("mobile.clock.connectPc")}
          </Button>
        )}
      </div>
      {config.showWeather && (
        <aside className="relative flex w-[29%] min-w-44 max-w-72 shrink-0 flex-col items-center justify-center border-l border-white/8 py-5 pl-4 text-center sm:pl-8">
          {weather ? (
            <>
              <WeatherIcon weather={weather} className="size-14 dock-accent-text sm:size-20" />
              <div className="mt-3 text-3xl font-semibold tabular-nums sm:text-5xl">
                {weatherTemperature(weather.temperatureC, config.weatherUnit)}
              </div>
              <div className="mt-2 text-sm text-white/65 sm:text-base">
                {weatherText(weather.code, weather.isDay)}
              </div>
              <div className="mt-1 truncate text-xs text-white/40">
                {config.weatherLocation?.name}
              </div>
              <div className="mt-4 text-[10px] text-white/25">Open-Meteo</div>
            </>
          ) : (
            <>
              <CloudSun className="size-14 text-white/20" />
              <p className="mt-3 text-sm text-white/40">
                {connected ? t("common.loadingWeather") : t("mobile.clock.weatherWhenConnected")}
              </p>
            </>
          )}
        </aside>
      )}
    </main>
  )
}
