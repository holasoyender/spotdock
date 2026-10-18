use serde::{Deserialize, Serialize};
use std::{
    path::PathBuf,
    sync::{Mutex, OnceLock},
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSession {
    pub source: String,
    pub title: String,
    pub artist: String,
    pub playing: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaSources {
    pub selected: Option<String>,
    pub sessions: Vec<MediaSession>,
}

#[derive(Default, Deserialize, Serialize)]
struct StoredSource {
    source: Option<String>,
}

struct SourceStore {
    path: PathBuf,
    source: Option<String>,
}

static STORE: OnceLock<Mutex<SourceStore>> = OnceLock::new();

pub fn init(path: PathBuf) {
    let source = std::fs::read_to_string(&path)
        .ok()
        .and_then(|contents| serde_json::from_str::<StoredSource>(&contents).ok())
        .and_then(|saved| saved.source);
    let _ = STORE.set(Mutex::new(SourceStore { path, source }));
}

pub fn selected() -> Option<String> {
    STORE.get()?.lock().ok()?.source.clone()
}

pub fn set_selected(source: Option<String>) -> Result<(), String> {
    if source
        .as_ref()
        .is_some_and(|id| id.is_empty() || id.len() > 256)
    {
        return Err("Identificador de sesión multimedia no válido".into());
    }
    let store = STORE.get().ok_or("No se ha preparado el almacenamiento")?;
    let mut store = store.lock().map_err(|e| e.to_string())?;
    save_selection(&mut store, source)
}

/// An automatic discovery must not overwrite a choice made while the media
/// scan was in progress.
pub fn remember(source: String, previous: Option<&str>) -> Result<(), String> {
    if source.is_empty() || source.len() > 256 {
        return Err("Identificador de sesión multimedia no válido".into());
    }
    let store = STORE.get().ok_or("No se ha preparado el almacenamiento")?;
    let mut store = store.lock().map_err(|e| e.to_string())?;
    if store.source.as_deref() != previous {
        return Ok(());
    }
    save_selection(&mut store, Some(source))
}

fn save_selection(store: &mut SourceStore, source: Option<String>) -> Result<(), String> {
    if store.source == source {
        return Ok(());
    }
    if let Some(parent) = store.path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let contents = serde_json::to_vec_pretty(&StoredSource {
        source: source.clone(),
    })
    .map_err(|e| e.to_string())?;
    std::fs::write(&store.path, contents).map_err(|e| e.to_string())?;
    store.source = source;
    Ok(())
}

/// A source ID identifies an app, not an individual track. Only learn an opaque
/// ID when the available sessions give us an unambiguous choice.
pub fn choose(
    sessions: &[MediaSession],
    selected: Option<&str>,
    spotify_running: bool,
) -> Option<usize> {
    let titled = |(_, session): &(usize, &MediaSession)| !session.title.trim().is_empty();
    let candidates: Vec<_> = sessions.iter().enumerate().filter(titled).collect();
    let best = |matches: Vec<(usize, &MediaSession)>| {
        matches
            .iter()
            .find(|(_, session)| session.playing)
            .or_else(|| matches.first())
            .map(|(index, _)| *index)
    };
    if let Some(id) = selected {
        let matches: Vec<_> = candidates
            .iter()
            .copied()
            .filter(|(_, session)| session.source.eq_ignore_ascii_case(id))
            .collect();
        if !matches.is_empty() {
            return best(matches);
        }
    }
    let spotify: Vec<_> = candidates
        .iter()
        .copied()
        .filter(|(_, session)| session.source.to_ascii_lowercase().contains("spotify"))
        .collect();
    if !spotify.is_empty() {
        return best(spotify);
    }
    // Do not replace a remembered Spotify source with an unrelated player just
    // because Spotify is temporarily closed.
    if selected.is_some() {
        return None;
    }
    if spotify_running
        && candidates.len() == 1
        && candidates[0]
            .1
            .source
            .to_ascii_lowercase()
            .starts_with("chromium.")
    {
        return Some(candidates[0].0);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(source: &str, title: &str, playing: bool) -> MediaSession {
        MediaSession {
            source: source.into(),
            title: title.into(),
            artist: String::new(),
            playing,
        }
    }

    #[test]
    fn learns_a_single_opaque_source() {
        let sessions = vec![session("chromium.vkvj5sk7rdptev6t2xc23h4tqa", "Song", true)];
        assert_eq!(choose(&sessions, None, true), Some(0));
        assert_eq!(choose(&sessions, None, false), None);
    }

    #[test]
    fn saved_source_beats_other_active_media_without_relearning_it() {
        let sessions = vec![
            session("chromium.vkvj5sk7rdptev6t2xc23h4tqa", "Song", false),
            session("YouTube", "Video", true),
        ];
        assert_eq!(
            choose(
                &sessions,
                Some("chromium.vkvj5sk7rdptev6t2xc23h4tqa"),
                false
            ),
            Some(0)
        );
        assert_eq!(choose(&sessions, Some("old.spotify.id"), true), None);
    }

    #[test]
    fn ambiguous_sessions_need_a_user_choice() {
        let sessions = vec![
            session("chromium.first", "Song", true),
            session("chromium.second", "Other song", false),
        ];
        assert_eq!(choose(&sessions, None, true), None);
    }

    #[test]
    fn explicit_spotify_source_wins_over_other_players() {
        let sessions = vec![
            session("YouTube", "Video", true),
            session("SpotifyAB.SpotifyMusic", "Song", false),
        ];
        assert_eq!(choose(&sessions, None, false), Some(1));
    }
}
