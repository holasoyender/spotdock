import { useEffect, useRef, useState, type CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { Smartphone } from "lucide-react"
import {
  resolveLocale,
  setAppLocale,
  t,
  type LanguagePreference,
  type Locale,
} from "../../shared/i18n"
import { localizeNativeMessage } from "../../shared/nativeMessages"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ClockSettings } from "./ClockSettings"
import { DeckSettings } from "./DeckSettings"
import { WindowChrome } from "./components/desktop/WindowChrome"
import { DesktopSidebar, PageHeading, type View } from "./components/desktop/DesktopNavigation"
import { Player } from "./components/desktop/Player"
import { PairingCard } from "./components/desktop/PairingCard"
import { SettingsPage } from "./components/desktop/SettingsPage"
import { NotificationsPage } from "./components/desktop/NotificationsPage"
import { ScreenSchedulePage } from "./components/desktop/ScreenSchedulePage"
import {
  defaultDockConfig,
  foregroundForColor,
  isHexColor,
  type DockConfig,
} from "../../shared/dock"
import type {
  ControlAction as Action,
  Pairing,
  Snapshot,
  SpotifyAuthStatus,
  Track,
  TrackUpdate,
} from "../../shared/protocol"

const empty: Track = {
  title: "",
  artist: "",
  album: "",
  artwork: null,
  positionMs: 0,
  durationMs: 0,
  playing: false,
  shuffle: false,
  repeat: "off",
  available: false,
}
const initial: Snapshot = {
  kind: "state",
  track: empty,
  clients: 0,
  accent: "#b8ef64",
  config: defaultDockConfig,
  screenOff: false,
  screenAt: 0,
  language: "auto",
  locale: "en-US",
  media: { source: "none", message: null },
}

function applyLocale(locale: Locale) {
  const selected = resolveLocale(locale)
  setAppLocale(selected)
  localStorage.setItem("spotdock:locale", selected)
}

export default function App() {
  useTranslation()
  const [view, setView] = useState<View>("player")
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const [state, setState] = useState<Snapshot>(initial)
  const [position, setPosition] = useState(0)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [autostart, setAutostart] = useState(false)
  const [autostartPending, setAutostartPending] = useState(false)
  const [host, setHost] = useState(() => localStorage.getItem("spotdock:host") ?? "")
  const [spotify, setSpotify] = useState<SpotifyAuthStatus>({
    connected: false,
    pending: false,
    clientId: "",
    error: null,
  })
  const [spotifyClientId, setSpotifyClientId] = useState("")
  const seeking = useRef(false)
  const accent = isHexColor(state.accent) ? state.accent : initial.accent
  const validHost =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(host) && host.split(".").every((part) => Number(part) <= 255)
  const pairingUrl =
    pairing && validHost ? pairing.url.replace(new URL(pairing.url).hostname, host) : pairing?.url
  const theme = {
    "--dock-accent": accent,
    "--dock-accent-ink": foregroundForColor(accent),
  } as CSSProperties

  useEffect(() => {
    invoke<Pairing>("get_pairing")
      .then(setPairing)
      .catch((cause) => setError(localizeNativeMessage(cause)))
    const refreshSpotify = () =>
      invoke<SpotifyAuthStatus>("get_spotify_status")
        .then((status) => {
          setSpotify(status)
          setSpotifyClientId((current) => current || status.clientId)
        })
        .catch(() => {})
    refreshSpotify()
    invoke<Snapshot>("get_snapshot")
      .then((snapshot) => {
        applyLocale(snapshot.locale)
        const saved = localStorage.getItem("spotdock:accent")
        setState(snapshot)
        setPosition(snapshot.track.positionMs)
        if (
          !localStorage.getItem("spotdock:accent-migrated") &&
          saved &&
          isHexColor(saved) &&
          saved !== snapshot.accent
        )
          invoke("set_accent", { accent: saved }).catch((cause) =>
            setError(localizeNativeMessage(cause)),
          )
        localStorage.setItem("spotdock:accent-migrated", "1")
      })
      .catch((cause) => setError(localizeNativeMessage(cause)))
    let unlisten: (() => void) | undefined
    let unlistenTrack: (() => void) | undefined
    listen<string>("spotdock:state", (event) => {
      try {
        const snapshot = JSON.parse(event.payload) as Snapshot
        applyLocale(snapshot.locale)
        setState(snapshot)
        if (!seeking.current) setPosition(snapshot.track.positionMs)
      } catch {
        /* native event ignored */
      }
    }).then((callback) => {
      unlisten = callback
    })
    listen<string>("spotdock:track", (event) => {
      try {
        const update = JSON.parse(event.payload) as TrackUpdate
        setState((previous) => ({ ...previous, track: { ...previous.track, ...update.track } }))
        if (!seeking.current) setPosition(update.track.positionMs)
      } catch {
        /* native event ignored */
      }
    }).then((callback) => {
      unlistenTrack = callback
    })
    const clientsTimer = setInterval(() => {
      invoke<number>("get_client_count")
        .then((clients) => setState((previous) => ({ ...previous, clients })))
        .catch(() => {})
    }, 2000)
    const spotifyTimer = setInterval(refreshSpotify, 2000)
    return () => {
      unlisten?.()
      unlistenTrack?.()
      clearInterval(clientsTimer)
      clearInterval(spotifyTimer)
    }
  }, [])
  useEffect(() => {
    localStorage.setItem("spotdock:host", host)
  }, [host])

  useEffect(() => {
    if (view !== "settings") return
    invoke<boolean>("get_autostart")
      .then(setAutostart)
      .catch((cause) => setError(localizeNativeMessage(cause)))
  }, [view])

  const send = async (action: Action) => {
    try {
      await invoke("control", { action })
      setError("")
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    }
  }
  const rotate = async () => {
    try {
      setPairing(await invoke<Pairing>("rotate_pairing"))
      setError("")
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    }
  }
  const copy = async () => {
    if (!pairingUrl) return
    try {
      await navigator.clipboard.writeText(pairingUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    }
  }
  const chooseAccent = async (color: string) => {
    if (!isHexColor(color)) return
    localStorage.setItem("spotdock:accent", color)
    setState((previous) => ({ ...previous, accent: color }))
    try {
      await invoke("set_accent", { accent: color })
      setError("")
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    }
  }
  const changeConfig = async (config: DockConfig) => {
    setState((previous) => ({ ...previous, config }))
    try {
      await invoke("set_dock_config", { config })
      setError("")
    } catch (cause) {
      setError(localizeNativeMessage(cause))
      const current = await invoke<Snapshot>("get_snapshot")
      setState(current)
      throw cause
    }
  }
  const changeLanguage = async (language: LanguagePreference) => {
    try {
      await invoke("set_language", { language })
      const snapshot = await invoke<Snapshot>("get_snapshot")
      applyLocale(snapshot.locale)
      setState(snapshot)
      setError("")
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    }
  }
  const connectSpotify = async () => {
    try {
      await invoke("connect_spotify", { clientId: spotifyClientId.trim() })
      setSpotify((current) => ({ ...current, pending: true, error: null }))
      setError("")
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    }
  }
  const disconnectSpotify = async () => {
    try {
      await invoke("disconnect_spotify")
      setSpotify({ connected: false, pending: false, clientId: "", error: null })
      setSpotifyClientId("")
      setError("")
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    }
  }
  const changeAutostart = async (enabled: boolean) => {
    setAutostartPending(true)
    try {
      setAutostart(await invoke<boolean>("set_autostart", { enabled }))
      setError("")
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    } finally {
      setAutostartPending(false)
    }
  }

  return (
    <div
      className="dark flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0d0c] text-foreground"
      style={theme}
    >
      <WindowChrome />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <DesktopSidebar view={view} onNavigate={setView} clients={state.clients} />
        <main className="desktop-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-6 sm:px-7 lg:px-9">
          <div className="mx-auto w-full max-w-362.5">
            <PageHeading view={view} onNavigate={setView} clients={state.clients} />
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            {view === "player" && (
              <>
                {state.media.source === "none" && state.media.message && (
                  <div className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/5 p-4 text-sm text-amber-100/80">
                    <p className="font-medium">{t("desktop.app.spotifyMissing")}</p>
                    <p className="mt-1 text-xs leading-relaxed text-white/50">
                      {localizeNativeMessage(state.media.message)}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => setView("settings")}
                    >
                      {t("desktop.app.alternativeConnection")}
                    </Button>
                  </div>
                )}
                {state.media.source === "spotify_api" && (
                  <p className="mb-4 text-xs dock-accent-text">{t("desktop.app.spotifyApi")}</p>
                )}
                <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <Player
                    track={state.track}
                    position={position}
                    setPosition={setPosition}
                    seeking={seeking}
                    send={send}
                  />
                  <PairingCard url={pairingUrl} rotate={rotate} />
                </div>
              </>
            )}

            {view === "clock" && <ClockSettings config={state.config} onChange={changeConfig} />}

            {view === "deck" && <DeckSettings config={state.config} onChange={changeConfig} />}

            {view === "notifications" && <NotificationsPage clients={state.clients} />}

            {view === "schedule" && (
              <ScreenSchedulePage config={state.config} onChange={changeConfig} />
            )}

            {view === "devices" && (
              <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                <PairingCard url={pairingUrl} rotate={rotate} />
                <Card className="min-w-0 border-white/8 bg-[#141817]">
                  <CardHeader>
                    <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
                      <Smartphone className="size-5" />
                    </div>
                    <CardTitle>{t("desktop.app.onlineDevices")}</CardTitle>
                    <CardDescription>
                      {state.clients === 0
                        ? t("desktop.app.noPhones")
                        : t("desktop.app.connectedInNetwork", { count: state.clients })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-white/55">
                    <Separator />
                    <p>{t("desktop.app.step1")}</p>
                    <p>{t("desktop.app.step2")}</p>
                    <p>{t("desktop.app.step3")}</p>
                    <p className="pt-2 text-xs text-white/35">{t("desktop.app.networkHelp")}</p>
                  </CardContent>
                </Card>
              </div>
            )}

            {view === "settings" && (
              <SettingsPage
                accent={accent}
                chooseAccent={chooseAccent}
                pairing={pairing}
                pairingUrl={pairingUrl}
                copied={copied}
                copy={copy}
                host={host}
                setHost={setHost}
                spotify={spotify}
                clientId={spotifyClientId}
                setClientId={setSpotifyClientId}
                media={state.media}
                connectSpotify={connectSpotify}
                disconnectSpotify={disconnectSpotify}
                autostart={autostart}
                autostartPending={autostartPending}
                onAutostartChange={changeAutostart}
                language={state.language}
                locale={state.locale}
                onLanguageChange={changeLanguage}
                onDashboard={() =>
                  invoke("open_spotify_developer_dashboard").catch((cause) =>
                    setError(localizeNativeMessage(cause)),
                  )
                }
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
