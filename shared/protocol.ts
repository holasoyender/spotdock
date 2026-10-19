import type { DockConfig } from "./dock"
import type { LanguagePreference, Locale } from "./i18n"
import type { Alarm, AlarmDevice } from "./alarms"

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
  screenOff: boolean
  screenAt: number
  language: LanguagePreference
  locale: Locale
  media: { source: string; message: string | null }
  alarms: Alarm[]
  devices: AlarmDevice[]
}

export type AlarmTestEvent = { kind: "alarm_test"; alarm: Alarm }
export type DeviceDisconnectEvent = { kind: "disconnect" }

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

export type NotificationSettings = {
  enabled: boolean
  discord: boolean
  whatsapp: boolean
}

export type NotificationStatus = {
  access: "allowed" | "unpackaged" | "denied" | "unspecified" | "unavailable"
  settings: NotificationSettings
}

/** Transient desktop notification; intentionally absent from the state snapshot. */
export type NotificationEvent = {
  kind: "notification"
  id: string
  app: "discord" | "whatsapp" | "spotdock"
  sender: string
  body: string
  image: string | null
}

export type ScreenEvent = { kind: "screen"; screenOff: boolean; screenAt: number }
export type NotificationAck = { action: "notification_ack"; id: string }
export type NotificationTestResult = { connected: number; acknowledged: number }

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
