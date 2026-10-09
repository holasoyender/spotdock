import { useEffect, useRef, useState, type CSSProperties } from "react"
import { Format, requestPermissions, scan } from "@tauri-apps/plugin-barcode-scanner"
import { Clock3, Disc3, Grid3X3, Music2, QrCode, Settings2, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ClockView, DeckView, PlayerView, type Action, type Track } from "./DockViews"
import { defaultDockConfig, type DeckButton, type DockConfig, type Weather } from "../../shared/dock"

type Snapshot = { kind: "state"; track: Track; clients: number; accent: string; config: DockConfig; weather: Weather | null }
type TrackUpdate = { kind: "track"; track: Omit<Track, "artwork"> & { artwork?: string | null } }
type ActionResult = { kind: "action_result"; buttonId: string; ok: boolean; message?: string | null }
type Preferences = { awake: boolean; brightness: number; compact: boolean }
type View = "clock" | "player" | "deck"

const empty: Track = { title: "Esperando música", artist: "Inicia música en tu ordenador", album: "", artwork: null, positionMs: 0, durationMs: 0, playing: false, shuffle: false, repeat: "off", available: false }
const stored = <T,>(key: string, fallback: T): T => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }
const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value)
function inkFor(hex: string) { const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255); return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.58 ? "#111714" : "#ffffff" }
function validAddress(input: string) {
  try {
    const url = new URL(input.trim())
    const parts = url.hostname.split(".").map(Number)
    const privateIp = parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) && (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || url.hostname === "127.0.0.1")
    return url.protocol === "ws:" && privateIp && url.port === "47917" && url.pathname === "/ws" && /^[a-f0-9]{32}$/.test(url.searchParams.get("token") ?? "")
  } catch { return false }
}

export default function App() {
  const [url, setUrl] = useState(() => stored("spotdock:url", ""))
  const [manual, setManual] = useState(url)
  const [status, setStatus] = useState<"offline" | "connecting" | "connected">("offline")
  const [track, setTrack] = useState<Track>(empty)
  const [position, setPosition] = useState(0)
  const [clock, setClock] = useState(new Date())
  const [accent, setAccent] = useState(() => stored("spotdock:accent", "#b8ef64"))
  const [config, setConfig] = useState<DockConfig>(() => stored("spotdock:config", defaultDockConfig))
  const [weather, setWeather] = useState<Weather | null>(null)
  const [view, setView] = useState<View>("clock")
  const [preferences, setPreferences] = useState<Preferences>(() => stored("spotdock:preferences", { awake: true, brightness: 100, compact: false }))
  const [settings, setSettings] = useState(false)
  const [error, setError] = useState("")
  const [actionMessage, setActionMessage] = useState("")
  const socket = useRef<WebSocket | null>(null)
  const seeking = useRef(false)
  const lastTrack = useRef<Track>(empty)
  const configRef = useRef(config)
  const lastActivity = useRef(Date.now())
  const connected = status === "connected"
  const color = isHex(accent) ? accent : "#b8ef64"
  const theme = { "--dock-accent": color, "--dock-accent-ink": inkFor(color), filter: `brightness(${preferences.brightness}%)` } as CSSProperties

  useEffect(() => { localStorage.setItem("spotdock:preferences", JSON.stringify(preferences)) }, [preferences])
  useEffect(() => {
    if (!preferences.awake || !("wakeLock" in navigator)) return
    let lock: WakeLockSentinel | undefined
    let active = true
    const acquire = async () => { try { lock = await navigator.wakeLock.request("screen"); if (!active) await lock.release() } catch { /* unavailable */ } }
    acquire()
    const onVisibility = () => { if (document.visibilityState === "visible") acquire() }
    document.addEventListener("visibilitychange", onVisibility)
    return () => { active = false; document.removeEventListener("visibilitychange", onVisibility); lock?.release() }
  }, [preferences.awake])
  useEffect(() => { const timer = setInterval(() => { setClock(new Date()); if (track.playing && status === "connected") setPosition((value) => Math.min(track.durationMs, value + 1000)) }, 1000); return () => clearInterval(timer) }, [track.playing, track.durationMs, status])
  useEffect(() => { const timer = setInterval(() => { if (view === "player" && !track.playing && Date.now() - lastActivity.current > config.returnAfterSeconds * 1000) setView("clock") }, 1000); return () => clearInterval(timer) }, [view, track.playing, config.returnAfterSeconds])
  useEffect(() => {
    if (!url || !validAddress(url)) { setStatus("offline"); return }
    localStorage.setItem("spotdock:url", JSON.stringify(url))
    let stopped = false
    let retry: ReturnType<typeof setTimeout> | undefined
    const applyTrack = (patch: TrackUpdate["track"], settings: DockConfig) => {
      const previous = lastTrack.current
      const next = { ...previous, ...patch }
      setTrack(next)
      if (!seeking.current) setPosition(next.positionMs)
      if (settings.autoPlayer && next.playing && (!previous.playing || previous.title !== next.title)) { setView("player"); lastActivity.current = Date.now() }
      if (previous.playing && !next.playing) lastActivity.current = Date.now()
      lastTrack.current = next
    }
    const connect = () => {
      if (stopped) return
      setStatus("connecting")
      const ws = new WebSocket(url)
      socket.current = ws
      ws.onopen = () => { if (!stopped) { setStatus("connected"); setError("") } }
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as Snapshot | TrackUpdate | ActionResult
          if (message.kind === "action_result") { setActionMessage(message.ok ? "Acción ejecutada" : message.message ?? "No se pudo ejecutar"); return }
          if (message.kind === "track") { applyTrack(message.track, configRef.current); return }
          if (message.kind !== "state") return
          if (isHex(message.accent)) { setAccent(message.accent); localStorage.setItem("spotdock:accent", JSON.stringify(message.accent)) }
          const nextConfig = message.config ?? defaultDockConfig
          configRef.current = nextConfig; setConfig(nextConfig); localStorage.setItem("spotdock:config", JSON.stringify(nextConfig))
          setWeather(message.weather ?? null)
          applyTrack(message.track, nextConfig)
        } catch { /* ignore malformed messages */ }
      }
      ws.onclose = () => { if (!stopped) { setStatus("offline"); setTrack(empty); lastTrack.current = empty; setView("clock"); retry = setTimeout(connect, 2500) } }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { stopped = true; clearTimeout(retry); socket.current?.close(); socket.current = null }
  }, [url])

  function openView(next: View) { lastActivity.current = Date.now(); setView(next) }
  function saveAddress(value: string) { if (!validAddress(value)) { setError("Introduce una dirección SpotDock válida de la red local."); return }; setError(""); setUrl(value.trim()); setSettings(false) }
  async function scanCode() { try { const permission = await requestPermissions(); if (permission === "denied") throw new Error("Activa el permiso de cámara para escanear el QR."); const result = await scan({ formats: [Format.QRCode], cameraDirection: "back" }); saveAddress(result.content) } catch (cause) { setError(String(cause)); setSettings(true) } }
  function send(action: Action) { lastActivity.current = Date.now(); if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(action)) }
  function pressButton(button: DeckButton) {
    lastActivity.current = Date.now(); setActionMessage("")
    if (button.actionKind === "view") { openView(button.actionValue as View); return }
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ action: "deck", button_id: button.id }))
    else setActionMessage("Conecta el PC para usar este botón")
  }
  function forget() { socket.current?.close(); localStorage.removeItem("spotdock:url"); setUrl(""); setManual(""); setTrack(empty); setWeather(null); setView("clock"); setSettings(false) }
  const setPreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences((current) => ({ ...current, [key]: value }))

  return <div className="dark relative h-screen overflow-hidden bg-[#090b0b] text-white" style={theme}>
    {view === "player" && connected && track.artwork && <div className="pointer-events-none absolute inset-0 overflow-hidden"><img src={track.artwork} alt="" className="absolute left-[12%] top-[-45%] h-[190%] w-[76%] scale-125 object-cover opacity-[0.18] blur-[100px] saturate-125" /><div className="absolute inset-0 bg-[#090b0b]/35" /></div>}
    <div className="relative flex h-full min-h-0 flex-col px-5 py-4 sm:px-9 sm:py-5"><header className="flex shrink-0 items-center justify-between gap-3"><div className="flex items-center gap-2.5"><div className="flex size-9 items-center justify-center rounded-xl dock-accent-bg"><Disc3 className="size-5" /></div><span className="hidden text-lg font-semibold tracking-tight sm:inline">SpotDock</span></div><nav aria-label="Vistas del dock" className="flex items-center gap-1 rounded-2xl border border-white/8 bg-white/4 p-1"><Button variant="ghost" size="sm" aria-label="Reloj" aria-current={view === "clock" ? "page" : undefined} onClick={() => openView("clock")} className={view === "clock" ? "dock-view-active" : "text-white/45"}><Clock3 className="size-4" /><span className="hidden text-xs sm:inline">Reloj</span></Button><Button variant="ghost" size="sm" aria-label="Música" aria-current={view === "player" ? "page" : undefined} onClick={() => openView("player")} className={view === "player" ? "dock-view-active" : "text-white/45"}><Music2 className="size-4" /><span className="hidden text-xs sm:inline">Música</span></Button><Button variant="ghost" size="sm" aria-label="Botonera" aria-current={view === "deck" ? "page" : undefined} onClick={() => openView("deck")} className={view === "deck" ? "dock-view-active" : "text-white/45"}><Grid3X3 className="size-4" /><span className="hidden text-xs sm:inline">Botonera</span></Button></nav><div className="flex items-center gap-2"><Badge variant="outline" className={`gap-1 border-white/15 ${connected ? "dock-accent-text" : "text-white/45"}`}>{connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}<span className="hidden sm:inline">{connected ? "Conectado" : status === "connecting" ? "Conectando" : "Sin conexión"}</span></Badge>{!connected && <Button variant="ghost" size="icon" aria-label="Escanear QR" onClick={scanCode}><QrCode className="size-4" /></Button>}<Button variant="ghost" size="icon" aria-label="Ajustes" onClick={() => setSettings(true)}><Settings2 className="size-5" /></Button></div></header>
      {view === "clock" && <ClockView now={clock} config={config} weather={weather} connected={connected} onOpenPlayer={() => openView("player")} onPair={scanCode} />}
      {view === "player" && <PlayerView track={track} position={position} setPosition={setPosition} seeking={seeking} send={send} compact={preferences.compact} onActivity={() => { lastActivity.current = Date.now() }} />}
      {view === "deck" && <DeckView buttons={config.buttons} connected={connected} onPress={pressButton} message={actionMessage} />}
    </div>
    <Sheet open={settings} onOpenChange={setSettings}><SheetContent className="w-[380px] max-w-[90vw] overflow-y-auto border-white/10 bg-[#141817] text-white"><SheetHeader><SheetTitle>Ajustes del dock</SheetTitle><SheetDescription>La apariencia del reloj y la botonera se editan desde el PC.</SheetDescription></SheetHeader><div className="space-y-6 px-6 pb-8"><div className="space-y-2"><Label htmlFor="manual-url">Conexión manual</Label><Input id="manual-url" placeholder="ws://192.168.1.x:47917/ws?token=…" value={manual} onChange={(event) => setManual(event.target.value)} className="text-xs" /><div className="flex gap-2"><Button className="flex-1 dock-accent-bg dock-accent-hover" onClick={() => saveAddress(manual)}>Conectar</Button><Button variant="outline" onClick={scanCode} aria-label="Escanear QR"><QrCode className="size-4" /></Button></div>{error && <p className="text-xs text-rose-300" role="alert">{error}</p>}</div><div className="flex items-center justify-between"><Label htmlFor="awake">Mantener pantalla activa</Label><Switch id="awake" checked={preferences.awake} onCheckedChange={(value) => setPreference("awake", value)} /></div><div className="flex items-center justify-between"><Label htmlFor="compact">Reproductor compacto</Label><Switch id="compact" checked={preferences.compact} onCheckedChange={(value) => setPreference("compact", value)} /></div><div className="space-y-3"><Label>Brillo de la interfaz · {preferences.brightness}%</Label><Slider min={35} max={100} value={[preferences.brightness]} onValueChange={(value) => setPreference("brightness", typeof value === "number" ? value : value[0])} className="dock-slider" /></div><Button variant="outline" className="w-full border-white/15" onClick={forget}>Olvidar ordenador</Button></div></SheetContent></Sheet>
  </div>
}
