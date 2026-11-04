// Shared entry point: desktop (Windows/macOS/Linux) calls it from main.rs,
// Android/iOS call it through the generated mobile entry point.
mod link; // opentick:// links from other apps, handed to the page (the OpenTick Bridge)
#[cfg(desktop)]
mod bg; // the desktop background service: tray, close-to-tray, start at sign-in, reminders while the window is hidden

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // remembers which files the user picked in a dialog (the sync file) across restarts; must come after fs
        .plugin(tauri_plugin_persisted_scope::init())
        // WebDAV requests go through Rust, so servers don't need to allow CORS
        .plugin(tauri_plugin_http::init())
        // opens links from notes in the system browser
        .plugin(tauri_plugin_opener::init());

    let builder = builder.manage(link::Pending::default());

    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![link::link_take]);

    #[cfg(desktop)]
    let builder = builder
        .manage(bg::Bg::default())
        .invoke_handler(tauri::generate_handler![bg::bg_set, bg::bg_take_fired, bg::link_scheme, link::link_take])
        .on_window_event(|window, event| bg::on_window_event(window, event))
        .setup(|app| {
            bg::setup(app.handle());
            Ok(())
        });

    builder
        .build(tauri::generate_context!())
        .expect("error while building OpenTick")
        .run(|app, event| {
            // macOS and iOS hand a link to the running app as an event (Windows and Linux pass it as an argument, see bg.rs)
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = &event {
                use tauri::Manager;
                if let Some(p) = app.try_state::<link::Pending>() {
                    for u in urls {
                        link::push(app, &p, u.as_str());
                    }
                }
            }
            #[cfg(not(any(target_os = "macos", target_os = "ios")))]
            let _ = (app, event);
        });
}
