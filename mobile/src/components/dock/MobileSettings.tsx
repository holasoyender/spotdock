import { useRef, useState } from "react"
import { MapPin, QrCode, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import type { Preferences } from "@/preferences.ts"
import { t, type LanguagePreference, type Locale } from "../../../../shared/i18n"
import { LanguageSelect } from "./LanguageSelect"
import { searchWeatherLocations } from "@/weather/openMeteo.ts"
import type { DockConfig, Location, ScreenSchedule } from "../../../../shared/dock"
import { i18n } from "../../../../shared/i18n"
import type { ClockSettings } from "@/localSettings.ts"
import { MobileClockSettings } from "./MobileClockSettings"
import { MobileAccentSettings } from "./MobileAccentSettings"
import { MobileScheduleSettings } from "./MobileScheduleSettings"
import { MobileDedicatedSettings } from "./MobileDedicatedSettings"

type Props = {
  settings: boolean
  setSettings: (open: boolean) => void
  manual: string
  setManual: (value: string) => void
  saveAddress: (value: string) => void
  scanCode: () => void
  error: string
  preferences: Preferences
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  forget: () => void
  language: LanguagePreference
  desktopLocale: Locale
  onLanguageChange: (language: LanguagePreference) => void
  localWeatherLocation: Location | null
  desktopWeatherLocation: Location | null
  onWeatherLocationChange: (location: Location | null) => void
  paired: boolean
  clockConfig: DockConfig
  localClock: ClockSettings | null
  onClockChange: (change: Partial<ClockSettings>) => void
  onClockReset: () => void
  localSchedule: ScreenSchedule | null
  onScheduleChange: (schedule: ScreenSchedule | null) => void
  accent: string
  localAccent: string | null
  onAccentChange: (accent: string | null) => void
}

export function MobileSettings({
  settings,
  setSettings,
  manual,
  setManual,
  saveAddress,
  scanCode,
  error,
  preferences,
  setPreference,
  forget,
  language,
  desktopLocale,
  onLanguageChange,
  localWeatherLocation,
  desktopWeatherLocation,
  onWeatherLocationChange,
  paired,
  clockConfig,
  localClock,
  onClockChange,
  onClockReset,
  localSchedule,
  onScheduleChange,
  accent,
  localAccent,
  onAccentChange,
}: Props) {
  const [cityQuery, setCityQuery] = useState("")
  const [locations, setLocations] = useState<Location[]>([])
  const [searching, setSearching] = useState(false)
  const [locationError, setLocationError] = useState(false)
  const searchController = useRef<AbortController | null>(null)
  async function searchCity() {
    if (cityQuery.trim().length < 2) {
      setLocationError(true)
      return
    }
    searchController.current?.abort()
    const controller = new AbortController()
    searchController.current = controller
    setSearching(true)
    setLocationError(false)
    try {
      setLocations(
        await searchWeatherLocations(
          cityQuery,
          i18n.resolvedLanguage?.startsWith("es") ? "es" : "en",
          controller.signal,
        ),
      )
    } catch {
      if (!controller.signal.aborted) setLocationError(true)
    } finally {
      if (!controller.signal.aborted) setSearching(false)
    }
  }
  return (
    <Sheet open={settings} onOpenChange={setSettings}>
      <SheetContent
        initialFocus={false}
        className="w-95 max-w-[90vw] overflow-y-auto border-white/10 bg-[#141817] text-white"
      >
        <SheetHeader>
          <SheetTitle className="text-white">{t("mobile.settings.title")}</SheetTitle>
          <SheetDescription className="text-white/50">
            {t("mobile.settings.description")}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-6 pb-8">
          <div className="order-last space-y-2 border-t border-white/10 pt-5">
            <Label htmlFor="manual-url">{t("mobile.settings.manual")}</Label>
            <Input
              id="manual-url"
              placeholder="ws://192.168.1.x:47917/ws?token=…"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              className="text-xs"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 dock-accent-bg dock-accent-hover"
                onClick={() => saveAddress(manual)}
              >
                {t("mobile.settings.connect")}
              </Button>
              <Button variant="outline" onClick={scanCode} aria-label={t("common.scanQr")}>
                <QrCode className="size-4" />
              </Button>
            </div>
            {error && (
              <p className="text-xs text-rose-300" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="order-first space-y-2 border-b border-white/10 pb-5">
            <Label htmlFor="weather-city">{t("mobile.weather.locationSetting")}</Label>
            <p className="text-xs text-white/45">
              {localWeatherLocation
                ? `${localWeatherLocation.name}, ${localWeatherLocation.country}`
                : desktopWeatherLocation
                  ? t("mobile.weather.fromDesktop", { city: desktopWeatherLocation.name })
                  : t("mobile.weather.noLocation")}
            </p>
            <div className="flex gap-2">
              <Input
                id="weather-city"
                value={cityQuery}
                onChange={(event) => setCityQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void searchCity()
                }}
                placeholder={t("mobile.weather.searchCity")}
              />
              <Button
                variant="outline"
                onClick={() => void searchCity()}
                disabled={searching}
                aria-label={t("mobile.weather.searchCity")}
              >
                <Search className="size-4" />
              </Button>
            </div>
            {locationError && (
              <p role="alert" className="text-xs text-rose-300">
                {t("mobile.weather.searchError")}
              </p>
            )}
            {locations.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {locations.map((location) => (
                  <Button
                    key={`${location.latitude},${location.longitude}`}
                    variant="ghost"
                    className="h-auto w-full justify-start text-left"
                    onClick={() => {
                      onWeatherLocationChange(location)
                      setLocations([])
                      setCityQuery("")
                    }}
                  >
                    <MapPin className="mr-2 size-4 shrink-0" />
                    <span className="min-w-0 truncate">
                      {location.name}
                      {location.admin1 ? ` · ${location.admin1}` : ""}, {location.country}
                    </span>
                  </Button>
                ))}
              </div>
            )}
            {localWeatherLocation && (
              <Button
                variant="outline"
                className="w-full border-white/15"
                onClick={() => onWeatherLocationChange(null)}
              >
                {t(paired ? "mobile.weather.useDesktop" : "mobile.weather.clearLocation")}
              </Button>
            )}
          </div>
          <MobileClockSettings
            config={clockConfig}
            local={localClock}
            paired={paired}
            onChange={onClockChange}
            onReset={onClockReset}
          />
          <MobileAccentSettings
            accent={accent}
            local={localAccent}
            paired={paired}
            onChange={onAccentChange}
          />
          <MobileScheduleSettings
            schedule={clockConfig.screenSchedule}
            local={localSchedule}
            paired={paired}
            onChange={onScheduleChange}
          />
          <MobileDedicatedSettings open={settings} />
          <div className="flex items-center justify-between">
            <Label htmlFor="awake">{t("mobile.settings.keepAwake")}</Label>
            <Switch
              id="awake"
              checked={preferences.awake}
              onCheckedChange={(value) => setPreference("awake", value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="compact">{t("mobile.settings.compact")}</Label>
            <Switch
              id="compact"
              checked={preferences.compact}
              onCheckedChange={(value) => setPreference("compact", value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile-language">{t("common.language")}</Label>
            <LanguageSelect id="mobile-language" value={language} onChange={onLanguageChange} />
            <p className="text-xs text-white/45">
              {t(paired ? "mobile.settings.autoHelp" : "mobile.settings.autoHelpDevice", {
                language: t(desktopLocale === "es-ES" ? "common.spanish" : "common.english"),
              })}
            </p>
          </div>
          <div className="space-y-3">
            <Label>{t("mobile.settings.brightness", { value: preferences.brightness })}</Label>
            <Slider
              min={35}
              max={100}
              value={[preferences.brightness]}
              onValueChange={(value) =>
                setPreference("brightness", typeof value === "number" ? value : value[0])
              }
              className="dock-slider"
            />
          </div>
          {paired && (
            <Button
              variant="outline"
              className="order-last w-full border-white/15"
              onClick={forget}
            >
              {t("mobile.settings.forget")}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
