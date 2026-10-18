import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { Format, requestPermissions, scan } from "@tauri-apps/plugin-barcode-scanner"
import { DockNavigation } from "./components/dock/DockNavigation"
import { MobileSettings } from "./components/dock/MobileSettings"
import { NotificationBanner } from "./components/dock/NotificationBanner"
import { ClockView } from "./views/ClockView"
import { WeatherView } from "./views/WeatherView"
import { PlayerView } from "./views/PlayerView"
import { DeckView } from "./views/DeckView"
import { validAddress } from "./connection/address"
import { useDockConnection, type View } from "./connection/useDockConnection"
import { readStored } from "./lib/storage"
import { useWeather } from "./weather/useWeather"
import {
  clockSettingsFrom,
  mobileScheduledOff,
  readLocalSetting,
  resolveMobileConfig,
  validAccent,
  validClockSettings,
  validScreenSchedule,
  type ClockSettings,
} from "./localSettings"
import type { Preferences } from "./preferences"
import {
  foregroundForColor,
  isHexColor,
  type DeckButton,
  type Location,
  type ScreenSchedule,
} from "../../shared/dock"
import type { ControlAction as Action } from "../../shared/protocol"
import {
  isLanguagePreference,
  resolveLocale,
  setAppLocale,
  t,
  type LanguagePreference,
} from "../../shared/i18n"
import { localizeNativeMessage } from "../../shared/nativeMessages"

export default function App() {
  useTranslation()
  const [url, setUrl] = useState(() => readStored("spotdock:url", ""))
  const [manual, setManual] = useState(url)
  const [clock, setClock] = useState(new Date())
  const [view, setView] = useState<View>("clock")
  const [preferences, setPreferences] = useState<Preferences>(() =>
    readStored("spotdock:preferences", { awake: true, brightness: 100, compact: false }),
  )
  const [settings, setSettings] = useState(false)
  const [weatherDialogOpen, setWeatherDialogOpen] = useState(false)
  const [localWeatherLocation, setLocalWeatherLocation] = useState<Location | null>(() =>
    readStored("spotdock:weather-location", null),
  )
  const [localClock, setLocalClock] = useState<ClockSettings | null>(() =>
    readLocalSetting("spotdock:local-clock", validClockSettings),
  )
  const [localSchedule, setLocalSchedule] = useState<ScreenSchedule | null>(() =>
    readLocalSetting("spotdock:local-schedule", validScreenSchedule),
  )
  const [localAccent, setLocalAccent] = useState<string | null>(() =>
    readLocalSetting("spotdock:local-accent", validAccent),
  )
  const [wakeUntil, setWakeUntil] = useState(0)
  const [language, setLanguage] = useState<LanguagePreference>(() => {
    const saved = readStored<unknown>("spotdock:language", "auto")
    return isLanguagePreference(saved) ? saved : "auto"
  })
  const [error, setError] = useState("")
  const [navigationVisible, setNavigationVisible] = useState(false)
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seeking = useRef(false)
  const lastActivity = useRef(Date.now())
  const {
    status,
    track,
    position,
    setPosition,
    accent,
    config,
    desktopLocale,
    actionMessage,
    notifications,
    setNotifications,
    screenOff: desktopScreenOff,
    setActionMessage,
    sendAction,
    resetConnection,
  } = useDockConnection({ url, setUrl, setManual, setView, seeking, lastActivity, setError })
  const effectiveConfig = resolveMobileConfig(config, Boolean(url), localClock, localSchedule)
  const desktopWeatherLocation = url ? config.weatherLocation : null
  const weatherLocation = localWeatherLocation ?? desktopWeatherLocation
  const {
    weather,
    forecast,
    loading: weatherLoading,
    error: weatherError,
  } = useWeather(weatherLocation)
  const connected = status === "connected"
  const scheduledOff = mobileScheduledOff(
    effectiveConfig.screenSchedule,
    localSchedule,
    connected,
    desktopScreenOff,
    clock,
  )
  const screenOff = scheduledOff && !settings && clock.getTime() >= wakeUntil
  const autoLocale = url ? desktopLocale : resolveLocale(navigator.language)
  const locale = language === "auto" ? autoLocale : resolveLocale(language)
  const selectedAccent = localAccent ?? (url ? accent : "#b8ef64")
  const color = isHexColor(selectedAccent) ? selectedAccent : "#b8ef64"
  const theme = {
    "--dock-accent": color,
    "--dock-accent-ink": foregroundForColor(color),
    filter: `brightness(${preferences.brightness}%)`,
  } as CSSProperties

  useEffect(() => {
    localStorage.setItem("spotdock:preferences", JSON.stringify(preferences))
  }, [preferences])
  useEffect(() => {
    localStorage.setItem("spotdock:weather-location", JSON.stringify(localWeatherLocation))
  }, [localWeatherLocation])
  useEffect(() => {
    localStorage.setItem("spotdock:local-clock", JSON.stringify(localClock))
  }, [localClock])
  useEffect(() => {
    localStorage.setItem("spotdock:local-schedule", JSON.stringify(localSchedule))
  }, [localSchedule])
  useEffect(() => {
    localStorage.setItem("spotdock:local-accent", JSON.stringify(localAccent))
  }, [localAccent])
  useEffect(() => {
    setAppLocale(locale)
    setError("")
    setActionMessage("")
  }, [locale])
  useEffect(() => {
    localStorage.setItem("spotdock:language", JSON.stringify(language))
  }, [language])
  useEffect(() => {
    if (notifications.length === 0) return
    const timer = setTimeout(() => setNotifications((current) => current.slice(1)), 5000)
    return () => clearTimeout(timer)
  }, [notifications])
  useEffect(() => {
    if (!preferences.awake || !("wakeLock" in navigator)) return
    let lock: WakeLockSentinel | undefined
    let active = true
    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request("screen")
        if (!active) await lock.release()
      } catch {
        /* unavailable */
      }
    }
    acquire()
    const onVisibility = () => {
      if (document.visibilityState === "visible") acquire()
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      active = false
      document.removeEventListener("visibilitychange", onVisibility)
      lock?.release()
    }
  }, [preferences.awake])
  useEffect(() => {
    const timer = setInterval(() => {
      setClock(new Date())
      if (track.playing && status === "connected")
        setPosition((value) => Math.min(track.durationMs, value + 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [track.playing, track.durationMs, status])
  useEffect(() => {
    const timer = setInterval(() => {
      if (
        !settings &&
        !weatherDialogOpen &&
        (view === "weather" || (view === "player" && !track.playing)) &&
        Date.now() - lastActivity.current > effectiveConfig.returnAfterSeconds * 1000
      )
        setView(view === "weather" && track.playing ? "player" : "clock")
    }, 1000)
    return () => clearInterval(timer)
  }, [view, track.playing, effectiveConfig.returnAfterSeconds, settings, weatherDialogOpen])
  useEffect(
    () => () => {
      if (navigationTimer.current) clearTimeout(navigationTimer.current)
    },
    [],
  )
  useEffect(() => {
    if (settings) {
      if (navigationTimer.current) clearTimeout(navigationTimer.current)
      setNavigationVisible(false)
    }
  }, [settings])
  function openView(next: View) {
    lastActivity.current = Date.now()
    setView(next)
  }
  function revealNavigation() {
    if (settings) return
    setNavigationVisible(true)
    if (navigationTimer.current) clearTimeout(navigationTimer.current)
    navigationTimer.current = setTimeout(() => setNavigationVisible(false), 5000)
  }
  function saveAddress(value: string) {
    if (!validAddress(value)) {
      setError(t("mobile.error.address"))
      return
    }
    setError("")
    setUrl(value.trim())
    setSettings(false)
  }
  async function scanCode() {
    try {
      const permission = await requestPermissions()
      if (permission === "denied") throw new Error(t("mobile.error.camera"))
      const result = await scan({ formats: [Format.QRCode], cameraDirection: "back" })
      saveAddress(result.content)
    } catch (cause) {
      setError(localizeNativeMessage(cause))
      setSettings(true)
    }
  }
  function send(action: Action) {
    lastActivity.current = Date.now()
    sendAction(action)
  }
  function pressButton(button: DeckButton) {
    lastActivity.current = Date.now()
    setActionMessage("")
    if (button.actionKind === "view") {
      openView(button.actionValue as View)
      return
    }
    if (!sendAction({ action: "deck", button_id: button.id }))
      setActionMessage(t("mobile.error.notConnected"))
  }
  function forget() {
    resetConnection()
    localStorage.removeItem("spotdock:url")
    setUrl("")
    setManual("")
    setView("clock")
    setSettings(false)
  }
  const setPreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setPreferences((current) => ({ ...current, [key]: value }))
  const patchClock = (change: Partial<ClockSettings>) =>
    setLocalClock((current) => ({ ...(current ?? clockSettingsFrom(effectiveConfig)), ...change }))

  return (
    <div className="dark relative h-screen overflow-hidden bg-[#090b0b] text-white" style={theme}>
      {view === "player" && connected && track.artwork && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src={track.artwork}
            alt=""
            className="absolute left-[12%] top-[-45%] h-[190%] w-[76%] scale-125 object-cover opacity-[0.3] blur-[90px] saturate-150"
          />
          <div className="absolute inset-0 bg-[#090b0b]/20" />
        </div>
      )}
      <div
        className="relative flex h-full min-h-0 flex-col px-5 py-4 sm:px-9 sm:py-5"
        onPointerDownCapture={(event) => {
          if (
            !navigationVisible &&
            !settings &&
            event.clientY <= 80 &&
            !(event.target instanceof Element && event.target.closest("button"))
          )
            revealNavigation()
        }}
      >
        <DockNavigation
          navigationVisible={navigationVisible}
          view={view}
          connected={connected}
          status={status}
          openView={openView}
          scanCode={scanCode}
          setSettings={setSettings}
        />
        {view === "clock" && (
          <ClockView
            now={clock}
            config={effectiveConfig}
            weather={weather}
            weatherLocation={weatherLocation}
            weatherError={weatherError}
            showWeather={effectiveConfig.showWeather}
            connected={connected}
            showPairingPrompt={!url && !localWeatherLocation}
            onOpenPlayer={() => openView("player")}
            onOpenWeather={() => openView("weather")}
            onPair={scanCode}
          />
        )}
        {view === "player" && (
          <PlayerView
            track={track}
            position={position}
            setPosition={setPosition}
            seeking={seeking}
            send={send}
            compact={preferences.compact}
            onActivity={() => {
              lastActivity.current = Date.now()
            }}
          />
        )}
        {view === "weather" && (
          <WeatherView
            now={clock}
            config={effectiveConfig}
            location={weatherLocation}
            forecast={forecast}
            loading={weatherLoading}
            onLocationSettings={() => setSettings(true)}
            onDialogChange={setWeatherDialogOpen}
            onActivity={() => {
              lastActivity.current = Date.now()
            }}
          />
        )}
        {view === "deck" && (
          <DeckView
            buttons={effectiveConfig.buttons}
            connected={connected}
            onPress={pressButton}
            message={actionMessage}
          />
        )}
      </div>
      <MobileSettings
        settings={settings}
        setSettings={(open) => {
          lastActivity.current = Date.now()
          setSettings(open)
        }}
        manual={manual}
        setManual={setManual}
        saveAddress={saveAddress}
        scanCode={scanCode}
        error={error}
        preferences={preferences}
        setPreference={setPreference}
        forget={forget}
        language={language}
        desktopLocale={autoLocale}
        onLanguageChange={setLanguage}
        localWeatherLocation={localWeatherLocation}
        desktopWeatherLocation={desktopWeatherLocation}
        onWeatherLocationChange={setLocalWeatherLocation}
        paired={Boolean(url)}
        clockConfig={effectiveConfig}
        localClock={localClock}
        onClockChange={patchClock}
        onClockReset={() => setLocalClock(null)}
        localSchedule={localSchedule}
        onScheduleChange={setLocalSchedule}
        accent={color}
        localAccent={localAccent}
        onAccentChange={setLocalAccent}
      />
      {notifications[0] && (
        <NotificationBanner key={notifications[0].id} notification={notifications[0]} />
      )}
      {screenOff && (
        <button
          type="button"
          className="fixed inset-0 z-[100] bg-black"
          aria-label={t("mobile.settings.temporaryWake")}
          onClick={() => setWakeUntil(Date.now() + 60_000)}
        />
      )}
    </div>
  )
}
