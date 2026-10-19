import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Dialog } from "@base-ui/react/dialog"
import { Bell, Loader2, Pencil, Smartphone, Unplug, Volume2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { t } from "../../../../shared/i18n"
import { localizeNativeMessage } from "../../../../shared/nativeMessages"
import type { AlarmDevice } from "../../../../shared/alarms"
import { PairingCard } from "./PairingCard"

type Action = "rename" | "disconnect" | "notification" | "alarm"
type Feedback = { id: string; message: string; error: boolean }

export function DevicesPage({
  devices,
  pairingUrl,
  rotate,
}: {
  devices: AlarmDevice[]
  pairingUrl?: string
  rotate: () => void
}) {
  const [renaming, setRenaming] = useState<AlarmDevice | null>(null)
  const [name, setName] = useState("")
  const [renameError, setRenameError] = useState("")
  const [busy, setBusy] = useState<{ id: string; action: Action } | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const sorted = [...devices].sort(
    (a, b) => Number(b.connected) - Number(a.connected) || a.name.localeCompare(b.name),
  )

  function openRename(device: AlarmDevice) {
    setRenaming(device)
    setName(device.name)
    setRenameError("")
  }

  async function rename() {
    if (!renaming || busy) return
    const next = name.trim()
    if (!next) {
      setRenameError(t("desktop.devices.nameRequired"))
      return
    }
    setBusy({ id: renaming.id, action: "rename" })
    try {
      await invoke("rename_device", { deviceId: renaming.id, name: next })
      setFeedback({ id: renaming.id, message: t("desktop.devices.renamed"), error: false })
      setRenaming(null)
    } catch (cause) {
      setRenameError(localizeNativeMessage(cause))
    } finally {
      setBusy(null)
    }
  }

  async function act(device: AlarmDevice, action: Exclude<Action, "rename">) {
    if (busy || !device.connected) return
    setBusy({ id: device.id, action })
    setFeedback(null)
    try {
      let message: string
      if (action === "disconnect") {
        await invoke("disconnect_device", { deviceId: device.id })
        message = t("desktop.devices.disconnectSent")
      } else if (action === "notification") {
        const acknowledged = await invoke<boolean>("send_device_test_notification", {
          deviceId: device.id,
          sender: t("desktop.notifications.testSender"),
          body: t("desktop.notifications.testBody"),
        })
        message = t(
          acknowledged
            ? "desktop.devices.notificationReceived"
            : "desktop.devices.notificationUnconfirmed",
        )
      } else {
        await invoke("test_alarm", { deviceId: device.id })
        message = t("desktop.devices.alarmSent")
      }
      setFeedback({ id: device.id, message, error: false })
    } catch (cause) {
      setFeedback({ id: device.id, message: localizeNativeMessage(cause), error: true })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.75fr)]">
      <Card className="min-w-0 border-white/8 bg-[#141817]">
        <CardHeader>
          <CardTitle>{t("desktop.devices.listTitle")}</CardTitle>
          <CardDescription>
            {t("desktop.devices.listDescription")}{" "}
            {t("desktop.app.connectedInNetwork", {
              count: devices.filter((device) => device.connected).length,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sorted.length === 0 && (
            <p className="rounded-xl border border-white/10 bg-white/3 px-5 py-8 text-center text-sm text-white/55">
              {t("desktop.devices.empty")}
            </p>
          )}
          {sorted.map((device) => (
            <div key={device.id} className="rounded-xl border border-white/10 bg-white/3 p-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
                  <Smartphone className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{device.name}</p>
                  <p className="text-xs text-white/40">{device.id.slice(0, 8)}</p>
                </div>
                <Badge
                  variant="outline"
                  className={
                    device.connected
                      ? "border-[var(--dock-accent)]/30 dock-accent-text"
                      : "border-white/15 text-white/45"
                  }
                >
                  {device.connected ? t("common.connected") : t("common.offline")}
                </Badge>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => openRename(device)}
                >
                  <Pencil className="size-4" /> {t("desktop.devices.rename")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!busy || !device.connected}
                  onClick={() => void act(device, "notification")}
                >
                  {busy?.id === device.id && busy.action === "notification" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Bell className="size-4" />
                  )}
                  {t("desktop.devices.testNotification")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!!busy || !device.connected}
                  onClick={() => void act(device, "alarm")}
                >
                  <Volume2 className="size-4" /> {t("desktop.devices.ring")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!!busy || !device.connected}
                  onClick={() => void act(device, "disconnect")}
                >
                  <Unplug className="size-4" /> {t("desktop.devices.disconnect")}
                </Button>
              </div>
              {feedback?.id === device.id && (
                <p
                  role={feedback.error ? "alert" : "status"}
                  className={`mt-3 text-xs ${feedback.error ? "text-red-300" : "text-white/55"}`}
                >
                  {feedback.message}
                </p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-5">
        <PairingCard url={pairingUrl} rotate={rotate} />
        <Card className="min-w-0 border-white/8 bg-[#141817]">
          <CardContent className="space-y-3 text-sm leading-relaxed text-white/55">
            <p>{t("desktop.app.step1")}</p>
            <p>{t("desktop.app.step2")}</p>
            <p>{t("desktop.app.step3")}</p>
            <p className="pt-2 text-xs text-white/35">{t("desktop.app.networkHelp")}</p>
            <p className="border-t border-white/10 pt-3 text-xs text-white/45">
              {t("desktop.devices.disconnectHelp")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Dialog.Root open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-51 w-[min(92vw,440px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-[#161c19] p-6 text-white shadow-2xl outline-none">
            <Dialog.Title className="text-lg font-semibold">
              {t("desktop.devices.renameTitle")}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-white/50">
              {t("desktop.devices.renameDescription")}
            </Dialog.Description>
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void rename()
              }}
              className="mt-5 space-y-5"
            >
              <div>
                <label htmlFor="device-name" className="mb-2 block text-sm font-medium">
                  {t("desktop.devices.name")}
                </label>
                <Input
                  id="device-name"
                  autoFocus
                  maxLength={80}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="h-11 rounded-xl border border-white/15 bg-[#101715] px-3 focus-visible:border-[var(--dock-accent)]"
                />
                {renameError && (
                  <p role="alert" className="mt-2 text-xs text-red-300">
                    {renameError}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRenaming(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={!!busy || !name.trim()} className="dock-accent-bg">
                  {t("common.save")}
                </Button>
              </div>
            </form>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
