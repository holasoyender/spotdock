import { Button } from "@/components/ui/button"
import { DeckIcon } from "../DeckIcon"
import { type DeckButton, foregroundForColor } from "../../../shared/dock"

export function DeckView({
  buttons,
  connected,
  onPress,
  message,
}: {
  buttons: DeckButton[]
  connected: boolean
  onPress: (button: DeckButton) => void
  message: string
}) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto py-3">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tu botonera</h1>
          <p className="text-xs text-white/40">Acciones configuradas desde el escritorio</p>
        </div>
        {message && (
          <p className="max-w-[45%] truncate text-xs dock-accent-text" role="status">
            {message}
          </p>
        )}
      </div>
      {buttons.length ? (
        <div className="grid grid-cols-4 gap-3 pb-3 sm:grid-cols-6">
          {buttons.map((button) => (
            <Button
              key={button.id}
              variant="ghost"
              title={button.label}
              disabled={!connected && button.actionKind !== "view"}
              onClick={() => onPress(button)}
              className="flex h-[min(27vh,132px)] min-h-20 min-w-0 flex-col gap-2 overflow-hidden rounded-2xl border border-white/10 p-3 shadow-lg transition-transform active:scale-95"
              style={{ backgroundColor: button.color, color: foregroundForColor(button.color) }}
            >
              {button.image ? (
                <img
                  src={button.image}
                  alt=""
                  className="size-[min(13vh,58px)] rounded-lg object-cover"
                />
              ) : (
                <DeckIcon name={button.icon} className="size-[min(13vh,58px)]" />
              )}
              <span className="w-full truncate text-center text-xs font-semibold sm:text-sm">
                {button.label}
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/15 text-center text-sm text-white/40">
          Añade botones desde SpotDock Desktop.
        </div>
      )}
    </main>
  )
}
