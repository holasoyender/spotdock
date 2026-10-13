import { Check, Copy, Languages, Laptop2, Link2, Palette, Power } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { SpotifySettingsCard } from "./SpotifySettingsCard"
import { LanguageSelect } from "./LanguageSelect"
import type { Pairing, Snapshot, SpotifyAuthStatus } from "../../../../shared/protocol"
import {
  t,
  type LanguagePreference,
  type Locale,
  type TranslationKey,
} from "../../../../shared/i18n"

const palette = [
  { name: "desktop.color.lime", color: "#b8ef64" },
  { name: "desktop.color.white", color: "#ffffff" },
  { name: "desktop.color.blue", color: "#91c7ff" },
  { name: "desktop.color.pink", color: "#ffb8d7" },
  { name: "desktop.color.amber", color: "#ffd18a" },
  { name: "desktop.color.purple", color: "#c3b3ff" },
] satisfies { name: TranslationKey; color: string }[]

type Props = {
  accent: string
  chooseAccent: (color: string) => void
  pairing: Pairing | null
  pairingUrl: string | undefined | null
  copied: boolean
  copy: () => void
  host: string
  setHost: (host: string) => void
  spotify: SpotifyAuthStatus
  clientId: string
  setClientId: (clientId: string) => void
  media: Snapshot["media"]
  connectSpotify: () => void
  disconnectSpotify: () => void
  onDashboard: () => void
  autostart: boolean
  autostartPending: boolean
  onAutostartChange: (enabled: boolean) => void
  language: LanguagePreference
  locale: Locale
  onLanguageChange: (language: LanguagePreference) => void
}

export function SettingsPage({
  accent,
  chooseAccent,
  pairing,
  pairingUrl,
  copied,
  copy,
  host,
  setHost,
  spotify,
  clientId,
  setClientId,
  media,
  connectSpotify,
  disconnectSpotify,
  onDashboard,
  autostart,
  autostartPending,
  onAutostartChange,
  language,
  locale,
  onLanguageChange,
}: Props) {
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <Card className="min-w-0 border-white/8 bg-[#141817]">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
            <Palette className="size-5" />
          </div>
          <CardTitle>{t("desktop.settings.accent")}</CardTitle>
          <CardDescription>{t("desktop.settings.accentHelp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {palette.map((option) => (
              <Button
                key={option.color}
                variant="outline"
                aria-label={t("desktop.settings.color", { name: t(option.name) })}
                title={t(option.name)}
                onClick={() => chooseAccent(option.color)}
                className={`h-14 rounded-xl border-white/10 p-1 ${accent.toLowerCase() === option.color ? "ring-2 ring-[var(--dock-accent)]" : ""}`}
              >
                <span
                  className="flex size-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: option.color }}
                >
                  {accent.toLowerCase() === option.color && (
                    <Check className="size-4 text-[#111714]" />
                  )}
                </span>
              </Button>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-4">
            <Label htmlFor="custom-color" className="shrink-0">
              {t("desktop.settings.customColor")}
            </Label>
            <Input
              id="custom-color"
              type="color"
              value={accent}
              onChange={(event) => chooseAccent(event.target.value)}
              className="h-10 w-24 cursor-pointer p-1"
            />
            <span className="font-mono text-xs text-white/45">{accent.toUpperCase()}</span>
          </div>
        </CardContent>
      </Card>
      <Card className="min-w-0 border-white/8 bg-[#141817]">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
            <Link2 className="size-5" />
          </div>
          <CardTitle>{t("desktop.settings.localConnection")}</CardTitle>
          <CardDescription>{t("desktop.settings.localHelp")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="address">{t("desktop.settings.address")}</Label>
            <div className="mt-2 flex min-w-0 gap-2">
              <Input
                id="address"
                readOnly
                value={pairingUrl ?? t("desktop.settings.starting")}
                className="min-w-0 font-mono text-xs"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copy}
                aria-label={t("desktop.settings.copy")}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="host">{t("desktop.settings.wifiIp")}</Label>
            <Input
              id="host"
              placeholder={pairing ? new URL(pairing.url).hostname : "192.168.1.20"}
              value={host}
              onChange={(event) => setHost(event.target.value.trim())}
              className="mt-2 font-mono text-xs"
            />
            <p className="mt-2 text-xs text-white/40">{t("desktop.settings.vpnHelp")}</p>
          </div>
          <Separator />
          <div className="flex gap-3 text-xs text-white/50">
            <Laptop2 className="size-4 shrink-0 dock-accent-text" />
            <p>{t("desktop.settings.networkHelp")}</p>
          </div>
        </CardContent>
      </Card>
      <Card className="min-w-0 border-white/8 bg-[#141817]">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
            <Power className="size-5" />
          </div>
          <CardTitle>{t("desktop.settings.background")}</CardTitle>
          <CardDescription>{t("desktop.settings.backgroundHelp")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="autostart">{t("desktop.settings.autostart")}</Label>
              <p className="text-xs text-white/45">{t("desktop.settings.autostartHelp")}</p>
            </div>
            <Switch
              id="autostart"
              checked={autostart}
              disabled={autostartPending}
              onCheckedChange={onAutostartChange}
              aria-label={t("desktop.settings.autostartAria")}
            />
          </div>
        </CardContent>
      </Card>
      <Card className="min-w-0 border-white/8 bg-[#141817]">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
            <Languages className="size-5" />
          </div>
          <CardTitle>{t("common.language")}</CardTitle>
          <CardDescription>{t("desktop.settings.languageHelp")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="desktop-language">{t("common.languageChoice")}</Label>
          <LanguageSelect id="desktop-language" value={language} onChange={onLanguageChange} />
          <p className="text-xs text-white/45">
            {t("common.currentLanguage", {
              language: t(locale === "es-ES" ? "common.spanish" : "common.english"),
            })}
          </p>
        </CardContent>
      </Card>
      <SpotifySettingsCard
        status={spotify}
        clientId={clientId}
        setClientId={setClientId}
        media={media}
        connect={connectSpotify}
        disconnect={disconnectSpotify}
        dashboard={onDashboard}
      />
    </div>
  )
}
