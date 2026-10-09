use crate::{Control, media};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    time::Duration,
};
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Location {
    pub name: String,
    pub country: String,
    #[serde(default)]
    pub admin1: Option<String>,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeckButton {
    pub id: String,
    pub label: String,
    pub icon: String,
    pub image: Option<String>,
    pub color: String,
    pub action_kind: String,
    pub action_value: String,
}

impl DeckButton {
    fn new(label: &str, icon: &str, action_kind: &str, action_value: &str) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            label: label.into(),
            icon: icon.into(),
            image: None,
            color: "#1c2420".into(),
            action_kind: action_kind.into(),
            action_value: action_value.into(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DockConfig {
    pub clock_style: String,
    pub digital_style: String,
    pub hour_format: String,
    pub show_seconds: bool,
    pub show_date: bool,
    pub show_weather: bool,
    pub weather_unit: String,
    pub weather_location: Option<Location>,
    pub auto_player: bool,
    pub return_after_seconds: u32,
    pub buttons: Vec<DeckButton>,
}

impl Default for DockConfig {
    fn default() -> Self {
        Self {
            clock_style: "digital".into(),
            digital_style: "bold".into(),
            hour_format: "24".into(),
            show_seconds: false,
            show_date: true,
            show_weather: true,
            weather_unit: "C".into(),
            weather_location: Some(Location {
                name: "Madrid".into(),
                country: "España".into(),
                admin1: Some("Comunidad de Madrid".into()),
                latitude: 40.4168,
                longitude: -3.7038,
            }),
            auto_player: true,
            return_after_seconds: 30,
            buttons: vec![
                DeckButton::new("Reproducir", "play", "media", "play_pause"),
                DeckButton::new("Siguiente", "next", "media", "next"),
                DeckButton::new("Anterior", "previous", "media", "previous"),
                DeckButton::new("Reproductor", "music", "view", "player"),
                DeckButton::new("Reloj", "clock", "view", "clock"),
                DeckButton::new("Spotify Web", "globe", "url", "https://open.spotify.com"),
            ],
        }
    }
}

impl DockConfig {
    pub fn validate(&self) -> Result<(), String> {
        if !["digital", "analog"].contains(&self.clock_style.as_str())
            || !["bold", "minimal"].contains(&self.digital_style.as_str())
            || !["12", "24"].contains(&self.hour_format.as_str())
            || !["C", "F"].contains(&self.weather_unit.as_str())
            || !(5..=300).contains(&self.return_after_seconds)
        {
            return Err("Configuración del reloj no válida".into());
        }
        if let Some(location) = &self.weather_location {
            if location.name.trim().is_empty()
                || location.name.len() > 100
                || !location.latitude.is_finite()
                || !location.longitude.is_finite()
                || location.latitude.abs() > 90.0
                || location.longitude.abs() > 180.0
            {
                return Err("Ubicación no válida".into());
            }
        }
        if self.buttons.len() > 24 {
            return Err("La botonera admite hasta 24 botones".into());
        }
        let mut ids = HashSet::new();
        for button in &self.buttons {
            if Uuid::parse_str(&button.id).is_err()
                || !ids.insert(&button.id)
                || button.label.trim().is_empty()
                || button.label.chars().count() > 32
                || ![
                    "play", "next", "previous", "music", "clock", "globe", "terminal", "folder",
                    "mail", "keyboard", "rocket", "power", "sun", "heart", "star", "settings",
                ]
                .contains(&button.icon.as_str())
                || !is_hex(&button.color)
                || button.action_value.len() > 500
            {
                return Err("Un botón tiene datos no válidos".into());
            }
            if let Some(image) = &button.image {
                if image.len() > 120_000
                    || ![
                        "data:image/png;base64,",
                        "data:image/jpeg;base64,",
                        "data:image/webp;base64,",
                    ]
                    .iter()
                    .any(|prefix| image.starts_with(prefix))
                {
                    return Err(
                        "La imagen de un botón debe ser PNG, JPEG o WebP y ocupar menos de 90 KB"
                            .into(),
                    );
                }
            }
            match button.action_kind.as_str() {
                "url" => validate_url(&button.action_value)?,
                "app" => {
                    if button.action_value.trim().is_empty() {
                        return Err("Indica la ruta de la aplicación".into());
                    }
                }
                "shortcut" => {
                    parse_shortcut(&button.action_value)?;
                }
                "media"
                    if ["play_pause", "next", "previous"]
                        .contains(&button.action_value.as_str()) => {}
                "view" if ["clock", "player", "deck"].contains(&button.action_value.as_str()) => {}
                _ => return Err("Acción de botón no válida".into()),
            }
        }
        Ok(())
    }
}

fn is_hex(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value[1..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn validate_url(value: &str) -> Result<(), String> {
    let url = reqwest::Url::parse(value).map_err(|_| "URL no válida")?;
    if !["http", "https"].contains(&url.scheme()) || url.host_str().is_none() {
        return Err("La URL debe empezar por http:// o https://".into());
    }
    Ok(())
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Weather {
    pub temperature_c: f64,
    pub apparent_c: f64,
    pub code: i32,
    pub is_day: bool,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedState {
    pub accent: String,
    pub config: DockConfig,
}

impl Default for SavedState {
    fn default() -> Self {
        Self {
            accent: "#b8ef64".into(),
            config: DockConfig::default(),
        }
    }
}

pub fn config_path(dir: &Path) -> PathBuf {
    dir.join("spotdock.json")
}

pub fn load(path: &Path) -> SavedState {
    std::fs::read_to_string(path)
        .ok()
        .and_then(|data| serde_json::from_str::<SavedState>(&data).ok())
        .filter(|saved| is_hex(&saved.accent) && saved.config.validate().is_ok())
        .unwrap_or_default()
}

pub fn save(path: &Path, state: &SavedState) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let data = serde_json::to_vec_pretty(state).map_err(|e| e.to_string())?;
    std::fs::write(path, data).map_err(|e| e.to_string())
}

#[derive(Deserialize)]
struct GeocodeResponse {
    results: Option<Vec<Location>>,
}

pub async fn search_locations(query: &str) -> Result<Vec<Location>, String> {
    let query = query.trim();
    if query.chars().count() < 2 || query.chars().count() > 80 {
        return Err("Escribe al menos dos letras de la ciudad".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|e| e.to_string())?;
    let result = client
        .get("https://geocoding-api.open-meteo.com/v1/search")
        .query(&[
            ("name", query),
            ("count", "6"),
            ("language", "es"),
            ("format", "json"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<GeocodeResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(result.results.unwrap_or_default())
}

#[derive(Deserialize)]
struct WeatherResponse {
    current: WeatherCurrent,
}
#[derive(Deserialize)]
struct WeatherCurrent {
    temperature_2m: f64,
    apparent_temperature: f64,
    weather_code: i32,
    is_day: i32,
    time: String,
}

pub async fn fetch_weather(location: &Location) -> Result<Weather, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;
    let result = client
        .get("https://api.open-meteo.com/v1/forecast")
        .query(&[
            ("latitude", location.latitude.to_string()),
            ("longitude", location.longitude.to_string()),
            (
                "current",
                "temperature_2m,apparent_temperature,weather_code,is_day".into(),
            ),
            ("timezone", "auto".into()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json::<WeatherResponse>()
        .await
        .map_err(|e| e.to_string())?;
    Ok(Weather {
        temperature_c: result.current.temperature_2m,
        apparent_c: result.current.apparent_temperature,
        code: result.current.weather_code,
        is_day: result.current.is_day == 1,
        updated_at: result.current.time,
    })
}

fn parse_shortcut(value: &str) -> Result<Vec<u16>, String> {
    let mut modifiers = Vec::new();
    let mut key = None;
    for part in value.split('+') {
        let token = part.trim().to_ascii_uppercase();
        let code = match token.as_str() {
            "CTRL" | "CONTROL" => 0x11,
            "ALT" => 0x12,
            "SHIFT" => 0x10,
            "WIN" | "WINDOWS" => 0x5B,
            "SPACE" | "ESPACIO" => 0x20,
            "ENTER" => 0x0D,
            "TAB" => 0x09,
            "ESC" | "ESCAPE" => 0x1B,
            "LEFT" => 0x25,
            "UP" => 0x26,
            "RIGHT" => 0x27,
            "DOWN" => 0x28,
            _ if token.len() == 1 && token.as_bytes()[0].is_ascii_alphanumeric() => {
                token.as_bytes()[0] as u16
            }
            _ if token.starts_with('F')
                && token[1..]
                    .parse::<u16>()
                    .is_ok_and(|n| (1..=12).contains(&n)) =>
            {
                0x70 + token[1..].parse::<u16>().unwrap() - 1
            }
            _ => return Err("Atajo no válido. Ejemplo: Ctrl+Shift+S".into()),
        };
        if [0x11, 0x12, 0x10, 0x5B].contains(&code) {
            if modifiers.contains(&code) {
                return Err("Modificador duplicado".into());
            }
            modifiers.push(code);
        } else if key.replace(code).is_some() {
            return Err("El atajo solo admite una tecla principal".into());
        }
    }
    let key = key.ok_or("El atajo necesita una tecla principal")?;
    modifiers.push(key);
    Ok(modifiers)
}

#[cfg(target_os = "windows")]
fn send_shortcut(value: &str) -> Result<(), String> {
    use windows::Win32::UI::Input::KeyboardAndMouse::{
        INPUT, INPUT_0, INPUT_KEYBOARD, KEYBD_EVENT_FLAGS, KEYBDINPUT, KEYEVENTF_KEYUP, SendInput,
        VIRTUAL_KEY,
    };
    let keys = parse_shortcut(value)?;
    let mut events = Vec::with_capacity(keys.len() * 2);
    for &key in &keys {
        events.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(key),
                    wScan: 0,
                    dwFlags: KEYBD_EVENT_FLAGS(0),
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
    }
    for &key in keys.iter().rev() {
        events.push(INPUT {
            r#type: INPUT_KEYBOARD,
            Anonymous: INPUT_0 {
                ki: KEYBDINPUT {
                    wVk: VIRTUAL_KEY(key),
                    wScan: 0,
                    dwFlags: KEYEVENTF_KEYUP,
                    time: 0,
                    dwExtraInfo: 0,
                },
            },
        });
    }
    let sent = unsafe { SendInput(&events, std::mem::size_of::<INPUT>() as i32) };
    if sent != events.len() as u32 {
        return Err("Windows no pudo enviar el atajo".into());
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn send_shortcut(_: &str) -> Result<(), String> {
    Err("Los atajos requieren Windows".into())
}

#[cfg(target_os = "windows")]
fn shell_open(value: &str) -> Result<(), String> {
    use windows::Win32::UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL};
    use windows::core::{HSTRING, PCWSTR, w};
    let target = HSTRING::from(value);
    let result = unsafe {
        ShellExecuteW(
            None,
            w!("open"),
            &target,
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    if result.0 as isize <= 32 {
        return Err("Windows no pudo abrir el destino".into());
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn shell_open(_: &str) -> Result<(), String> {
    Err("Esta acción requiere Windows".into())
}

pub async fn execute(button: &DeckButton) -> Result<(), String> {
    match button.action_kind.as_str() {
        "url" => {
            validate_url(&button.action_value)?;
            shell_open(&button.action_value)
        }
        "app" => {
            let path = std::fs::canonicalize(&button.action_value)
                .map_err(|_| "No se encuentra la aplicación".to_string())?;
            let extension = path.extension().and_then(|ext| ext.to_str()).unwrap_or("");
            if !["exe", "lnk"]
                .iter()
                .any(|item| extension.eq_ignore_ascii_case(item))
            {
                return Err("Selecciona un archivo .exe o .lnk".into());
            }
            shell_open(&path.to_string_lossy())
        }
        "shortcut" => send_shortcut(&button.action_value),
        "media" => {
            let action = match button.action_value.as_str() {
                "play_pause" => Control::PlayPause,
                "next" => Control::Next,
                "previous" => Control::Previous,
                _ => return Err("Control multimedia no válido".into()),
            };
            media::control(action).await
        }
        "view" => Ok(()),
        _ => Err("Acción no válida".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn configured_actions_reject_unsafe_or_invalid_targets() {
        let mut config = DockConfig::default();
        config.buttons[0].action_kind = "url".into();
        config.buttons[0].action_value = "javascript:alert(1)".into();
        assert!(config.validate().is_err());
        config.buttons[0].action_kind = "shortcut".into();
        config.buttons[0].action_value = "Ctrl+Shift+S".into();
        assert!(config.validate().is_ok());
        config.buttons[0].action_value = "Ctrl+S+X".into();
        assert!(config.validate().is_err());
    }

    #[test]
    fn duplicate_ids_are_rejected() {
        let mut config = DockConfig::default();
        config.buttons[1].id = config.buttons[0].id.clone();
        assert!(config.validate().is_err());
    }
}
