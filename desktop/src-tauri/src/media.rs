use crate::{Control, Track};

#[cfg(target_os = "windows")]
mod windows_media {
    use super::*;
    use base64::{Engine, engine::general_purpose::STANDARD};
    use std::time::{SystemTime, UNIX_EPOCH};
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
    };

    async fn spotify() -> Result<GlobalSystemMediaTransportControlsSession, String> {
        let manager = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
            .map_err(|e| e.to_string())?
            .join()
            .map_err(|e| e.to_string())?;
        let sessions = manager.GetSessions().map_err(|e| e.to_string())?;
        for index in 0..sessions.Size().map_err(|e| e.to_string())? {
            let session = sessions.GetAt(index).map_err(|e| e.to_string())?;
            let source = session
                .SourceAppUserModelId()
                .map_err(|e| e.to_string())?
                .to_string()
                .to_ascii_lowercase();
            if source.contains("spotify") {
                return Ok(session);
            }
        }
        Err("Spotify no está publicando una sesión multimedia de Windows".into())
    }

    pub async fn read_track() -> Result<Track, String> {
        let session = spotify().await?;
        let media = session
            .TryGetMediaPropertiesAsync()
            .map_err(|e| e.to_string())?
            .join()
            .map_err(|e| e.to_string())?;
        let playback = session.GetPlaybackInfo().map_err(|e| e.to_string())?;
        let timeline = session.GetTimelineProperties().map_err(|e| e.to_string())?;
        let repeat = match playback
            .AutoRepeatMode()
            .ok()
            .and_then(|value| value.Value().ok())
        {
            Some(MediaPlaybackAutoRepeatMode::Track) => "track",
            Some(MediaPlaybackAutoRepeatMode::List) => "all",
            _ => "off",
        };
        let playing = playback.PlaybackStatus().map_err(|e| e.to_string())?
            == GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;
        let duration_ms = timeline.EndTime().map_err(|e| e.to_string())?.Duration / 10_000;
        let base_position_ms = timeline.Position().map_err(|e| e.to_string())?.Duration / 10_000;
        let elapsed_ms = if playing {
            let updated = timeline
                .LastUpdatedTime()
                .map_err(|e| e.to_string())?
                .UniversalTime;
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;
            (now - (updated / 10_000 - 11_644_473_600_000)).clamp(0, 60_000)
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
        Ok(Track {
            title: media.Title().map_err(|e| e.to_string())?.to_string(),
            artist: media.Artist().map_err(|e| e.to_string())?.to_string(),
            album: media.AlbumTitle().map_err(|e| e.to_string())?.to_string(),
            artwork,
            position_ms: (base_position_ms + elapsed_ms).clamp(0, duration_ms.max(0)),
            duration_ms,
            playing,
            shuffle: playback
                .IsShuffleActive()
                .ok()
                .and_then(|value| value.Value().ok())
                .unwrap_or(false),
            repeat: repeat.into(),
            available: true,
        })
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

#[cfg(target_os = "windows")]
pub use windows_media::{control, read_track};

#[cfg(not(target_os = "windows"))]
pub async fn read_track() -> Result<Track, String> {
    Err("La integración con Spotify requiere Windows".into())
}
#[cfg(not(target_os = "windows"))]
pub async fn control(_: Control) -> Result<(), String> {
    Err("La integración con Spotify requiere Windows".into())
}
