use crate::{Control, Track, media_source, spotify_web};
use std::sync::atomic::{AtomicBool, Ordering};

static PREFER_WEB: AtomicBool = AtomicBool::new(false);

#[cfg(target_os = "windows")]
mod windows_media {
    use super::*;
    use base64::{Engine, engine::general_purpose::STANDARD};
    use std::{
        sync::{Mutex, OnceLock},
        time::{Duration, Instant, SystemTime, UNIX_EPOCH},
    };
    use windows::{
        Media::{
            Control::{
                GlobalSystemMediaTransportControlsSession,
                GlobalSystemMediaTransportControlsSessionManager,
                GlobalSystemMediaTransportControlsSessionPlaybackStatus,
            },
            MediaPlaybackAutoRepeatMode,
        },
        Storage::Streams::DataReader,
        Win32::{
            Foundation::CloseHandle,
            System::Diagnostics::ToolHelp::{
                CreateToolhelp32Snapshot, PROCESSENTRY32W, Process32FirstW, Process32NextW,
                TH32CS_SNAPPROCESS,
            },
        },
    };

    fn spotify_desktop_running() -> bool {
        static CACHE: OnceLock<Mutex<Option<(Instant, bool)>>> = OnceLock::new();
        let cache = CACHE.get_or_init(|| Mutex::new(None));
        let Ok(mut cache) = cache.lock() else {
            return false;
        };
        if let Some((checked_at, running)) = *cache {
            if checked_at.elapsed() < Duration::from_secs(5) {
                return running;
            }
        }
        let running = find_spotify_process();
        *cache = Some((Instant::now(), running));
        running
    }

    fn find_spotify_process() -> bool {
        let Ok(snapshot) = (unsafe { CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0) }) else {
            return false;
        };
        let mut process = PROCESSENTRY32W {
            dwSize: std::mem::size_of::<PROCESSENTRY32W>() as u32,
            ..Default::default()
        };
        let mut running = false;
        if unsafe { Process32FirstW(snapshot, &mut process) }.is_ok() {
            loop {
                let length = process
                    .szExeFile
                    .iter()
                    .position(|unit| *unit == 0)
                    .unwrap_or(process.szExeFile.len());
                if String::from_utf16_lossy(&process.szExeFile[..length])
                    .eq_ignore_ascii_case("Spotify.exe")
                {
                    running = true;
                    break;
                }
                if unsafe { Process32NextW(snapshot, &mut process) }.is_err() {
                    break;
                }
            }
        }
        let _ = unsafe { CloseHandle(snapshot) };
        running
    }

    struct SessionEntry {
        session: GlobalSystemMediaTransportControlsSession,
        details: media_source::MediaSession,
    }

    fn available_sessions(preferred: Option<&str>) -> Result<Vec<SessionEntry>, String> {
        let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
            .map_err(|e| e.to_string())?
            .join()
            .map_err(|e| e.to_string())?;
        let sessions = manager.GetSessions().map_err(|e| e.to_string())?;
        let mut entries = Vec::new();
        for index in 0..sessions.Size().map_err(|e| e.to_string())? {
            let session = sessions.GetAt(index).map_err(|e| e.to_string())?;
            let source = session
                .SourceAppUserModelId()
                .map_err(|e| e.to_string())?
                .to_string();
            let inspect = preferred.is_none_or(|id| source.eq_ignore_ascii_case(id))
                || source.to_ascii_lowercase().contains("spotify");
            let media = if inspect {
                session
                    .TryGetMediaPropertiesAsync()
                    .ok()
                    .and_then(|operation| operation.join().ok())
            } else {
                None
            };
            let details = media_source::MediaSession {
                source,
                title: media
                    .as_ref()
                    .and_then(|media| media.Title().ok())
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
                artist: media
                    .as_ref()
                    .and_then(|media| media.Artist().ok())
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
                playing: inspect
                    && session
                        .GetPlaybackInfo()
                        .ok()
                        .and_then(|info| info.PlaybackStatus().ok())
                        == Some(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing),
            };
            entries.push(SessionEntry { session, details });
        }
        Ok(entries)
    }

    pub fn list_sessions() -> Result<Vec<media_source::MediaSession>, String> {
        Ok(available_sessions(None)?
            .into_iter()
            .map(|entry| entry.details)
            .collect())
    }

    fn selection_error(entries: &[SessionEntry], selected: Option<&str>) -> String {
        if entries.is_empty() {
            return "Windows no muestra ninguna sesión multimedia; comprueba que Spotify esté reproduciendo".into();
        }
        if let Some(id) = selected {
            return if entries
                .iter()
                .any(|entry| entry.details.source.eq_ignore_ascii_case(id))
            {
                "La sesión multimedia de Spotify no contiene una canción".into()
            } else {
                "La sesión multimedia guardada no está disponible; elige la de Spotify en Ajustes"
                    .into()
            };
        }
        let titled = entries
            .iter()
            .filter(|entry| !entry.details.title.trim().is_empty())
            .count();
        match titled {
            0 => "Las sesiones multimedia de Windows no contienen ninguna canción".into(),
            1 => "No se pudo identificar la sesión de Spotify; elígela en Ajustes".into(),
            _ => "Hay varias sesiones multimedia; elige la de Spotify en Ajustes".into(),
        }
    }

    async fn spotify() -> Result<GlobalSystemMediaTransportControlsSession, String> {
        let selected = media_source::selected();
        let entries = available_sessions(selected.as_deref())?;
        let details: Vec<_> = entries.iter().map(|entry| entry.details.clone()).collect();
        let spotify_running =
            selected.is_none() && !entries.is_empty() && spotify_desktop_running();
        let index = media_source::choose(&details, selected.as_deref(), spotify_running)
            .ok_or_else(|| selection_error(&entries, selected.as_deref()))?;
        let entry = &entries[index];
        if !selected
            .as_deref()
            .is_some_and(|id| id.eq_ignore_ascii_case(&entry.details.source))
        {
            if let Err(error) =
                media_source::remember(entry.details.source.clone(), selected.as_deref())
            {
                log::warn!("No se pudo guardar la sesión multimedia: {error}");
            }
        }
        Ok(entry.session.clone())
    }

    pub async fn read_track() -> Result<Track, String> {
        let session = spotify().await?;
        let media = session
            .TryGetMediaPropertiesAsync()
            .map_err(|e| e.to_string())?
            .join()
            .map_err(|e| e.to_string())?;
        let playback = session.GetPlaybackInfo().ok();
        let timeline = session.GetTimelineProperties().ok();
        let repeat = match playback
            .as_ref()
            .and_then(|info| info.AutoRepeatMode().ok())
            .and_then(|value| value.Value().ok())
        {
            Some(MediaPlaybackAutoRepeatMode::Track) => "track",
            Some(MediaPlaybackAutoRepeatMode::List) => "all",
            _ => "off",
        };
        let playing = playback
            .as_ref()
            .and_then(|info| info.PlaybackStatus().ok())
            == Some(GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing);
        let duration_ms = timeline
            .as_ref()
            .and_then(|timeline| timeline.EndTime().ok())
            .map(|time| time.Duration / 10_000)
            .unwrap_or(0);
        let base_position_ms = timeline
            .as_ref()
            .and_then(|timeline| timeline.Position().ok())
            .map(|time| time.Duration / 10_000)
            .unwrap_or(0);
        let elapsed_ms = if playing {
            let updated = timeline
                .as_ref()
                .and_then(|timeline| timeline.LastUpdatedTime().ok())
                .map(|time| time.UniversalTime)
                .unwrap_or(0);
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;
            if updated > 0 {
                (now - (updated / 10_000 - 11_644_473_600_000)).clamp(0, 60_000)
            } else {
                0
            }
        } else {
            0
        };
        let artwork = async {
            let reference = media.Thumbnail().ok()?;
            let stream = reference.OpenReadAsync().ok()?.join().ok()?;
            let size = stream.Size().ok()?.min(2_000_000) as u32;
            let reader = DataReader::CreateDataReader(&stream).ok()?;
            reader.LoadAsync(size).ok()?.join().ok()?;
            let mut bytes = vec![0; size as usize];
            reader.ReadBytes(&mut bytes).ok()?;
            let mime = if bytes.starts_with(b"\x89PNG") {
                "image/png"
            } else if bytes.starts_with(b"GIF8") {
                "image/gif"
            } else if bytes.starts_with(b"RIFF") {
                "image/webp"
            } else {
                "image/jpeg"
            };
            Some(format!("data:{mime};base64,{}", STANDARD.encode(bytes)))
        }
        .await;
        let track = Track {
            title: media.Title().map_err(|e| e.to_string())?.to_string(),
            artist: media
                .Artist()
                .map(|value| value.to_string())
                .unwrap_or_default(),
            album: media
                .AlbumTitle()
                .map(|value| value.to_string())
                .unwrap_or_default(),
            artwork,
            position_ms: (base_position_ms + elapsed_ms).clamp(0, duration_ms.max(0)),
            duration_ms,
            playing,
            shuffle: playback
                .as_ref()
                .and_then(|info| info.IsShuffleActive().ok())
                .and_then(|value| value.Value().ok())
                .unwrap_or(false),
            repeat: repeat.into(),
            available: true,
        };
        if track.title.trim().is_empty() {
            return Err("La sesión multimedia de Spotify no contiene una canción".into());
        }
        Ok(track)
    }

    pub async fn control(action: Control) -> Result<(), String> {
        let session = spotify().await?;
        let operation = match action {
            Control::PlayPause => session.TryTogglePlayPauseAsync(),
            Control::Next => session.TrySkipNextAsync(),
            Control::Previous => session.TrySkipPreviousAsync(),
            Control::Seek { position_ms } => {
                session.TryChangePlaybackPositionAsync(position_ms.max(0).saturating_mul(10_000))
            }
            Control::Shuffle { enabled } => session.TryChangeShuffleActiveAsync(enabled),
            Control::Repeat { mode } => session.TryChangeAutoRepeatModeAsync(match mode.as_str() {
                "track" => MediaPlaybackAutoRepeatMode::Track,
                "all" => MediaPlaybackAutoRepeatMode::List,
                _ => MediaPlaybackAutoRepeatMode::None,
            }),
        }
        .map_err(|e| e.to_string())?;
        if operation.join().map_err(|e| e.to_string())? {
            Ok(())
        } else {
            Err("Spotify no admite esta acción mediante Windows".into())
        }
    }
}

pub fn list_sessions() -> Result<media_source::MediaSources, String> {
    #[cfg(target_os = "windows")]
    let sessions = windows_media::list_sessions()?;
    #[cfg(not(target_os = "windows"))]
    let sessions = Vec::new();
    Ok(media_source::MediaSources {
        selected: media_source::selected(),
        sessions,
    })
}

pub async fn read_track() -> Result<(Track, &'static str, Option<String>), String> {
    #[cfg(target_os = "windows")]
    let local = windows_media::read_track().await;
    #[cfg(not(target_os = "windows"))]
    let local: Result<Track, String> = Err("La integración local requiere Windows".into());
    match local {
        Ok(track) => {
            PREFER_WEB.store(false, Ordering::Relaxed);
            Ok((track, "windows", None))
        }
        Err(windows_error) => match spotify_web::read_track().await {
            Ok(track) => {
                PREFER_WEB.store(true, Ordering::Relaxed);
                Ok((track, "spotify_api", Some(windows_error)))
            }
            Err(api_error) => {
                PREFER_WEB.store(false, Ordering::Relaxed);
                Err(format!(
                    "Windows: {windows_error}. API de Spotify: {api_error}"
                ))
            }
        },
    }
}

pub async fn control(action: Control) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    async fn local(action: Control) -> Result<(), String> {
        windows_media::control(action).await
    }
    #[cfg(not(target_os = "windows"))]
    async fn local(_: Control) -> Result<(), String> {
        Err("Los controles locales requieren Windows".into())
    }
    if PREFER_WEB.load(Ordering::Relaxed) {
        match spotify_web::control(action.clone()).await {
            Ok(()) => Ok(()),
            Err(web_error) => local(action).await.map_err(|local_error| {
                format!("API de Spotify: {web_error}. Windows: {local_error}")
            }),
        }
    } else {
        match local(action.clone()).await {
            Ok(()) => Ok(()),
            Err(local_error) => spotify_web::control(action).await.map_err(|web_error| {
                format!("Windows: {local_error}. API de Spotify: {web_error}")
            }),
        }
    }
}
