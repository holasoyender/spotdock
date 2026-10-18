mod background;
#[path = "../../../shared/discovery.rs"]
mod discovery;
mod dock;
mod locale;
mod media;
mod media_source;
mod notification_delivery;
mod notifications;
mod spotify_web;

use axum::{
    Router,
    extract::{
        Query, State,
        ws::{Message, WebSocket, WebSocketUpgrade},
    },
    response::IntoResponse,
    routing::get,
};
use chrono::{Datelike, Local, Timelike};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    net::{IpAddr, Ipv4Addr, SocketAddr, UdpSocket},
    path::PathBuf,
    sync::{Arc, OnceLock},
    time::Duration,
};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;
use tokio::sync::{RwLock, broadcast};

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
    screen_off: bool,
    screen_at: i64,
    language: String,
    locale: &'static str,
    media: MediaStatus,
}

#[derive(Clone, Default, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
struct MediaStatus {
    source: String,
    message: Option<String>,
}

struct Shared {
    token: RwLock<String>,
    track: RwLock<Track>,
    clients: RwLock<usize>,
    accent: RwLock<String>,
    config: RwLock<dock::DockConfig>,
    language: RwLock<String>,
    system_locale: String,
    media_status: RwLock<MediaStatus>,
    notifications: RwLock<notifications::NotificationSettings>,
    notification_delivery: notification_delivery::NotificationDelivery,
    config_path: OnceLock<PathBuf>,
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

#[derive(Clone, Deserialize)]
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

#[derive(Deserialize)]
struct NotificationAck {
    action: String,
    id: String,
}

fn scheduled_screen_off(config: &dock::DockConfig, now: &chrono::DateTime<Local>) -> bool {
    dock::screen_off(
        &config.screen_schedule,
        now.weekday().num_days_from_monday() as usize,
        now.hour() * 60 + now.minute(),
    )
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
    *shared.token.write().await = dock::new_pairing_token();
    persist(&shared).await?;
    Ok(pairing(&shared).await)
}

#[tauri::command]
async fn get_snapshot(shared: tauri::State<'_, Arc<Shared>>) -> Result<Snapshot, String> {
    Ok(snapshot(&shared).await)
}

#[tauri::command]
async fn get_client_count(shared: tauri::State<'_, Arc<Shared>>) -> Result<usize, String> {
    Ok(*shared.clients.read().await)
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let autolaunch = app.autolaunch();
    if enabled {
        autolaunch.enable()
    } else {
        autolaunch.disable()
    }
    .map_err(|error| error.to_string())?;
    autolaunch.is_enabled().map_err(|error| error.to_string())
}

#[tauri::command]
async fn get_notification_status(
    shared: tauri::State<'_, Arc<Shared>>,
) -> Result<notifications::NotificationStatus, String> {
    Ok(notifications::NotificationStatus {
        access: notifications::access(),
        settings: shared.notifications.read().await.clone(),
    })
}

#[tauri::command]
async fn request_notification_access(app: AppHandle) -> Result<&'static str, String> {
    notifications::request_access(app).await
}

#[tauri::command]
async fn set_notification_settings(
    settings: notifications::NotificationSettings,
    shared: tauri::State<'_, Arc<Shared>>,
) -> Result<(), String> {
    *shared.notifications.write().await = settings;
    persist(&shared).await
}

#[tauri::command]
async fn send_test_notification(
    sender: String,
    body: String,
    shared: tauri::State<'_, Arc<Shared>>,
) -> Result<notification_delivery::TestResult, String> {
    if sender.len() > 100 || body.len() > 300 {
        return Err("Test notification is too long".into());
    }
    let event = notifications::NotificationEvent {
        kind: "notification",
        id: uuid::Uuid::new_v4().to_string(),
        app: "spotdock".into(),
        sender,
        body,
        image: None,
    };
    let message = serde_json::to_string(&event).map_err(|error| error.to_string())?;
    Ok(shared
        .notification_delivery
        .send_test(&event.id, &message)
        .await)
}

#[tauri::command]
async fn get_spotify_status() -> Result<spotify_web::AuthStatus, String> {
    spotify_web::status().await
}

#[tauri::command]
fn get_media_sessions() -> Result<media_source::MediaSources, String> {
    media::list_sessions()
}

#[tauri::command]
fn set_media_session(source: Option<String>) -> Result<(), String> {
    if let Some(id) = &source {
        let sessions = media::list_sessions()?;
        if !sessions
            .sessions
            .iter()
            .any(|session| session.source == *id)
        {
            return Err("La sesión multimedia seleccionada ya no está disponible".into());
        }
    }
    media_source::set_selected(source)
}

#[tauri::command]
async fn connect_spotify(client_id: String) -> Result<(), String> {
    spotify_web::begin_auth(client_id).await
}

#[tauri::command]
async fn disconnect_spotify() -> Result<(), String> {
    spotify_web::disconnect().await
}

#[tauri::command]
fn open_spotify_developer_dashboard() -> Result<(), String> {
    dock::shell_open("https://developer.spotify.com/dashboard")
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
    *shared.config.write().await = config;
    persist(&shared).await?;
    publish(&shared, &app).await;
    Ok(())
}

#[tauri::command]
async fn set_language(
    language: String,
    shared: tauri::State<'_, Arc<Shared>>,
    app: AppHandle,
) -> Result<(), String> {
    if !locale::valid_preference(&language) {
        return Err("Unsupported language".into());
    }
    *shared.language.write().await = language;
    persist(&shared).await?;
    let effective = locale::resolve(&shared.language.read().await, &shared.system_locale);
    background::update_tray(&app, effective).map_err(|error| error.to_string())?;
    spotify_web::set_locale(effective);
    publish(&shared, &app).await;
    Ok(())
}

#[tauri::command]
async fn search_locations(
    query: String,
    shared: tauri::State<'_, Arc<Shared>>,
) -> Result<Vec<dock::Location>, String> {
    let code = {
        let language = shared.language.read().await;
        if locale::resolve(&language, &shared.system_locale) == locale::SPANISH {
            "es"
        } else {
            "en"
        }
    };
    dock::search_locations(&query, code).await
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
            language: shared.language.read().await.clone(),
            pairing_token: shared.token.read().await.clone(),
            notifications: shared.notifications.read().await.clone(),
        },
    )
}

async fn snapshot(shared: &Shared) -> Snapshot {
    let language = shared.language.read().await.clone();
    let config = shared.config.read().await.clone();
    let now = Local::now();
    Snapshot {
        kind: "state",
        track: shared.track.read().await.clone(),
        clients: *shared.clients.read().await,
        accent: shared.accent.read().await.clone(),
        screen_off: scheduled_screen_off(&config, &now),
        screen_at: now.timestamp_millis(),
        config,
        locale: locale::resolve(&language, &shared.system_locale),
        language,
        media: shared.media_status.read().await.clone(),
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
    let (client_id, mut notification_queue) = shared.notification_delivery.register().await;
    let first = serde_json::to_string(&snapshot(&shared).await).unwrap_or_default();
    if sink.send(Message::Text(first.into())).await.is_ok() {
        loop {
            tokio::select! {
                biased;
                notification = notification_queue.recv() => {
                    if let Some(notification) = notification {
                        if sink.send(Message::Text(notification.into())).await.is_err() { break; }
                    }
                }
                update = updates.recv() => {
                    if let Ok(update) = update {
                        if sink.send(Message::Text(update.into())).await.is_err() { break; }
                    }
                }
                received = stream.next() => {
                    match received {
                        Some(Ok(Message::Text(text))) => {
                            if let Ok(ack) = serde_json::from_str::<NotificationAck>(&text) {
                                if ack.action == "notification_ack" && ack.id.len() <= 64 {
                                    shared.notification_delivery.acknowledge(client_id, ack.id);
                                }
                            } else if let Ok(request) = serde_json::from_str::<DeckRequest>(&text) {
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
    shared.notification_delivery.unregister(client_id).await;
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

async fn run_discovery(shared: Arc<Shared>) {
    let address = SocketAddr::from(([0, 0, 0, 0], discovery::PORT));
    let socket = match tokio::net::UdpSocket::bind(address).await {
        Ok(socket) => socket,
        Err(err) => {
            log::error!("Could not listen for LAN discovery on {address}: {err}");
            return;
        }
    };
    let mut buffer = [0_u8; 128];
    loop {
        let Ok((length, sender)) = socket.recv_from(&mut buffer).await else {
            continue;
        };
        let Ok(request) = std::str::from_utf8(&buffer[..length]) else {
            continue;
        };
        let Some(nonce) = request.strip_prefix(discovery::REQUEST) else {
            continue;
        };
        if !discovery::valid_nonce(nonce) {
            continue;
        }
        let response = format!(
            "{}{}:{}",
            discovery::OFFER,
            nonce,
            discovery::proof(&shared.token.read().await, nonce)
        );
        let _ = socket.send_to(response.as_bytes(), sender).await;
    }
}

pub fn run() {
    let (updates, _) = broadcast::channel(32);
    let shared = Arc::new(Shared {
        token: RwLock::new(dock::new_pairing_token()),
        track: RwLock::new(Track::default()),
        clients: RwLock::new(0),
        accent: RwLock::new("#b8ef64".into()),
        config: RwLock::new(dock::DockConfig::default()),
        language: RwLock::new(locale::AUTO.into()),
        system_locale: locale::system_locale(),
        media_status: RwLock::new(MediaStatus::default()),
        notifications: RwLock::new(notifications::NotificationSettings::default()),
        notification_delivery: notification_delivery::NotificationDelivery::default(),
        config_path: OnceLock::new(),
        updates,
        port: 47917,
    });
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if !background::is_background_launch(&args) {
                background::show_main_window(app);
            }
        }))
        .plugin(tauri_plugin_autostart::Builder::new().arg(background::BACKGROUND_ARG).build())
        .plugin(tauri_plugin_log::Builder::new().build())
        .manage(shared.clone())
        .setup(move |app| {
            let path = dock::config_path(&app.path().app_config_dir().map_err(|err| err.to_string())?);
            spotify_web::init(path.with_file_name("spotify.json"));
            media_source::init(path.with_file_name("media-source.json"));
            let saved = dock::load(&path);
            dock::save(&path, &saved)?;
            let _ = shared.config_path.set(path);
            tauri::async_runtime::block_on(async {
                *shared.accent.write().await = saved.accent;
                *shared.config.write().await = saved.config;
                *shared.language.write().await = saved.language;
                *shared.token.write().await = saved.pairing_token;
                *shared.notifications.write().await = saved.notifications;
            });
            let selected_language = tauri::async_runtime::block_on(shared.language.read()).clone();
            let effective = locale::resolve(&selected_language, &shared.system_locale);
            spotify_web::set_locale(effective);
            background::create_tray(app, effective)?;
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(run_server(shared.clone()));
            tauri::async_runtime::spawn(run_discovery(shared.clone()));
            let schedule_shared = shared.clone();
            tauri::async_runtime::spawn(async move {
                let mut previous = None;
                loop {
                    let now = Local::now();
                    let config = schedule_shared.config.read().await;
                    let off = scheduled_screen_off(&*config, &now);
                    drop(config);
                    if previous.is_some_and(|old| old != off) {
                        let message = serde_json::json!({ "kind": "screen", "screenOff": off, "screenAt": now.timestamp_millis() }).to_string();
                        schedule_shared.notification_delivery.send_all(&message).await;
                    }
                    previous = Some(off);
                    tokio::time::sleep(Duration::from_secs(5)).await;
                }
            });
            let notification_shared = shared.clone();
            tauri::async_runtime::spawn(async move {
                let mut changes = notifications::NotificationChanges::default();
                let mut previous_settings: Option<notifications::NotificationSettings> = None;
                loop {
                    let settings = notification_shared.notifications.read().await.clone();
                    if previous_settings.as_ref().is_none_or(|previous| previous != &settings) {
                        changes.reset();
                        previous_settings = Some(settings.clone());
                    }
                    if settings.enabled && notifications::access() == "allowed" {
                        match tokio::task::spawn_blocking(move || notifications::read(&settings)).await {
                            Ok(Ok(current)) => {
                                for event in changes.accept(current) {
                                    if let Ok(message) = serde_json::to_string(&event) {
                                        notification_shared.notification_delivery.send_all(&message).await;
                                    }
                                }
                            }
                            Ok(Err(error)) => { log::warn!("Notification listener: {error}"); changes.reset(); }
                            Err(error) => { log::warn!("Notification worker: {error}"); changes.reset(); }
                        }
                    } else {
                        changes.reset();
                    }
                    tokio::time::sleep(Duration::from_millis(1200)).await;
                }
            });
            tauri::async_runtime::spawn(async move {
                loop {
                    let result = media::read_track().await;
                    let (next, media_status) = match result {
                        Ok((track, source, message)) => (track, MediaStatus { source: source.into(), message }),
                        Err(error) => (Track::default(), MediaStatus { source: "none".into(), message: Some(error) }),
                    };
                    let shared = app_handle.state::<Arc<Shared>>();
                    let previous = shared.track.read().await.clone();
                    let media_changed = *shared.media_status.read().await != media_status;
                    if media_changed { *shared.media_status.write().await = media_status; }
                    if previous != next {
                        let artwork_changed = previous.artwork != next.artwork;
                        *shared.track.write().await = next;
                        if !media_changed { publish_track(&shared, &app_handle, artwork_changed).await; }
                    }
                    if media_changed { publish(&shared, &app_handle).await; }
                    tokio::time::sleep(Duration::from_millis(900)).await;
                }
            });
            if !background::is_background_launch(&std::env::args().collect::<Vec<_>>()) {
                background::show_main_window(app.handle());
            }
            Ok(())
        })
        .on_window_event(background::handle_window_event)
        .invoke_handler(tauri::generate_handler![
            get_pairing,
            rotate_pairing,
            get_snapshot,
            get_client_count,
            get_autostart,
            set_autostart,
            get_notification_status,
            request_notification_access,
            set_notification_settings,
            send_test_notification,
            get_spotify_status,
            get_media_sessions,
            set_media_session,
            connect_spotify,
            disconnect_spotify,
            open_spotify_developer_dashboard,
            control,
            set_accent,
            set_dock_config,
            set_language,
            search_locations,
            trigger_deck_button
        ])
        .run(tauri::generate_context!())
        .expect("error while running SpotDock desktop");
}
