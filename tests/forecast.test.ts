import { describe, expect, test } from "bun:test"
import { forecastForToday, forecastLocalNow } from "../mobile/src/weather/forecast"
import type { WeatherForecast } from "../shared/dock"

describe("forecast selection", () => {
  test("uses the forecast city's date and shows the remaining hours", () => {
    const now = new Date("2026-10-18T16:30:00Z")
    const forecast: WeatherForecast = {
      timezone: "Asia/Tokyo",
      hourly: [
        {
          time: "2026-10-19T00:00",
          temperatureC: 17,
          code: 0,
          isDay: false,
          precipitationProbability: 0,
        },
        {
          time: "2026-10-19T01:00",
          temperatureC: 16,
          code: 0,
          isDay: false,
          precipitationProbability: 0,
        },
        {
          time: "2026-10-19T02:00",
          temperatureC: 16,
          code: 1,
          isDay: false,
          precipitationProbability: 10,
        },
      ],
      daily: [
        { date: "2026-10-18", minC: 12, maxC: 22, code: 0, precipitationProbability: 0 },
        { date: "2026-10-19", minC: 11, maxC: 20, code: 1, precipitationProbability: 10 },
      ],
    }
    const selected = forecastForToday(forecast, now)
    expect(selected.local).toEqual({ date: "2026-10-19", hour: 1 })
    expect(selected.hourly.map((hour) => hour.time)).toEqual([
      "2026-10-19T01:00",
      "2026-10-19T02:00",
    ])
    expect(selected.daily.map((day) => day.date)).toEqual(["2026-10-19"])
  })

  test("invalid timezone falls back to the device clock", () => {
    const now = new Date(2026, 9, 18, 9)
    expect(forecastLocalNow("bad/timezone", now)).toEqual({ date: "2026-10-18", hour: 9 })
  })

  test("midnight starts the new forecast day at hour zero", () => {
    expect(forecastLocalNow("UTC", new Date("2026-10-19T00:30:00Z"))).toEqual({
      date: "2026-10-19",
      hour: 0,
    })
  })
})
