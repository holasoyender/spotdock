import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { t } from "../../../../shared/i18n"
import { accentPalette } from "../../../../shared/accent"

export function MobileAccentSettings({
  accent,
  local,
  paired,
  onChange,
}: {
  accent: string
  local: string | null
  paired: boolean
  onChange: (value: string | null) => void
}) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/3 p-3">
      <summary className="cursor-pointer text-sm font-semibold">
        {t("desktop.settings.accent")}
      </summary>
      <div className="mt-4 space-y-4">
        <p className="text-xs text-white/45">
          {local
            ? t("mobile.settings.localOverride")
            : paired
              ? t("mobile.settings.fromPc")
              : t("mobile.settings.localDefaults")}
        </p>
        <div className="grid grid-cols-6 gap-2">
          {accentPalette.map((option) => (
            <button
              key={option.color}
              type="button"
              aria-label={t("desktop.settings.color", { name: t(option.name) })}
              onClick={() => onChange(option.color)}
              className={`flex aspect-square items-center justify-center rounded-lg border border-white/15 ${accent.toLowerCase() === option.color ? "ring-2 ring-[var(--dock-accent)]" : ""}`}
              style={{ backgroundColor: option.color }}
            >
              {accent.toLowerCase() === option.color && <Check className="size-4 text-[#111714]" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor="mobile-custom-accent">{t("desktop.settings.customColor")}</Label>
          <Input
            id="mobile-custom-accent"
            type="color"
            value={accent}
            onChange={(event) => onChange(event.target.value)}
            className="h-10 w-20 cursor-pointer p-1"
          />
          <span className="font-mono text-xs text-white/45">{accent.toUpperCase()}</span>
        </div>
        {local && (
          <Button
            variant="outline"
            className="w-full border-white/15"
            onClick={() => onChange(null)}
          >
            {paired ? t("mobile.settings.usePc") : t("mobile.settings.resetDefaults")}
          </Button>
        )}
      </div>
    </details>
  )
}
