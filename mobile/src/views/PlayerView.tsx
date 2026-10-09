import { useLayoutEffect, useRef, useState, type CSSProperties } from "react"
import { Music2, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import type { ControlAction as Action, Track } from "../../../shared/protocol"

const timeOf = (ms: number) =>
  `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`

function MarqueeTitle({ title }: { title: string }) {
  const viewport = useRef<HTMLDivElement>(null)
  const text = useRef<HTMLSpanElement>(null)
  const [distance, setDistance] = useState(0)
  useLayoutEffect(() => {
    const measure = () =>
      setDistance(
        Math.max(
          0,
          Math.ceil((text.current?.scrollWidth ?? 0) - (viewport.current?.clientWidth ?? 0)),
        ),
      )
    measure()
    const observer = new ResizeObserver(measure)
    if (viewport.current) observer.observe(viewport.current)
    if (text.current) observer.observe(text.current)
    return () => observer.disconnect()
  }, [title])
  const motion =
    distance > 0
      ? ({
          "--marquee-distance": `${distance}px`,
          animationDuration: `${Math.max(7, distance / 28 + 5)}s`,
        } as CSSProperties)
      : undefined
  return (
    <div ref={viewport} className="min-w-0 overflow-hidden" title={title}>
      <span
        ref={text}
        className={`inline-block w-max max-w-none whitespace-nowrap text-3xl font-semibold leading-tight tracking-tight sm:text-5xl ${distance > 0 ? "dock-marquee" : ""}`}
        style={motion}
      >
        {title}
      </span>
    </div>
  )
}

export function PlayerView({
  track,
  position,
  setPosition,
  seeking,
  send,
  compact,
  onActivity,
}: {
  track: Track
  position: number
  setPosition: (value: number) => void
  seeking: React.RefObject<boolean>
  send: (action: Action) => void
  compact: boolean
  onActivity: () => void
}) {
  const max = Math.max(track.durationMs, 1)
  return (
    <main
      onPointerDown={onActivity}
      className={`flex min-h-0 flex-1 items-center gap-6 py-3 sm:gap-9 ${compact ? "mx-auto w-full max-w-5xl" : ""}`}
    >
      <div className="flex aspect-square h-[min(58vh,430px)] max-h-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_30px_80px_rgba(0,0,0,.45)]">
        {track.artwork ? (
          <img
            src={track.artwork}
            alt={`Carátula de ${track.album}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <Music2 className="size-20 text-white/15" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] dock-accent-text">
          <span className="size-1.5 rounded-full dock-accent-bg" />{" "}
          {track.playing ? "REPRODUCIENDO" : "EN PAUSA"}
        </div>
        <MarqueeTitle title={track.title || "Esperando música"} />
        <p className="mt-2 truncate text-lg text-white/55 sm:text-xl">
          {track.artist || "Inicia música en el ordenador"}
        </p>
        <p className="mt-1 truncate text-xs text-white/35">{track.album}</p>
        <div className="mt-6">
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
            disabled={!track.available}
            className="dock-slider"
          />
          <div className="mt-3 flex justify-between text-xs tabular-nums text-white/40">
            <span>{timeOf(position)}</span>
            <span>{timeOf(track.durationMs)}</span>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2 sm:gap-5">
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Aleatorio"
            disabled={!track.available}
            onClick={() => send({ action: "shuffle", enabled: !track.shuffle })}
            className={track.shuffle ? "dock-accent-text" : "text-white/55"}
          >
            <Shuffle className="size-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Canción anterior"
            disabled={!track.available}
            onClick={() => send({ action: "previous" })}
          >
            <SkipBack className="size-6 fill-current" />
          </Button>
          <Button
            size="icon-lg"
            aria-label={track.playing ? "Pausar" : "Reproducir"}
            disabled={!track.available}
            onClick={() => send({ action: "play_pause" })}
            className="size-16 rounded-full dock-accent-bg dock-accent-hover"
          >
            {track.playing ? (
              <Pause className="size-6 fill-current" />
            ) : (
              <Play className="size-6 fill-current" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Siguiente canción"
            disabled={!track.available}
            onClick={() => send({ action: "next" })}
          >
            <SkipForward className="size-6 fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="icon-lg"
            aria-label="Repetición"
            disabled={!track.available}
            onClick={() =>
              send({
                action: "repeat",
                mode: track.repeat === "off" ? "all" : track.repeat === "all" ? "track" : "off",
              })
            }
            className={track.repeat !== "off" ? "dock-accent-text" : "text-white/55"}
          >
            {track.repeat === "track" ? (
              <Repeat1 className="size-5" />
            ) : (
              <Repeat className="size-5" />
            )}
          </Button>
        </div>
      </div>
    </main>
  )
}
