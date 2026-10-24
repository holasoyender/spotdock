import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Settings2, Wifi } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { t } from "../../../../shared/i18n"

type DockModeStatus = {
  available: boolean
  enabled: boolean
  locked: boolean
}

export function MobileDedicatedSettings({ open }: { open: boolean }) {
  const [status, setStatus] = useState<DockModeStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    const refresh = () => {
      void invoke<DockModeStatus>("dock_mode_status")
        .then(setStatus)
        .catch(() => setError(t("mobile.settings.dockModeError")))
    }
    refresh()
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [open])

  async function setMode(enabled: boolean) {
    setBusy(true)
    setError("")
    try {
      setStatus(await invoke<DockModeStatus>("set_dock_mode", { enabled }))
    } catch {
      setError(t("mobile.settings.dockModeError"))
    } finally {
      setBusy(false)
    }
  }

  async function openAndroid(command: "open_android_wifi" | "open_android_settings") {
    setError("")
    try {
      await invoke(command)
    } catch {
      setError(t("mobile.settings.androidSettingsError"))
    }
  }

  return (
    <section className="space-y-3 border-t border-white/10 pt-5">
      <h2 className="text-sm font-semibold text-white/85">
        {t("mobile.settings.dockModeSection")}
      </h2>
      {status?.available && (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="mobile-dock-mode">{t("mobile.settings.dockMode")}</Label>
          <Switch
            id="mobile-dock-mode"
            checked={status.enabled}
            disabled={busy}
            onCheckedChange={(enabled) => void setMode(enabled)}
          />
        </div>
      )}
      <p className="text-xs text-white/55">
        {status?.available
          ? t("mobile.settings.dockModeHelp")
          : t("mobile.settings.dockModeUnavailable")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          className="border-white/15"
          onClick={() => void openAndroid("open_android_wifi")}
        >
          <Wifi className="size-4" />
          {t("mobile.settings.openWifi")}
        </Button>
        <Button
          variant="outline"
          className="border-white/15"
          onClick={() => void openAndroid("open_android_settings")}
        >
          <Settings2 className="size-4" />
          {t("mobile.settings.openAndroidSettings")}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-rose-300">
          {error}
        </p>
      )}
    </section>
  )
}
