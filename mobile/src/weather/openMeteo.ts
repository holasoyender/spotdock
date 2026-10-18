import type {
  DailyForecast,
  HourlyForecast,
  Location,
  Weather,
  WeatherForecast,
} from "../../../shared/dock"

type Series = Record<string, unknown>

function array(series: Series, key: string): unknown[] {
  return Array.isArray(series[key]) ? series[key] : []
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}

function object(value: unknown): Series {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Series) : {}
}

/** Open-Meteo returns parallel arrays; drop incomplete entries without shifting their indexes. */
export function parseWeatherResponse(value: unknown): {
  weather: Weather
  forecast: WeatherForecast
} {
  const response = object(value)
  const current = object(response.current)
  const hourly = object(response.hourly)
  const daily = object(response.daily)
  const temperatureC = number(current.temperature_2m)
  const code = number(current.weather_code)
  if (temperatureC === null || code === null) throw new Error("Missing current weather")

  const hours: HourlyForecast[] = array(hourly, "time").flatMap((rawTime, index) => {
    const time = string(rawTime)
    const temperatureC = number(array(hourly, "temperature_2m")[index])
    const code = number(array(hourly, "weather_code")[index])
    if (!time || temperatureC === null || code === null) return []
    return [
      {
        time,
        temperatureC,
        code,
        isDay: array(hourly, "is_day")[index] === 1,
        precipitationProbability: number(array(hourly, "precipitation_probability")[index]),
        apparentC: number(array(hourly, "apparent_temperature")[index]),
        windKmh: number(array(hourly, "wind_speed_10m")[index]),
      },
    ]
  })
  const days: DailyForecast[] = array(daily, "time").flatMap((rawDate, index) => {
    const date = string(rawDate)
    const minC = number(array(daily, "temperature_2m_min")[index])
    const maxC = number(array(daily, "temperature_2m_max")[index])
    const code = number(array(daily, "weather_code")[index])
    if (!date || minC === null || maxC === null || code === null) return []
    return [
      {
        date,
        minC,
        maxC,
        code,
        precipitationProbability: number(array(daily, "precipitation_probability_max")[index]),
        sunrise: string(array(daily, "sunrise")[index]),
        sunset: string(array(daily, "sunset")[index]),
        windKmh: number(array(daily, "wind_speed_10m_max")[index]),
      },
    ]
  })
  return {
    weather: {
      temperatureC,
      apparentC: number(current.apparent_temperature) ?? temperatureC,
      code,
      isDay: current.is_day === 1,
      updatedAt: string(current.time) ?? "",
    },
    forecast: { timezone: string(response.timezone) ?? "UTC", hourly: hours, daily: days },
  }
}

export async function fetchWeather(location: Location, signal: AbortSignal) {
  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", String(location.latitude))
  url.searchParams.set("longitude", String(location.longitude))
  url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,is_day")
  url.searchParams.set(
    "hourly",
    "temperature_2m,apparent_temperature,weather_code,is_day,precipitation_probability,wind_speed_10m",
  )
  url.searchParams.set(
    "daily",
    "temperature_2m_min,temperature_2m_max,weather_code,precipitation_probability_max,sunrise,sunset,wind_speed_10m_max",
  )
  url.searchParams.set("forecast_days", "8")
  url.searchParams.set("timezone", "auto")
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`)
  return parseWeatherResponse(await response.json())
}

export async function searchWeatherLocations(
  query: string,
  language: string,
  signal: AbortSignal,
): Promise<Location[]> {
  if (query.trim().length < 2) return []
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search")
  url.searchParams.set("name", query.trim())
  url.searchParams.set("count", "6")
  url.searchParams.set("language", language)
  url.searchParams.set("format", "json")
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`)
  const data = object(await response.json())
  return array(data, "results").flatMap((entry) => {
    const result = object(entry)
    const name = string(result.name)
    const country = string(result.country)
    const latitude = number(result.latitude)
    const longitude = number(result.longitude)
    if (!name || !country || latitude === null || longitude === null) return []
    return [{ name, country, admin1: string(result.admin1), latitude, longitude }]
  })
}
