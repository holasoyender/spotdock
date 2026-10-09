import {
  AppWindow,
  Clock3,
  FastForward,
  Folder,
  Globe2,
  Heart,
  Keyboard,
  Mail,
  Music2,
  Play,
  Power,
  Rocket,
  Settings2,
  SkipBack,
  Star,
  Sun,
  Terminal,
} from "lucide-react"

const icons = {
  play: Play,
  next: FastForward,
  previous: SkipBack,
  music: Music2,
  clock: Clock3,
  globe: Globe2,
  terminal: Terminal,
  folder: Folder,
  mail: Mail,
  keyboard: Keyboard,
  rocket: Rocket,
  power: Power,
  sun: Sun,
  heart: Heart,
  star: Star,
  settings: Settings2,
} as const

export const deckIconNames = Object.keys(icons) as (keyof typeof icons)[]

export function DeckIcon({ name, className }: { name: string; className?: string }) {
  const Icon = icons[name as keyof typeof icons] ?? AppWindow
  return <Icon className={className} />
}
