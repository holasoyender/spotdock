import { QrCode, RefreshCw } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { t } from "../../../../shared/i18n"

export function PairingCard({ url, rotate }: { url?: string; rotate: () => void }) {
  return (
    <Card className="min-w-0 border-white/8 bg-[#141817]">
      <CardHeader className="pb-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex size-10 items-center justify-center rounded-xl dock-accent-soft dock-accent-text">
            <QrCode className="size-5" />
          </div>
          <Badge variant="outline" className="border-white/15 text-white/45">
            01 / 02
          </Badge>
        </div>
        <CardTitle className="text-xl">{t("desktop.pair.title")}</CardTitle>
        <CardDescription>{t("desktop.pair.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mx-auto flex size-44 items-center justify-center rounded-xl bg-white p-2">
          {url ? (
            <QRCodeSVG value={url} size={160} level="M" />
          ) : (
            <RefreshCw className="animate-spin text-black" />
          )}
        </div>
        <Button variant="outline" className="mt-5 w-full gap-2" onClick={rotate}>
          <RefreshCw className="size-4" /> {t("desktop.pair.rotate")}
        </Button>
        <p className="mt-2 text-center text-xs text-white/35">{t("desktop.pair.rotateHelp")}</p>
      </CardContent>
    </Card>
  )
}
