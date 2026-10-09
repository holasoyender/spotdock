import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { Format, requestPermissions, scan } from "@tauri-apps/plugin-barcode-scanner"
import { Disc3, Link2, Music2, Pause, Play, QrCode, Repeat, Repeat1, Settings2, Shuffle, SkipBack, SkipForward, Wifi, WifiOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

type Track = { title: string; artist: string; album: string; artwork: string | null; positionMs: number; durationMs: number; playing: boolean; shuffle: boolean; repeat: string; available: boolean }
type Snapshot = { kind: "state"; track: Track; clients: number; accent: string }
type Action = { action: "play_pause" | "next" | "previous" } | { action: "seek"; position_ms: number } | { action: "shuffle"; enabled: boolean } | { action: "repeat"; mode: string }
type Preferences = { clock: boolean; awake: boolean; brightness: number; compact: boolean }

const empty: Track = { title: "Esperando música", artist: "Inicia Spotify en tu ordenador", album: "", artwork: null, positionMs: 0, durationMs: 0, playing: false, shuffle: false, repeat: "off", available: false }
const stored = <T,>(key: string, fallback: T): T => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback } catch { return fallback } }
const format = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`
const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value)
function inkFor(hex: string) {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.58 ? "#111714" : "#ffffff"
}
function validAddress(input: string) {
  try {
    const url = new URL(input.trim())
    const parts = url.hostname.split(".").map(Number)
    const privateIp = parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) && (parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168) || url.hostname === "127.0.0.1")
    return url.protocol === "ws:" && privateIp && url.port === "47917" && url.pathname === "/ws" && /^[a-f0-9]{32}$/.test(url.searchParams.get("token") ?? "")
  } catch { return false }
}

function MarqueeTitle({ title }: { title: string }) {
  const viewport = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLSpanElement>(null)
  const [distance, setDistance] = useState(0)
  useLayoutEffect(() => {
    const measure = () => setDistance(Math.max(0, Math.ceil((text.current?.scrollWidth ?? 0) - (viewport.current?.clientWidth ?? 0))))
    measure()
    const observer = new ResizeObserver(measure)
    if (viewport.current) observer.observe(viewport.current)
    if (text.current) observer.observe(text.current)
    return () => observer.disconnect()
  }, [title])
  const motion = distance > 0 ? { "--marquee-distance": `${distance}px`, animationDuration: `${Math.max(7, distance / 28 + 5)}s` } as CSSProperties : undefined
  return <div ref={viewport} className="min-w-0 overflow-hidden" title={title}><span ref={text} className={`inline-block w-max max-w-none whitespace-nowrap text-3xl font-semibold leading-tight tracking-tight sm:text-5xl ${distance > 0 ? "dock-marquee" : ""}`} style={motion}>{title}</span></div>
}

export default function App() {
  const [url, setUrl] = useState(() => stored("spotdock:url", ""))
  const [manual, setManual] = useState(url)
  const [status, setStatus] = useState<"offline" | "connecting" | "connected">("offline")
  const [track, setTrack] = useState<Track>(empty)
  const [position, setPosition] = useState(0)
  const [clock, setClock] = useState(new Date())
  const [accent, setAccent] = useState(() => stored("spotdock:accent", "#b8ef64"))
  const [preferences, setPreferences] = useState<Preferences>(() => stored("spotdock:preferences", { clock: true, awake: true, brightness: 100, compact: false }))
  const [settings, setSettings] = useState(false)
  const [error, setError] = useState("")
  const socket = useRef<WebSocket | null>(null)
  const seeking = useRef(false)
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
  useEffect(() => { const id = setInterval(() => { setClock(new Date()); if (track.playing && status === "connected") setPosition((p) => Math.min(track.durationMs, p + 1000)) }, 1000); return () => clearInterval(id) }, [track.playing, track.durationMs, status])
  useEffect(() => {
    if (!url || !validAddress(url)) { setStatus("offline"); return }
    localStorage.setItem("spotdock:url", JSON.stringify(url))
    let stopped = false
    let retry: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      if (stopped) return
      setStatus("connecting")
      const ws = new WebSocket(url)
      socket.current = ws
      ws.onopen = () => { if (!stopped) { setStatus("connected"); setError("") } }
      ws.onmessage = (event) => { try { const state = JSON.parse(event.data) as Snapshot; if (state.kind === "state") { setTrack(state.track); if (!seeking.current) setPosition(state.track.positionMs); if (isHex(state.accent)) { setAccent(state.accent); localStorage.setItem("spotdock:accent", JSON.stringify(state.accent)) } } } catch { /* malformed message */ } }
      ws.onclose = () => { if (!stopped) { setStatus("offline"); retry = setTimeout(connect, 2500) } }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { stopped = true; clearTimeout(retry); socket.current?.close(); socket.current = null }
  }, [url])

  function saveAddress(value: string) { if (!validAddress(value)) { setError("Introduce una dirección SpotDock válida de la red local."); return }; setError(""); setUrl(value.trim()); setSettings(false) }
  async function scanCode() {
    try {
      const permission = await requestPermissions()
      if (permission === "denied") throw new Error("Activa el permiso de cámara para escanear el QR.")
      const result = await scan({ formats: [Format.QRCode], cameraDirection: "back" })
      saveAddress(result.content)
    } catch (cause) { setError(String(cause)) }
  }
  function send(action: Action) { if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify(action)) }
  function forget() { socket.current?.close(); localStorage.removeItem("spotdock:url"); setUrl(""); setManual(""); setTrack(empty); setSettings(false) }
  const setPreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setPreferences((p) => ({ ...p, [key]: value }))

  return <div className="dark relative h-screen overflow-hidden bg-[#090b0b] text-white" style={theme}>
    {connected && track.artwork && <div className="pointer-events-none absolute inset-0 overflow-hidden"><img src={track.artwork} alt="" className="absolute left-[12%] top-[-45%] h-[190%] w-[76%] scale-125 object-cover opacity-[0.18] blur-[100px] saturate-125" /><div className="absolute inset-0 bg-[#090b0b]/35" /></div>}
    <div className="relative flex h-full min-h-0 flex-col px-5 py-4 sm:px-9 sm:py-5">
      <header className="flex shrink-0 items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="flex size-9 items-center justify-center rounded-xl dock-accent-bg"><Disc3 className="size-5" /></div><span className="text-lg font-semibold tracking-tight">SpotDock</span></div><div className="flex items-center gap-3">{preferences.clock && <span className="text-sm font-medium tabular-nums text-white/60">{clock.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}</span>}<Badge variant="outline" className={`gap-1.5 border-white/15 ${connected ? "dock-accent-text" : "text-white/50"}`}>{connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}{connected ? "Conectado" : status === "connecting" ? "Conectando" : "Sin conexión"}</Badge><Button variant="ghost" size="icon" aria-label="Ajustes" onClick={() => setSettings(true)}><Settings2 /></Button></div></header>
      {!connected ? <main className="flex min-h-0 flex-1 items-center justify-center gap-10 py-4"><div className="hidden size-48 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white/5 shadow-2xl sm:flex"><QrCode className="size-20 dock-accent-text" /></div><div className="max-w-xl"><div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] dock-accent-text">EMPEZAR A ESCUCHAR</div><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Tu música, en el dock.</h1><p className="mt-3 text-sm leading-relaxed text-white/50">Escanea el QR de SpotDock Desktop. Ambos dispositivos deben estar en la misma red Wi‑Fi.</p><div className="mt-6 flex flex-wrap gap-3"><Button onClick={scanCode} className="gap-2 dock-accent-bg dock-accent-hover"><QrCode className="size-4" /> Escanear QR</Button><Button variant="outline" onClick={() => setSettings(true)} className="gap-2 border-white/20"><Link2 className="size-4" /> Conectar manualmente</Button></div>{error && <p className="mt-4 text-sm text-rose-300">{error}</p>}{status === "connecting" && <p className="mt-4 text-xs text-white/40">Buscando el ordenador. Reintento automático activado.</p>}</div></main> :
        <main className={`flex min-h-0 flex-1 items-center gap-6 py-3 sm:gap-9 ${preferences.compact ? "mx-auto w-full max-w-5xl" : ""}`}><div className="flex aspect-square h-[min(58vh,430px)] max-h-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_30px_80px_rgba(0,0,0,.45)]">{track.artwork ? <img src={track.artwork} alt={`Carátula de ${track.album}`} className="h-full w-full object-cover" /> : <Music2 className="size-20 text-white/15" />}</div><div className="flex min-w-0 flex-1 flex-col justify-center"><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] dock-accent-text"><span className="size-1.5 rounded-full dock-accent-bg" /> {track.playing ? "REPRODUCIENDO" : "EN PAUSA"}</div><MarqueeTitle title={track.title || empty.title} /><p className="mt-2 truncate text-lg text-white/55 sm:text-xl">{track.artist || empty.artist}</p><p className="mt-1 truncate text-xs text-white/35">{track.album}</p>
          <div className="mt-6"><Slider min={0} max={Math.max(track.durationMs, 1)} value={[Math.min(position, Math.max(track.durationMs, 1))]} onValueChange={(value) => { seeking.current = true; setPosition(typeof value === "number" ? value : value[0]) }} onValueCommitted={(value) => { send({ action: "seek", position_ms: typeof value === "number" ? value : value[0] }); setTimeout(() => { seeking.current = false }, 700) }} disabled={!track.available} className="dock-slider" /><div className="mt-3 flex justify-between text-xs tabular-nums text-white/40"><span>{format(position)}</span><span>{format(track.durationMs)}</span></div></div>
          <div className="mt-4 flex items-center justify-center gap-2 sm:gap-5"><Button variant="ghost" size="icon-lg" aria-label="Aleatorio" onClick={() => send({ action: "shuffle", enabled: !track.shuffle })} className={track.shuffle ? "dock-accent-text" : "text-white/55"}><Shuffle className="size-5" /></Button><Button variant="ghost" size="icon-lg" aria-label="Canción anterior" onClick={() => send({ action: "previous" })}><SkipBack className="size-6 fill-current" /></Button><Button size="icon-lg" aria-label={track.playing ? "Pausar" : "Reproducir"} onClick={() => send({ action: "play_pause" })} className="size-16 rounded-full dock-accent-bg dock-accent-hover">{track.playing ? <Pause className="size-6 fill-current" /> : <Play className="size-6 fill-current" />}</Button><Button variant="ghost" size="icon-lg" aria-label="Siguiente canción" onClick={() => send({ action: "next" })}><SkipForward className="size-6 fill-current" /></Button><Button variant="ghost" size="icon-lg" aria-label="Repetición" onClick={() => send({ action: "repeat", mode: track.repeat === "off" ? "all" : track.repeat === "all" ? "track" : "off" })} className={track.repeat !== "off" ? "dock-accent-text" : "text-white/55"}>{track.repeat === "track" ? <Repeat1 className="size-5" /> : <Repeat className="size-5" />}</Button></div>
        </div></main>}
    </div>
    <Sheet open={settings} onOpenChange={setSettings}><SheetContent className="w-[380px] max-w-[90vw] overflow-y-auto border-white/10 bg-[#141817] text-white"><SheetHeader><SheetTitle>Ajustes del dock</SheetTitle><SheetDescription>Personaliza la pantalla y la conexión.</SheetDescription></SheetHeader><div className="space-y-6 px-6 pb-8"><div className="space-y-2"><Label htmlFor="manual-url">Conexión manual</Label><Input id="manual-url" placeholder="ws://192.168.1.x:47917/ws?token=…" value={manual} onChange={(event) => setManual(event.target.value)} className="text-xs" /><Button className="w-full dock-accent-bg dock-accent-hover" onClick={() => saveAddress(manual)}>Conectar</Button>{error && <p className="text-xs text-rose-300">{error}</p>}</div><div className="flex items-center justify-between"><Label htmlFor="clock">Mostrar reloj</Label><Switch id="clock" checked={preferences.clock} onCheckedChange={(value) => setPreference("clock", value)} /></div><div className="flex items-center justify-between"><Label htmlFor="awake">Mantener pantalla activa</Label><Switch id="awake" checked={preferences.awake} onCheckedChange={(value) => setPreference("awake", value)} /></div><div className="flex items-center justify-between"><Label htmlFor="compact">Vista compacta</Label><Switch id="compact" checked={preferences.compact} onCheckedChange={(value) => setPreference("compact", value)} /></div><div className="space-y-3"><Label>Brillo de la interfaz · {preferences.brightness}%</Label><Slider min={35} max={100} value={[preferences.brightness]} onValueChange={(value) => setPreference("brightness", typeof value === "number" ? value : value[0])} className="dock-slider" /></div><Button variant="outline" className="w-full border-white/15" onClick={forget}>Olvidar ordenador</Button></div></SheetContent></Sheet>
  </div>
}
