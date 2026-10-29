//! OpenTick's desktop background service (Windows, macOS, Linux).
//!
//! The web page hands over a plan (`bg_set`): the next 14 days of reminders and the next 3 days of lessons, as JSON. This side keeps:
//!   * a tray icon whose menu shows the lesson you are in, the next one and the whole day (the room is its title where the system
//!     allows it, otherwise its tooltip),
//!   * "close to tray": closing the window hides it, and reminders keep coming,
//!   * reminders shown while the window is hidden (while it is open the page shows its own, so nothing appears twice),
//!   * "start when I sign in" (a registry Run key, a LaunchAgent or an XDG autostart entry), starting hidden with `--background`,
//!   * one running copy: starting OpenTick again brings the existing window forward.
//! Only the standard library, serde_json and Tauri are used. Nothing is sent anywhere.

use std::collections::HashSet;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::Value;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_notification::NotificationExt;

const TRAY_ID: &str = "opentick";
const SINGLETON_PORT: u16 = 47931;

#[derive(Default)]
struct Inner {
    plan: Option<Value>,
    done: HashSet<String>,
    fired: Vec<String>,
    tray_on: bool,
    close: bool,
    label: String,
    autostart: Option<bool>,
    ticker: bool,
}

#[derive(Default)]
pub struct Bg {
    st: Mutex<Inner>,
}

fn now_ms() -> f64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as f64).unwrap_or(0.0)
}

fn num(v: &Value, k: &str) -> f64 {
    v.get(k).and_then(|x| x.as_f64()).unwrap_or(0.0)
}

fn text(v: &Value, k: &str) -> String {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string()
}

fn flag(plan: &Value, k: &str, default: bool) -> bool {
    plan.get("cfg").and_then(|c| c.get(k)).and_then(|x| x.as_bool()).unwrap_or(default)
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn window_hidden(app: &AppHandle) -> bool {
    match app.get_webview_window("main") {
        Some(w) => !w.is_visible().unwrap_or(true) || w.is_minimized().unwrap_or(false),
        None => true,
    }
}

/* ---------------- the lesson lines ---------------- */

struct Lsn {
    a: f64,
    b: f64,
    tm: String,
    n: String,
    r: String,
    te: String,
}

fn lessons_today(plan: &Value, now: f64) -> Vec<Lsn> {
    let mut out = Vec::new();
    let days = match plan.get("tl").and_then(|t| t.as_array()) {
        Some(d) => d,
        None => return out,
    };
    // the day that holds "now": the last one that started before it
    let day = days.iter().filter(|d| num(d, "t0") <= now).last();
    if let Some(d) = day {
        if let Some(items) = d.get("items").and_then(|i| i.as_array()) {
            for it in items {
                out.push(Lsn { a: num(it, "as"), b: num(it, "bs"), tm: text(it, "tm"), n: text(it, "n"), r: text(it, "r"), te: text(it, "te") });
            }
        }
    }
    out
}

fn next_after(plan: &Value, now: f64) -> Option<Lsn> {
    let days = plan.get("tl")?.as_array()?;
    let mut best: Option<Lsn> = None;
    for d in days {
        if let Some(items) = d.get("items").and_then(|i| i.as_array()) {
            for it in items {
                let a = num(it, "as");
                if a > now && best.as_ref().map(|b| a < b.a).unwrap_or(true) {
                    best = Some(Lsn { a, b: num(it, "bs"), tm: text(it, "tm"), n: text(it, "n"), r: text(it, "r"), te: text(it, "te") });
                }
            }
        }
    }
    best
}

fn describe(l: &Lsn) -> String {
    let mut s = format!("{}  {}", l.tm, l.n);
    if !l.r.is_empty() {
        s.push_str(&format!(" · {}", l.r));
    }
    if !l.te.is_empty() {
        s.push_str(&format!(" · {}", l.te));
    }
    s
}

/// Rebuilds the tray menu when the current lesson changes.
fn refresh_tray(app: &AppHandle, inner: &mut Inner) {
    if !inner.tray_on {
        return;
    }
    let plan = match inner.plan.as_ref() {
        Some(p) => p,
        None => return,
    };
    let now = now_ms();
    let today = lessons_today(plan, now);
    let cur = today.iter().find(|l| l.a <= now && now < l.b);
    let nxt = next_after(plan, now);
    let locked = plan.get("locked").and_then(|x| x.as_bool()).unwrap_or(false);

    let mut lines: Vec<String> = Vec::new();
    let mut tip = String::from("OpenTick");
    let mut title = String::new();
    if let Some(c) = cur {
        lines.push(format!("Now  ·  {}", describe(c)));
        tip = format!("Now: {}{}", c.n, if c.r.is_empty() { String::new() } else { format!(" · {}", c.r) });
        title = c.r.clone();
    }
    if let Some(n) = nxt.as_ref() {
        lines.push(format!("Next  ·  {}", describe(n)));
        if cur.is_none() {
            tip = format!("Next: {}{}", n.n, if n.r.is_empty() { String::new() } else { format!(" · {}", n.r) });
            title = n.r.clone();
        }
    }
    if cur.is_none() && nxt.is_none() {
        lines.push(if locked { "Timetable hidden while encryption is on".to_string() } else { "No lessons coming up".to_string() });
    }
    let sig = format!("{}|{}|{}", lines.join("/"), today.len(), today.iter().map(|l| l.a as i64).sum::<i64>());
    if sig == inner.label {
        return;
    }
    inner.label = sig;

    let tray = match app.tray_by_id(TRAY_ID) {
        Some(t) => t,
        None => return,
    };
    let build = || -> tauri::Result<Menu<tauri::Wry>> {
        let menu = Menu::new(app)?;
        for l in &lines {
            menu.append(&MenuItem::new(app, l, false, None::<&str>)?)?;
        }
        if !today.is_empty() {
            menu.append(&PredefinedMenuItem::separator(app)?)?;
            menu.append(&MenuItem::new(app, "Today", false, None::<&str>)?)?;
            for l in &today {
                let mark = if l.a <= now && now < l.b { "▶ " } else { "    " };
                menu.append(&MenuItem::new(app, format!("{}{}", mark, describe(l)), false, None::<&str>)?)?;
            }
        }
        menu.append(&PredefinedMenuItem::separator(app)?)?;
        menu.append(&MenuItem::with_id(app, "open", "Open OpenTick", true, None::<&str>)?)?;
        menu.append(&MenuItem::with_id(app, "quit", "Quit OpenTick", true, None::<&str>)?)?;
        Ok(menu)
    };
    if let Ok(menu) = build() {
        let _ = tray.set_menu(Some(menu));
    }
    let _ = tray.set_tooltip(Some(tip));
    let _ = tray.set_title(if title.is_empty() { None::<String> } else { Some(title) }); // macOS shows it next to the icon
}

fn ensure_tray(app: &AppHandle, inner: &mut Inner, want: bool) {
    if want && !inner.tray_on {
        let menu = match Menu::new(app).and_then(|m| {
            m.append(&MenuItem::with_id(app, "open", "Open OpenTick", true, None::<&str>)?)?;
            m.append(&MenuItem::with_id(app, "quit", "Quit OpenTick", true, None::<&str>)?)?;
            Ok(m)
        }) {
            Ok(m) => m,
            Err(_) => return,
        };
        let mut b = TrayIconBuilder::with_id(TRAY_ID)
            .tooltip("OpenTick")
            .menu(&menu)
            .show_menu_on_left_click(false)
            .on_menu_event(|app, ev| match ev.id().as_ref() {
                "open" => show_main(app),
                "quit" => app.exit(0),
                _ => {}
            })
            .on_tray_icon_event(|tray, ev| {
                if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
                    show_main(tray.app_handle());
                }
            });
        if let Some(icon) = app.default_window_icon() {
            b = b.icon(icon.clone());
        }
        inner.tray_on = b.build(app).is_ok();
        inner.label.clear();
    } else if !want && inner.tray_on {
        let _ = app.remove_tray_by_id(TRAY_ID);
        inner.tray_on = false;
    }
}

/* ---------------- reminders while the window is hidden ---------------- */

fn tick(app: &AppHandle) {
    let state = app.state::<Bg>();
    let mut to_show: Vec<(String, String)> = Vec::new();
    {
        let mut g = match state.st.lock() {
            Ok(g) => g,
            Err(_) => return,
        };
        let now = now_ms();
        let hidden = window_hidden(app);
        let on = g.plan.as_ref().map(|p| flag(p, "on", true)).unwrap_or(false);
        if on && hidden {
            let mut hits: Vec<(String, String, String)> = Vec::new();
            if let Some(rem) = g.plan.as_ref().and_then(|p| p.get("rem")).and_then(|r| r.as_array()) {
                for r in rem {
                    let k = text(r, "k");
                    if g.done.contains(&k) || num(r, "at") > now || num(r, "exp") < now {
                        continue;
                    }
                    hits.push((k, text(r, "t"), text(r, "b")));
                }
            }
            for (k, t, b) in hits {
                g.done.insert(k.clone());
                g.fired.push(k);
                to_show.push((t, b));
            }
        }
        if g.done.len() > 800 {
            g.done.clear();
        }
        refresh_tray(app, &mut g);
    }
    for (t, b) in to_show {
        let _ = app.notification().builder().title(t).body(b).show();
    }
}

/* ---------------- commands the page calls ---------------- */

#[tauri::command]
pub fn bg_set(app: AppHandle, state: State<'_, Bg>, plan: String) -> Result<(), String> {
    let v: Value = serde_json::from_str(&plan).map_err(|e| e.to_string())?;
    let on = flag(&v, "on", true);
    let want_tray = on && (flag(&v, "tray", true) || flag(&v, "autostart", false) || flag(&v, "close", false));
    let autostart = on && flag(&v, "autostart", false);
    let close = on && flag(&v, "close", false);
    let spawn;
    {
        let mut g = state.st.lock().map_err(|_| "busy".to_string())?;
        g.plan = Some(v);
        ensure_tray(&app, &mut g, want_tray);
        g.close = close && g.tray_on; // never hide the window when there is no tray to bring it back from
        if g.autostart != Some(autostart) {
            let _ = set_autostart(autostart);
            g.autostart = Some(autostart);
        }
        g.label.clear();
        spawn = !g.ticker;
        g.ticker = true;
    }
    if spawn {
        let handle = app.clone();
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(15));
            tick(&handle);
        });
    }
    tick(&app);
    Ok(())
}

/// The reminders shown here, so the page can mark them as shown.
#[tauri::command]
pub fn bg_take_fired(state: State<'_, Bg>) -> Vec<String> {
    match state.st.lock() {
        Ok(mut g) => std::mem::take(&mut g.fired),
        Err(_) => Vec::new(),
    }
}

/* ---------------- window and process ---------------- */

pub fn on_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        if window.label() != "main" {
            return;
        }
        let state = window.app_handle().state::<Bg>();
        let close = state.st.lock().map(|g| g.close && g.tray_on).unwrap_or(false);
        if close {
            api.prevent_close();
            let _ = window.hide();
        }
    }
}

/// Runs once at start-up: hide the window when started with --background, and keep a single copy running.
pub fn setup(app: &AppHandle) {
    if std::env::args().any(|a| a == "--background") {
        if let Some(w) = app.get_webview_window("main") {
            let _ = w.hide();
        }
    }
    singleton(app.clone());
}

fn singleton(app: AppHandle) {
    match TcpListener::bind(("127.0.0.1", SINGLETON_PORT)) {
        Ok(listener) => {
            std::thread::spawn(move || {
                for stream in listener.incoming().flatten() {
                    let mut s = stream;
                    let _ = s.set_read_timeout(Some(Duration::from_millis(500)));
                    let mut buf = [0u8; 32];
                    let n = s.read(&mut buf).unwrap_or(0);
                    if &buf[..n] == b"opentick-show\n" {
                        let _ = s.write_all(b"opentick-ok\n");
                        show_main(&app);
                    }
                }
            });
        }
        Err(_) => {
            // the port is taken: ask whoever has it to show its window. If it answers like OpenTick, this copy is not needed.
            if let Ok(mut s) = TcpStream::connect_timeout(&std::net::SocketAddr::from(([127, 0, 0, 1], SINGLETON_PORT)), Duration::from_millis(400)) {
                let _ = s.set_read_timeout(Some(Duration::from_millis(600)));
                if s.write_all(b"opentick-show\n").is_ok() {
                    let mut buf = [0u8; 16];
                    let n = s.read(&mut buf).unwrap_or(0);
                    if &buf[..n] == b"opentick-ok\n" {
                        std::process::exit(0);
                    }
                }
            }
        }
    }
}

/* ---------------- start when I sign in ---------------- */

fn exe_path() -> Result<String, String> {
    if let Ok(a) = std::env::var("APPIMAGE") {
        if !a.is_empty() {
            return Ok(a); // an AppImage runs from a temporary mount; the file itself is what to start
        }
    }
    std::env::current_exe().map(|p| p.to_string_lossy().to_string()).map_err(|e| e.to_string())
}

#[cfg(target_os = "linux")]
fn set_autostart(on: bool) -> Result<(), String> {
    let base = match std::env::var("XDG_CONFIG_HOME") {
        Ok(x) if !x.is_empty() => std::path::PathBuf::from(x),
        _ => std::path::PathBuf::from(std::env::var("HOME").map_err(|e| e.to_string())?).join(".config"),
    };
    let dir = base.join("autostart");
    let file = dir.join("opentick.desktop");
    if on {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let body = format!(
            "[Desktop Entry]\nType=Application\nName=OpenTick\nComment=Reminders and timetable in the background\nExec=\"{}\" --background\nTerminal=false\nX-GNOME-Autostart-enabled=true\n",
            exe_path()?
        );
        std::fs::write(&file, body).map_err(|e| e.to_string())
    } else {
        let _ = std::fs::remove_file(&file);
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn set_autostart(on: bool) -> Result<(), String> {
    let home = std::env::var("HOME").map_err(|e| e.to_string())?;
    let dir = std::path::PathBuf::from(home).join("Library").join("LaunchAgents");
    let file = dir.join("com.opentick.app.plist");
    if on {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let body = format!(
            "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\"><dict><key>Label</key><string>com.opentick.app</string><key>ProgramArguments</key><array><string>{}</string><string>--background</string></array><key>RunAtLoad</key><true/></dict></plist>\n",
            exe_path()?
        );
        std::fs::write(&file, body).map_err(|e| e.to_string())
    } else {
        let _ = std::fs::remove_file(&file);
        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn set_autostart(on: bool) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const NO_WINDOW: u32 = 0x0800_0000;
    let key = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
    let mut cmd = std::process::Command::new("reg");
    if on {
        let value = format!("\"{}\" --background", exe_path()?);
        cmd.args(["add", key, "/v", "OpenTick", "/t", "REG_SZ", "/d", value.as_str(), "/f"]);
    } else {
        cmd.args(["delete", key, "/v", "OpenTick", "/f"]);
    }
    cmd.creation_flags(NO_WINDOW).output().map(|_| ()).map_err(|e| e.to_string())
}

#[cfg(not(any(target_os = "linux", target_os = "macos", target_os = "windows")))]
fn set_autostart(_on: bool) -> Result<(), String> {
    Ok(())
}
