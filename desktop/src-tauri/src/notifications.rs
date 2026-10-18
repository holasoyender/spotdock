//! Windows notification listener and the small, opt-in LAN payload sent to the dock.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct NotificationSettings {
    pub enabled: bool,
    pub discord: bool,
    pub whatsapp: bool,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            discord: true,
            whatsapp: true,
        }
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationEvent {
    pub kind: &'static str,
    pub id: String,
    pub app: String,
    pub sender: String,
    pub body: String,
    pub image: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationStatus {
    pub access: &'static str,
    pub settings: NotificationSettings,
}

#[derive(Clone)]
pub struct ObservedNotification {
    pub key: String,
    pub event: NotificationEvent,
}

/// Keeps only the currently visible Windows toasts. A changed message under the same
/// Windows ID is new; a toast already present when mirroring starts is just baseline.
#[derive(Default)]
pub struct NotificationChanges {
    previous: Option<HashSet<String>>,
}

impl NotificationChanges {
    pub fn reset(&mut self) {
        self.previous = None;
    }

    pub fn accept(&mut self, current: Vec<ObservedNotification>) -> Vec<NotificationEvent> {
        let keys: HashSet<_> = current.iter().map(|item| item.key.clone()).collect();
        let fresh = self.previous.as_ref().map_or_else(Vec::new, |previous| {
            current
                .into_iter()
                .filter(|item| !previous.contains(&item.key))
                .map(|item| item.event)
                .collect()
        });
        self.previous = Some(keys);
        fresh
    }
}

#[cfg(test)]
mod change_tests {
    use super::*;

    fn item(key: &str) -> ObservedNotification {
        ObservedNotification {
            key: key.into(),
            event: NotificationEvent {
                kind: "notification",
                id: key.into(),
                app: "discord".into(),
                sender: "Alex".into(),
                body: key.into(),
                image: None,
            },
        }
    }

    #[test]
    fn only_new_or_changed_toasts_are_forwarded() {
        let mut changes = NotificationChanges::default();
        assert!(changes.accept(vec![item("old")]).is_empty());
        assert!(changes.accept(vec![item("old")]).is_empty());
        assert_eq!(changes.accept(vec![item("old"), item("new")]).len(), 1);
        changes.reset();
        assert!(changes.accept(vec![item("new")]).is_empty());
    }
}

#[cfg(target_os = "windows")]
mod windows_listener {
    use super::*;
    use base64::{Engine, engine::general_purpose::STANDARD};
    use windows::{
        ApplicationModel::{AppDisplayInfo, Package},
        Foundation::Size,
        Storage::Streams::DataReader,
        UI::Notifications::Management::{
            UserNotificationListener, UserNotificationListenerAccessStatus,
        },
        UI::Notifications::{KnownNotificationBindings, NotificationKinds, UserNotification},
        core::HSTRING,
    };

    fn access_name(status: UserNotificationListenerAccessStatus) -> &'static str {
        match status {
            UserNotificationListenerAccessStatus::Allowed => "allowed",
            UserNotificationListenerAccessStatus::Denied => "denied",
            _ => "unspecified",
        }
    }

    pub fn access() -> &'static str {
        if Package::Current().is_err() {
            return "unpackaged";
        }
        UserNotificationListener::Current()
            .and_then(|listener| listener.GetAccessStatus())
            .map(access_name)
            .unwrap_or("unavailable")
    }

    pub async fn request_access(app: tauri::AppHandle) -> Result<&'static str, String> {
        if Package::Current().is_err() {
            return Ok("unpackaged");
        }
        let (send, receive) = tokio::sync::oneshot::channel();
        app.run_on_main_thread(move || {
            let operation = UserNotificationListener::Current()
                .and_then(|listener| listener.RequestAccessAsync())
                .map_err(|error| error.to_string());
            let _ = send.send(operation);
        })
        .map_err(|error| error.to_string())?;
        let operation = receive.await.map_err(|error| error.to_string())??;
        tokio::task::spawn_blocking(move || {
            operation
                .join()
                .map(|_| access())
                .map_err(|error| error.to_string())
        })
        .await
        .map_err(|error| error.to_string())?
    }

    fn text_and_attribution(notification: &UserNotification) -> (Vec<String>, String) {
        let mut text = Vec::new();
        let mut attribution = String::new();
        let binding = notification
            .Notification()
            .ok()
            .and_then(|item| item.Visual().ok())
            .and_then(|visual| {
                visual
                    .GetBinding(&KnownNotificationBindings::ToastGeneric().ok()?)
                    .ok()
            });
        if let Some(binding) = binding {
            if let Ok(elements) = binding.GetTextElements() {
                for index in 0..elements.Size().unwrap_or(0).min(8) {
                    if let Ok(element) = elements.GetAt(index) {
                        let value = element
                            .Text()
                            .map(|value| value.to_string())
                            .unwrap_or_default();
                        let placement = element
                            .Hints()
                            .ok()
                            .and_then(|hints| hints.Lookup(&HSTRING::from("placement")).ok())
                            .map(|value| value.to_string());
                        if placement.as_deref() == Some("attribution") {
                            attribution = value;
                        } else if !value.trim().is_empty() {
                            text.push(value);
                        }
                    }
                }
            }
        }
        if attribution.is_empty()
            && text.len() > 2
            && text.last().is_some_and(|last| browser_host(last).is_some())
        {
            attribution = text.pop().unwrap_or_default();
        }
        (text, attribution)
    }

    fn browser_host(value: &str) -> Option<String> {
        let url = reqwest::Url::parse(value)
            .or_else(|_| reqwest::Url::parse(&format!("https://{value}")))
            .ok()?;
        let host = url.host_str()?.to_ascii_lowercase();
        if host == "web.whatsapp.com" || host == "discord.com" || host.ends_with(".discord.com") {
            Some(host)
        } else {
            None
        }
    }

    fn source(app_id: &str, app_name: &str, attribution: &str) -> Option<&'static str> {
        let identity = format!("{app_id} {app_name}").to_ascii_lowercase();
        let host = browser_host(attribution).unwrap_or_default();
        if host == "web.whatsapp.com" || identity.contains("whatsapp") {
            Some("whatsapp")
        } else if (host == "discord.com" || host.ends_with(".discord.com"))
            || identity.contains("discord")
        {
            Some("discord")
        } else {
            None
        }
    }

    fn app_logo(display: &AppDisplayInfo) -> Option<String> {
        let reference = display
            .GetLogo(Size {
                Width: 48.0,
                Height: 48.0,
            })
            .ok()?;
        let stream = reference.OpenReadAsync().ok()?.join().ok()?;
        let size = stream.Size().ok()?;
        if size == 0 || size > 128 * 1024 {
            return None;
        }
        let reader = DataReader::CreateDataReader(&stream.GetInputStreamAt(0).ok()?).ok()?;
        let count = reader.LoadAsync(size as u32).ok()?.join().ok()?;
        let mut bytes = vec![0; count as usize];
        reader.ReadBytes(&mut bytes).ok()?;
        let mime = if bytes.starts_with(&[0x89, b'P', b'N', b'G']) {
            "image/png"
        } else if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
            "image/jpeg"
        } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
            "image/webp"
        } else {
            return None;
        };
        Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
    }

    fn sender_and_body(lines: &[String], app: &str) -> Option<(String, String)> {
        let first = lines.first()?.trim();
        let mut sender = first.to_string();
        let mut body_lines = lines.iter().skip(1).map(String::as_str).collect::<Vec<_>>();
        if (first.eq_ignore_ascii_case("whatsapp")
            || first.eq_ignore_ascii_case("whatsapp web")
            || first.eq_ignore_ascii_case("discord"))
            && !body_lines.is_empty()
        {
            if let Some((name, message)) = [": ", " — ", " – "]
                .iter()
                .find_map(|separator| body_lines[0].split_once(separator))
            {
                if !name.trim().is_empty() && !message.trim().is_empty() {
                    sender = name.trim().into();
                    body_lines[0] = message;
                }
            }
        }
        let body = body_lines.join("\n");
        let sender = sender.chars().take(160).collect::<String>();
        let body = body.trim().chars().take(1200).collect::<String>();
        if sender.is_empty() || body.is_empty() || !["discord", "whatsapp"].contains(&app) {
            None
        } else {
            Some((sender, body))
        }
    }

    fn observed(
        notification: UserNotification,
        settings: &NotificationSettings,
    ) -> Option<ObservedNotification> {
        let app_info = notification.AppInfo().ok()?;
        let app_id = app_info.AppUserModelId().ok()?.to_string();
        let display = app_info.DisplayInfo().ok()?;
        let app_name = display.DisplayName().ok()?.to_string();
        let (lines, attribution) = text_and_attribution(&notification);
        let app = source(&app_id, &app_name, &attribution)?;
        if (app == "discord" && !settings.discord) || (app == "whatsapp" && !settings.whatsapp) {
            return None;
        }
        let (sender, body) = sender_and_body(&lines, app)?;
        let key = format!("{}:{}:{}:{}", app_id, notification.Id().ok()?, sender, body);
        Some(ObservedNotification {
            key,
            event: NotificationEvent {
                kind: "notification",
                id: uuid::Uuid::new_v4().to_string(),
                app: app.into(),
                sender,
                body,
                image: app_logo(&display),
            },
        })
    }

    pub fn read(settings: &NotificationSettings) -> Result<Vec<ObservedNotification>, String> {
        let listener = UserNotificationListener::Current().map_err(|error| error.to_string())?;
        if listener
            .GetAccessStatus()
            .map_err(|error| error.to_string())?
            != UserNotificationListenerAccessStatus::Allowed
        {
            return Ok(Vec::new());
        }
        let notifications = listener
            .GetNotificationsAsync(NotificationKinds::Toast)
            .and_then(|operation| operation.join())
            .map_err(|error| error.to_string())?;
        let mut result = Vec::new();
        for index in 0..notifications
            .Size()
            .map_err(|error| error.to_string())?
            .min(200)
        {
            if let Ok(notification) = notifications.GetAt(index) {
                if let Some(item) = observed(notification, settings) {
                    result.push(item);
                }
            }
        }
        Ok(result)
    }

    #[cfg(test)]
    mod tests {
        use super::{sender_and_body, source};
        #[test]
        fn classifies_native_and_browser_notifications() {
            assert_eq!(source("Discord.Desktop", "Discord", ""), Some("discord"));
            assert_eq!(
                source("Chrome", "Google Chrome", "https://web.whatsapp.com"),
                Some("whatsapp")
            );
            assert_eq!(
                source("Firefox", "Firefox", "https://discord.com"),
                Some("discord")
            );
            assert_eq!(source("Chrome", "Chrome", "https://other.example"), None);
        }

        #[test]
        fn extracts_sender_from_branded_browser_toast() {
            let lines = vec!["WhatsApp".into(), "Lucía: Nos vemos luego".into()];
            assert_eq!(
                sender_and_body(&lines, "whatsapp"),
                Some(("Lucía".into(), "Nos vemos luego".into()))
            );
        }
    }
}

#[cfg(target_os = "windows")]
pub use windows_listener::{access, read, request_access};

#[cfg(not(target_os = "windows"))]
pub fn access() -> &'static str {
    "unavailable"
}

#[cfg(not(target_os = "windows"))]
pub async fn request_access(_: tauri::AppHandle) -> Result<&'static str, String> {
    Ok("unavailable")
}

#[cfg(not(target_os = "windows"))]
pub fn read(_: &NotificationSettings) -> Result<Vec<ObservedNotification>, String> {
    Ok(Vec::new())
}
