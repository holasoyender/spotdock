import { Select } from "@base-ui/react/select"
import { Check, ChevronDown, Globe2 } from "lucide-react"
import { languageOptions, t, type LanguagePreference } from "../../../../shared/i18n"
import spanishFlag from "../../../../shared/assets/flags/es.svg"
import unitedStatesFlag from "../../../../shared/assets/flags/us.svg"

type Props = {
  id: string
  value: LanguagePreference
  onChange: (value: LanguagePreference) => void
}

function LanguageIcon({ language }: { language: LanguagePreference }) {
  if (language === "auto")
    return (
      <span className="flex w-7.5 shrink-0 justify-center">
        <Globe2 className="size-4.5" aria-hidden="true" />
      </span>
    )

  return (
    <img
      src={language === "es-ES" ? spanishFlag : unitedStatesFlag}
      alt=""
      aria-hidden="true"
      className="h-4 w-7.5 shrink-0 rounded-[2px] object-cover"
    />
  )
}

export function LanguageSelect({ id, value, onChange }: Props) {
  return (
    <Select.Root value={value} onValueChange={(next) => next && onChange(next)}>
      <Select.Trigger
        id={id}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-white/15 bg-[#101312] px-3 text-left text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      >
        <Select.Value>
          {(selected: LanguagePreference) => {
            const option =
              languageOptions.find((item) => item.value === selected) ?? languageOptions[0]
            return (
              <span className="flex items-center gap-2">
                <LanguageIcon language={option.value} />
                {t(option.label)}
              </span>
            )
          }}
        </Select.Value>
        <ChevronDown className="size-4 shrink-0 text-white/60" aria-hidden="true" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={4} alignItemWithTrigger={false} className="z-100">
          <Select.Popup className="w-[var(--anchor-width)] rounded-lg border border-white/15 bg-[#1b201e] p-1 text-sm text-white shadow-xl">
            <Select.List>
              {languageOptions.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  label={t(option.label)}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 outline-none data-highlighted:bg-white/10"
                >
                  <LanguageIcon language={option.value} />
                  <Select.ItemText className="flex-1">{t(option.label)}</Select.ItemText>
                  <Select.ItemIndicator>
                    <Check className="size-4" aria-hidden="true" />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  )
}
