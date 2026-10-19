import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { Checkbox } from "@base-ui/react/checkbox"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { Select } from "@base-ui/react/select"
import { Switch } from "@base-ui/react/switch"

const fieldClass =
  "h-11 w-full min-w-0 rounded-xl border border-white/15 bg-[#101715] px-3 text-sm text-white outline-none transition-colors placeholder:text-white/35 focus-visible:border-[var(--dock-accent)] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--dock-accent)_25%,transparent)]"

export function AlarmButton({
  variant = "outline",
  className = "",
  ...props
}: ButtonPrimitive.Props & { variant?: "primary" | "outline" | "ghost" | "danger" }) {
  const variants = {
    primary: "border-transparent dock-accent-bg font-semibold hover:brightness-110",
    outline: "border-white/20 bg-white/5 text-white hover:bg-white/10",
    ghost: "border-transparent bg-transparent text-white/70 hover:bg-white/10 hover:text-white",
    danger: "border-transparent bg-transparent text-rose-300 hover:bg-rose-400/10",
  }
  return (
    <ButtonPrimitive
      type="button"
      className={`inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl border px-4 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--dock-accent)] disabled:pointer-events-none disabled:opacity-40 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}

export function AlarmInput({ className = "", ...props }: InputPrimitive.Props) {
  return <InputPrimitive className={`${fieldClass} ${className}`} {...props} />
}

export function AlarmCheckbox({
  checked,
  onCheckedChange,
  disabled,
  id,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  id: string
}) {
  return (
    <Checkbox.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="flex size-5 shrink-0 items-center justify-center rounded-md border border-white/30 bg-[#101715] text-[#090b0b] outline-none transition-colors data-checked:border-[var(--dock-accent)] data-checked:bg-[var(--dock-accent)] focus-visible:ring-2 focus-visible:ring-[var(--dock-accent)] data-disabled:opacity-40"
    >
      <Checkbox.Indicator aria-hidden="true" className="text-sm font-bold leading-none">
        ✓
      </Checkbox.Indicator>
    </Checkbox.Root>
  )
}

export function AlarmSwitch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
}) {
  return (
    <Switch.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-label={label}
      className="relative flex h-7 w-12 shrink-0 items-center rounded-full border border-white/20 bg-white/15 outline-none transition-colors data-checked:border-[var(--dock-accent)] data-checked:bg-[var(--dock-accent)] focus-visible:ring-2 focus-visible:ring-[var(--dock-accent)]"
    >
      <Switch.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow-sm transition-transform data-checked:translate-x-6 data-checked:bg-[#101715]" />
    </Switch.Root>
  )
}

export function AlarmSelect({
  id,
  value,
  options,
  onChange,
}: {
  id: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <Select.Root value={value} onValueChange={(next) => next && onChange(next)}>
      <Select.Trigger
        id={id}
        className={`${fieldClass} flex items-center justify-between gap-3 text-left focus-visible:ring-2`}
      >
        <Select.Value>
          {(selected: string) => options.find((option) => option.value === selected)?.label ?? ""}
        </Select.Value>
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 text-white/55">
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner sideOffset={6} alignItemWithTrigger={false} className="z-[200]">
          <Select.Popup className="max-h-[min(240px,45dvh)] w-[var(--anchor-width)] overflow-y-auto rounded-xl border border-white/15 bg-[#1b211e] p-1 text-sm text-white shadow-2xl outline-none">
            <Select.List>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  label={option.label}
                  className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 outline-none data-highlighted:bg-white/10 data-selected:bg-white/5"
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="dock-accent-text font-semibold">
                    ✓
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
