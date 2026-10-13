import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DeckIcon } from "./DeckIcon"
import { ButtonEditor, actionNames } from "./components/desktop/ButtonEditor"
import { t } from "../../shared/i18n"
import { localizeNativeMessage } from "../../shared/nativeMessages"
import {
  buttonDisplayLabel,
  type DeckButton,
  type DockConfig,
  foregroundForColor,
} from "../../shared/dock"

type ChangeConfig = (config: DockConfig) => Promise<void>

function newButton(): DeckButton {
  return {
    id: crypto.randomUUID(),
    label: t("desktop.deck.newButton"),
    icon: "rocket",
    image: null,
    color: "#1c2420",
    actionKind: "view",
    actionValue: "clock",
  }
}

export function DeckSettings({ config, onChange }: { config: DockConfig; onChange: ChangeConfig }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState("")
  const button = config.buttons.find((item) => item.id === editing)
  const updateButtons = (buttons: DeckButton[]) => onChange({ ...config, buttons })
  async function add() {
    if (config.buttons.length >= 24) {
      setError(t("desktop.deck.limit"))
      return
    }
    const item = newButton()
    try {
      await updateButtons([...config.buttons, item])
      setEditing(item.id)
      setError("")
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    }
  }
  async function save(item: DeckButton) {
    await updateButtons(config.buttons.map((current) => (current.id === item.id ? item : current)))
    setEditing(null)
  }
  async function remove(id: string) {
    try {
      await updateButtons(config.buttons.filter((item) => item.id !== id))
      if (editing === id) setEditing(null)
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    }
  }
  async function move(index: number, offset: number) {
    const target = index + offset
    if (target < 0 || target >= config.buttons.length) return
    const next = [...config.buttons]
    ;[next[index], next[target]] = [next[target], next[index]]
    try {
      await updateButtons(next)
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    }
  }
  async function test(id: string) {
    try {
      setError("")
      await invoke("trigger_deck_button", { buttonId: id })
    } catch (cause) {
      setError(localizeNativeMessage(cause))
    }
  }
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.95fr)]">
      <Card className="min-w-0 border-white/8 bg-[#141817]">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>{t("desktop.deck.title")}</CardTitle>
              <CardDescription>{t("desktop.deck.description")}</CardDescription>
            </div>
            <Button onClick={add} disabled={config.buttons.length >= 24} className="dock-accent-bg">
              <Plus className="size-4" /> {t("desktop.deck.add")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {config.buttons.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-white/40">
              {t("desktop.deck.empty")}
            </p>
          )}
          {config.buttons.map((item, index) => (
            <div
              key={item.id}
              className="flex min-w-0 items-center gap-3 rounded-xl border border-white/8 bg-white/3 p-3"
            >
              <div
                className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                style={{ backgroundColor: item.color, color: foregroundForColor(item.color) }}
              >
                {item.image ? (
                  <img src={item.image} alt="" className="size-full object-cover" />
                ) : (
                  <DeckIcon name={item.icon} className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{buttonDisplayLabel(item)}</p>
                <p className="truncate text-xs text-white/40">
                  {t(actionNames[item.actionKind])} · {item.actionValue}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={t("desktop.deck.moveUp")}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, 1)}
                  disabled={index === config.buttons.length - 1}
                  aria-label={t("desktop.deck.moveDown")}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => test(item.id)}
                  disabled={item.actionKind === "view"}
                  title={
                    item.actionKind === "view"
                      ? t("desktop.deck.viewOnly")
                      : t("desktop.deck.testAction")
                  }
                >
                  {t("desktop.deck.test")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(item.id)}>
                  {t("common.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(item.id)}
                  aria-label={t("common.delete")}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
          {error && (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
      <div className="min-w-0 space-y-5">
        {button ? (
          <ButtonEditor
            key={button.id}
            button={button}
            onSave={save}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <Card className="border-white/8 bg-[#141817]">
            <CardHeader>
              <div className="flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
                <ImagePlus className="size-5" />
              </div>
              <CardTitle>{t("desktop.deck.emptyTitle")}</CardTitle>
              <CardDescription>{t("desktop.deck.emptyDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-white/50">{t("desktop.deck.help")}</p>
              <p className="mt-4 text-xs text-white/35">{t("desktop.deck.security")}</p>
            </CardContent>
          </Card>
        )}
        <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto rounded-2xl border border-white/8 bg-[#0e1210] p-3">
          {config.buttons.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              title={buttonDisplayLabel(item)}
              onClick={() => setEditing(item.id)}
              className="flex h-20 flex-col gap-1 rounded-xl border border-white/10 p-2 hover:border-white/30"
              style={{ backgroundColor: item.color, color: foregroundForColor(item.color) }}
            >
              {item.image ? (
                <img src={item.image} alt="" className="size-9 rounded-md object-cover" />
              ) : (
                <DeckIcon name={item.icon} className="size-6" />
              )}
              <span className="w-full truncate text-center text-[10px] font-medium">
                {buttonDisplayLabel(item)}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
