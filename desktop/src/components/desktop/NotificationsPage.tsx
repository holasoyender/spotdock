import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { BellRing, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { t } from "../../../../shared/i18n"
import type {
  NotificationSettings,
  NotificationStatus,
  NotificationTestResult,
} from "../../../../shared/protocol"

const initial: NotificationStatus = {
  access: "unspecified",
  settings: { enabled: false, discord: true, whatsapp: true },
}

export function NotificationsPage({ clients }: { clients: number }) {
  const [status, setStatus] = useState<NotificationStatus>(initial)
  const [pending, setPending] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [testResult, setTestResult] = useState<NotificationTestResult | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    invoke<NotificationStatus>("get_notification_status")
      .then(setStatus)
      .catch((cause) => setError(String(cause)))
  }, [])

  async function change(key: keyof NotificationSettings, enabled: boolean) {
    if (saving) return
    setSaving(true)
    const previous = status.settings
    const settings = { ...previous, [key]: enabled }
    setStatus((current) => ({ ...current, settings }))
    try {
      await invoke("set_notification_settings", { settings })
      setError("")
    } catch (cause) {
      setStatus((current) => ({ ...current, settings: previous }))
      setError(String(cause))
    } finally {
      setSaving(false)
    }
  }

  async function requestAccess() {
    setPending(true)
    try {
      const access = await invoke<NotificationStatus["access"]>("request_notification_access")
      setStatus((current) => ({ ...current, access }))
      setError("")
    } catch (cause) {
      setError(String(cause))
    } finally {
      setPending(false)
    }
  }

  async function test() {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await invoke<NotificationTestResult>("send_test_notification", {
        sender: t("desktop.notifications.testSender"),
        body: t("desktop.notifications.testBody"),
      })
      setTestResult(result)
      setError("")
    } catch (cause) {
      setError(String(cause))
    } finally {
      setTesting(false)
    }
  }

  const accessDescription = {
    allowed: "desktop.notifications.accessAllowed",
    unpackaged: "desktop.notifications.accessUnpackaged",
    denied: "desktop.notifications.accessDenied",
    unspecified: "desktop.notifications.accessNeeded",
    unavailable: "desktop.notifications.accessUnavailable",
  } as const

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <Card className="min-w-0 border-white/8 bg-[#141817]">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
            <BellRing className="size-5" />
          </div>
          <CardTitle>{t("desktop.notifications.mirroring")}</CardTitle>
          <CardDescription>{t("desktop.notifications.mirroringHelp")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-white/3 p-4">
            <div>
              <p className="text-sm font-medium">{t("desktop.notifications.global")}</p>
              <p className="mt-1 text-xs text-white/45">{t("desktop.notifications.globalHelp")}</p>
            </div>
            <Switch
              checked={status.settings.enabled}
              disabled={saving}
              onCheckedChange={(enabled) => change("enabled", enabled)}
              aria-label={t("desktop.notifications.global")}
            />
          </div>
          {(["discord", "whatsapp"] as const).map((app) => (
            <div key={app} className="flex items-center justify-between gap-4 px-1">
              <div>
                <p className="text-sm font-medium">{app === "discord" ? "Discord" : "WhatsApp"}</p>
                <p className="mt-1 text-xs text-white/45">
                  {t(
                    app === "discord"
                      ? "desktop.notifications.discordHelp"
                      : "desktop.notifications.whatsappHelp",
                  )}
                </p>
              </div>
              <Switch
                checked={status.settings[app]}
                disabled={saving}
                onCheckedChange={(enabled) => change(app, enabled)}
                aria-label={app}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="min-w-0 border-white/8 bg-[#141817]">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
            <ShieldCheck className="size-5" />
          </div>
          <CardTitle>{t("desktop.notifications.permission")}</CardTitle>
          <CardDescription>{t(accessDescription[status.access])}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.access !== "allowed" &&
            status.access !== "unpackaged" &&
            status.access !== "unavailable" && (
              <Button onClick={requestAccess} disabled={pending} className="dock-accent-bg">
                {t("desktop.notifications.allow")}
              </Button>
            )}
          <p className="text-xs leading-relaxed text-white/45">
            {t("desktop.notifications.privacy")}
          </p>
          <p className="text-xs leading-relaxed text-white/45">
            {t("desktop.notifications.browserHelp")}
          </p>
          <Button variant="outline" onClick={test} disabled={clients === 0 || testing}>
            {t("desktop.notifications.test")}
          </Button>
          {testResult && (
            <div role="status" className="space-y-1 text-sm text-white/65">
              <p>{t("desktop.notifications.testResult", testResult)}</p>
              {testResult.acknowledged < testResult.connected && (
                <p className="text-xs text-white/45">{t("desktop.notifications.testPartial")}</p>
              )}
            </div>
          )}
          {clients === 0 && (
            <p className="text-xs text-white/45">{t("desktop.notifications.testNeedsPhone")}</p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-300">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
