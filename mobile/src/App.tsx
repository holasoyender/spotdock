import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { Format, requestPermissions, scan } from "@tauri-apps/plugin-barcode-scanner"
import { DockNavigation } from "./components/dock/DockNavigation"
import { MobileSettings } from "./components/dock/MobileSettings"
import { NotificationBanner } from "./components/dock/NotificationBanner"
import { ClockView } from "./views/ClockView"
import { PlayerView } from "./views/PlayerView"
import { DeckView } from "./views/DeckView"
import { validAddress } from "./connection/address"
import { useDockConnection, type View } from "./connection/useDockConnection"
import { readStored } from "./lib/storage"
import type { Preferences } from "./preferences"
import { foregroundForColor, isHexColor, isScreenOff, type DeckButton } from "../../shared/dock"
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
    weather,
    desktopLocale,
    actionMessage,
    notifications,
    setNotifications,
    screenOff: desktopScreenOff,
    setActionMessage,
    sendAction,
    resetConnection,
  } = useDockConnection({ url, setUrl, setManual, setView, seeking, lastActivity, setError })
  const connected = status === "connected"
  const screenOff = connected ? desktopScreenOff : isScreenOff(config.screenSchedule, clock)
  const locale = language === "auto" ? desktopLocale : resolveLocale(language)
  const color = isHexColor(accent) ? accent : "#b8ef64"
  const theme = {
    "--dock-accent": color,
    "--dock-accent-ink": foregroundForColor(color),
    filter: `brightness(${preferences.brightness}%)`,
  } as CSSProperties

  useEffect(() => {
    localStorage.setItem("spotdock:preferences", JSON.stringify(preferences))
  }, [preferences])
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
        view === "player" &&
        !track.playing &&
        Date.now() - lastActivity.current > config.returnAfterSeconds * 1000
      )
        setView("clock")
    }, 1000)
    return () => clearInterval(timer)
  }, [view, track.playing, config.returnAfterSeconds])
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
      <div className="relative flex h-full min-h-0 flex-col px-5 py-4 sm:px-9 sm:py-5">
        {!navigationVisible && !settings && (
          <button
            type="button"
            aria-label={t("mobile.nav.show")}
            onPointerDown={revealNavigation}
            className="absolute inset-x-0 top-0 z-10 h-20 bg-transparent sm:h-24"
          />
        )}
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
            config={config}
            weather={weather}
            connected={connected}
            paired={Boolean(url)}
            onOpenPlayer={() => openView("player")}
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
        {view === "deck" && (
          <DeckView
            buttons={config.buttons}
            connected={connected}
            onPress={pressButton}
            message={actionMessage}
          />
        )}
      </div>
      <MobileSettings
        settings={settings}
        setSettings={setSettings}
        manual={manual}
        setManual={setManual}
        saveAddress={saveAddress}
        scanCode={scanCode}
        error={error}
        preferences={preferences}
        setPreference={setPreference}
        forget={forget}
        language={language}
        desktopLocale={desktopLocale}
        onLanguageChange={setLanguage}
      />
      {notifications[0] && (
        <NotificationBanner key={notifications[0].id} notification={notifications[0]} />
      )}
      {screenOff && <div className="fixed inset-0 z-[100] bg-black" aria-hidden="true" />}
    </div>
  )
}
