use crate::{Control, Track, dock};
use base64::{
    Engine,
    engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD},
};
use reqwest::{Client, Method, StatusCode, Url};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    path::PathBuf,
    sync::{
        Arc, OnceLock,
        atomic::{AtomicBool, Ordering},
    },
    time::{Duration, Instant},
};
use tokio::{
    io::{AsyncReadExt, AsyncWriteExt},
    net::TcpListener,
    sync::Mutex,
};
use uuid::Uuid;

static INSTANCE: OnceLock<Arc<SpotifyWeb>> = OnceLock::new();
const TOKEN_URL: &str = "https://accounts.spotify.com/api/token";
const PLAYER_URL: &str = "https://api.spotify.com/v1/me/player";
const SCOPES: &str =
    "user-read-playback-state user-read-currently-playing user-modify-playback-state";

#[derive(Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SavedAccount {
    client_id: String,
    refresh_token: String,
}

#[derive(Default)]
struct State {
    saved: SavedAccount,
    access_token: String,
    expires_at: Option<Instant>,
    cached: Option<Option<Track>>,
    last_poll: Option<Instant>,
    blocked_until: Option<Instant>,
    art_url: String,
    art_data: Option<String>,
    last_error: Option<String>,
}

pub struct SpotifyWeb {
    client: Client,
    state: Mutex<State>,
    path: PathBuf,
    pending: AtomicBool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthStatus {
    pub connected: bool,
    pub pending: bool,
    pub client_id: String,
    pub error: Option<String>,
}

#[derive(Deserialize)]
struct TokenReply {
    access_token: String,
    expires_in: u64,
    refresh_token: Option<String>,
}

#[derive(Deserialize)]
struct Playback {
    is_playing: bool,
    progress_ms: Option<i64>,
    shuffle_state: Option<bool>,
    repeat_state: Option<String>,
    item: Option<PlaybackItem>,
}

#[derive(Deserialize)]
struct PlaybackItem {
    name: String,
    duration_ms: i64,
    artists: Option<Vec<Artist>>,
    album: Option<Album>,
}

#[derive(Deserialize)]
struct Artist {
    name: String,
}

#[derive(Deserialize)]
struct Album {
    name: String,
    images: Vec<AlbumImage>,
}

#[derive(Deserialize)]
struct AlbumImage {
    url: String,
    width: Option<u32>,
}

fn instance() -> Result<&'static Arc<SpotifyWeb>, String> {
    INSTANCE
        .get()
        .ok_or("La conexión de Spotify todavía no está preparada".into())
}

pub fn init(path: PathBuf) {
    let mut saved = std::fs::read_to_string(&path)
        .ok()
        .and_then(|data| serde_json::from_str::<SavedAccount>(&data).ok())
        .unwrap_or_default();
    let mut load_error = None;
    if let Some(encrypted) = saved.refresh_token.strip_prefix("dpapi:") {
        match unprotect_secret(encrypted) {
            Ok(token) => saved.refresh_token = token,
            Err(error) => {
                saved.refresh_token.clear();
                load_error = Some(format!(
                    "No se pudo recuperar la conexión guardada de Spotify: {error}"
                ));
            }
        }
    }
    let client = Client::builder()
        .timeout(Duration::from_secs(8))
        .build()
        .expect("HTTP client");
    let _ = INSTANCE.set(Arc::new(SpotifyWeb {
        client,
        state: Mutex::new(State {
            saved,
            last_error: load_error,
            ..State::default()
        }),
        path,
        pending: AtomicBool::new(false),
    }));
}

fn save(path: &PathBuf, account: &SavedAccount) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let stored = SavedAccount {
        client_id: account.client_id.clone(),
        refresh_token: if account.refresh_token.is_empty() {
            String::new()
        } else {
            format!("dpapi:{}", protect_secret(&account.refresh_token)?)
        },
    };
    let bytes = serde_json::to_vec(&stored).map_err(|err| err.to_string())?;
    std::fs::write(path, bytes).map_err(|err| err.to_string())
}

#[cfg(target_os = "windows")]
fn protect_secret(secret: &str) -> Result<String, String> {
    use windows::Win32::{
        Foundation::{HLOCAL, LocalFree},
        Security::Cryptography::{CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN, CryptProtectData},
    };
    use windows::core::w;
    let input = CRYPT_INTEGER_BLOB {
        cbData: secret.len() as u32,
        pbData: secret.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptProtectData(
            &input,
            w!("SpotDock Spotify"),
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|err| err.to_string())?;
    }
    let bytes = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) };
    let encoded = STANDARD.encode(bytes);
    unsafe {
        LocalFree(Some(HLOCAL(output.pbData.cast())));
    }
    Ok(encoded)
}

#[cfg(target_os = "windows")]
fn unprotect_secret(encoded: &str) -> Result<String, String> {
    use windows::Win32::{
        Foundation::{HLOCAL, LocalFree},
        Security::Cryptography::{
            CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN, CryptUnprotectData,
        },
    };
    let mut ciphertext = STANDARD.decode(encoded).map_err(|err| err.to_string())?;
    let input = CRYPT_INTEGER_BLOB {
        cbData: ciphertext.len() as u32,
        pbData: ciphertext.as_mut_ptr(),
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe {
        CryptUnprotectData(
            &input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|err| err.to_string())?;
    }
    let bytes = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) };
    let secret = String::from_utf8(bytes.to_vec()).map_err(|err| err.to_string());
    unsafe {
        LocalFree(Some(HLOCAL(output.pbData.cast())));
    }
    secret
}

#[cfg(not(target_os = "windows"))]
fn protect_secret(secret: &str) -> Result<String, String> {
    Ok(STANDARD.encode(secret))
}
#[cfg(not(target_os = "windows"))]
fn unprotect_secret(encoded: &str) -> Result<String, String> {
    String::from_utf8(STANDARD.decode(encoded).map_err(|err| err.to_string())?)
        .map_err(|err| err.to_string())
}

pub async fn status() -> Result<AuthStatus, String> {
    let api = instance()?;
    let state = api.state.lock().await;
    Ok(AuthStatus {
        connected: !state.saved.refresh_token.is_empty(),
        pending: api.pending.load(Ordering::SeqCst),
        client_id: state.saved.client_id.clone(),
        error: state.last_error.clone(),
    })
}

pub async fn disconnect() -> Result<(), String> {
    let api = instance()?;
    let mut state = api.state.lock().await;
    save(&api.path, &SavedAccount::default())?;
    *state = State::default();
    Ok(())
}

pub async fn begin_auth(client_id: String) -> Result<(), String> {
    if client_id.len() != 32 || !client_id.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Introduce un Client ID de Spotify de 32 caracteres hexadecimales".into());
    }
    let api = instance()?.clone();
    if api.pending.swap(true, Ordering::SeqCst) {
        return Err("Ya hay una autorización en curso".into());
    }
    let listener = match TcpListener::bind("127.0.0.1:0").await {
        Ok(listener) => listener,
        Err(err) => {
            api.pending.store(false, Ordering::SeqCst);
            return Err(err.to_string());
        }
    };
    let redirect = format!(
        "http://127.0.0.1:{}/callback",
        match listener.local_addr() {
            Ok(address) => address.port(),
            Err(err) => {
                api.pending.store(false, Ordering::SeqCst);
                return Err(err.to_string());
            }
        }
    );
    let verifier = format!("{}{}", Uuid::new_v4().simple(), Uuid::new_v4().simple());
    let challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()));
    let expected_state = Uuid::new_v4().simple().to_string();
    let mut url =
        Url::parse("https://accounts.spotify.com/authorize").map_err(|err| err.to_string())?;
    url.query_pairs_mut()
        .append_pair("response_type", "code")
        .append_pair("client_id", &client_id)
        .append_pair("scope", SCOPES)
        .append_pair("redirect_uri", &redirect)
        .append_pair("state", &expected_state)
        .append_pair("code_challenge_method", "S256")
        .append_pair("code_challenge", &challenge);
    if let Err(err) = dock::shell_open(url.as_str()) {
        api.pending.store(false, Ordering::SeqCst);
        return Err(err);
    }
    tauri::async_runtime::spawn(async move {
        let outcome = api
            .wait_for_callback(listener, &client_id, &redirect, &verifier, &expected_state)
            .await;
        if let Err(err) = outcome {
            api.state.lock().await.last_error = Some(err);
        }
        api.pending.store(false, Ordering::SeqCst);
    });
    Ok(())
}

impl SpotifyWeb {
    async fn wait_for_callback(
        &self,
        listener: TcpListener,
        client_id: &str,
        redirect: &str,
        verifier: &str,
        expected_state: &str,
    ) -> Result<(), String> {
        let deadline = tokio::time::Instant::now() + Duration::from_secs(180);
        loop {
            let (mut stream, _) = tokio::time::timeout_at(deadline, listener.accept())
                .await
                .map_err(|_| "La autorización de Spotify ha caducado".to_string())?
                .map_err(|err| err.to_string())?;
            let mut buffer = [0_u8; 8192];
            let length = match tokio::time::timeout(
                Duration::from_secs(5),
                stream.read(&mut buffer),
            )
            .await
            {
                Ok(Ok(length)) => length,
                _ => continue,
            };
            let first_line = String::from_utf8_lossy(&buffer[..length])
                .lines()
                .next()
                .unwrap_or("")
                .to_string();
            let Some(target) = first_line
                .strip_prefix("GET ")
                .and_then(|line| line.split_once(' ').map(|(target, _)| target))
            else {
                continue;
            };
            let Ok(url) = Url::parse(&format!("http://127.0.0.1{target}")) else {
                continue;
            };
            if url.path() != "/callback" {
                continue;
            }
            let query: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
            if query.get("state").map(String::as_str) != Some(expected_state) {
                let _ = reply(&mut stream, false).await;
                continue;
            }
            if query.contains_key("error") {
                let _ = reply(&mut stream, false).await;
                return Err("Spotify no autorizó la conexión".into());
            }
            let Some(code) = query.get("code") else {
                let _ = reply(&mut stream, false).await;
                continue;
            };
            let result = self
                .exchange_code(client_id, redirect, verifier, code)
                .await;
            let _ = reply(&mut stream, result.is_ok()).await;
            return result;
        }
    }

    async fn exchange_code(
        &self,
        client_id: &str,
        redirect: &str,
        verifier: &str,
        code: &str,
    ) -> Result<(), String> {
        let response = self
            .client
            .post(TOKEN_URL)
            .form(&[
                ("client_id", client_id),
                ("grant_type", "authorization_code"),
                ("code", code),
                ("redirect_uri", redirect),
                ("code_verifier", verifier),
            ])
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err(format!(
                "Spotify rechazó la autorización ({})",
                response.status()
            ));
        }
        let token: TokenReply = response.json().await.map_err(|err| err.to_string())?;
        let refresh = token
            .refresh_token
            .ok_or("Spotify no devolvió una clave de renovación")?;
        let mut state = self.state.lock().await;
        let saved = SavedAccount {
            client_id: client_id.into(),
            refresh_token: refresh,
        };
        save(&self.path, &saved)?;
        state.saved = saved;
        state.access_token = token.access_token;
        state.expires_at =
            Some(Instant::now() + Duration::from_secs(token.expires_in.saturating_sub(30)));
        state.cached = None;
        state.last_poll = None;
        state.blocked_until = None;
        state.last_error = None;
        Ok(())
    }

    async fn access_token(&self) -> Result<String, String> {
        let mut state = self.state.lock().await;
        if state.expires_at.is_some_and(|until| until > Instant::now())
            && !state.access_token.is_empty()
        {
            return Ok(state.access_token.clone());
        }
        if state.saved.refresh_token.is_empty() {
            return Err("Configura la conexión de Spotify en Ajustes".into());
        }
        let response = self
            .client
            .post(TOKEN_URL)
            .form(&[
                ("grant_type", "refresh_token"),
                ("refresh_token", state.saved.refresh_token.as_str()),
                ("client_id", state.saved.client_id.as_str()),
            ])
            .send()
            .await
            .map_err(|err| {
                state.blocked_until = Some(Instant::now() + Duration::from_secs(15));
                state.last_error = Some(format!("No se pudo renovar Spotify: {err}"));
                err.to_string()
            })?;
        if !response.status().is_success() {
            let message = format!("Spotify rechazó la renovación ({})", response.status());
            state.last_error = Some(message.clone());
            state.blocked_until = Some(Instant::now() + Duration::from_secs(30));
            return Err(message);
        }
        let token: TokenReply = response.json().await.map_err(|err| err.to_string())?;
        if let Some(refresh) = token.refresh_token {
            let saved = SavedAccount {
                client_id: state.saved.client_id.clone(),
                refresh_token: refresh,
            };
            save(&self.path, &saved)?;
            state.saved = saved;
        }
        state.access_token = token.access_token;
        state.expires_at =
            Some(Instant::now() + Duration::from_secs(token.expires_in.saturating_sub(30)));
        state.blocked_until = None;
        state.last_error = None;
        Ok(state.access_token.clone())
    }

    async fn read_track(&self) -> Result<Track, String> {
        {
            let state = self.state.lock().await;
            if state.saved.refresh_token.is_empty() {
                return Err("API de Spotify sin configurar".into());
            }
            if state
                .blocked_until
                .is_some_and(|until| until > Instant::now())
            {
                return state
                    .cached
                    .clone()
                    .map(|cached| cached.unwrap_or_default())
                    .ok_or_else(|| {
                        state
                            .last_error
                            .clone()
                            .unwrap_or("Spotify no está disponible temporalmente".into())
                    });
            }
            let poll_interval = if state
                .cached
                .as_ref()
                .and_then(Option::as_ref)
                .is_some_and(|track| track.playing)
            {
                10
            } else {
                20
            };
            if state
                .last_poll
                .is_some_and(|last| last.elapsed() < Duration::from_secs(poll_interval))
            {
                return Ok(state.cached.clone().flatten().unwrap_or_default());
            }
        }
        let token = self.access_token().await?;
        let response = match self.client.get(PLAYER_URL).bearer_auth(&token).send().await {
            Ok(response) => response,
            Err(err) => {
                let mut state = self.state.lock().await;
                state.blocked_until = Some(Instant::now() + Duration::from_secs(15));
                state.last_error = Some(format!("No se pudo consultar Spotify: {err}"));
                return Err(err.to_string());
            }
        };
        if response.status() == StatusCode::TOO_MANY_REQUESTS {
            let retry_after = response
                .headers()
                .get("retry-after")
                .and_then(|value| value.to_str().ok())
                .and_then(|value| value.parse::<u64>().ok());
            let quota = response
                .json::<serde_json::Value>()
                .await
                .ok()
                .and_then(|body| {
                    body.pointer("/error/reason")
                        .and_then(|reason| reason.as_str())
                        .map(|reason| reason == "QUOTA_EXCEEDED")
                })
                .unwrap_or(false);
            let seconds = retry_after
                .unwrap_or(if quota { 600 } else { 30 })
                .clamp(1, 3600);
            let mut state = self.state.lock().await;
            state.blocked_until = Some(Instant::now() + Duration::from_secs(seconds));
            state.last_error = Some(format!(
                "Spotify ha limitado las consultas durante {seconds} s"
            ));
            return state
                .cached
                .clone()
                .map(|cached| cached.unwrap_or_default())
                .ok_or_else(|| state.last_error.clone().unwrap_or_default());
        }
        if response.status() == StatusCode::NO_CONTENT {
            let mut state = self.state.lock().await;
            state.cached = Some(None);
            state.last_poll = Some(Instant::now());
            state.last_error = None;
            return Ok(Track::default());
        }
        if !response.status().is_success() {
            let status = response.status();
            let mut state = self.state.lock().await;
            if status == StatusCode::UNAUTHORIZED {
                state.expires_at = None;
            }
            state.blocked_until = Some(
                Instant::now()
                    + Duration::from_secs(if status == StatusCode::FORBIDDEN {
                        60
                    } else {
                        15
                    }),
            );
            let message = if status == StatusCode::FORBIDDEN {
                "Spotify denegó el acceso (403). Comprueba la cuenta Premium y la lista de usuarios autorizados de la aplicación".into()
            } else {
                format!("Spotify Web API devolvió {status}")
            };
            state.last_error = Some(message.clone());
            return Err(message);
        }
        let playback: Playback = response.json().await.map_err(|err| err.to_string())?;
        let Some(item) = playback.item else {
            let mut state = self.state.lock().await;
            state.cached = Some(None);
            state.last_poll = Some(Instant::now());
            state.last_error = None;
            return Ok(Track::default());
        };
        let album = item.album;
        let art_url = album
            .as_ref()
            .and_then(|album| {
                album
                    .images
                    .iter()
                    .min_by_key(|image| image.width.unwrap_or(640).abs_diff(300))
            })
            .map(|image| image.url.clone())
            .unwrap_or_default();
        let artwork = self.artwork(&art_url).await;
        let track = Track {
            title: item.name,
            artist: item
                .artists
                .unwrap_or_default()
                .into_iter()
                .map(|artist| artist.name)
                .collect::<Vec<_>>()
                .join(", "),
            album: album.map(|album| album.name).unwrap_or_default(),
            artwork,
            position_ms: playback.progress_ms.unwrap_or(0).max(0),
            duration_ms: item.duration_ms.max(0),
            playing: playback.is_playing,
            shuffle: playback.shuffle_state.unwrap_or(false),
            repeat: match playback.repeat_state.as_deref() {
                Some("context") => "all",
                Some("track") => "track",
                _ => "off",
            }
            .into(),
            available: true,
        };
        let mut state = self.state.lock().await;
        state.cached = Some(Some(track.clone()));
        state.last_poll = Some(Instant::now());
        state.blocked_until = None;
        state.last_error = None;
        Ok(track)
    }

    async fn artwork(&self, address: &str) -> Option<String> {
        if address.is_empty() {
            return None;
        }
        {
            let state = self.state.lock().await;
            if state.art_url == address {
                return state.art_data.clone();
            }
        }
        let url = Url::parse(address).ok()?;
        let host = url.host_str()?;
        if url.scheme() != "https" || !(host == "i.scdn.co" || host.ends_with(".spotifycdn.com")) {
            return None;
        }
        let response = self.client.get(url).send().await.ok()?;
        if !response.status().is_success() || response.content_length().unwrap_or(0) > 2_000_000 {
            return None;
        }
        let mime = response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)?
            .to_str()
            .ok()?
            .split(';')
            .next()?
            .to_string();
        if !["image/jpeg", "image/png", "image/webp"].contains(&mime.as_str()) {
            return None;
        }
        let bytes = response.bytes().await.ok()?;
        if bytes.len() > 2_000_000 {
            return None;
        }
        let data = format!(
            "data:{mime};base64,{}",
            base64::engine::general_purpose::STANDARD.encode(bytes)
        );
        let mut state = self.state.lock().await;
        state.art_url = address.into();
        state.art_data = Some(data.clone());
        Some(data)
    }

    async fn control(&self, action: Control) -> Result<(), String> {
        let playing = if matches!(action, Control::PlayPause) {
            self.state.lock().await.last_poll = None;
            self.read_track().await?.playing
        } else {
            false
        };
        let (method, url) = match action {
            Control::PlayPause => (
                Method::PUT,
                format!("{PLAYER_URL}/{}", if playing { "pause" } else { "play" }),
            ),
            Control::Next => (Method::POST, format!("{PLAYER_URL}/next")),
            Control::Previous => (Method::POST, format!("{PLAYER_URL}/previous")),
            Control::Seek { position_ms } => (
                Method::PUT,
                format!("{PLAYER_URL}/seek?position_ms={}", position_ms.max(0)),
            ),
            Control::Shuffle { enabled } => {
                (Method::PUT, format!("{PLAYER_URL}/shuffle?state={enabled}"))
            }
            Control::Repeat { mode } => {
                let state = if mode == "track" {
                    "track"
                } else if mode == "all" {
                    "context"
                } else {
                    "off"
                };
                (Method::PUT, format!("{PLAYER_URL}/repeat?state={state}"))
            }
        };
        let token = self.access_token().await?;
        let response = self
            .client
            .request(method, url)
            .bearer_auth(token)
            .send()
            .await
            .map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err(format!(
                "Spotify no pudo ejecutar la acción ({})",
                response.status()
            ));
        }
        self.state.lock().await.last_poll = None;
        Ok(())
    }
}

async fn reply(stream: &mut tokio::net::TcpStream, success: bool) -> Result<(), String> {
    let body = if success {
        "<h1>Spotify conectado a SpotDock</h1><p>Ya puedes cerrar esta pestaña.</p>"
    } else {
        "<h1>No se pudo conectar Spotify</h1><p>Vuelve a intentarlo desde SpotDock.</p>"
    };
    let page = format!(
        "<!doctype html><html lang=es><meta charset=utf-8><title>SpotDock</title><body style=\"font:16px sans-serif;background:#101514;color:#fff;padding:3rem\">{body}</body></html>"
    );
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{page}",
        page.len()
    );
    stream
        .write_all(response.as_bytes())
        .await
        .map_err(|err| err.to_string())
}

pub async fn read_track() -> Result<Track, String> {
    instance()?.read_track().await
}
pub async fn control(action: Control) -> Result<(), String> {
    instance()?.control(action).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn saved_refresh_token_is_protected_for_this_windows_user() {
        let plain = "spotify-refresh-token-for-test";
        let encrypted = protect_secret(plain).unwrap();
        assert!(!encrypted.contains(plain));
        assert_eq!(unprotect_secret(&encrypted).unwrap(), plain);
    }

    #[test]
    fn spotify_playback_response_accepts_track_fields() {
        let playback: Playback = serde_json::from_value(serde_json::json!({
            "is_playing": true,
            "progress_ms": 42000,
            "shuffle_state": false,
            "repeat_state": "context",
            "item": { "name": "Tema", "duration_ms": 180000,
                "artists": [{ "name": "Artista" }],
                "album": { "name": "Álbum", "images": [{ "url": "https://i.scdn.co/image/example", "width": 300 }] }
            }
        })).unwrap();
        assert!(playback.is_playing);
        assert_eq!(playback.item.unwrap().album.unwrap().name, "Álbum");
    }
}
