import {
  BellRing,
  Clock3,
  Grid3X3,
  Music2,
  Moon,
  Settings2,
  Smartphone,
  Wifi,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { t, type TranslationKey } from "../../../../shared/i18n"

export type View =
  | "player"
  | "clock"
  | "deck"
  | "devices"
  | "notifications"
  | "alarms"
  | "schedule"
  | "settings"

const pages: {
  view: View
  label: TranslationKey
  compactLabel: TranslationKey
  heading: TranslationKey
  description: TranslationKey
  icon: LucideIcon
}[] = [
  {
    view: "player",
    label: "desktop.nav.playback",
    compactLabel: "desktop.nav.playback",
    heading: "desktop.heading.player",
    description: "desktop.heading.playerDescription",
    icon: Music2,
  },
  {
    view: "clock",
    label: "desktop.nav.clockWeather",
    compactLabel: "common.clock",
    heading: "desktop.nav.clockWeather",
    description: "desktop.heading.clockDescription",
    icon: Clock3,
  },
  {
    view: "deck",
    label: "common.deck",
    compactLabel: "common.deck",
    heading: "common.deck",
    description: "desktop.heading.deckDescription",
    icon: Grid3X3,
  },
  {
    view: "devices",
    label: "desktop.nav.devices",
    compactLabel: "desktop.nav.devices",
    heading: "desktop.heading.devices",
    description: "desktop.heading.devicesDescription",
    icon: Smartphone,
  },
  {
    view: "notifications",
    label: "desktop.nav.notifications",
    compactLabel: "desktop.nav.notifications",
    heading: "desktop.nav.notifications",
    description: "desktop.heading.notificationsDescription",
    icon: BellRing,
  },
  {
    view: "alarms",
    label: "alarms.title",
    compactLabel: "alarms.title",
    heading: "alarms.title",
    description: "desktop.heading.alarmsDescription",
    icon: BellRing,
  },
  {
    view: "schedule",
    label: "desktop.nav.schedule",
    compactLabel: "desktop.nav.schedule",
    heading: "desktop.nav.schedule",
    description: "desktop.heading.scheduleDescription",
    icon: Moon,
  },
  {
    view: "settings",
    label: "common.settings",
    compactLabel: "common.settings",
    heading: "common.settings",
    description: "desktop.heading.settingsDescription",
    icon: Settings2,
  },
]

type NavigationProps = {
  view: View
  onNavigate: (view: View) => void
  clients: number
}

function NavButton({
  page,
  current,
  onNavigate,
  compact = false,
}: {
  page: (typeof pages)[number]
  current: View
  onNavigate: (view: View) => void
  compact?: boolean
}) {
  const Icon = page.icon
  return (
    <Button
      variant="ghost"
      onClick={() => onNavigate(page.view)}
      aria-current={current === page.view ? "page" : undefined}
      className={`w-full justify-start gap-3 rounded-xl px-4 py-3 text-sm normal-case tracking-normal ${current === page.view ? "dock-nav-active text-white" : "text-white/55 hover:text-white"}`}
    >
      <Icon className={`size-4 ${current === page.view ? "dock-accent-text" : ""}`} />
      {t(compact ? page.compactLabel : page.label)}
    </Button>
  )
}

export function DesktopSidebar({ view, onNavigate, clients }: NavigationProps) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-white/8 bg-[#101312] px-4 py-6 lg:flex">
      <div className="px-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] dock-accent-text">
          {t("desktop.nav.tagline")}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/40">{t("desktop.nav.description")}</p>
      </div>
      <nav aria-label={t("desktop.nav.main")} className="mt-10 space-y-1">
        {pages.map((page) => (
          <NavButton key={page.view} page={page} current={view} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-white/8 bg-white/4 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="size-2 rounded-full dock-accent-bg" /> {t("desktop.nav.network")}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/40">
          {clients
            ? t("desktop.nav.connectedPhones", { count: clients })
            : t("desktop.nav.waitingPhone")}
        </p>
      </div>
    </aside>
  )
}

export function PageHeading({ view, onNavigate, clients }: NavigationProps) {
  const page = pages.find((item) => item.view === view)!
  return (
    <>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t(page.heading)}</h1>
          <p className="mt-1 text-sm text-white/45">{t(page.description)}</p>
        </div>
        <Badge
          variant="secondary"
          className="gap-2 border border-white/10 bg-white/5 px-3 py-2 text-white/65"
        >
          <Wifi className="size-3.5 dock-accent-text" />{" "}
          {t("desktop.nav.connectedShort", { count: clients })}
        </Badge>
      </header>
      <nav
        aria-label={t("desktop.nav.main")}
        className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden"
      >
        {pages.map((item) => (
          <NavButton key={item.view} page={item} current={view} onNavigate={onNavigate} compact />
        ))}
      </nav>
    </>
  )
}
