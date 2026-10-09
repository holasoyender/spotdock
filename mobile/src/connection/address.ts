/** Only accept the local SpotDock endpoint and a complete pairing token. */
export function validAddress(input: string) {
  try {
    const url = new URL(input.trim())
    const parts = url.hostname.split(".").map(Number)
    const privateIp =
      parts.length === 4 &&
      parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) &&
      (parts[0] === 10 ||
        (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
        (parts[0] === 192 && parts[1] === 168) ||
        url.hostname === "127.0.0.1")
    return (
      url.protocol === "ws:" &&
      privateIp &&
      url.port === "47917" &&
      url.pathname === "/ws" &&
      /^[a-f0-9]{32}$/.test(url.searchParams.get("token") ?? "")
    )
  } catch {
    return false
  }
}
