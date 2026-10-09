import { useEffect, useState } from "react"
import { getCurrentWindow } from "@tauri-apps/api/window"
import { Disc3, Maximize2, Minimize2, Minus, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export function WindowChrome() {
  const [maximized, setMaximized] = useState(false)
  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return
    const appWindow = getCurrentWindow()
    let unlisten: (() => void) | undefined
    appWindow
      .isMaximized()
      .then(setMaximized)
      .catch(() => {})
    appWindow
      .onResized(() => {
        appWindow
          .isMaximized()
          .then(setMaximized)
          .catch(() => {})
      })
      .then((callback) => {
        unlisten = callback
      })
    return () => unlisten?.()
  }, [])
  const windowAction = (action: "minimize" | "toggleMaximize" | "close") => {
    if (!("__TAURI_INTERNALS__" in window)) return
    const appWindow = getCurrentWindow()
    appWindow[action]()
      .then(() => appWindow.isMaximized().then(setMaximized))
      .catch(() => {})
  }
  return (
    <div className="flex h-11 shrink-0 items-stretch border-b border-white/8 bg-[#101312] select-none">
      <div
        className="flex min-w-0 flex-1 cursor-default items-center gap-2 px-4"
        onMouseDown={(event) => {
          if (event.button !== 0 || !("__TAURI_INTERNALS__" in window)) return
          if (event.detail === 2) windowAction("toggleMaximize")
          else
            getCurrentWindow()
              .startDragging()
              .catch(() => {})
        }}
      >
        <Disc3 className="size-4 shrink-0 dock-accent-text" />
        <span className="text-xs font-semibold tracking-wide">SpotDock</span>
        <span className="ml-2 hidden text-[11px] text-white/35 sm:inline">/ Centro de control</span>
      </div>
      <div className="flex shrink-0 items-stretch">
        <Button
          variant="ghost"
          aria-label="Minimizar"
          title="Minimizar"
          onClick={() => windowAction("minimize")}
          className="h-full w-12 rounded-none text-white/65 hover:bg-white/10"
        >
          <Minus className="size-4" />
        </Button>
        <Button
          variant="ghost"
          aria-label={maximized ? "Restaurar" : "Maximizar"}
          title={maximized ? "Restaurar" : "Maximizar"}
          onClick={() => windowAction("toggleMaximize")}
          className="h-full w-12 rounded-none text-white/65 hover:bg-white/10"
        >
          {maximized ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </Button>
        <Button
          variant="ghost"
          aria-label="Cerrar"
          title="Cerrar"
          onClick={() => windowAction("close")}
          className="h-full w-12 rounded-none text-white/65 hover:bg-red-600 hover:text-white"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  )
}
