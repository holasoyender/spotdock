import { describe, expect, test } from "bun:test"
import { parseWeatherResponse } from "../mobile/src/weather/openMeteo"

describe("mobile weather response", () => {
  test("maps hourly and daily details by index and skips incomplete entries", () => {
    const report = parseWeatherResponse({
      timezone: "Europe/Madrid",
      current: {
        temperature_2m: 20,
        apparent_temperature: 19,
        weather_code: 2,
        is_day: 1,
        time: "2026-10-18T12:00",
      },
      hourly: {
        time: ["2026-10-18T12:00", "2026-10-18T13:00", "2026-10-18T14:00"],
        temperature_2m: [20, null, 22],
        apparent_temperature: [19, null, 21],
        weather_code: [2, 2, 3],
        is_day: [1, 1, 1],
        precipitation_probability: [10, 20, 30],
        wind_speed_10m: [8, 9, 10],
      },
      daily: {
        time: ["2026-10-18"],
        temperature_2m_min: [12],
        temperature_2m_max: [24],
        weather_code: [2],
        precipitation_probability_max: [30],
        sunrise: ["2026-10-18T08:12"],
        sunset: ["2026-10-18T19:32"],
        wind_speed_10m_max: [20],
      },
    })
    expect(report.weather.temperatureC).toBe(20)
    expect(report.forecast.hourly).toHaveLength(2)
    expect(report.forecast.hourly[1]).toMatchObject({
      time: "2026-10-18T14:00",
      apparentC: 21,
      windKmh: 10,
    })
    expect(report.forecast.daily[0]).toMatchObject({
      sunrise: "2026-10-18T08:12",
      sunset: "2026-10-18T19:32",
      windKmh: 20,
    })
  })

  test("rejects a response without current weather", () => {
    expect(() => parseWeatherResponse({ current: {} })).toThrow("Missing current weather")
  })
})
