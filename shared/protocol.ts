import type { DockConfig, Weather } from "./dock"
import type { LanguagePreference, Locale } from "./i18n"

/** Shape of the media state sent by the desktop application. */
export type Track = {
  title: string
  artist: string
  album: string
  artwork: string | null
  positionMs: number
  durationMs: number
  playing: boolean
  shuffle: boolean
  repeat: string
  available: boolean
}

export type ControlAction =
  | { action: "play_pause" | "next" | "previous" }
  | { action: "seek"; position_ms: number }
  | { action: "shuffle"; enabled: boolean }
  | { action: "repeat"; mode: string }

export type DeckAction = { action: "deck"; button_id: string }

export type Snapshot = {
  kind: "state"
  track: Track
  clients: number
  accent: string
  config: DockConfig
  language: LanguagePreference
  locale: Locale
  weather: Weather | null
  media: { source: string; message: string | null }
}

export type TrackUpdate = {
  kind: "track"
  track: Omit<Track, "artwork"> & { artwork?: string | null }
}

export type ActionResult = {
  kind: "action_result"
  buttonId: string
  ok: boolean
  message?: string | null
}

export type Pairing = { url: string; clients: number; port: number }
export type SpotifyAuthStatus = {
  connected: boolean
  pending: boolean
  clientId: string
  error: string | null
}

export type MediaSession = {
  source: string
  title: string
  artist: string
  playing: boolean
}

export type MediaSources = {
  selected: string | null
  sessions: MediaSession[]
}
