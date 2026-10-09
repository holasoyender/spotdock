import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { CloudSun, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Segmented } from "./components/desktop/Segmented"
import {
  type DockConfig,
  type Location,
  type Weather,
  weatherTemperature,
  weatherText,
} from "../../shared/dock"

type ChangeConfig = (config: DockConfig) => Promise<void>

function ClockPreview({ config, weather }: { config: DockConfig; weather: Weather | null }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  const time = now.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
    second: config.showSeconds ? "2-digit" : undefined,
    hour12: config.hourFormat === "12",
  })
  const date = now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
  const hour = ((now.getHours() % 12) + now.getMinutes() / 60) * 30
  const minute = (now.getMinutes() + now.getSeconds() / 60) * 6
  const second = now.getSeconds() * 6
  return (
    <div className="relative flex min-h-64 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-[#0a0d0c] p-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_70%,var(--dock-accent),transparent_58%)] opacity-[0.07]" />
      {config.clockStyle === "analog" ? (
        <div className="relative size-40 rounded-full border-2 border-white/20 bg-white/3 shadow-2xl">
          <span className="absolute inset-3 rounded-full border border-dashed border-white/10" />
          <span
            className="absolute left-1/2 top-1/2 h-12 w-1 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-white"
            style={{ rotate: `${hour}deg` }}
          />
          <span
            className="absolute left-1/2 top-1/2 h-16 w-0.5 origin-bottom -translate-x-1/2 -translate-y-full rounded-full bg-white"
            style={{ rotate: `${minute}deg` }}
          />
          {config.showSeconds && (
            <span
              className="absolute left-1/2 top-1/2 h-[72px] w-px origin-bottom -translate-x-1/2 -translate-y-full dock-accent-bg"
              style={{ rotate: `${second}deg` }}
            />
          )}
          <span className="absolute left-1/2 top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full dock-accent-bg" />
        </div>
      ) : (
        <div
          className={`relative tabular-nums tracking-tight ${config.showSeconds || config.hourFormat === "12" ? (config.digitalStyle === "bold" ? "text-4xl font-semibold" : "text-4xl font-light tracking-wider") : config.digitalStyle === "bold" ? "text-6xl font-semibold" : "text-6xl font-light tracking-widest"}`}
        >
          {time}
        </div>
      )}
      {config.showDate && <p className="relative mt-5 text-sm capitalize text-white/55">{date}</p>}
      {config.showWeather && (
        <p className="relative mt-3 flex items-center gap-2 text-sm dock-accent-text">
          <CloudSun className="size-4" />
          {weather
            ? `${weatherTemperature(weather.temperatureC, config.weatherUnit)} · ${weatherText(weather.code, weather.isDay)}`
            : "Cargando el tiempo…"}
        </p>
      )}
    </div>
  )
}

export function ClockSettings({
  config,
  weather,
  onChange,
}: {
  config: DockConfig
  weather: Weather | null
  onChange: ChangeConfig
}) {
  const [query, setQuery] = useState("")
  const [locations, setLocations] = useState<Location[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState("")
  const patch = (changes: Partial<DockConfig>) => {
    void onChange({ ...config, ...changes }).catch(() => {})
  }
  async function search() {
    if (query.trim().length < 2) {
      setError("Escribe al menos dos letras.")
      return
    }
    setSearching(true)
    setError("")
    try {
      const found = await invoke<Location[]>("search_locations", { query })
      setLocations(found)
      if (!found.length) setError("No hay resultados para esa búsqueda.")
    } catch (cause) {
      setError(`No se pudo buscar: ${String(cause)}`)
    } finally {
      setSearching(false)
    }
  }
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-5">
        <Card className="border-white/8 bg-[#141817]">
          <CardHeader>
            <CardTitle>Reloj del dock</CardTitle>
            <CardDescription>
              La vista habitual del móvil cuando no estás usando otra función.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Estilo de reloj</Label>
              <Segmented
                value={config.clockStyle}
                options={[
                  { value: "digital", label: "Digital" },
                  { value: "analog", label: "Analógico" },
                ]}
                onChange={(clockStyle) => patch({ clockStyle })}
              />
            </div>
            {config.clockStyle === "digital" && (
              <div className="space-y-2">
                <Label>Diseño digital</Label>
                <Segmented
                  value={config.digitalStyle}
                  options={[
                    { value: "bold", label: "Grande" },
                    { value: "minimal", label: "Ligero" },
                  ]}
                  onChange={(digitalStyle) => patch({ digitalStyle })}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Formato de hora</Label>
              <Segmented
                value={config.hourFormat}
                options={[
                  { value: "24", label: "24 horas" },
                  { value: "12", label: "12 horas" },
                ]}
                onChange={(hourFormat) => patch({ hourFormat })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="clock-seconds">Mostrar segundos</Label>
              <Switch
                id="clock-seconds"
                checked={config.showSeconds}
                onCheckedChange={(showSeconds) => patch({ showSeconds })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="clock-date">Mostrar fecha</Label>
              <Switch
                id="clock-date"
                checked={config.showDate}
                onCheckedChange={(showDate) => patch({ showDate })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="clock-auto">Abrir reproductor al empezar música</Label>
              <Switch
                id="clock-auto"
                checked={config.autoPlayer}
                onCheckedChange={(autoPlayer) => patch({ autoPlayer })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="return-seconds">Volver al reloj tras la pausa · segundos</Label>
              <Input
                id="return-seconds"
                type="number"
                min={5}
                max={300}
                value={config.returnAfterSeconds}
                onChange={(event) => {
                  const value = Number(event.target.value)
                  if (value >= 5 && value <= 300) patch({ returnAfterSeconds: value })
                }}
                className="max-w-36"
              />
            </div>
          </CardContent>
        </Card>
        <Card className="border-white/8 bg-[#141817]">
          <CardHeader>
            <CardTitle>Tiempo actual</CardTitle>
            <CardDescription>
              La información se actualiza en el PC y se envía al móvil por la red local.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex items-center justify-between">
              <Label htmlFor="show-weather">Mostrar el tiempo</Label>
              <Switch
                id="show-weather"
                checked={config.showWeather}
                onCheckedChange={(showWeather) => patch({ showWeather })}
              />
            </div>
            <div className="space-y-2">
              <Label>Unidad de temperatura</Label>
              <Segmented
                value={config.weatherUnit}
                options={[
                  { value: "C", label: "°C" },
                  { value: "F", label: "°F" },
                ]}
                onChange={(weatherUnit) => patch({ weatherUnit })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city-search">Ciudad</Label>
              <div className="flex gap-2">
                <Input
                  id="city-search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") search()
                  }}
                  placeholder="Busca una ciudad"
                />
                <Button
                  variant="outline"
                  onClick={search}
                  disabled={searching}
                  aria-label="Buscar ciudad"
                >
                  <Search className="size-4" />
                </Button>
              </div>
              <p className="text-xs text-white/40">
                Actual:{" "}
                {config.weatherLocation
                  ? `${config.weatherLocation.name}, ${config.weatherLocation.country}`
                  : "sin ciudad"}
              </p>
              {error && (
                <p role="alert" className="text-xs text-rose-300">
                  {error}
                </p>
              )}
              {locations.length > 0 && (
                <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-white/10 p-2">
                  {locations.map((location) => (
                    <Button
                      key={`${location.latitude}-${location.longitude}`}
                      variant="ghost"
                      className="h-auto w-full justify-start text-left"
                      onClick={() => {
                        patch({ weatherLocation: location })
                        setLocations([])
                        setQuery("")
                      }}
                    >
                      {location.name}
                      {location.admin1 ? ` · ${location.admin1}` : ""}, {location.country}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-white/35">
              Datos meteorológicos: Open-Meteo. La edición gratuita está destinada a uso no
              comercial.
            </p>
          </CardContent>
        </Card>
      </div>
      <div className="min-w-0 space-y-4">
        <ClockPreview config={config} weather={weather} />
        <p className="px-2 text-xs leading-relaxed text-white/40">
          Así aparecerá la vista de reposo en el móvil. Toca el reloj para abrir el reproductor.
        </p>
      </div>
    </div>
  )
}
