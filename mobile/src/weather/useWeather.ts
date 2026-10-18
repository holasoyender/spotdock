import { useEffect, useState } from "react"
import type { Location, Weather, WeatherForecast } from "../../../shared/dock"
import { fetchWeather } from "./openMeteo"

export function useWeather(location: Location | null) {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [forecast, setForecast] = useState<WeatherForecast | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const latitude = location?.latitude
  const longitude = location?.longitude

  useEffect(() => {
    if (latitude === undefined || longitude === undefined) {
      setWeather(null)
      setForecast(null)
      setLoading(false)
      setError(false)
      return
    }
    let active = true
    let controller: AbortController | null = null
    let lastFetch = 0
    const refresh = async () => {
      controller?.abort()
      controller = new AbortController()
      const request = controller
      setLoading(true)
      try {
        const next = await fetchWeather(
          { latitude, longitude, name: "", country: "" },
          request.signal,
        )
        if (!active || request.signal.aborted) return
        setWeather(next.weather)
        setForecast(next.forecast)
        setError(false)
        lastFetch = Date.now()
      } catch {
        if (active && !request.signal.aborted) setError(true)
      } finally {
        if (active && !request.signal.aborted) setLoading(false)
      }
    }
    setWeather(null)
    setForecast(null)
    void refresh()
    const interval = setInterval(() => void refresh(), 15 * 60 * 1000)
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetch > 15 * 60 * 1000)
        void refresh()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      active = false
      controller?.abort()
      clearInterval(interval)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [latitude, longitude])

  return { weather, forecast, loading, error }
}
