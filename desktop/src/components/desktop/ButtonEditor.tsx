import { useState } from "react"
import { Check, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DeckIcon, deckIconNames } from "../../DeckIcon"
import { Segmented } from "./Segmented"
import type { DeckButton } from "../../../../shared/dock"
import { t, type TranslationKey } from "../../../../shared/i18n"
import { localizeNativeMessage } from "../../../../shared/nativeMessages"

const iconNames: Record<string, TranslationKey> = {
  play: "desktop.icon.play",
  next: "desktop.icon.next",
  previous: "desktop.icon.previous",
  music: "desktop.icon.music",
  clock: "desktop.icon.clock",
  globe: "desktop.icon.globe",
  terminal: "desktop.icon.terminal",
  folder: "desktop.icon.folder",
  mail: "desktop.icon.mail",
  keyboard: "desktop.icon.keyboard",
  rocket: "desktop.icon.rocket",
  power: "desktop.icon.power",
  sun: "desktop.icon.sun",
  heart: "desktop.icon.heart",
  star: "desktop.icon.star",
  settings: "desktop.icon.settings",
}
export const actionNames: Record<DeckButton["actionKind"], TranslationKey> = {
  url: "desktop.action.url",
  app: "desktop.action.app",
  shortcut: "desktop.action.shortcut",
  media: "desktop.action.media",
  view: "desktop.action.view",
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
    throw new Error(t("desktop.editor.imageType"))
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    const canvas = document.createElement("canvas")
    canvas.width = 160
    canvas.height = 160
    const context = canvas.getContext("2d")
    if (!context) throw new Error(t("desktop.editor.imageProcess"))
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
    if (data.length > 120_000) throw new Error(t("desktop.editor.imageLarge"))
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
      setError(localizeNativeMessage(cause))
    }
  }
  return (
    <Card className="border-white/12 bg-[#191f1c]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{t("desktop.editor.title")}</CardTitle>
            <CardDescription>{t("desktop.editor.description")}</CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onCancel} aria-label={t("common.cancel")}>
            <X />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_110px]">
          <div className="space-y-2">
            <Label htmlFor="button-label">{t("desktop.editor.label")}</Label>
            <Input
              id="button-label"
              maxLength={32}
              value={draft.label}
              onChange={(event) => patch({ label: event.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="button-color">{t("desktop.editor.background")}</Label>
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
          <Label htmlFor="button-image">{t("desktop.editor.image")}</Label>
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
                  setError(localizeNativeMessage(cause))
                }
              }
            }}
            className="cursor-pointer"
          />
          <p className="text-xs text-white/40">{t("desktop.editor.imageHelp")}</p>
          {draft.image && (
            <Button variant="outline" size="sm" onClick={() => patch({ image: null })}>
              <Trash2 className="size-3.5" /> {t("desktop.editor.removeImage")}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          <Label>{t("desktop.editor.icon")}</Label>
          <div className="flex flex-wrap gap-2">
            {deckIconNames.map((name) => (
              <Button
                key={name}
                variant="outline"
                size="icon"
                title={t(iconNames[name])}
                aria-label={t(iconNames[name])}
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
          <Label>{t("desktop.editor.action")}</Label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(actionNames) as DeckButton["actionKind"][]).map((kind) => (
              <Button
                key={kind}
                variant={draft.actionKind === kind ? "default" : "outline"}
                onClick={() => patch({ actionKind: kind, actionValue: actionDefaults[kind] })}
                className={draft.actionKind === kind ? "dock-accent-bg" : "border-white/15"}
              >
                {t(actionNames[kind])}
              </Button>
            ))}
          </div>
        </div>
        {draft.actionKind === "media" || draft.actionKind === "view" ? (
          <div className="space-y-2">
            <Label>
              {draft.actionKind === "media"
                ? t("desktop.editor.control")
                : t("desktop.editor.screen")}
            </Label>
            <Segmented
              value={draft.actionValue}
              options={
                draft.actionKind === "media"
                  ? [
                      { value: "play_pause", label: t("desktop.editor.playPause") },
                      { value: "next", label: t("common.next") },
                      { value: "previous", label: t("common.previous") },
                    ]
                  : [
                      { value: "clock", label: t("common.clock") },
                      { value: "player", label: t("common.music") },
                      { value: "deck", label: t("common.deck") },
                    ]
              }
              onChange={(actionValue) => patch({ actionValue })}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="action-value">
              {draft.actionKind === "url"
                ? t("desktop.editor.webAddress")
                : draft.actionKind === "app"
                  ? t("desktop.editor.appPath")
                  : t("desktop.editor.keys")}
            </Label>
            <Input
              id="action-value"
              value={draft.actionValue}
              onChange={(event) => patch({ actionValue: event.target.value })}
              placeholder={
                draft.actionKind === "url"
                  ? t("desktop.editor.urlExample")
                  : draft.actionKind === "app"
                    ? "C:\\Program Files\\App\\app.exe"
                    : "Ctrl+Shift+S"
              }
            />
            <p className="text-xs text-white/40">
              {draft.actionKind === "shortcut"
                ? t("desktop.editor.shortcutHelp")
                : draft.actionKind === "app"
                  ? t("desktop.editor.appHelp")
                  : t("desktop.editor.urlHelp")}
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
            {t("common.cancel")}
          </Button>
          <Button onClick={save} className="dock-accent-bg">
            <Check className="size-4" /> {t("desktop.editor.save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
