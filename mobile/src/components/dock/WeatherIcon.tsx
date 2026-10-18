import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react"

export function WeatherIcon({
  code,
  isDay,
  className,
}: {
  code: number
  isDay: boolean
  className?: string
}) {
  const Icon =
    code === 0
      ? isDay
        ? Sun
        : Moon
      : code <= 2
        ? isDay
          ? CloudSun
          : CloudMoon
        : code === 3
          ? Cloud
          : code <= 48
            ? CloudFog
            : code <= 57
              ? CloudDrizzle
              : code <= 67 || (code <= 82 && code >= 80)
                ? CloudRain
                : code <= 86
                  ? CloudSnow
                  : CloudLightning
  return <Icon className={className} strokeWidth={1.4} />
}
