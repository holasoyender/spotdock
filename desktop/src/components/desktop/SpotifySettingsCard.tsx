import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Music2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { MediaSources, Snapshot, SpotifyAuthStatus } from "../../../../shared/protocol"
import { t } from "../../../../shared/i18n"
import { localizeNativeMessage } from "../../../../shared/nativeMessages"

export function SpotifySettingsCard({
  status,
  clientId,
  setClientId,
  media,
  connect,
  disconnect,
  dashboard,
}: {
  status: SpotifyAuthStatus
  clientId: string
  setClientId: (value: string) => void
  media: Snapshot["media"]
  connect: () => void
  disconnect: () => void
  dashboard: () => void
}) {
  const [sources, setSources] = useState<MediaSources>({ selected: null, sessions: [] })
  const [sourceError, setSourceError] = useState("")

  useEffect(() => {
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = async () => {
      try {
        const current = await invoke<MediaSources>("get_media_sessions")
        if (active) {
          setSources(current)
          setSourceError("")
        }
      } catch (cause) {
        if (active) setSourceError(localizeNativeMessage(cause))
      } finally {
        if (active) timer = setTimeout(refresh, 4000)
      }
    }
    void refresh()
    return () => {
      active = false
      if (timer) clearTimeout(timer)
    }
  }, [])

  const chooseSource = async (source: string) => {
    try {
      await invoke("set_media_session", { source: source || null })
      setSources((current) => ({ ...current, selected: source || null }))
      setSourceError("")
    } catch (cause) {
      setSourceError(localizeNativeMessage(cause))
    }
  }

  const uniqueSessions = sources.sessions.filter(
    (session, index, sessions) =>
      sessions.findIndex((other) => other.source === session.source) === index,
  )

  return (
    <Card className="min-w-0 border-white/8 bg-[#141817] xl:col-span-2">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
          <Music2 className="size-5" />
        </div>
        <CardTitle>{t("desktop.spotify.title")}</CardTitle>
        <CardDescription>{t("desktop.spotify.description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/4 p-4 text-sm">
            <p className="font-medium text-white">
              {t("desktop.spotify.currentSource", {
                source:
                  media.source === "windows"
                    ? "Windows"
                    : media.source === "spotify_api"
                      ? t("desktop.spotify.api")
                      : t("desktop.spotify.noPlayback"),
              })}
            </p>
            {media.message && (
              <p className="mt-2 break-words text-xs leading-relaxed text-white/50">
                {localizeNativeMessage(media.message)}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="spotify-media-session">{t("desktop.spotify.sessionLabel")}</Label>
            <select
              id="spotify-media-session"
              value={sources.selected ?? ""}
              onChange={(event) => void chooseSource(event.target.value)}
              className="flex h-9 w-full min-w-0 rounded-md border border-white/15 bg-[#1a1e1b] px-3 text-sm text-white"
            >
              <option value="">{t("desktop.spotify.detectAutomatically")}</option>
              {sources.selected &&
                !uniqueSessions.some((session) => session.source === sources.selected) && (
                  <option value={sources.selected}>{sources.selected}</option>
                )}
              {uniqueSessions.map((session) => (
                <option key={session.source} value={session.source}>
                  {session.title
                    ? `${session.title}${session.artist ? ` — ${session.artist}` : ""} (${session.source})`
                    : session.source}
                </option>
              ))}
            </select>
            <p className="text-xs leading-relaxed text-white/45">
              {t("desktop.spotify.sessionHelp")}
            </p>
            {sourceError && (
              <p role="alert" className="text-xs text-rose-300">
                {sourceError}
              </p>
            )}
          </div>
          <p className="text-xs leading-relaxed text-white/45">
            {t("desktop.spotify.instructionsStart")}{" "}
            <code className="text-white/75">http://127.0.0.1/callback</code>{" "}
            {t("desktop.spotify.instructionsEnd")}
          </p>
          <Button variant="outline" onClick={dashboard}>
            {t("desktop.spotify.openDashboard")}
          </Button>
        </div>
        <div className="space-y-3">
          <Label htmlFor="spotify-client-id">{t("desktop.spotify.clientId")}</Label>
          <Input
            id="spotify-client-id"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder={t("desktop.spotify.clientIdLength")}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={connect}
              disabled={status.pending || clientId.trim().length !== 32}
              className="dock-accent-bg dock-accent-hover"
            >
              {status.pending
                ? t("desktop.spotify.awaitingAuth")
                : status.connected
                  ? t("desktop.spotify.changeAccount")
                  : t("desktop.spotify.connect")}
            </Button>
            {status.connected && (
              <Button variant="outline" onClick={disconnect}>
                {t("desktop.spotify.disconnect")}
              </Button>
            )}
          </div>
          <p className="text-xs text-white/45">
            {status.connected
              ? t("desktop.spotify.connectedHelp")
              : status.pending
                ? t("desktop.spotify.pendingHelp")
                : t("desktop.spotify.optionalHelp")}
          </p>
          {status.error && (
            <p role="alert" className="text-xs text-rose-300">
              {localizeNativeMessage(status.error)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
