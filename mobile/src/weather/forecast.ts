import type { WeatherForecast } from "../../../shared/dock"

/** Open-Meteo timestamps are local to the forecast location, without a UTC suffix. */
export function forecastLocalNow(timezone: string, now: Date): { date: string; hour: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now)
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? ""
    return {
      date: `${value("year")}-${value("month")}-${value("day")}`,
      hour: Number(value("hour")),
    }
  } catch {
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    return { date: `${year}-${month}-${day}`, hour: now.getHours() }
  }
}

export function forecastForToday(forecast: WeatherForecast, now: Date) {
  const local = forecastLocalNow(forecast.timezone, now)
  return {
    local,
    hourly: forecast.hourly.filter(
      (hour) =>
        hour.time.startsWith(`${local.date}T`) && Number(hour.time.slice(11, 13)) >= local.hour,
    ),
    daily: forecast.daily.filter((day) => day.date >= local.date).slice(0, 7),
  }
}
