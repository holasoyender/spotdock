import { Bell } from "lucide-react"
import { t } from "../../../../shared/i18n"
import type { NotificationEvent } from "../../../../shared/protocol"

const appNames = {
  discord: "Discord",
  whatsapp: "WhatsApp",
  spotdock: "SpotDock",
} as const

export function NotificationBanner({ notification }: { notification: NotificationEvent }) {
  const name = appNames[notification.app] ?? notification.app
  const image = notification.image?.startsWith("data:image/") ? notification.image : null

  return (
    <div
      className="dock-notification pointer-events-none absolute inset-x-3 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto max-w-lg rounded-2xl border border-white/15 bg-[#1a211f]/95 px-4 py-3 text-white shadow-2xl shadow-black/50 backdrop-blur-xl sm:inset-x-8"
      role="status"
      aria-label={`${t("mobile.notification.announcement", { app: name })}: ${notification.sender}. ${notification.body}`}
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/65">
        <Bell className="size-3.5 dock-accent-text" /> {name}
      </div>
      <div className="flex items-start gap-3">
        {image ? (
          <img src={image} alt="" className="size-11 shrink-0 rounded-full object-cover" />
        ) : (
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-semibold dock-accent-text"
            aria-hidden="true"
          >
            {name.slice(0, 1)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{notification.sender}</p>
          <p className="line-clamp-3 whitespace-pre-line break-words text-sm text-white/75">
            {notification.body}
          </p>
        </div>
      </div>
    </div>
  )
}
