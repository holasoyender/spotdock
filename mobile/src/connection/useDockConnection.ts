import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react"
import { invoke } from "@tauri-apps/api/core"
import { defaultDockConfig, isHexColor, type DockConfig, type Weather } from "../../../shared/dock"
import type {
  ActionResult,
  ControlAction,
  DeckAction,
  Snapshot,
  Track,
  TrackUpdate,
} from "../../../shared/protocol"
import { validAddress } from "./address"
import { readStored } from "../lib/storage"

export type View = "clock" | "player" | "deck"
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
  title: "Esperando música",
  artist: "Inicia música en tu ordenador",
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
  const [track, setTrack] = useState<Track>(emptyTrack)
  const [position, setPosition] = useState(0)
  const [accent, setAccent] = useState(() => readStored("spotdock:accent", "#b8ef64"))
  const [config, setConfig] = useState<DockConfig>(() =>
    readStored("spotdock:config", defaultDockConfig),
  )
  const [weather, setWeather] = useState<Weather | null>(null)
  const [actionMessage, setActionMessage] = useState("")
  const socket = useRef<WebSocket | null>(null)
  const lastTrack = useRef<Track>(emptyTrack)
  const configRef = useRef(config)

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
          setStatus("connected")
          setError("")
        }
      }
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as Snapshot | TrackUpdate | ActionResult
          if (message.kind === "action_result") {
            setActionMessage(
              message.ok ? "Acción ejecutada" : (message.message ?? "No se pudo ejecutar"),
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
          configRef.current = nextConfig
          setConfig(nextConfig)
          localStorage.setItem("spotdock:config", JSON.stringify(nextConfig))
          setWeather(message.weather ?? null)
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
  }, [url])

  function sendAction(action: ControlAction | DeckAction) {
    if (socket.current?.readyState !== WebSocket.OPEN) return false
    socket.current.send(JSON.stringify(action))
    return true
  }

  function resetConnection() {
    socket.current?.close()
    setTrack(emptyTrack)
    setWeather(null)
  }

  return {
    status,
    track,
    position,
    setPosition,
    accent,
    config,
    weather,
    actionMessage,
    setActionMessage,
    sendAction,
    resetConnection,
  }
}
