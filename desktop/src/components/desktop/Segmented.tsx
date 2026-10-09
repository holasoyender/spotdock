import { Button } from "@/components/ui/button"

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          variant={value === option.value ? "default" : "outline"}
          onClick={() => onChange(option.value)}
          className={value === option.value ? "dock-accent-bg" : "border-white/15"}
        >
          {option.label}
        </Button>
      ))}
    </div>
  )
}
