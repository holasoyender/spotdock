import { useEffect, useRef, useState, type CSSProperties } from "react"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { QRCodeSVG } from "qrcode.react"
import { Check, Copy, Disc3, Laptop2, Link2, Maximize2, Minimize2, Minus, Music2, Palette, Pause, Play, QrCode, RefreshCw, Repeat, Repeat1, Settings2, Shuffle, SkipBack, SkipForward, Smartphone, Wifi, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"

type Track = { title: string; artist: string; album: string; artwork: string | null; positionMs: number; durationMs: number; playing: boolean; shuffle: boolean; repeat: string; available: boolean }
type Snapshot = { kind: "state"; track: Track; clients: number; accent: string }
type Pairing = { url: string; clients: number; port: number }
type Action = { action: "play_pause" | "next" | "previous" } | { action: "seek"; position_ms: number } | { action: "shuffle"; enabled: boolean } | { action: "repeat"; mode: string }
type View = "player" | "devices" | "settings"

const empty: Track = { title: "Nada sonando todavía", artist: "Abre Spotify en este ordenador", album: "", artwork: null, positionMs: 0, durationMs: 0, playing: false, shuffle: false, repeat: "off", available: false }
const initial: Snapshot = { kind: "state", track: empty, clients: 0, accent: "#b8ef64" }
const palette = [
  { name: "Lima", color: "#b8ef64" }, { name: "Blanco", color: "#ffffff" },
  { name: "Azul", color: "#91c7ff" }, { name: "Rosa", color: "#ffb8d7" },
  { name: "Ámbar", color: "#ffd18a" }, { name: "Lila", color: "#c3b3ff" },
]
const time = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`
const isHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value)
function inkFor(hex: string) {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.58 ? "#111714" : "#ffffff"
}

function WindowChrome() {
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return
    const appWindow = getCurrentWindow()
    let unlisten: (() => void) | undefined
    appWindow.isMaximized().then(setMaximized).catch(() => {})
    appWindow.onResized(() => { appWindow.isMaximized().then(setMaximized).catch(() => {}) }).then((callback) => { unlisten = callback })
    return () => unlisten?.()
  }, [])
  const windowAction = (action: "minimize" | "toggleMaximize" | "close") => {
    if (!("__TAURI_INTERNALS__" in window)) return
    const appWindow = getCurrentWindow()
    appWindow[action]().then(() => appWindow.isMaximized().then(setMaximized)).catch(() => {})
  }
  return <div className="flex h-11 shrink-0 items-stretch border-b border-white/8 bg-[#101312] select-none">
    <div className="flex min-w-0 flex-1 cursor-default items-center gap-2 px-4" onMouseDown={(event) => {
      if (event.button !== 0 || !("__TAURI_INTERNALS__" in window)) return
      if (event.detail === 2) windowAction("toggleMaximize")
      else getCurrentWindow().startDragging().catch(() => {})
    }}>
      <Disc3 className="size-4 shrink-0 dock-accent-text" /><span className="text-xs font-semibold tracking-wide">SpotDock</span><span className="ml-2 hidden text-[11px] text-white/35 sm:inline">/ Centro de control</span>
    </div>
    <div className="flex shrink-0 items-stretch">
      <Button variant="ghost" aria-label="Minimizar" title="Minimizar" onClick={() => windowAction("minimize")} className="h-full w-12 rounded-none text-white/65 hover:bg-white/10"><Minus className="size-4" /></Button>
      <Button variant="ghost" aria-label={maximized ? "Restaurar" : "Maximizar"} title={maximized ? "Restaurar" : "Maximizar"} onClick={() => windowAction("toggleMaximize")} className="h-full w-12 rounded-none text-white/65 hover:bg-white/10">{maximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}</Button>
      <Button variant="ghost" aria-label="Cerrar" title="Cerrar" onClick={() => windowAction("close")} className="h-full w-12 rounded-none text-white/65 hover:bg-red-600 hover:text-white"><X className="size-4" /></Button>
    </div>
  </div>
}

function NavButton({ view, current, label, icon: Icon, onClick }: { view: View; current: View; label: string; icon: typeof Music2; onClick: (view: View) => void }) {
  return <Button variant="ghost" onClick={() => onClick(view)} aria-current={current === view ? "page" : undefined} className={`w-full justify-start gap-3 rounded-xl px-4 py-3 text-sm normal-case tracking-normal ${current === view ? "dock-nav-active text-white" : "text-white/55 hover:text-white"}`}><Icon className={`size-4 ${current === view ? "dock-accent-text" : ""}`} />{label}</Button>
}

function Player({ track, position, setPosition, seeking, send }: { track: Track; position: number; setPosition: (value: number) => void; seeking: React.RefObject<boolean>; send: (action: Action) => void }) {
  const max = Math.max(track.durationMs, 1)
  return <Card className="relative min-w-0 overflow-hidden border-white/8 bg-[#141817] p-0"><div className="relative flex min-h-[455px] flex-col justify-between overflow-hidden p-6 lg:p-8">
    {track.artwork && <img src={track.artwork} alt="" className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-[0.1] blur-[70px]" />}
    <div className="relative min-w-0"><div className="mb-8 flex items-center justify-between gap-3"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] dock-accent-text"><span className="size-2 rounded-full dock-accent-bg" /> Ahora suena</div><Badge variant="outline" className="shrink-0 border-white/15 text-white/45">Spotify</Badge></div>
      <div className="flex min-w-0 items-center gap-7"><div className="flex size-44 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/6 shadow-2xl xl:size-52">{track.artwork ? <img src={track.artwork} alt={`Carátula de ${track.album}`} className="h-full w-full object-cover" /> : <Disc3 className="size-16 text-white/15" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/40">{track.album || "ESPERANDO MÚSICA"}</p><h2 className="mt-3 line-clamp-2 text-3xl font-semibold leading-tight tracking-tight xl:text-4xl" title={track.title}>{track.title || empty.title}</h2><p className="mt-3 truncate text-lg text-white/55">{track.artist || empty.artist}</p></div></div>
    </div>
    <div className="relative min-w-0 pt-8"><Slider min={0} max={max} value={[Math.min(position, max)]} onValueChange={(value) => { seeking.current = true; setPosition(typeof value === "number" ? value : value[0]) }} onValueCommitted={(value) => { send({ action: "seek", position_ms: typeof value === "number" ? value : value[0] }); setTimeout(() => { seeking.current = false }, 700) }} disabled={!track.available} className="dock-slider" /><div className="mt-3 flex justify-between text-xs tabular-nums text-white/40"><span>{time(position)}</span><span>{time(track.durationMs)}</span></div>
      <div className="mt-5 flex items-center justify-center gap-2 sm:gap-3"><Button variant="ghost" size="icon" aria-label="Aleatorio" disabled={!track.available} onClick={() => send({ action: "shuffle", enabled: !track.shuffle })} className={track.shuffle ? "dock-accent-text" : "text-white/45"}><Shuffle /></Button><Button variant="ghost" size="icon-lg" aria-label="Anterior" disabled={!track.available} onClick={() => send({ action: "previous" })}><SkipBack className="size-5 fill-current" /></Button><Button size="icon-lg" aria-label={track.playing ? "Pausar" : "Reproducir"} disabled={!track.available} onClick={() => send({ action: "play_pause" })} className="size-14 rounded-full dock-accent-bg dock-accent-hover">{track.playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}</Button><Button variant="ghost" size="icon-lg" aria-label="Siguiente" disabled={!track.available} onClick={() => send({ action: "next" })}><SkipForward className="size-5 fill-current" /></Button><Button variant="ghost" size="icon" aria-label="Repetir" disabled={!track.available} onClick={() => send({ action: "repeat", mode: track.repeat === "off" ? "all" : track.repeat === "all" ? "track" : "off" })} className={track.repeat !== "off" ? "dock-accent-text" : "text-white/45"}>{track.repeat === "track" ? <Repeat1 /> : <Repeat />}</Button></div>
    </div>
  </div></Card>
}

function PairingCard({ url, rotate }: { url?: string; rotate: () => void }) {
  return <Card className="min-w-0 border-white/8 bg-[#141817]"><CardHeader className="pb-4"><div className="mb-2 flex items-center justify-between"><div className="flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text"><QrCode className="size-5" /></div><Badge variant="outline" className="border-white/15 text-white/45">01 / 02</Badge></div><CardTitle className="text-xl">Conecta tu móvil</CardTitle><CardDescription>Escanea este QR en SpotDock para Android. Ambos dispositivos deben estar en la misma Wi‑Fi.</CardDescription></CardHeader><CardContent><div className="mx-auto flex size-44 items-center justify-center rounded-xl bg-white p-2">{url ? <QRCodeSVG value={url} size={160} level="M" /> : <RefreshCw className="animate-spin text-black" />}</div><Button variant="outline" className="mt-5 w-full gap-2" onClick={rotate}><RefreshCw className="size-4" /> Renovar código</Button></CardContent></Card>
}

export default function App() {
  const [view, setView] = useState<View>("player")
  const [pairing, setPairing] = useState<Pairing | null>(null)
  const [state, setState] = useState<Snapshot>(initial)
  const [position, setPosition] = useState(0)
  const [error, setError] = useState("")
  const [copied, setCopied] = useState(false)
  const [host, setHost] = useState(() => localStorage.getItem("spotdock:host") ?? "")
  const seeking = useRef(false)
  const accent = isHex(state.accent) ? state.accent : initial.accent
  const validHost = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) && host.split(".").every((part) => Number(part) <= 255)
  const pairingUrl = pairing && validHost ? pairing.url.replace(new URL(pairing.url).hostname, host) : pairing?.url
  const theme = { "--dock-accent": accent, "--dock-accent-ink": inkFor(accent) } as CSSProperties

  useEffect(() => {
    invoke<Pairing>("get_pairing").then(setPairing).catch((cause) => setError(String(cause)))
    invoke<Snapshot>("get_snapshot").then((snapshot) => {
      const saved = localStorage.getItem("spotdock:accent")
      setState({ ...snapshot, accent: saved && isHex(saved) ? saved : snapshot.accent })
      setPosition(snapshot.track.positionMs)
      if (saved && isHex(saved) && saved !== snapshot.accent) invoke("set_accent", { accent: saved }).catch((cause) => setError(String(cause)))
    }).catch((cause) => setError(String(cause)))
    let unlisten: (() => void) | undefined
    listen<string>("spotdock:state", (event) => { try { const snapshot = JSON.parse(event.payload) as Snapshot; setState(snapshot); if (!seeking.current) setPosition(snapshot.track.positionMs) } catch { /* native event ignored */ } }).then((callback) => { unlisten = callback })
    const clientsTimer = setInterval(() => { invoke<Snapshot>("get_snapshot").then((snapshot) => setState((previous) => ({ ...previous, clients: snapshot.clients }))).catch(() => {}) }, 2000)
    return () => { unlisten?.(); clearInterval(clientsTimer) }
  }, [])
  useEffect(() => { localStorage.setItem("spotdock:host", host) }, [host])

  const send = async (action: Action) => { try { await invoke("control", { action }); setError("") } catch (cause) { setError(String(cause)) } }
  const rotate = async () => { try { setPairing(await invoke<Pairing>("rotate_pairing")); setError("") } catch (cause) { setError(String(cause)) } }
  const copy = async () => { if (!pairingUrl) return; try { await navigator.clipboard.writeText(pairingUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch (cause) { setError(String(cause)) } }
  const chooseAccent = async (color: string) => {
    if (!isHex(color)) return
    localStorage.setItem("spotdock:accent", color)
    setState((previous) => ({ ...previous, accent: color }))
    try { await invoke("set_accent", { accent: color }); setError("") } catch (cause) { setError(String(cause)) }
  }

  return <div className="dark flex h-screen min-h-0 flex-col overflow-hidden bg-[#0b0d0c] text-foreground" style={theme}>
    <WindowChrome />
    <div className="flex min-h-0 flex-1 overflow-hidden">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-white/8 bg-[#101312] px-4 py-6 lg:flex">
        <div className="px-3"><div className="text-xs font-semibold uppercase tracking-[0.2em] dock-accent-text">TU MÚSICA, EN TU DOCK</div><p className="mt-2 text-xs leading-relaxed text-white/40">Spotify en tu PC. El control, en tu móvil.</p></div>
        <nav aria-label="Navegación principal" className="mt-10 space-y-1"><NavButton view="player" current={view} onClick={setView} icon={Music2} label="Reproducción" /><NavButton view="devices" current={view} onClick={setView} icon={Smartphone} label="Dispositivos" /><NavButton view="settings" current={view} onClick={setView} icon={Settings2} label="Ajustes" /></nav>
        <div className="mt-auto rounded-2xl border border-white/8 bg-white/4 p-4"><div className="flex items-center gap-2 text-xs font-semibold"><span className="size-2 rounded-full dock-accent-bg" /> Red local activa</div><p className="mt-2 text-xs leading-relaxed text-white/40">{state.clients ? `${state.clients} móvil${state.clients === 1 ? "" : "es"} conectado${state.clients === 1 ? "" : "s"}` : "Esperando móvil"}</p></div>
      </aside>
      <main className="desktop-scroll min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-6 sm:px-7 lg:px-9">
        <div className="mx-auto w-full max-w-[1450px]"><header className="mb-6 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{view === "player" ? "Centro de control" : view === "devices" ? "Tus dispositivos" : "Ajustes"}</h1><p className="mt-1 text-sm text-white/45">{view === "player" ? "Tu música, al alcance de la mano." : view === "devices" ? "Empareja y controla la conexión local." : "Haz que SpotDock se sienta tuyo."}</p></div><Badge variant="secondary" className="gap-2 border border-white/10 bg-white/5 px-3 py-2 text-white/65"><Wifi className="size-3.5 dock-accent-text" /> {state.clients} conectado{state.clients === 1 ? "" : "s"}</Badge></header>
          <nav aria-label="Navegación principal" className="mb-5 grid grid-cols-3 gap-2 lg:hidden"><NavButton view="player" current={view} onClick={setView} icon={Music2} label="Reproducción" /><NavButton view="devices" current={view} onClick={setView} icon={Smartphone} label="Dispositivos" /><NavButton view="settings" current={view} onClick={setView} icon={Settings2} label="Ajustes" /></nav>
          {error && <div role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-300">{error}</div>}

          {view === "player" && <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]"><Player track={state.track} position={position} setPosition={setPosition} seeking={seeking} send={send} /><PairingCard url={pairingUrl} rotate={rotate} /></div>}

          {view === "devices" && <div className="grid min-w-0 gap-5 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]"><PairingCard url={pairingUrl} rotate={rotate} /><Card className="min-w-0 border-white/8 bg-[#141817]"><CardHeader><div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text"><Smartphone className="size-5" /></div><CardTitle>Dispositivos en línea</CardTitle><CardDescription>{state.clients === 0 ? "Todavía no hay móviles conectados." : `${state.clients} móvil${state.clients === 1 ? "" : "es"} conectado${state.clients === 1 ? "" : "s"} en esta red.`}</CardDescription></CardHeader><CardContent className="space-y-4 text-sm text-white/55"><Separator /><p>1. Abre SpotDock en el móvil.</p><p>2. Escanea el QR de esta pantalla.</p><p>3. Coloca el teléfono en horizontal sobre el dock.</p><p className="pt-2 text-xs text-white/35">Si el móvil no encuentra el PC, comprueba la Wi‑Fi y los permisos de red privada de Windows.</p></CardContent></Card></div>}

          {view === "settings" && <div className="grid min-w-0 gap-5 xl:grid-cols-2"><Card className="min-w-0 border-white/8 bg-[#141817]"><CardHeader><div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text"><Palette className="size-5" /></div><CardTitle>Color de acento</CardTitle><CardDescription>El cambio se aplica aquí y en todos los móviles conectados.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{palette.map((option) => <Button key={option.color} variant="outline" aria-label={`Color ${option.name}`} title={option.name} onClick={() => chooseAccent(option.color)} className={`h-14 rounded-xl border-white/10 p-1 ${accent.toLowerCase() === option.color ? "ring-2 ring-[var(--dock-accent)]" : ""}`}><span className="flex size-9 items-center justify-center rounded-lg" style={{ backgroundColor: option.color }}>{accent.toLowerCase() === option.color && <Check className="size-4 text-[#111714]" />}</span></Button>)}</div><div className="mt-6 flex items-center gap-4"><Label htmlFor="custom-color" className="shrink-0">Color propio</Label><Input id="custom-color" type="color" value={accent} onChange={(event) => chooseAccent(event.target.value)} className="h-10 w-24 cursor-pointer p-1" /><span className="font-mono text-xs text-white/45">{accent.toUpperCase()}</span></div></CardContent></Card>
            <Card className="min-w-0 border-white/8 bg-[#141817]"><CardHeader><div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text"><Link2 className="size-5" /></div><CardTitle>Conexión local</CardTitle><CardDescription>El QR contiene la dirección del PC y una clave temporal.</CardDescription></CardHeader><CardContent className="space-y-5"><div><Label htmlFor="address">Dirección de conexión</Label><div className="mt-2 flex min-w-0 gap-2"><Input id="address" readOnly value={pairingUrl ?? "Iniciando servidor…"} className="min-w-0 font-mono text-xs" /><Button variant="outline" size="icon" onClick={copy} aria-label="Copiar dirección">{copied ? <Check /> : <Copy />}</Button></div></div><div><Label htmlFor="host">IP Wi‑Fi del ordenador (opcional)</Label><Input id="host" placeholder={pairing ? new URL(pairing.url).hostname : "192.168.1.20"} value={host} onChange={(event) => setHost(event.target.value.trim())} className="mt-2 font-mono text-xs" /><p className="mt-2 text-xs text-white/40">Cámbiala si se detecta la IP de una VPN.</p></div><Separator /><div className="flex gap-3 text-xs text-white/50"><Laptop2 className="size-4 shrink-0 dock-accent-text" /><p>El PC y el móvil deben estar en la misma Wi‑Fi. Permite el acceso de SpotDock en redes privadas cuando Windows lo solicite.</p></div></CardContent></Card></div>}
        </div>
      </main>
    </div>
  </div>
}
