import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react"
import { invoke } from "@tauri-apps/api/core"
import { mergeAlarms, type Alarm, type AlarmDevice } from "../../../shared/alarms"
import { defaultDockConfig, isHexColor, type DockConfig } from "../../../shared/dock"
import type {
  ActionResult,
  AlarmTestEvent,
  ControlAction,
  DeckAction,
  DeviceDisconnectEvent,
  NotificationEvent,
  ScreenEvent,
  Snapshot,
  Track,
  TrackUpdate,
} from "../../../shared/protocol"
import { validAddress } from "./address"
import { readStored } from "../lib/storage"
import { resolveLocale, t, type Locale } from "../../../shared/i18n"
import { localizeNativeMessage } from "../../../shared/nativeMessages"

export type View = "clock" | "player" | "weather" | "deck" | "alarms"
type ConnectionStatus = "offline" | "connecting" | "connected"

type ConnectionOptions = {
  url: string
  setUrl: Dispatch<SetStateAction<string>>
  setManual: Dispatch<SetStateAction<string>>
  setView: Dispatch<SetStateAction<View>>
  seeking: RefObject<boolean>
  lastActivity: RefObject<number>
  setError: Dispatch<SetStateAction<string>>
}

export const emptyTrack: Track = {
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

/** Owns the WebSocket session, discovery retries, and server-synchronized dock state. */
export function useDockConnection({
  url,
  setUrl,
  setManual,
  setView,
  seeking,
  lastActivity,
  setError,
}: ConnectionOptions) {
  const [status, setStatus] = useState<ConnectionStatus>("offline")
  const [deviceId] = useState(() => {
    const saved = readStored("spotdock:device-id", "")
    if (/^[0-9a-f-]{36}$/i.test(saved)) return saved
    const id = crypto.randomUUID()
    localStorage.setItem("spotdock:device-id", JSON.stringify(id))
    return id
  })
  const [alarms, setAlarms] = useState<Alarm[]>(() => readStored("spotdock:alarms", []))
  const [devices, setDevices] = useState<AlarmDevice[]>([])
  const alarmsRef = useRef(alarms)
  const [track, setTrack] = useState<Track>(emptyTrack)
  const [position, setPosition] = useState(0)
  const [accent, setAccent] = useState(() => readStored("spotdock:accent", "#b8ef64"))
  const [config, setConfig] = useState<DockConfig>(() =>
    readStored("spotdock:config", defaultDockConfig),
  )
  const [desktopLocale, setDesktopLocale] = useState<Locale>(() =>
    resolveLocale(readStored("spotdock:desktop-locale", "en-US")),
  )
  const [actionMessage, setActionMessage] = useState("")
  const [notifications, setNotifications] = useState<NotificationEvent[]>([])
  const [screenOff, setScreenOff] = useState(false)
  const socket = useRef<WebSocket | null>(null)
  const lastTrack = useRef<Track>(emptyTrack)
  const configRef = useRef(config)
  const lastScreenAt = useRef(0)

  useEffect(() => {
    if (!url || !validAddress(url)) {
      setStatus("offline")
      return
    }
    localStorage.setItem("spotdock:url", JSON.stringify(url))
    let stopped = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let lastDiscovery = 0
    const applyTrack = (patch: TrackUpdate["track"], settings: DockConfig) => {
      const previous = lastTrack.current
      const next = { ...previous, ...patch }
      setTrack(next)
      if (!seeking.current) setPosition(next.positionMs)
      if (
        settings.autoPlayer &&
        next.playing &&
        (!previous.playing || previous.title !== next.title)
      ) {
        setView("player")
        lastActivity.current = Date.now()
      }
      if (previous.playing && !next.playing) lastActivity.current = Date.now()
      lastTrack.current = next
    }
    const connect = () => {
      if (stopped) return
      setStatus("connecting")
      const ws = new WebSocket(url)
      socket.current = ws
      ws.onopen = () => {
        if (!stopped) {
          const model = navigator.userAgent.match(/Android[^;]*;\s*([^;)]+)[;)]/)?.[1]?.trim()
          ws.send(
            JSON.stringify({
              action: "hello",
              device_id: deviceId,
              name: model
                ? `${model} · ${deviceId.slice(0, 4)}`
                : `Android · ${deviceId.slice(0, 4)}`,
            }),
          )
          lastScreenAt.current = 0
          setStatus("connected")
          setError("")
        }
      }
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as
            | Snapshot
            | TrackUpdate
            | ActionResult
            | NotificationEvent
            | ScreenEvent
            | AlarmTestEvent
            | DeviceDisconnectEvent
          if (message.kind === "disconnect") {
            localStorage.removeItem("spotdock:url")
            setUrl("")
            setManual("")
            setDevices([])
            setStatus("offline")
            setView("clock")
            setError(t("mobile.device.disconnected"))
            ws.close()
            return
          }
          if (message.kind === "alarm_test") {
            void invoke("test_local_alarm", { alarm: message.alarm }).catch(console.error)
            return
          }
          if (message.kind === "notification") {
            if (typeof message.sender === "string" && typeof message.body === "string") {
              setNotifications((current) => [...current.slice(-19), message])
              if (ws.readyState === WebSocket.OPEN)
                ws.send(JSON.stringify({ action: "notification_ack", id: message.id }))
            }
            return
          }
          if (message.kind === "screen") {
            if (message.screenAt >= lastScreenAt.current) {
              lastScreenAt.current = message.screenAt
              setScreenOff(message.screenOff)
            }
            return
          }
          if (message.kind === "action_result") {
            setActionMessage(
              message.ok
                ? t("mobile.action.success")
                : message.message
                  ? localizeNativeMessage(message.message)
                  : t("mobile.action.failed"),
            )
            return
          }
          if (message.kind === "track") {
            applyTrack(message.track, configRef.current)
            return
          }
          if (message.kind !== "state") return
          if (isHexColor(message.accent)) {
            setAccent(message.accent)
            localStorage.setItem("spotdock:accent", JSON.stringify(message.accent))
          }
          const nextConfig = message.config ?? defaultDockConfig
          if (Array.isArray(message.alarms)) {
            const merged = mergeAlarms(alarmsRef.current, message.alarms)
            for (const local of alarmsRef.current) {
              if (
                (message.alarms.find((alarm) => alarm.id === local.id)?.updatedAt ?? -1) <
                local.updatedAt
              )
                ws.send(JSON.stringify({ action: "alarm_upsert", alarm: local }))
            }
            if (JSON.stringify(merged) !== JSON.stringify(alarmsRef.current)) {
              alarmsRef.current = merged
              setAlarms(merged)
              localStorage.setItem("spotdock:alarms", JSON.stringify(merged))
            }
          }
          if (Array.isArray(message.devices)) setDevices(message.devices)
          if (message.screenAt >= lastScreenAt.current) {
            lastScreenAt.current = message.screenAt
            setScreenOff(Boolean(message.screenOff))
          }
          configRef.current = nextConfig
          setConfig(nextConfig)
          localStorage.setItem("spotdock:config", JSON.stringify(nextConfig))
          const locale = resolveLocale(message.locale)
          setDesktopLocale(locale)
          localStorage.setItem("spotdock:desktop-locale", JSON.stringify(locale))
          applyTrack(message.track, nextConfig)
        } catch {
          /* ignore malformed messages */
        }
      }
      ws.onclose = () => {
        if (stopped) return
        setStatus("offline")
        setTrack(emptyTrack)
        lastTrack.current = emptyTrack
        setView("clock")
        retry = setTimeout(async () => {
          if (stopped) return
          if (Date.now() - lastDiscovery > 8000) {
            lastDiscovery = Date.now()
            try {
              const saved = new URL(url)
              const host = await invoke<string | null>("discover_desktop", {
                token: saved.searchParams.get("token"),
                previousHost: saved.hostname,
              })
              if (stopped) return
              if (host && host !== saved.hostname) {
                saved.hostname = host
                setManual(saved.toString())
                setUrl(saved.toString())
                return
              }
            } catch {
              /* Discovery is best effort; the saved address is still retried. */
            }
          }
          connect()
        }, 2500)
      }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => {
      stopped = true
      clearTimeout(retry)
      socket.current?.close()
      socket.current = null
    }
  }, [url, deviceId])

  function upsertAlarm(alarm: Alarm) {
    const next = mergeAlarms(alarmsRef.current, [alarm])
    alarmsRef.current = next
    setAlarms(next)
    localStorage.setItem("spotdock:alarms", JSON.stringify(next))
    if (socket.current?.readyState === WebSocket.OPEN)
      socket.current.send(JSON.stringify({ action: "alarm_upsert", alarm }))
  }
  function sendAction(action: ControlAction | DeckAction) {
    if (socket.current?.readyState !== WebSocket.OPEN) return false
    socket.current.send(JSON.stringify(action))
    return true
  }

  function resetConnection() {
    socket.current?.close()
    setTrack(emptyTrack)
  }

  return {
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
    screenOff,
    alarms,
    devices,
    deviceId,
    upsertAlarm,
    setActionMessage,
    sendAction,
    resetConnection,
  }
}
