//! Links from other apps (opentick://…), the door of the OpenTick Bridge (docs/INTEGRATION.md).
//!
//! This side only receives a link and hands it to the page; it decides nothing. The page checks that the Bridge is switched on, that the
//! app is paired and what it may do, and answers the other app itself through the link's x-success / x-error address.
//!   * Windows and Linux: the operating system starts OpenTick with the link as an argument. A copy that finds another running passes the
//!     link to it through the one-copy socket (see bg.rs) and exits.
//!   * macOS and iOS: the system gives the running app the link (RunEvent::Opened, see lib.rs).
//!   * A link that arrives before the page has started is kept, and handed over by `link_take`.
//! Only our own scheme and a sane length are accepted. Only the standard library and Tauri are used. Nothing is sent anywhere.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, State};

pub const MAX_LEN: usize = 8000;
const MAX_KEPT: usize = 20;

#[derive(Default)]
pub struct Pending {
    list: Mutex<Vec<String>>,
    ready: AtomicBool,
}

/// Only opentick: links, of a sane length, with no control characters.
pub fn accept(url: &str) -> bool {
    let u = url.trim();
    u.len() > 9 && u.len() <= MAX_LEN && u.get(..9).map_or(false, |p| p.eq_ignore_ascii_case("opentick:")) && !u.chars().any(|c| c.is_control())
}

/// Hands a link to the page (now if it is running, otherwise when it asks) and brings the window forward on desktop.
pub fn push(app: &AppHandle, state: &Pending, url: &str) {
    if !accept(url) {
        return;
    }
    let url = url.trim().to_string();
    if state.ready.load(Ordering::SeqCst) {
        let _ = app.emit("opentick-link", url);
    } else if let Ok(mut g) = state.list.lock() {
        g.push(url);
        if g.len() > MAX_KEPT {
            g.remove(0);
        }
    }
    #[cfg(desktop)]
    crate::bg::show_main(app);
}

/// Links given on the command line when OpenTick was started (Windows, Linux).
pub fn from_args(app: &AppHandle, state: &Pending) {
    for a in std::env::args().skip(1) {
        push(app, state, &a);
    }
}

/// The page calls this once it can listen; from then on links arrive as the "opentick-link" event.
#[tauri::command]
pub fn link_take(state: State<'_, Pending>) -> Vec<String> {
    state.ready.store(true, Ordering::SeqCst);
    state.list.lock().map(|mut g| std::mem::take(&mut *g)).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::accept;
    #[test]
    fn accepts_only_our_links() {
        assert!(accept("opentick://x-callback-url/tasks.list?app=a.b"));
        assert!(accept("  OPENTICK:tasks.list  "));
        assert!(!accept("https://example.com"));
        assert!(!accept("javascript:alert(1)"));
        assert!(!accept("opentick:"));
        assert!(!accept("opentick://a\nb"));
        assert!(!accept("é€é€é€é€é€")); // multi-byte text near the start never panics
        assert!(!accept(&format!("opentick://{}", "a".repeat(9000))));
        assert!(!accept("--background"));
    }
}
