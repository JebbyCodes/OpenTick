// Shared entry point: desktop (Windows/macOS/Linux) calls it from main.rs,
// Android/iOS call it through the generated mobile entry point.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // remembers which files the user picked in a dialog (the sync file) across restarts; must come after fs
        .plugin(tauri_plugin_persisted_scope::init())
        // WebDAV requests go through Rust, so servers don't need to allow CORS
        .plugin(tauri_plugin_http::init())
        // opens links from notes in the system browser
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running OpenTick");
}
