import { Clock3, Disc3, Grid3X3, Music2, QrCode, Settings2, Wifi, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { View } from "@/connection/useDockConnection.ts"

type Props = {
  navigationVisible: boolean
  view: View
  connected: boolean
  status: "offline" | "connecting" | "connected"
  openView: (view: View) => void
  scanCode: () => void
  setSettings: (open: boolean) => void
}

export function DockNavigation({
  navigationVisible,
  view,
  connected,
  status,
  openView,
  scanCode,
  setSettings,
}: Props) {
  return (
    <header
      aria-hidden={!navigationVisible}
      className={`absolute inset-x-5 top-4 z-20 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111615]/90 p-2 shadow-2xl backdrop-blur-xl transition-all duration-300 sm:inset-x-9 sm:top-5 ${navigationVisible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-3 opacity-0"}`}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-xl dock-accent-bg">
          <Disc3 className="size-5" />
        </div>
        <span className="hidden text-lg font-semibold tracking-tight sm:inline">SpotDock</span>
      </div>
      <nav
        aria-label="Vistas del dock"
        className="flex items-center gap-1 rounded-2xl border border-white/8 bg-white/4 p-1"
      >
        <Button
          variant="ghost"
          size="sm"
          aria-label="Reloj"
          aria-current={view === "clock" ? "page" : undefined}
          onClick={() => openView("clock")}
          className={view === "clock" ? "dock-view-active" : "text-white/45"}
        >
          <Clock3 className="size-4" />
          <span className="hidden text-xs sm:inline">Reloj</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Música"
          aria-current={view === "player" ? "page" : undefined}
          onClick={() => openView("player")}
          className={view === "player" ? "dock-view-active" : "text-white/45"}
        >
          <Music2 className="size-4" />
          <span className="hidden text-xs sm:inline">Música</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Botonera"
          aria-current={view === "deck" ? "page" : undefined}
          onClick={() => openView("deck")}
          className={view === "deck" ? "dock-view-active" : "text-white/45"}
        >
          <Grid3X3 className="size-4" />
          <span className="hidden text-xs sm:inline">Botonera</span>
        </Button>
      </nav>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`gap-1 border-white/15 ${connected ? "dock-accent-text" : "text-white/45"}`}
        >
          {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          <span className="hidden sm:inline">
            {connected ? "Conectado" : status === "connecting" ? "Conectando" : "Sin conexión"}
          </span>
        </Badge>
        {!connected && (
          <Button variant="ghost" size="icon" aria-label="Escanear QR" onClick={scanCode}>
            <QrCode className="size-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label="Ajustes" onClick={() => setSettings(true)}>
          <Settings2 className="size-5" />
        </Button>
      </div>
    </header>
  )
}
