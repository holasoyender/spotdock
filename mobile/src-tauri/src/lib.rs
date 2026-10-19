#[path = "../../../shared/discovery.rs"]
mod discovery;

use std::{
    net::{IpAddr, Ipv4Addr, UdpSocket},
    time::Duration,
};
#[cfg(target_os = "android")]
use tauri::{
    Manager,
    plugin::{Builder as PluginBuilder, PluginHandle, TauriPlugin},
};
use uuid::Uuid;

#[cfg(target_os = "android")]
struct AlarmPluginHandle(PluginHandle<tauri::Wry>);

#[cfg(target_os = "android")]
#[tauri::command]
fn sync_alarms(
    alarms: serde_json::Value,
    plugin: tauri::State<'_, AlarmPluginHandle>,
) -> Result<serde_json::Value, String> {
    plugin
        .0
        .run_mobile_plugin("sync", serde_json::json!({ "alarms": alarms }))
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn alarm_status(plugin: tauri::State<'_, AlarmPluginHandle>) -> Result<serde_json::Value, String> {
    plugin
        .0
        .run_mobile_plugin("status", ())
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn request_alarm_permission(plugin: tauri::State<'_, AlarmPluginHandle>) -> Result<(), String> {
    plugin
        .0
        .run_mobile_plugin("requestExact", ())
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn request_alarm_full_screen(plugin: tauri::State<'_, AlarmPluginHandle>) -> Result<(), String> {
    plugin
        .0
        .run_mobile_plugin("requestFullScreen", ())
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn request_alarm_notifications(plugin: tauri::State<'_, AlarmPluginHandle>) -> Result<(), String> {
    plugin
        .0
        .run_mobile_plugin("requestNotifications", ())
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "android")]
#[tauri::command]
fn test_local_alarm(
    alarm: serde_json::Value,
    plugin: tauri::State<'_, AlarmPluginHandle>,
) -> Result<(), String> {
    plugin
        .0
        .run_mobile_plugin("test", serde_json::json!({ "alarm": alarm }))
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "android")]
fn alarms_plugin() -> TauriPlugin<tauri::Wry> {
    PluginBuilder::new("alarms")
        .setup(|app, api| {
            let handle = api.register_android_plugin("com.spotdock.mobile", "AlarmPlugin")?;
            app.manage(AlarmPluginHandle(handle));
            Ok(())
        })
        .build()
}

fn same_bytes(left: &str, right: &str) -> bool {
    left.len() == right.len()
        && left
            .bytes()
            .zip(right.bytes())
            .fold(0_u8, |diff, (a, b)| diff | (a ^ b))
            == 0
}

fn discover(token: &str, previous_host: &str) -> Result<Option<String>, String> {
    if token.len() != 32 || !token.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("Clave de emparejamiento no válida".into());
    }
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|err| err.to_string())?;
    socket.set_broadcast(true).map_err(|err| err.to_string())?;
    socket
        .set_read_timeout(Some(Duration::from_millis(1200)))
        .map_err(|err| err.to_string())?;
    let nonce = Uuid::new_v4().simple().to_string();
    let request = format!("{}{nonce}", discovery::REQUEST);
    socket
        .send_to(request.as_bytes(), (Ipv4Addr::BROADCAST, discovery::PORT))
        .map_err(|err| err.to_string())?;
    if let Ok(IpAddr::V4(host)) = previous_host.parse::<IpAddr>() {
        if host.is_private() {
            let mut octets = host.octets();
            octets[3] = 255;
            let _ = socket.send_to(
                request.as_bytes(),
                (Ipv4Addr::from(octets), discovery::PORT),
            );
        }
    }
    let expected = discovery::proof(token, &nonce);
    let mut buffer = [0_u8; 160];
    loop {
        let Ok((length, sender)) = socket.recv_from(&mut buffer) else {
            return Ok(None);
        };
        let Ok(offer) = std::str::from_utf8(&buffer[..length]) else {
            continue;
        };
        let Some(data) = offer.strip_prefix(discovery::OFFER) else {
            continue;
        };
        let Some((reply_nonce, reply_proof)) = data.split_once(':') else {
            continue;
        };
        if !discovery::valid_nonce(reply_nonce)
            || reply_nonce != nonce
            || !same_bytes(reply_proof, &expected)
        {
            continue;
        }
        if let IpAddr::V4(host) = sender.ip() {
            if host.is_private() {
                return Ok(Some(host.to_string()));
            }
        }
    }
}

#[tauri::command]
async fn discover_desktop(token: String, previous_host: String) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || discover(&token, &previous_host))
        .await
        .map_err(|err| err.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(target_os = "android")]
    let builder = builder.plugin(alarms_plugin());
    #[cfg(target_os = "android")]
    let builder = builder.invoke_handler(tauri::generate_handler![
        discover_desktop,
        sync_alarms,
        alarm_status,
        request_alarm_permission,
        request_alarm_full_screen,
        request_alarm_notifications,
        test_local_alarm
    ]);
    #[cfg(not(target_os = "android"))]
    let builder = builder.invoke_handler(tauri::generate_handler![discover_desktop]);
    builder
        .setup(|app| {
            #[cfg(mobile)]
            app.handle().plugin(tauri_plugin_barcode_scanner::init())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SpotDock mobile");
}
