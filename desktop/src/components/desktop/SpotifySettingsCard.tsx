import { Music2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Snapshot, SpotifyAuthStatus } from "../../../../shared/protocol"

export function SpotifySettingsCard({
  status,
  clientId,
  setClientId,
  media,
  connect,
  disconnect,
  dashboard,
}: {
  status: SpotifyAuthStatus
  clientId: string
  setClientId: (value: string) => void
  media: Snapshot["media"]
  connect: () => void
  disconnect: () => void
  dashboard: () => void
}) {
  return (
    <Card className="min-w-0 border-white/8 bg-[#141817] xl:col-span-2">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
          <Music2 className="size-5" />
        </div>
        <CardTitle>Spotify en este ordenador</CardTitle>
        <CardDescription>
          SpotDock usa primero la sesión multimedia de Windows. Si Spotify no aparece allí, puede
          leer y controlar la reproducción mediante la API oficial.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-white/4 p-4 text-sm">
            <p className="font-medium text-white">
              Fuente actual:{" "}
              {media.source === "windows"
                ? "Windows"
                : media.source === "spotify_api"
                  ? "API de Spotify"
                  : "sin reproducción detectada"}
            </p>
            {media.message && (
              <p className="mt-2 break-words text-xs leading-relaxed text-white/50">
                {media.message}
              </p>
            )}
          </div>
          <p className="text-xs leading-relaxed text-white/45">
            En Spotify for Developers, crea una aplicación y registra{" "}
            <code className="text-white/75">http://127.0.0.1/callback</code> como dirección de
            retorno. Copia aquí su Client ID. Spotify exige una cuenta Premium para usar
            aplicaciones en modo desarrollo.
          </p>
          <Button variant="outline" onClick={dashboard}>
            Abrir Spotify for Developers
          </Button>
        </div>
        <div className="space-y-3">
          <Label htmlFor="spotify-client-id">Client ID de Spotify</Label>
          <Input
            id="spotify-client-id"
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            placeholder="32 caracteres"
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={connect}
              disabled={status.pending || clientId.trim().length !== 32}
              className="dock-accent-bg dock-accent-hover"
            >
              {status.pending
                ? "Esperando autorización…"
                : status.connected
                  ? "Cambiar cuenta"
                  : "Conectar Spotify"}
            </Button>
            {status.connected && (
              <Button variant="outline" onClick={disconnect}>
                Desconectar
              </Button>
            )}
          </div>
          <p className="text-xs text-white/45">
            {status.connected
              ? "Cuenta vinculada. SpotDock renovará el acceso automáticamente."
              : status.pending
                ? "Termina la autorización en el navegador."
                : "La conexión con la API es opcional."}
          </p>
          {status.error && (
            <p role="alert" className="text-xs text-rose-300">
              {status.error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
