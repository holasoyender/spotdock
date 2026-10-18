import {
  Clock3,
  CloudSun,
  Disc3,
  Grid3X3,
  Music2,
  QrCode,
  Settings2,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { View } from "@/connection/useDockConnection.ts"
import { t } from "../../../../shared/i18n"

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
        aria-label={t("mobile.nav.views")}
        className="flex items-center gap-1 rounded-2xl border border-white/8 bg-white/4 p-1"
      >
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("common.clock")}
          aria-current={view === "clock" ? "page" : undefined}
          onClick={() => openView("clock")}
          className={view === "clock" ? "dock-view-active" : "text-white/45"}
        >
          <Clock3 className="size-4" />
          <span className="hidden text-xs md:inline">{t("common.clock")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("common.music")}
          aria-current={view === "player" ? "page" : undefined}
          onClick={() => openView("player")}
          className={view === "player" ? "dock-view-active" : "text-white/45"}
        >
          <Music2 className="size-4" />
          <span className="hidden text-xs md:inline">{t("common.music")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("common.weather")}
          aria-current={view === "weather" ? "page" : undefined}
          onClick={() => openView("weather")}
          className={view === "weather" ? "dock-view-active" : "text-white/45"}
        >
          <CloudSun className="size-4" />
          <span className="hidden text-xs md:inline">{t("common.weather")}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t("common.deck")}
          aria-current={view === "deck" ? "page" : undefined}
          onClick={() => openView("deck")}
          className={view === "deck" ? "dock-view-active" : "text-white/45"}
        >
          <Grid3X3 className="size-4" />
          <span className="hidden text-xs md:inline">{t("common.deck")}</span>
        </Button>
      </nav>
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={`gap-1 border-white/15 ${connected ? "dock-accent-text" : "text-white/45"}`}
        >
          {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          <span className="hidden sm:inline">
            {connected
              ? t("common.connected")
              : status === "connecting"
                ? t("common.connecting")
                : t("common.offline")}
          </span>
        </Badge>
        {!connected && (
          <Button variant="ghost" size="icon" aria-label={t("common.scanQr")} onClick={scanCode}>
            <QrCode className="size-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.settings")}
          onClick={() => setSettings(true)}
        >
          <Settings2 className="size-5" />
        </Button>
      </div>
    </header>
  )
}
