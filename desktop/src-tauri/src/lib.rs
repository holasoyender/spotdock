mod dock;
mod media;

use axum::{
    Router,
    extract::{
        Query, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
    routing::get,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket},
    path::PathBuf,
    sync::{Arc, OnceLock},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::{Notify, RwLock, broadcast};
use uuid::Uuid;

#[derive(Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    title: String,
    artist: String,
    album: String,
    artwork: Option<String>,
    position_ms: i64,
    duration_ms: i64,
    playing: bool,
    shuffle: bool,
    repeat: String,
    available: bool,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    kind: &'static str,
    track: Track,
    clients: usize,
    accent: String,
    config: dock::DockConfig,
    weather: Option<dock::Weather>,
}

struct Shared {
    token: RwLock<String>,
    track: RwLock<Track>,
    clients: RwLock<usize>,
    accent: RwLock<String>,
    config: RwLock<dock::DockConfig>,
    weather: RwLock<Option<dock::Weather>>,
    config_path: OnceLock<PathBuf>,
    refresh_weather: Notify,
    updates: broadcast::Sender<String>,
    port: u16,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PairingInfo {
    url: String,
    clients: usize,
    port: u16,
}

#[derive(Deserialize)]
struct Auth {
    token: String,
}

#[derive(Deserialize)]
#[serde(tag = "action", rename_all = "snake_case")]
pub enum Control {
    PlayPause,
    Next,
    Previous,
    Seek { position_ms: i64 },
    Shuffle { enabled: bool },
    Repeat { mode: String },
}

#[derive(Deserialize)]
struct DeckRequest {
    action: String,
    button_id: String,
}

fn local_ip() -> IpAddr {
    if let Ok(socket) = UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("1.1.1.1:80").is_ok() {
            if let Ok(address) = socket.local_addr() {
                return address.ip();
            }
        }
    }
    IpAddr::V4(Ipv4Addr::LOCALHOST)
}

async fn pairing(shared: &Shared) -> PairingInfo {
    PairingInfo {
        url: format!(
            "ws://{}:{}/ws?token={}",
            local_ip(),
            shared.port,
            shared.token.read().await
        ),
        clients: *shared.clients.read().await,
        port: shared.port,
    }
}

#[tauri::command]
async fn get_pairing(shared: tauri::State<'_, Arc<Shared>>) -> Result<PairingInfo, String> {
    Ok(pairing(&shared).await)
}

#[tauri::command]
async fn rotate_pairing(shared: tauri::State<'_, Arc<Shared>>) -> Result<PairingInfo, String> {
    *shared.token.write().await = Uuid::new_v4().simple().to_string();
    Ok(pairing(&shared).await)
}

#[tauri::command]
async fn get_snapshot(shared: tauri::State<'_, Arc<Shared>>) -> Result<Snapshot, String> {
    Ok(snapshot(&shared).await)
}

#[tauri::command]
async fn control(action: Control) -> Result<(), String> {
    media::control(action).await
}

#[tauri::command]
async fn set_accent(
    accent: String,
    shared: tauri::State<'_, Arc<Shared>>,
    app: AppHandle,
) -> Result<(), String> {
    let valid = accent.len() == 7
        && accent.starts_with('#')
        && accent[1..].bytes().all(|byte| byte.is_ascii_hexdigit());
    if !valid {
        return Err("El color debe tener formato #RRGGBB".into());
    }
    *shared.accent.write().await = accent;
    persist(&shared).await?;
    publish(&shared, &app).await;
    Ok(())
}

#[tauri::command]
async fn set_dock_config(
    config: dock::DockConfig,
    shared: tauri::State<'_, Arc<Shared>>,
    app: AppHandle,
) -> Result<(), String> {
    config.validate()?;
    let old_location = shared.config.read().await.weather_location.clone();
    let changed_location = old_location != config.weather_location;
    *shared.config.write().await = config;
    persist(&shared).await?;
    if changed_location {
        *shared.weather.write().await = None;
        shared.refresh_weather.notify_one();
    }
    publish(&shared, &app).await;
    Ok(())
}

#[tauri::command]
async fn search_locations(query: String) -> Result<Vec<dock::Location>, String> {
    dock::search_locations(&query).await
}

#[tauri::command]
async fn trigger_deck_button(
    button_id: String,
    shared: tauri::State<'_, Arc<Shared>>,
) -> Result<(), String> {
    run_button(&shared, &button_id).await
}

async fn run_button(shared: &Shared, button_id: &str) -> Result<(), String> {
    let button = shared
        .config
        .read()
        .await
        .buttons
        .iter()
        .find(|button| button.id == button_id)
        .cloned()
        .ok_or("Botón no encontrado")?;
    dock::execute(&button).await
}

async fn persist(shared: &Shared) -> Result<(), String> {
    let path = shared
        .config_path
        .get()
        .ok_or("No se ha preparado el almacenamiento")?;
    dock::save(
        path,
        &dock::SavedState {
            accent: shared.accent.read().await.clone(),
            config: shared.config.read().await.clone(),
        },
    )
}

async fn snapshot(shared: &Shared) -> Snapshot {
    Snapshot {
        kind: "state",
        track: shared.track.read().await.clone(),
        clients: *shared.clients.read().await,
        accent: shared.accent.read().await.clone(),
        config: shared.config.read().await.clone(),
        weather: shared.weather.read().await.clone(),
    }
}

async fn publish(shared: &Shared, app: &AppHandle) {
    let message = serde_json::to_string(&snapshot(shared).await).unwrap_or_default();
    let _ = shared.updates.send(message.clone());
    let _ = app.emit("spotdock:state", message);
}

async fn publish_track(shared: &Shared, app: &AppHandle, artwork_changed: bool) {
    let mut track = serde_json::to_value(&*shared.track.read().await).unwrap_or_default();
    if !artwork_changed {
        if let Some(object) = track.as_object_mut() {
            object.remove("artwork");
        }
    }
    let message = serde_json::json!({ "kind": "track", "track": track }).to_string();
    let _ = shared.updates.send(message.clone());
    let _ = app.emit("spotdock:track", message);
}

async fn ws_upgrade(
    State(shared): State<Arc<Shared>>,
    Query(auth): Query<Auth>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    if auth.token != *shared.token.read().await {
        return axum::http::StatusCode::UNAUTHORIZED.into_response();
    }
    ws.max_message_size(2048)
        .on_upgrade(move |socket| ws_client(socket, shared))
        .into_response()
}

async fn ws_client(socket: WebSocket, shared: Arc<Shared>) {
    *shared.clients.write().await += 1;
    let (mut sink, mut stream) = socket.split();
    let mut updates = shared.updates.subscribe();
    let first = serde_json::to_string(&snapshot(&shared).await).unwrap_or_default();
    if sink.send(Message::Text(first.into())).await.is_ok() {
        loop {
            tokio::select! {
                update = updates.recv() => {
                    if let Ok(update) = update {
                        if sink.send(Message::Text(update.into())).await.is_err() { break; }
                    }
                }
                received = stream.next() => {
                    match received {
                        Some(Ok(Message::Text(text))) => {
                            if let Ok(request) = serde_json::from_str::<DeckRequest>(&text) {
                                if request.action == "deck" {
                                    let result = run_button(&shared, &request.button_id).await;
                                    let reply = serde_json::json!({ "kind": "action_result", "buttonId": request.button_id, "ok": result.is_ok(), "message": result.err() });
                                    let _ = sink.send(Message::Text(reply.to_string().into())).await;
                                }
                            } else if let Ok(action) = serde_json::from_str::<Control>(&text) { let _ = media::control(action).await; }
                        }
                        Some(Ok(Message::Ping(data))) => { if sink.send(Message::Pong(data)).await.is_err() { break; } }
                        Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                        _ => {}
                    }
                }
            }
        }
    }
    *shared.clients.write().await -= 1;
}

async fn run_server(shared: Arc<Shared>) {
    let router = Router::new()
        .route("/ws", get(ws_upgrade))
        .with_state(shared.clone());
    let address = SocketAddr::from(([0, 0, 0, 0], shared.port));
    match tokio::net::TcpListener::bind(address).await {
        Ok(listener) => {
            if let Err(err) = axum::serve(listener, router).await {
                log::error!("WebSocket server: {err}");
            }
        }
        Err(err) => log::error!("Could not listen on {address}: {err}"),
    }
}

pub fn run() {
    let (updates, _) = broadcast::channel(32);
    let shared = Arc::new(Shared {
        token: RwLock::new(Uuid::new_v4().simple().to_string()),
        track: RwLock::new(Track::default()),
        clients: RwLock::new(0),
        accent: RwLock::new("#b8ef64".into()),
        config: RwLock::new(dock::DockConfig::default()),
        weather: RwLock::new(None),
        config_path: OnceLock::new(),
        refresh_weather: Notify::new(),
        updates,
        port: 47917,
    });
    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(shared.clone())
        .setup(move |app| {
            let path = dock::config_path(&app.path().app_config_dir().map_err(|err| err.to_string())?);
            let saved = dock::load(&path);
            let _ = shared.config_path.set(path);
            tauri::async_runtime::block_on(async {
                *shared.accent.write().await = saved.accent;
                *shared.config.write().await = saved.config;
            });
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(run_server(shared.clone()));
            let weather_shared = shared.clone();
            let weather_app = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                loop {
                    let location = weather_shared.config.read().await.weather_location.clone();
                    let weather = match &location { Some(location) => dock::fetch_weather(location).await.ok(), None => None };
                    if weather_shared.config.read().await.weather_location == location {
                        *weather_shared.weather.write().await = weather;
                        publish(&weather_shared, &weather_app).await;
                    }
                    tokio::select! { _ = tokio::time::sleep(Duration::from_secs(900)) => {}, _ = weather_shared.refresh_weather.notified() => {} }
                }
            });
            tauri::async_runtime::spawn(async move {
                loop {
                    let next = media::read_track().await.unwrap_or_default();
                    let shared = app_handle.state::<Arc<Shared>>();
                    let previous = shared.track.read().await.clone();
                    if previous != next {
                        let artwork_changed = previous.artwork != next.artwork;
                        *shared.track.write().await = next;
                        publish_track(&shared, &app_handle, artwork_changed).await;
                    }
                    tokio::time::sleep(Duration::from_millis(900)).await;
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_pairing,
            rotate_pairing,
            get_snapshot,
            control,
            set_accent,
            set_dock_config,
            search_locations,
            trigger_deck_button
        ])
        .run(tauri::generate_context!())
        .expect("error while running SpotDock desktop");
}
