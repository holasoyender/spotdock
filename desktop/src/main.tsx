import React from "react"
import ReactDOM from "react-dom/client"
import "./index.css"
import App from "./App"
import { resolveLocale, setAppLocale } from "../../shared/i18n"

setAppLocale(resolveLocale(localStorage.getItem("spotdock:locale") ?? navigator.language))

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
