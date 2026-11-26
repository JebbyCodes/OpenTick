# Keyboard shortcuts (0.9.1)

Every keyboard shortcut in OpenTick is an **action** with a default key. You can change the key, add more keys to an action, give an action no key at all, or bring the default back. The choices sync to your other devices like the rest of your data.

Settings → Keyboard lists every action, grouped (Navigation, Tasks, Notes, Calendar, Habits, Projects, General, and *Pack & custom sections*). Next to each is **Set** / **Add** and, once you have changed it, **Default**.

## What a key can be

| Kind | Example | Notes |
| --- | --- | --- |
| One key | `n`, `?`, `F2` | Does nothing while you type in a text field, so typing is never interrupted. |
| A chord | `Ctrl+Shift+K` | `Ctrl` is `Cmd` on a Mac (written `Mod` in the stored form). Chords with a modifier work in text fields only for actions made for it (search, command palette, settings). |
| A sequence | `g` then `t` | Up to three steps, each within 1.5 s of the last. Never starts while typing. A sequence cannot start with Esc. |

Letters are case-insensitive (`Shift+N` is a different key from `n`, as `Shift` is part of the key). `Shift` is ignored for symbols such as `?` and `/`, because the keyboard layout decides whether they need it.

An action can have up to six keys.

### Recording a key

* **With the mouse:** press **Set**/**Add**, then press the keys. Press several one after another to make a sequence. After a moment the verdict appears (free, taken, or kept by something else), with suggestions if it is not free.
* **With the keyboard:** pressing **Set**/**Add** with Enter or Space does *not* capture the keyboard (so Tab still reaches the buttons). Press **Record keys** to start capturing, or type the shortcut in the box (`Ctrl+Shift+K`, `g then t`, `Option+P`) and press Enter.
* **Esc** always leaves the recorder, and only the recorder (it never closes Settings while you are choosing a key).
* *Only on this computer* stores the choice for this kind of computer only (macOS, Windows or Linux); the others keep what they had.

A web browser keeps a few keys for itself (for example `Ctrl+T`) and never gives them to a page, so they cannot be recorded; type them in to see the explanation.

## What OpenTick checks before it takes a key

Six kinds of conflict are checked, each with its own wording:

1. **Another action** has the key. You can take it, if the key is yours to take (see below), or choose another.
2. **The same key somewhere else.** Two actions may share a key when they never work at the same time: *Space* (focus timer) and *Left arrow* (previous week) are in different places. This is information, not a problem. Actions that work in the same place conflict.
   * Prefixes count: if `g` is an action on its own, `g t` could never be reached, and the other way round (pressing `g` would wait for a second key). Both are refused.
3. **Keys OpenTick needs:** Esc, Enter, Tab and Backspace, the clipboard and undo keys, and Bold / Italic / Link in notes. These are **refused**.
4. **Keys the browser keeps.** In a web browser, tab and window keys (`Ctrl+T`, `Ctrl+W`, `Ctrl+1`…`9`, `Alt+Left`…) are **refused**, since a page never receives them; keys a page can take but that switch a browser feature off (`Ctrl+P`, `Ctrl+F`, `F5`…) give a **warning**. In the desktop app both are only a note ("would not work in a web browser"), because the app can use them.
5. **Keys the operating system keeps.** Per system: for example `Alt+Tab` / `Alt+F4` on Windows and Linux, `Cmd+Space` / `Cmd+Q` / `Cmd+Tab` on a Mac (**refused**: the app never sees them); screenshots, workspace switching and similar (**warning**: desktops differ).
6. **Differences between computers and keyboards:** Option+letter types a special character on a Mac; `Ctrl+Alt` is AltGr on many Windows layouts; some symbols need Shift or AltGr depending on the layout; function keys need Fn on many laptops.

The verdict names the other action and says what to do about it.

## What happens to a choice that cannot work

OpenTick never silently reassigns or discards a shortcut.

* A choice that is **not allowed on this computer** (for example `Cmd+Space` chosen on a Windows PC, synced to your Mac) is **kept** and **switched off on that computer only**, with the reason, marked *Needs attention*. It still works where it is allowed.
* A choice that meets **a default key** is switched off; the default keeps its key. (You can free the default by changing that action first.)
* Two choices of yours that meet (for example set on two devices before they synced) are **both** switched off, on both devices, until you pick a new key for one of them. Which one was set first never decides.
* A key written by a **newer version** of OpenTick that this one does not understand is kept as it is (it will work again after you update) and shown as *not understood*.

The Keyboard page shows how many need attention and each one with a *Change it* button.

## Sections of your own and of packs

Every section (your own, or one that came from a pack) gets two actions with no default key: **Go to *Section*** and **New entry in *Section***. A pack that is disabled or removed adds none. If a section is deleted, the keys you chose for it are kept (it may come back); they are simply not shown or used.

Pack *actions* (buttons a pack adds to an entry) are not bindable yet.

## Fixed keys

These cannot be changed (they are shown in the list as *Fixed*): Esc, and Bold / Italic / Link / Indent inside notes. The editor claims `Ctrl+K` first inside a note, so *Search* keeps it everywhere else.

## Export and import

*Export* writes a small JSON file with your choices, without times. *Import* adds them as new choices made now (so they sync); ones that clash or are not allowed here are imported and marked *Needs attention*, never dropped. The file contains no personal data.

## How it syncs

One record per action (`S.shortcuts`, id `sc-…`, the action name hashed), made of three kinds of parts, each with its own time:

* `keys` – the choice for every computer;
* `pf.mac`, `pf.win`, `pf.linux` – a choice for that kind of computer only (`k: null` means "none of its own", so taking a choice back also reaches the other devices).

When two devices changed the same record, **each part is merged on its own** (newest wins, ties settled the same way on both devices), so a Mac choice made on one device and a Windows choice made on another both survive. The merge is commutative, associative and idempotent (tested). Going back to the default deletes the record, and the deletion syncs like any other (180 days of tombstones, as for all data). The records are sealed together with everything else when sync encryption is on.

Not synced: nothing about shortcuts stays on one device; the "show the key on buttons" switch is part of Settings.

## Known limits

* The browser decides which keys a page receives; we cannot see or override the browser's own shortcuts, only warn about the well-known ones. Lists are best effort and cover Chrome / Edge / Firefox / Safari defaults, Windows, macOS and common Linux desktops.
* The editing keys in notes and Esc are fixed.
* Keyboard layouts: shortcuts match the character a key produces, so the same shortcut sits on a different physical key on a different layout.
* No shortcut for creating a habit (there is no such action yet).
