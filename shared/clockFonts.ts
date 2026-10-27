import { useEffect, useState } from "react"
import type { DockConfig } from "./dock"

export const clockFonts = [
  { id: "inter", name: "Inter", family: "'Inter Variable', sans-serif" },
  { id: "space-grotesk", name: "Space Grotesk", family: "'Space Grotesk Variable', sans-serif" },
  { id: "outfit", name: "Outfit", family: "'Outfit Variable', sans-serif" },
  { id: "jetbrains-mono", name: "JetBrains Mono", family: "'JetBrains Mono Variable', monospace" },
] as const

const customFamily = "'SpotDock Custom Clock', sans-serif"
export const maxClockFontBytes = 256_000

/** The imported face is only registered while a clock uses it. */
export function useClockFont(config: DockConfig): string {
  const data = config.clockFont === "custom" ? config.customClockFont?.data : undefined
  const [loadedData, setLoadedData] = useState<string | null>(null)

  useEffect(() => {
    if (!data || !/^data:font\/(?:woff2|woff|ttf|otf);base64,/.test(data)) return
    const face = new FontFace("SpotDock Custom Clock", `url("${data}")`)
    let active = true
    void face.load().then(
      () => {
        if (!active) return
        document.fonts.add(face)
        setLoadedData(data)
      },
      () => setLoadedData(null),
    )
    return () => {
      active = false
      document.fonts.delete(face)
    }
  }, [data])

  if (config.clockFont === "custom")
    return loadedData === data ? customFamily : clockFonts[0].family
  return clockFonts.find((font) => font.id === config.clockFont)?.family ?? clockFonts[0].family
}

/** Accept only a real WOFF2, WOFF, TrueType or OpenType file. */
export async function readClockFontFile(
  file: File,
): Promise<NonNullable<DockConfig["customClockFont"]>> {
  if (!file.size || file.size > maxClockFontBytes) throw new Error("size")
  const bytes = new Uint8Array(await file.arrayBuffer())
  const signature = String.fromCharCode(...bytes.slice(0, 4))
  const mime =
    signature === "wOF2"
      ? "woff2"
      : signature === "wOFF"
        ? "woff"
        : signature === "OTTO"
          ? "otf"
          : bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0
            ? "ttf"
            : null
  if (!mime) throw new Error("format")
  let binary = ""
  for (let index = 0; index < bytes.length; index += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32_768))
  }
  return {
    name: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "Custom font",
    data: `data:font/${mime};base64,${btoa(binary)}`,
  }
}
