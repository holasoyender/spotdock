import { Check, Copy, Laptop2, Link2, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { SpotifySettingsCard } from "./SpotifySettingsCard"
import type { Pairing, Snapshot, SpotifyAuthStatus } from "../../../../shared/protocol"

const palette = [
  { name: "Lima", color: "#b8ef64" },
  { name: "Blanco", color: "#ffffff" },
  { name: "Azul", color: "#91c7ff" },
  { name: "Rosa", color: "#ffb8d7" },
  { name: "Ámbar", color: "#ffd18a" },
  { name: "Lila", color: "#c3b3ff" },
]

type Props = {
  accent: string
  chooseAccent: (color: string) => void
  pairing: Pairing | null
  pairingUrl: string | undefined | null
  copied: boolean
  copy: () => void
  host: string
  setHost: (host: string) => void
  spotify: SpotifyAuthStatus
  clientId: string
  setClientId: (clientId: string) => void
  media: Snapshot["media"]
  connectSpotify: () => void
  disconnectSpotify: () => void
  onDashboard: () => void
}

export function SettingsPage({
  accent,
  chooseAccent,
  pairing,
  pairingUrl,
  copied,
  copy,
  host,
  setHost,
  spotify,
  clientId,
  setClientId,
  media,
  connectSpotify,
  disconnectSpotify,
  onDashboard,
}: Props) {
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-2">
      <Card className="min-w-0 border-white/8 bg-[#141817]">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
            <Palette className="size-5" />
          </div>
          <CardTitle>Color de acento</CardTitle>
          <CardDescription>
            El cambio se aplica aquí y en todos los móviles conectados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {palette.map((option) => (
              <Button
                key={option.color}
                variant="outline"
                aria-label={`Color ${option.name}`}
                title={option.name}
                onClick={() => chooseAccent(option.color)}
                className={`h-14 rounded-xl border-white/10 p-1 ${accent.toLowerCase() === option.color ? "ring-2 ring-[var(--dock-accent)]" : ""}`}
              >
                <span
                  className="flex size-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: option.color }}
                >
                  {accent.toLowerCase() === option.color && (
                    <Check className="size-4 text-[#111714]" />
                  )}
                </span>
              </Button>
            ))}
          </div>
          <div className="mt-6 flex items-center gap-4">
            <Label htmlFor="custom-color" className="shrink-0">
              Color propio
            </Label>
            <Input
              id="custom-color"
              type="color"
              value={accent}
              onChange={(event) => chooseAccent(event.target.value)}
              className="h-10 w-24 cursor-pointer p-1"
            />
            <span className="font-mono text-xs text-white/45">{accent.toUpperCase()}</span>
          </div>
        </CardContent>
      </Card>
      <Card className="min-w-0 border-white/8 bg-[#141817]">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
            <Link2 className="size-5" />
          </div>
          <CardTitle>Conexión local</CardTitle>
          <CardDescription>
            El QR contiene la dirección del PC y una clave de emparejamiento guardada.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label htmlFor="address">Dirección de conexión</Label>
            <div className="mt-2 flex min-w-0 gap-2">
              <Input
                id="address"
                readOnly
                value={pairingUrl ?? "Iniciando servidor…"}
                className="min-w-0 font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={copy} aria-label="Copiar dirección">
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="host">IP Wi‑Fi del ordenador (opcional)</Label>
            <Input
              id="host"
              placeholder={pairing ? new URL(pairing.url).hostname : "192.168.1.20"}
              value={host}
              onChange={(event) => setHost(event.target.value.trim())}
              className="mt-2 font-mono text-xs"
            />
            <p className="mt-2 text-xs text-white/40">Cámbiala si se detecta la IP de una VPN.</p>
          </div>
          <Separator />
          <div className="flex gap-3 text-xs text-white/50">
            <Laptop2 className="size-4 shrink-0 dock-accent-text" />
            <p>
              El PC y el móvil deben estar en la misma Wi‑Fi. Permite el acceso de SpotDock en redes
              privadas cuando Windows lo solicite.
            </p>
          </div>
        </CardContent>
      </Card>
      <SpotifySettingsCard
        status={spotify}
        clientId={clientId}
        setClientId={setClientId}
        media={media}
        connect={connectSpotify}
        disconnect={disconnectSpotify}
        dashboard={onDashboard}
      />
    </div>
  )
}
