import { Clock3, Grid3X3, Music2, Settings2, Smartphone, Wifi, type LucideIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type View = "player" | "clock" | "deck" | "devices" | "settings"

const pages: {
  view: View
  label: string
  compactLabel: string
  heading: string
  description: string
  icon: LucideIcon
}[] = [
  {
    view: "player",
    label: "Reproducción",
    compactLabel: "Reproducción",
    heading: "Centro de control",
    description: "Tu música, al alcance de la mano.",
    icon: Music2,
  },
  {
    view: "clock",
    label: "Reloj y tiempo",
    compactLabel: "Reloj",
    heading: "Reloj y tiempo",
    description: "Tu dock también te acompaña entre canciones.",
    icon: Clock3,
  },
  {
    view: "deck",
    label: "Botonera",
    compactLabel: "Botonera",
    heading: "Botonera",
    description: "Tus acciones favoritas a un toque.",
    icon: Grid3X3,
  },
  {
    view: "devices",
    label: "Dispositivos",
    compactLabel: "Dispositivos",
    heading: "Tus dispositivos",
    description: "Empareja y controla la conexión local.",
    icon: Smartphone,
  },
  {
    view: "settings",
    label: "Ajustes",
    compactLabel: "Ajustes",
    heading: "Ajustes",
    description: "Haz que SpotDock se sienta tuyo.",
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
      {compact ? page.compactLabel : page.label}
    </Button>
  )
}

export function DesktopSidebar({ view, onNavigate, clients }: NavigationProps) {
  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-white/8 bg-[#101312] px-4 py-6 lg:flex">
      <div className="px-3">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] dock-accent-text">
          TU ESPACIO, EN TU DOCK
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/40">
          Reloj, música y acciones a un toque.
        </p>
      </div>
      <nav aria-label="Navegación principal" className="mt-10 space-y-1">
        {pages.map((page) => (
          <NavButton key={page.view} page={page} current={view} onNavigate={onNavigate} />
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-white/8 bg-white/4 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="size-2 rounded-full dock-accent-bg" /> Red local activa
        </div>
        <p className="mt-2 text-xs leading-relaxed text-white/40">
          {clients
            ? `${clients} móvil${clients === 1 ? "" : "es"} conectado${clients === 1 ? "" : "s"}`
            : "Esperando móvil"}
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
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{page.heading}</h1>
          <p className="mt-1 text-sm text-white/45">{page.description}</p>
        </div>
        <Badge
          variant="secondary"
          className="gap-2 border border-white/10 bg-white/5 px-3 py-2 text-white/65"
        >
          <Wifi className="size-3.5 dock-accent-text" /> {clients} conectado
          {clients === 1 ? "" : "s"}
        </Badge>
      </header>
      <nav
        aria-label="Navegación principal"
        className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden"
      >
        {pages.map((item) => (
          <NavButton key={item.view} page={item} current={view} onNavigate={onNavigate} compact />
        ))}
      </nav>
    </>
  )
}
