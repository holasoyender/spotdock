import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import App from "./App"
import { isLanguagePreference, resolveLocale, setAppLocale } from "../../shared/i18n"
import { readStored } from "./lib/storage"

const savedLanguage = readStored<unknown>("spotdock:language", "auto")
const desktopLocale = readStored<unknown>("spotdock:desktop-locale", "en-US")
setAppLocale(
  resolveLocale(
    isLanguagePreference(savedLanguage) && savedLanguage !== "auto" ? savedLanguage : desktopLocale,
  ),
)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
