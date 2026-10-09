import { useState } from "react"
import { Check, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DeckIcon, deckIconNames } from "../../DeckIcon"
import { Segmented } from "./Segmented"
import type { DeckButton } from "../../../../shared/dock"

const iconNames: Record<string, string> = {
  play: "Play",
  next: "Siguiente",
  previous: "Anterior",
  music: "Música",
  clock: "Reloj",
  globe: "Web",
  terminal: "Terminal",
  folder: "Carpeta",
  mail: "Correo",
  keyboard: "Teclado",
  rocket: "Cohete",
  power: "Encendido",
  sun: "Sol",
  heart: "Corazón",
  star: "Estrella",
  settings: "Ajustes",
}
export const actionNames: Record<DeckButton["actionKind"], string> = {
  url: "Abrir web",
  app: "Abrir aplicación",
  shortcut: "Atajo de teclado",
  media: "Música",
  view: "Cambiar vista",
}
const actionDefaults: Record<DeckButton["actionKind"], string> = {
  url: "https://",
  app: "",
  shortcut: "Ctrl+Shift+S",
  media: "play_pause",
  view: "clock",
}

async function imageData(file: File): Promise<string> {
  if (file.size > 5_000_000 || !["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Elige una imagen PNG, JPEG o WebP de menos de 5 MB.")
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = 160
    canvas.height = 160
    const context = canvas.getContext("2d")
    if (!context) throw new Error("No se pudo procesar la imagen.")
    const size = Math.min(image.width, image.height)
    context.drawImage(
      image,
      (image.width - size) / 2,
      (image.height - size) / 2,
      size,
      size,
      0,
      0,
      160,
      160,
    )
    const data = canvas.toDataURL("image/webp", 0.78)
    if (data.length > 120_000)
      throw new Error("La imagen comprimida sigue siendo demasiado grande.")
    return data
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function ButtonEditor({
  button,
  onSave,
  onCancel,
}: {
  button: DeckButton
  onSave: (button: DeckButton) => Promise<void>
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(button)
  const [error, setError] = useState("")
  const patch = (changes: Partial<DeckButton>) =>
    setDraft((current) => ({ ...current, ...changes }))
  async function save() {
    try {
      setError("")
      await onSave(draft)
    } catch (cause) {
      setError(String(cause))
    }
  }
  return (
    <Card className="border-white/12 bg-[#191f1c]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Editar botón</CardTitle>
            <CardDescription>Su aspecto y acción se sincronizan con el móvil.</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancelar">
            <X />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_110px]">
          <div className="space-y-2">
            <Label htmlFor="button-label">Texto del botón</Label>
            <Input
              id="button-label"
              maxLength={32}
              value={draft.label}
              onChange={(event) => patch({ label: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="button-color">Fondo</Label>
            <Input
              id="button-color"
              type="color"
              value={draft.color}
              onChange={(event) => patch({ color: event.target.value })}
              className="h-10 cursor-pointer p-1"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="button-image">Imagen personalizada</Label>
          <Input
            id="button-image"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (event) => {
              const file = event.target.files?.[0]
              if (file) {
                try {
                  patch({ image: await imageData(file) })
                  setError("")
                } catch (cause) {
                  setError(String(cause))
                }
              }
            }}
            className="cursor-pointer"
          />
          <p className="text-xs text-white/40">
            Se recorta a formato cuadrado y se reduce antes de enviarla.
          </p>
          {draft.image && (
            <Button variant="outline" size="sm" onClick={() => patch({ image: null })}>
              <Trash2 className="size-3.5" /> Quitar imagen
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <Label>Icono cuando no hay imagen</Label>
          <div className="flex flex-wrap gap-2">
            {deckIconNames.map((name) => (
              <Button
                key={name}
                variant="outline"
                size="icon"
                title={iconNames[name]}
                aria-label={iconNames[name]}
                onClick={() => patch({ icon: name })}
                className={
                  draft.icon === name
                    ? "border-[var(--dock-accent)] dock-accent-text"
                    : "border-white/10"
                }
              >
                <DeckIcon name={name} className="size-4" />
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Acción</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(actionNames) as DeckButton["actionKind"][]).map((kind) => (
              <Button
                key={kind}
                variant={draft.actionKind === kind ? "default" : "outline"}
                onClick={() => patch({ actionKind: kind, actionValue: actionDefaults[kind] })}
                className={draft.actionKind === kind ? "dock-accent-bg" : "border-white/15"}
              >
                {actionNames[kind]}
              </Button>
            ))}
          </div>
        </div>
        {draft.actionKind === "media" || draft.actionKind === "view" ? (
          <div className="space-y-2">
            <Label>{draft.actionKind === "media" ? "Control" : "Pantalla"}</Label>
            <Segmented
              value={draft.actionValue}
              options={
                draft.actionKind === "media"
                  ? [
                      { value: "play_pause", label: "Play / pausa" },
                      { value: "next", label: "Siguiente" },
                      { value: "previous", label: "Anterior" },
                    ]
                  : [
                      { value: "clock", label: "Reloj" },
                      { value: "player", label: "Música" },
                      { value: "deck", label: "Botonera" },
                    ]
              }
              onChange={(actionValue) => patch({ actionValue })}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="action-value">
              {draft.actionKind === "url"
                ? "Dirección web"
                : draft.actionKind === "app"
                  ? "Ruta completa del .exe o .lnk"
                  : "Combinación de teclas"}
            </Label>
            <Input
              id="action-value"
              value={draft.actionValue}
              onChange={(event) => patch({ actionValue: event.target.value })}
              placeholder={
                draft.actionKind === "url"
                  ? "https://ejemplo.com"
                  : draft.actionKind === "app"
                    ? "C:\\Program Files\\App\\app.exe"
                    : "Ctrl+Shift+S"
              }
            />
            <p className="text-xs text-white/40">
              {draft.actionKind === "shortcut"
                ? "Se envía a la aplicación que tenga el foco en Windows. Acepta Ctrl, Alt, Shift, Win, letras, números y F1–F12."
                : draft.actionKind === "app"
                  ? "Se abrirá en el ordenador cuando pulses el botón del móvil."
                  : "Se abrirá en el navegador predeterminado del ordenador."}
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={save} className="dock-accent-bg">
            <Check className="size-4" /> Guardar botón
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
