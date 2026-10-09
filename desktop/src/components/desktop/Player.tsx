import { Disc3, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import type { ControlAction as Action, Track } from "../../../../shared/protocol"

const empty = { title: "Nada sonando todavía", artist: "Abre Spotify en este ordenador" }
const time = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`

export function Player({
  track,
  position,
  setPosition,
  seeking,
  send,
}: {
  track: Track
  position: number
  setPosition: (value: number) => void
  seeking: React.RefObject<boolean>
  send: (action: Action) => void
}) {
  const max = Math.max(track.durationMs, 1)
  return (
    <Card className="relative min-w-0 overflow-hidden border-white/8 bg-[#141817] p-0">
      <div className="relative flex min-h-[455px] flex-col justify-between overflow-hidden p-6 lg:p-8">
        {track.artwork && (
          <img
            src={track.artwork}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-[0.1] blur-[70px]"
          />
        )}
        <div className="relative min-w-0">
          <div className="mb-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] dock-accent-text">
              <span className="size-2 rounded-full dock-accent-bg" /> Ahora suena
            </div>
            <Badge variant="outline" className="shrink-0 border-white/15 text-white/45">
              Spotify
            </Badge>
          </div>
          <div className="flex min-w-0 items-center gap-7">
            <div className="flex size-44 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/6 shadow-2xl xl:size-52">
              {track.artwork ? (
                <img
                  src={track.artwork}
                  alt={`Carátula de ${track.album}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Disc3 className="size-16 text-white/15" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                {track.album || "ESPERANDO MÚSICA"}
              </p>
              <h2
                className="mt-3 line-clamp-2 text-3xl font-semibold leading-tight tracking-tight xl:text-4xl"
                title={track.title}
              >
                {track.title || empty.title}
              </h2>
              <p className="mt-3 truncate text-lg text-white/55">{track.artist || empty.artist}</p>
            </div>
          </div>
        </div>
        <div className="relative min-w-0 pt-8">
          <Slider
            min={0}
            max={max}
            value={[Math.min(position, max)]}
            onValueChange={(value) => {
              seeking.current = true
              setPosition(typeof value === "number" ? value : value[0])
            }}
            onValueCommitted={(value) => {
              send({ action: "seek", position_ms: typeof value === "number" ? value : value[0] })
              setTimeout(() => {
                seeking.current = false
              }, 700)
            }}
            disabled={!track.available || track.durationMs <= 0}
            className="dock-slider"
          />
          <div className="mt-3 flex justify-between text-xs tabular-nums text-white/40">
            <span>{time(position)}</span>
            <span>{time(track.durationMs)}</span>
          </div>
          <div className="mt-5 flex items-center justify-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Aleatorio"
              disabled={!track.available}
              onClick={() => send({ action: "shuffle", enabled: !track.shuffle })}
              className={track.shuffle ? "dock-accent-text" : "text-white/45"}
            >
              <Shuffle />
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Anterior"
              disabled={!track.available}
              onClick={() => send({ action: "previous" })}
            >
              <SkipBack className="size-5 fill-current" />
            </Button>
            <Button
              size="icon-lg"
              aria-label={track.playing ? "Pausar" : "Reproducir"}
              disabled={!track.available}
              onClick={() => send({ action: "play_pause" })}
              className="size-14 rounded-full dock-accent-bg dock-accent-hover"
            >
              {track.playing ? (
                <Pause className="size-5 fill-current" />
              ) : (
                <Play className="size-5 fill-current" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-lg"
              aria-label="Siguiente"
              disabled={!track.available}
              onClick={() => send({ action: "next" })}
            >
              <SkipForward className="size-5 fill-current" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Repetir"
              disabled={!track.available}
              onClick={() =>
                send({
                  action: "repeat",
                  mode: track.repeat === "off" ? "all" : track.repeat === "all" ? "track" : "off",
                })
              }
              className={track.repeat !== "off" ? "dock-accent-text" : "text-white/45"}
            >
              {track.repeat === "track" ? <Repeat1 /> : <Repeat />}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  )
}
