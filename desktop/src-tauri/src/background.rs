use tauri::{
    App, AppHandle, Manager, WindowEvent,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

pub const BACKGROUND_ARG: &str = "--background";

pub fn is_background_launch(args: &[String]) -> bool {
    args.iter().any(|arg| arg == BACKGROUND_ARG)
}

pub fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn handle_window_event(window: &tauri::Window, event: &WindowEvent) {
    if window.label() != "main" {
        return;
    }

    if let WindowEvent::CloseRequested { api, .. } = event {
        api.prevent_close();
        let _ = window.hide();
    }
}

pub fn create_tray(app: &mut App) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Abrir SpotDock", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Salir de SpotDock", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quit])?;

    TrayIconBuilder::new()
        .icon(
            app.default_window_icon()
                .expect("SpotDock has a configured application icon")
                .clone(),
        )
        .tooltip("SpotDock")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main_window(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::is_background_launch;

    #[test]
    fn only_the_autostart_argument_hides_the_window() {
        assert!(!is_background_launch(&["spotdock.exe".into()]));
        assert!(is_background_launch(&[
            "spotdock.exe".into(),
            "--background".into(),
        ]));
        assert!(!is_background_launch(&[
            "spotdock.exe".into(),
            "--background-other".into(),
        ]));
    }
}
