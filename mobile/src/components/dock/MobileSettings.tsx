import { QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

import type { Preferences } from "@/preferences.ts"
import { t, type LanguagePreference, type Locale } from "../../../../shared/i18n"
import { LanguageSelect } from "./LanguageSelect"

type Props = {
  settings: boolean
  setSettings: (open: boolean) => void
  manual: string
  setManual: (value: string) => void
  saveAddress: (value: string) => void
  scanCode: () => void
  error: string
  preferences: Preferences
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void
  forget: () => void
  language: LanguagePreference
  desktopLocale: Locale
  onLanguageChange: (language: LanguagePreference) => void
}

export function MobileSettings({
  settings,
  setSettings,
  manual,
  setManual,
  saveAddress,
  scanCode,
  error,
  preferences,
  setPreference,
  forget,
  language,
  desktopLocale,
  onLanguageChange,
}: Props) {
  return (
    <Sheet open={settings} onOpenChange={setSettings}>
      <SheetContent className="w-95 max-w-[90vw] overflow-y-auto border-white/10 bg-[#141817] text-white">
        <SheetHeader>
          <SheetTitle>{t("mobile.settings.title")}</SheetTitle>
          <SheetDescription>{t("mobile.settings.description")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-6 pb-8">
          <div className="space-y-2">
            <Label htmlFor="manual-url">{t("mobile.settings.manual")}</Label>
            <Input
              id="manual-url"
              placeholder="ws://192.168.1.x:47917/ws?token=…"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              className="text-xs"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 dock-accent-bg dock-accent-hover"
                onClick={() => saveAddress(manual)}
              >
                {t("mobile.settings.connect")}
              </Button>
              <Button variant="outline" onClick={scanCode} aria-label={t("common.scanQr")}>
                <QrCode className="size-4" />
              </Button>
            </div>
            {error && (
              <p className="text-xs text-rose-300" role="alert">
                {error}
              </p>
            )}
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="awake">{t("mobile.settings.keepAwake")}</Label>
            <Switch
              id="awake"
              checked={preferences.awake}
              onCheckedChange={(value) => setPreference("awake", value)}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="compact">{t("mobile.settings.compact")}</Label>
            <Switch
              id="compact"
              checked={preferences.compact}
              onCheckedChange={(value) => setPreference("compact", value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile-language">{t("common.language")}</Label>
            <LanguageSelect id="mobile-language" value={language} onChange={onLanguageChange} />
            <p className="text-xs text-white/45">
              {t("mobile.settings.autoHelp", {
                language: t(desktopLocale === "es-ES" ? "common.spanish" : "common.english"),
              })}
            </p>
          </div>
          <div className="space-y-3">
            <Label>{t("mobile.settings.brightness", { value: preferences.brightness })}</Label>
            <Slider
              min={35}
              max={100}
              value={[preferences.brightness]}
              onValueChange={(value) =>
                setPreference("brightness", typeof value === "number" ? value : value[0])
              }
              className="dock-slider"
            />
          </div>
          <Button variant="outline" className="w-full border-white/15" onClick={forget}>
            {t("mobile.settings.forget")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
