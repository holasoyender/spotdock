import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { CloudSun, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Segmented } from "./components/desktop/Segmented"
import { i18n, t } from "../../shared/i18n"
import { localizeNativeMessage } from "../../shared/nativeMessages"
import { type DockConfig, type Location } from "../../shared/dock"
import { clockFonts, readClockFontFile, useClockFont } from "../../shared/clockFonts"

type ChangeConfig = (config: DockConfig) => Promise<void>

function ClockPreview({ config }: { config: DockConfig }) {
  const [now, setNow] = useState(new Date())
  const clockFontFamily = useClockFont(config)
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
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
    <div className="relative flex min-h-64 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-[#0a0d0c] p-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,var(--dock-accent),transparent_58%)] opacity-[0.07]" />
      {config.clockStyle === "analog" ? (
        <div className="relative size-40 rounded-full border-2 border-white/20 bg-white/3 shadow-2xl">
          <span className="absolute inset-3 rounded-full border border-dashed border-white/10" />
          <span
            className="absolute left-1/2 top-1/2 h-12 w-1 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-white"
            style={{ rotate: `${hour}deg` }}
          />
          <span
            className="absolute left-1/2 top-1/2 h-16 w-0.5 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-white"
            style={{ rotate: `${minute}deg` }}
          />
          {config.showSeconds && (
            <span
              className="absolute left-1/2 top-1/2 h-[72px] w-px origin-bottom -translate-x-1/2 -translate-y-full dock-accent-bg"
              style={{ rotate: `${second}deg` }}
            />
          )}
          <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full dock-accent-bg" />
        </div>
      ) : (
        <div
          className={`relative tabular-nums tracking-tight ${config.showSeconds || config.hourFormat === "12" ? (config.digitalStyle === "bold" ? "text-4xl font-semibold" : "text-4xl font-light tracking-wider") : config.digitalStyle === "bold" ? "text-6xl font-semibold" : "text-6xl font-light tracking-widest"}`}
          style={{ fontFamily: clockFontFamily }}
        >
          {time}
        </div>
      )}
      {config.showDate && <p className="relative mt-5 text-sm capitalize text-white/55">{date}</p>}
      {config.showWeather && (
        <p className="relative mt-3 flex items-center gap-2 text-sm dock-accent-text">
          <CloudSun className="size-4" />
          {config.weatherLocation?.name ?? t("desktop.clock.noLocation")}
        </p>
      )}
    </div>
  )
}

export function ClockSettings({
  config,
  onChange,
}: {
  config: DockConfig
  onChange: ChangeConfig
}) {
  const [query, setQuery] = useState("")
  const [locations, setLocations] = useState<Location[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState("")
  const [fontError, setFontError] = useState("")
  const patch = (changes: Partial<DockConfig>) => {
    void onChange({ ...config, ...changes }).catch(() => {})
  }
  async function search() {
    if (query.trim().length < 2) {
      setError(t("desktop.clock.shortQuery"))
      return
    }
    setSearching(true)
    setError("")
    try {
      const found = await invoke<Location[]>("search_locations", { query })
      setLocations(found)
      if (!found.length) setError(t("desktop.clock.noResults"))
    } catch (cause) {
      setError(t("desktop.clock.searchFailed", { error: localizeNativeMessage(cause) }))
    } finally {
      setSearching(false)
    }
  }
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <Card className="border-white/8 bg-[#141817]">
          <CardHeader>
            <CardTitle>{t("desktop.clock.title")}</CardTitle>
            <CardDescription>{t("desktop.clock.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>{t("desktop.clock.style")}</Label>
              <Segmented
                value={config.clockStyle}
                options={[
                  { value: "digital", label: t("desktop.clock.digital") },
                  { value: "analog", label: t("desktop.clock.analog") },
                ]}
                onChange={(clockStyle) => patch({ clockStyle })}
              />
            </div>
            {config.clockStyle === "digital" && (
              <>
                <div className="space-y-2">
                  <Label>{t("desktop.clock.digitalStyle")}</Label>
                  <Segmented
                    value={config.digitalStyle}
                    options={[
                      { value: "bold", label: t("desktop.clock.bold") },
                      { value: "minimal", label: t("desktop.clock.minimal") },
                    ]}
                    onChange={(digitalStyle) => patch({ digitalStyle })}
                  />
                </div>
                <div className="space-y-3">
                  <Label>{t("desktop.clock.font")}</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {clockFonts.map((font) => (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => patch({ clockFont: font.id })}
                        aria-pressed={(config.clockFont ?? "inter") === font.id}
                        className={`rounded-xl border px-3 py-2 text-left transition-colors ${config.clockFont === font.id || (!config.clockFont && font.id === "inter") ? "border-[var(--dock-accent)] bg-white/8" : "border-white/10 hover:border-white/25"}`}
                      >
                        <span className="block text-xs text-white/60">{font.name}</span>
                        <span
                          className="block text-2xl tabular-nums"
                          style={{ fontFamily: font.family }}
                        >
                          12:48
                        </span>
                      </button>
                    ))}
                    {config.customClockFont && (
                      <button
                        type="button"
                        onClick={() => patch({ clockFont: "custom" })}
                        aria-pressed={config.clockFont === "custom"}
                        className={`rounded-xl border px-3 py-2 text-left transition-colors ${config.clockFont === "custom" ? "border-[var(--dock-accent)] bg-white/8" : "border-white/10 hover:border-white/25"}`}
                      >
                        <span className="block truncate text-xs text-white/60">
                          {config.customClockFont.name}
                        </span>
                        <span
                          className="block text-2xl tabular-nums"
                          style={{
                            fontFamily:
                              config.clockFont === "custom"
                                ? "'SpotDock Custom Clock', sans-serif"
                                : undefined,
                          }}
                        >
                          12:48
                        </span>
                      </button>
                    )}
                  </div>
                  <Label
                    htmlFor="clock-font-file"
                    className="block cursor-pointer text-xs text-white/65 underline underline-offset-4"
                  >
                    {t("desktop.clock.importFont")}
                  </Label>
                  <Input
                    id="clock-font-file"
                    type="file"
                    accept=".woff2,.woff,.ttf,.otf"
                    className="sr-only"
                    onChange={async (event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      try {
                        const customClockFont = await readClockFontFile(file)
                        setFontError("")
                        patch({ clockFont: "custom", customClockFont })
                      } catch {
                        setFontError(t("desktop.clock.fontError"))
                      }
                      event.target.value = ""
                    }}
                  />
                  <p className="text-xs text-white/40">{t("desktop.clock.fontHelp")}</p>
                  {fontError && (
                    <p role="alert" className="text-xs text-rose-300">
                      {fontError}
                    </p>
                  )}
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>{t("desktop.clock.timeFormat")}</Label>
              <Segmented
                value={config.hourFormat}
                options={[
                  { value: "24", label: "24 horas" },
                  { value: "12", label: "12 horas" },
                ]}
                onChange={(hourFormat) => patch({ hourFormat })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="clock-seconds">{t("desktop.clock.showSeconds")}</Label>
              <Switch
                id="clock-seconds"
                checked={config.showSeconds}
                onCheckedChange={(showSeconds) => patch({ showSeconds })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="clock-date">{t("desktop.clock.showDate")}</Label>
              <Switch
                id="clock-date"
                checked={config.showDate}
                onCheckedChange={(showDate) => patch({ showDate })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="clock-auto">{t("desktop.clock.autoPlayer")}</Label>
              <Switch
                id="clock-auto"
                checked={config.autoPlayer}
                onCheckedChange={(autoPlayer) => patch({ autoPlayer })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="return-seconds">{t("desktop.clock.returnAfter")}</Label>
              <Input
                id="return-seconds"
                type="number"
                min={5}
                max={300}
                value={config.returnAfterSeconds}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (value >= 5 && value <= 300) patch({ returnAfterSeconds: value })
                }}
                className="max-w-36"
              />
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/8 bg-[#141817]">
          <CardHeader>
            <CardTitle>{t("desktop.clock.weatherTitle")}</CardTitle>
            <CardDescription>{t("desktop.clock.weatherDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-weather">{t("desktop.clock.showWeather")}</Label>
              <Switch
                id="show-weather"
                checked={config.showWeather}
                onCheckedChange={(showWeather) => patch({ showWeather })}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("desktop.clock.temperatureUnit")}</Label>
              <Segmented
                value={config.weatherUnit}
                options={[
                  { value: "C", label: "°C" },
                  { value: "F", label: "°F" },
                ]}
                onChange={(weatherUnit) => patch({ weatherUnit })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city-search">{t("desktop.clock.city")}</Label>
              <div className="flex gap-2">
                <Input
                  id="city-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") search()
                  }}
                  placeholder={t("desktop.clock.searchCity")}
                />
                <Button
                  variant="outline"
                  onClick={search}
                  disabled={searching}
                  aria-label={t("desktop.clock.searchCity")}
                >
                  <Search className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-white/40">
                {t("desktop.clock.currentCity", {
                  city: config.weatherLocation
                    ? `${config.weatherLocation.name}, ${config.weatherLocation.country}`
                    : t("desktop.clock.noCity"),
                })}
              </p>
              {error && (
                <p role="alert" className="text-xs text-rose-300">
                  {error}
                </p>
              )}
              {locations.length > 0 && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
                  {locations.map((location) => (
                    <Button
                      key={`${location.latitude}-${location.longitude}`}
                      variant="ghost"
                      className="h-auto w-full justify-start text-left"
                      onClick={() => {
                        patch({ weatherLocation: location })
                        setLocations([])
                        setQuery("")
                      }}
                    >
                      {location.name}
                      {location.admin1 ? ` · ${location.admin1}` : ""}, {location.country}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-white/35">{t("desktop.clock.attribution")}</p>
          </CardContent>
        </Card>
      </div>
      <div className="min-w-0 space-y-4">
        <ClockPreview config={config} />
        <p className="px-2 text-xs leading-relaxed text-white/40">
          {t("desktop.clock.previewHelp")}
        </p>
      </div>
    </div>
  )
}
