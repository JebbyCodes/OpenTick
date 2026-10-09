<div align="center">

# OpenTick

**A TickTick-style task manager that runs everywhere from one codebase.**

Plan, schedule and track your day on the web, your desktop and your phone — without an account, a subscription or a server you don't own.

[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](https://unlicense.org)
[![Platforms](https://img.shields.io/badge/platforms-Web%20·%20Windows%20·%20macOS%20·%20Linux%20·%20Android%20·%20iOS-4d6bfe)](#platforms)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB?logo=tauri&logoColor=white)](https://tauri.app)
[![PWA ready](https://img.shields.io/badge/PWA-installable-5A0FC8)](https://web.dev/progressive-web-apps/)
[![Dependencies](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)](#project-layout)
[![Tests](https://img.shields.io/badge/tests-7%20suites-success)](#testing)
[![Made with AI](https://img.shields.io/badge/generated%20with-AI-8e5cf7)](#a-note-on-ai)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-34b36b)](#contributing)

[Features](#features) · [Platforms](#platforms) · [Quick start](#quick-start) · [Building](#building-from-source) · [Sync](#sync) · [Shortcuts](#keyboard-shortcuts) · [Contributing](#contributing)

</div>

---

> **Project status: early development.** OpenTick works, but it is young and this codebase is AI-generated. Expect rough edges, breaking changes between minor versions, and a few knowingly unfinished areas — see [Known gaps](#known-gaps).

<!--
  SCREENSHOTS
  Drop images in docs/ and uncomment the block below.

  <p align="center">
    <img src="docs/tasks.png" width="32%" alt="Task list">
    <img src="docs/timetable.png" width="32%" alt="Timetable week view">
    <img src="docs/gantt.png" width="32%" alt="Gantt view">
  </p>
-->

## Table of contents

- [Why OpenTick](#why-opentick)
- [Features](#features)
- [Platforms](#platforms)
- [Quick start](#quick-start)
- [Building from source](#building-from-source)
  - [Web / PWA](#web--pwa)
  - [Desktop](#desktop-windows-macos-linux)
  - [Android](#android)
  - [iOS and macOS](#ios-and-macos)
  - [Application icons](#application-icons)
- [Testing](#testing)
- [Sync](#sync)
  - [How merging works](#how-merging-works)
  - [WebDAV](#webdav)
  - [A file in a synced folder](#a-file-in-a-synced-folder)
  - [Adding a provider](#adding-a-provider)
- [OpenGantt integration](#opengantt-integration)
- [Timetable](#timetable)
- [Markdown](#markdown)
- [Themes](#themes)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Project layout](#project-layout)
- [Architecture](#architecture)
- [CI and releases](#ci-and-releases)
- [Your data](#your-data)
- [Known gaps](#known-gaps)
- [Contributing](#contributing)
- [A note on AI](#a-note-on-ai)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Why OpenTick

Most task managers make you pick a side: a polished desktop app **or** a phone app **or** a website — and then they hold your data. OpenTick is one small codebase that ships to all six of them, stores everything locally by default, and syncs through *your* WebDAV server or *your* existing Dropbox/Syncthing/iCloud folder.

- **One front end, every platform.** The entire UI is plain HTML, CSS and JavaScript with **zero runtime dependencies**. Tauri 2 wraps it in a native shell for desktop and mobile; the browser runs the exact same files as an installable PWA.
- **Offline-first, local-first.** Data lives on the device in `localStorage`. Sync is opt-in and never required.
- **No lock-in.** One JSON export contains everything, readable with a text editor.
- **Free as in public domain.** The [Unlicense](https://unlicense.org) — copy it, fork it, sell it, ship it.

---

## Features

### Capture and organise

- **Smart lists** — Inbox, Today, Tomorrow, Next 7 Days, All, Completed, Won't Do, Trash.
- **Lists, sections, tags and sub-tasks** with priorities (none / low / medium / high), due date + time, and drag-to-reorder rows.
- **Natural-language quick add.** Type a sentence and OpenTick parses it:

  ```text
  Pay rent every month 9am !high #bills ~Personal
  ```

  | Token | Examples |
  |---|---|
  | Dates | `today`, `tomorrow`, `mon`, `next week`, `in 3 days`, `dec 5`, `2026-12-05` |
  | Times | `5pm`, `17:30` |
  | Durations | `for 45min`, `for 1.5h` |
  | Repeats | `daily`, `every 2 weeks`, `every mon, wed`, `weekdays` |
  | Priority | `!high`, `!medium`, `!low` |
  | Tag / list | `#bills`, `~Personal` |

- **Repeating tasks** — completing one rolls it forward to the next date and logs the completion as a separate finished entry.
- **Reminders** — native notifications on desktop and mobile, browser notifications on the web, with lead times from "on time" to "1 day before".
- **Markdown notes** — write/preview toggle, formatting toolbar, `Ctrl+B` / `Ctrl+I` / `Ctrl+K`, and Enter continues lists. Checklists in notes are clickable and show a `done/total` badge on the task row.

### Views

| View | What it gives you |
|---|---|
| **Tasks** | Grouped and sorted list, plus a per-list **board (kanban)** with sections and drag-and-drop between columns. |
| **Calendar** | Month grid with colour-coded chips per day; click a day to add a task. |
| **Timetable** | Week and day timetable with weekly recurring slots and tasks on the grid — see [Timetable](#timetable). |
| **Gantt** | A built-in Gantt renderer *and* the real OpenGantt app — see [OpenGantt integration](#opengantt-integration). |
| **Matrix** | Eisenhower quadrants (urgent/important) derived from due dates and priorities, each with its own quick-add box. |
| **Habit** | Daily check-ins, streaks, and a rolling seven-day strip per habit. |
| **Focus** | Pomodoro timer with focus / short break / long break modes, session log, today's stats and a seven-day bar chart. |

### Interface

- **Coloured tags** — tap a tag anywhere to give it a colour or rename it. The colour follows the tag everywhere and syncs between devices.
- **Eight themes** — Gruvbox Dark (default), Gruvbox Light, Light, Dark, Nord, Solarized Dark, Dracula, and match-the-system. All colours are CSS variables.
- **Resizable, hideable panels** — drag the edge of the sidebar, details panel, timetable tray or Gantt table; double-click to reset. `[` hides the sidebar, `]` the details, `\` hides both for a distraction-free view.
- **Command palette** (`Ctrl/Cmd+Shift+P`) — jump to any view, list, tag or task, and run actions like switching theme, toggling compact density, or printing the Gantt chart.
- **Full-text search** (`/` or `Ctrl/Cmd+K`) across titles, notes and tags.
- **Responsive by default** — hidden or too-narrow panels slide in as drawers, so the same layout works on a phone.
- **JSON export and import** for backups and migration.

### Data

- **Offline-first.** Nothing leaves the device unless you turn sync on.
- **Sync over WebDAV** (Nextcloud, ownCloud, Synology, Apache/nginx `dav`, …) or through **any file in a folder another tool already syncs** (Syncthing, Dropbox, OneDrive, iCloud Drive, a Nextcloud client…).
- **Conflict-free by design for everyday use** — per-record last-writer-wins with tombstones, per-day habit merging and unioned focus sessions.

---

## Platforms

| Platform | Status | How you get it |
|---|---|---|
| **Web / PWA** | ✅ | Host `dist/` over HTTPS — installable from the browser. |
| **Windows** | ✅ | Installer from [Releases](https://github.com/JebbyCodes/OpenTick/releases), or build locally. |
| **macOS** | ✅ | `.dmg` / `.app` from Releases, or build locally. |
| **Linux** | ✅ | `.deb` / `.rpm` / AppImage from Releases, or build locally. |
| **Android** | ✅ | APK built with `npx tauri android build --apk`. |
| **iOS** | ✅ | Requires a Mac with Xcode and an Apple developer team. |

Tauri 2 produces native binaries; the front end is byte-identical across every target.

---

## Quick start

### Try the web app (no install)

```bash
git clone https://github.com/JebbyCodes/OpenTick.git
cd OpenTick
npm install
npm run build:app     # bundles src/ into dist/index.html
```

Then open `dist/index.html`, or serve `dist/` from any static host. Over HTTPS it registers a service worker and becomes an installable PWA.

### Development server

```bash
npm install
npm run dev           # http://localhost:1420 with live rebuild on change
```

`dev-server.mjs` watches `src/` and rebuilds on every save — no bundler, no hot-reload runtime, just a `setTimeout` and a rebuild.

---

## Building from source

### Prerequisites

| Target | Needs |
|---|---|
| Web | Node.js 18+ |
| Desktop | Node.js, Rust, and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS |
| Android | Android Studio / SDK + NDK and `JAVA_HOME` |
| iOS | macOS with Xcode and an Apple developer team for device builds |

### Web / PWA

```bash
npm run build:app
```

Bundles `src/index.html`, `src/styles.css` and every file in `src/js/` (in the order declared by `JS_ORDER`) into a single self-contained `dist/index.html`, and copies `manifest.webmanifest`, `sw.js` and `icon.svg` alongside it. If `vendor/opengantt/Gantt.html` exists, it is shipped as `dist/OpenGantt.html` and the Gantt page gains an **OpenGantt** pane.

Deploy `dist/` anywhere that serves HTTPS — GitHub Pages, Netlify, a Raspberry Pi. No build server, no environment variables.

### Desktop (Windows, macOS, Linux)

```bash
npm run icons          # generates src-tauri/icons from src/icon.svg (once)
npm run tauri dev      # development window with the live-rebuilding dev server
npm run tauri build    # installers land in src-tauri/target/release/bundle
```

### Android

```bash
npx tauri android init
npx tauri android dev
npx tauri android build --apk
```

The APK is written under `src-tauri/gen/android/`. Android blocks plain HTTP, so use HTTPS for WebDAV sync.

### iOS and macOS

```bash
npx tauri ios init
npx tauri ios dev
npx tauri ios build
```

Device builds need a signing team configured in Xcode.

### Application icons

```bash
npm run icons
```

Regenerates every platform icon from `src/icon.svg` using the Tauri CLI. Run it once after cloning if `src-tauri/icons/` is missing pieces.

### Vendoring OpenGantt

```bash
npm run sync:gantt     # fetch the latest stable OpenGantt release into vendor/opengantt/
npm run check:gantt    # exit 1 if a newer stable release exists (used by CI)
node scripts/sync-opengantt.mjs --ref main   # track a branch/commit instead of the latest release
```

The script resolves the release tag to a commit SHA first, downloads `Gantt.html` and the upstream `README.md` from that immutable SHA, validates both, parses the documented chart format, and only then replaces the vendored files atomically. It also reports *drift*: upstream features OpenTick does not yet understand.

---

## Testing

```bash
npm test
```

Runs seven suites, each a plain Node script with no test framework:

| Suite | Covers |
|---|---|
| `test/smoke.mjs` | Quick-add parser, repeat rules, and every page rendering against a fake DOM. |
| `test/markdown.mjs` | Markdown rendering, XSS safety, checklist toggling. |
| `test/sync.mjs` | Merge rules, change tracking, and two devices syncing against a mock WebDAV server. |
| `test/timetable.mjs` | Themes, tag colours, durations, timetable layout, drag/drop, reminders, merge. |
| `test/opengantt.mjs` | YAML subset, Markdown fence handling, task ↔ row mapping, two-way file sync. |
| `test/layout.mjs` | Panel sizing, sidebar views, task drops, Gantt table columns and drag date maths. |
| `test/upstream.mjs` | The upstream-spec reader and drift check (no network). |

`test/harness.mjs` loads the real app scripts into an isolated Node VM with a fake DOM, so several simulated "devices" can run side by side in one process. There is no mocking of the application code itself — the tests exercise the same files the browser runs.

### Mock WebDAV server

```bash
node test/dav-mock.mjs
```

Starts an in-memory WebDAV server on `http://127.0.0.1:8080/dav` with CORS enabled — username `me`, password `secret`. Point the app's sync settings at it to try sync by hand.

---

## Sync

Sync keeps **tasks, lists, tag colours, timetable slots, habits and focus history** identical across devices. Theme, sort/group and other view settings deliberately stay per device.

The sync file format is versioned (`schema: 2`, adding tag colours and timetable slots). A device running an older build refuses the file rather than silently dropping the fields it does not understand.

### How merging works

One file, `OpenTick/opentick.json`, lives on the provider. Every sync:

1. Downloads the file and merges it with the local data.
2. Uploads the result **only if something differs**.
3. Uploads conditionally (`If-Match`) — if another device wrote in between, OpenTick re-merges and retries instead of clobbering.

Every task, list and habit records when it last changed. The most recent edit to a record wins, and deletions are remembered as tombstones for **180 days** so they are not undone by a device that still holds the old copy. Habit check-ins merge **day by day** and focus sessions are **unioned**, so nothing is lost when two devices touch the same habit. Different edits to *different* tasks never conflict; two edits to the *same* task keep the later one.

Sync runs on start, ~5 seconds after you stop editing, every 3 minutes, when the app regains focus or the network returns, and when you click the cloud icon. **Undo last merge** in the Sync dialog restores the data from immediately before the last sync brought in changes.

> Keep device clocks roughly correct — ordering is timestamp-based.

### WebDAV

Enter the server address, a folder name (created if missing), a username and an **app password**. The password is stored on this device only — never in backups, never on the server.

```text
Nextcloud:  https://HOST/remote.php/dav/files/USERNAME/
```

Use HTTPS (Android blocks plain HTTP).

- **Desktop and mobile apps** send requests from native Rust code, so no server configuration is needed.
- **Web / PWA** is subject to browser CORS rules, so the server must answer preflight requests. For Nextcloud/Apache, add this for the WebDAV location:

  ```apache
  Header always set Access-Control-Allow-Origin "https://your-opentick-host"
  Header always set Access-Control-Allow-Headers "Authorization, Content-Type, If-Match, If-None-Match"
  Header always set Access-Control-Allow-Methods "GET, PUT, MKCOL, PROPFIND, OPTIONS"
  Header always set Access-Control-Expose-Headers "ETag"
  ```

  and answer `OPTIONS` with a 2xx **without** requiring a login. If that is not possible, use the desktop/mobile app or the file provider instead.

### A file in a synced folder

Available in the desktop app and Chromium-based browsers (because it writes to disk). Choose a `.json` file inside a folder that Syncthing, Dropbox, OneDrive, iCloud Drive or a Nextcloud client already keeps in sync. Browsers ask you to re-grant file access after a restart — press **Sync now**.

### Adding a provider

S3, Dropbox, Google Drive and friends are one object away. Add to `PROVIDERS` in `src/js/sync.js`:

```js
{
  label: 'My provider',
  async read(cfg, rev)  { /* → { status: 'ok'|'nochange'|'missing', text?, rev? } */ },
  async write(cfg, text, rev, isNew) { /* → { rev } or { conflict: true } */ },
}
```

…plus its form fields in `openSync()`.

---

## OpenGantt integration

OpenTick reads and writes the YAML that [OpenGantt](https://github.com/JebbyCodes/OpenGantt) draws — `rows:` with `label`, `plan`, `fact`, `notes`, `children` and any extra columns — whether it lives in a `.yaml` file or in the first ```` ```gantt ```` block of a Markdown note.

**Gantt view.** The *Gantt* tab draws your tasks the OpenGantt way: a bar for the plan (start → due; a single date is a diamond), a striped bar for the actual (actual start → the day you finished), and an open task with an actual start as a progress bar up to today showing the percentage of the plan elapsed. Subtasks are children (collapse with the chevron), scale is day / week / month / year, and mode is plan / actual / both. Click a bar to open the task. Set dates in a task's details under **Gantt dates** (*Start*, *Actual start*; the due date is the plan end).

### Mapping

| OpenTick | OpenGantt row |
|---|---|
| task title | `label` |
| start → due date (due only = one date) | `plan: [start, end]` / `plan: [date]` |
| actual start; done tasks end on the day they were completed | `fact: [start]` (open) / `fact: [start, end]` (finished) |
| notes | `notes` |
| priority, tags | `priority: High`, `tags: [a, b]` |
| subtasks (any depth) | `children` |
| unknown columns in a chart (e.g. `owner`) | kept on the task and written back unchanged |
| task id | `otid` — a hidden-by-default extra column that lets edits find the right task again |

Only tasks with a start, due or actual-start date are exported. Undated, deleted, won't-do and repeat-log entries are not. A finished subtask without dates is written as `done: true`.

### Import, export, copy

In a list: the link icon → **Import chart…** (into this list), **Export file…** (`.md` note or `.yaml`), **Copy as Obsidian block**. Settings → **Import OpenGantt chart…** creates a new list from a file.

### Linking a list to a chart file

Desktop app or a Chromium browser, because it writes the file. Link icon → **Link to a file…**, then pick an existing `.md` / `.yaml` or create one. From then on OpenTick keeps the chart's `rows:` in step with the list — after you edit (a couple of seconds later), when you come back to the app, every 3 minutes, or with **Sync now**.

- For a `.md` note **only the `gantt` block is touched** — the front matter, other blocks and the rest of the note stay byte for byte. For any file, the chart's own keys (`scale`, `mode`, `columns`, `title`, comments…) are preserved; only `rows:` is rewritten.
- It is a **three-way merge per task**. OpenTick remembers what each task looked like at the last sync. Changed only in the file → pulled in. Changed only in OpenTick → written out. Changed in both → the OpenTick version wins (and the Sync dialog counts it). A row you delete in OpenGantt moves the task to the Trash; new rows become new tasks and get an `otid`. A file that cannot be parsed is **never** overwritten.
- Rows keep the file's order; reordering tasks in OpenTick does not reorder the chart.
- Links are per device (the file handle or path stays on the device). The task data itself syncs through normal OpenTick sync, so two devices linked to the same synced file converge.
- The format is implemented from OpenGantt's README. Features not documented there are preserved as custom columns — tell us if something does not round-trip.

### Running the real OpenGantt app

`npm run sync:gantt` vendors the upstream standalone app into `vendor/opengantt/` and adds an **OpenGantt** pane to the Gantt page that runs the real thing in an iframe, seeded with the current list. **Send tasks** pushes the list in; **Apply to OpenTick** brings the editor's changes back.

---

## Timetable

Open the **Timetable** tab. Slots repeat weekly, so one slot like *"Maths · Mon + Wed 09:00–10:30"* appears every week.

- **Add** — click an empty spot on the grid, or **+ Slot**. Pick days, times, colour, location, notes and an optional reminder.
- **Move / resize** — drag a block to another day or time (15-minute steps); drag its bottom edge to change the end. Moving one day of a multi-day slot moves just that day. On touch screens, edit in the dialog.
- **Overlaps** are shown side by side with a red outline and a warning in the editor.
- **Tasks on the grid** — a task due on a day with a time shows as a dashed block (duration from the task, default 30 min). Without a time it sits in the *all day* row. Drag a task from the *Tasks* tray onto the grid to schedule it, or onto *all day* to clear its time. In a task's details, **Timetable slot** links it to a slot, after which it is listed inside that slot on its due day.
- **Views** — *Week* / *Day* (click a day header), arrows, and *Today*. The grid shows 07:00–21:00 by default (change it in the sliders menu) and grows automatically if something falls outside those hours.
- A red **"now" line** tracks the current time on today's column.

---

## Markdown

Supported: headings, `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, fenced code blocks, links and bare URLs, `>` quotes, bullet / numbered / nested lists, `- [ ]` task lists, tables, and `---`.

Raw HTML is **never rendered** — it is shown as text. Only `http(s)`, `mailto` and `tel` links are created, and they open in the system browser. Task titles get inline formatting only (no links, so clicking a task still opens it). Sub-task titles and habit names stay plain text.

The renderer is dependency-free and safe by construction: all input is HTML-escaped *first*, and the only tags that ever reach the DOM are the ones the renderer generates.

---

## Themes

Settings → pick a theme. The default is **Gruvbox Dark**.

| Theme | | |
|---|---|---|
| Gruvbox Dark (default) | Gruvbox Light | Light |
| Dark | Nord | Solarized Dark |
| Dracula | Match system | |

Every colour comes from CSS variables at the top of `src/styles.css`. To add a theme, copy one `:root[data-theme=…]` block, change the values, and add an entry to `THEMES` in `src/js/core.js`.

Existing installs that were on the old *Match system* default move to Gruvbox Dark once; an explicit Light/Dark choice is kept.

---

## Keyboard shortcuts

Press <kbd>?</kbd> in the app for this list.

| Shortcut | Action |
|---|---|
| <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>P</kbd> | Command palette |
| <kbd>Ctrl/Cmd</kbd> + <kbd>K</kbd> or <kbd>/</kbd> | Search |
| <kbd>N</kbd> | New task |
| <kbd>[</kbd> | Show / hide the sidebar |
| <kbd>]</kbd> | Show / hide task details |
| <kbd>\\</kbd> | Focus mode (hide both panels) |
| <kbd>Esc</kbd> | Close dialog / details |
| <kbd>?</kbd> | Keyboard shortcut help |
| <kbd>Ctrl/Cmd</kbd> + <kbd>B</kbd> / <kbd>I</kbd> / <kbd>K</kbd> | Bold / italic / link in notes |
| <kbd>Ctrl</kbd> + scroll (Gantt) | Zoom the timeline |
| Drag a handle | Resize a panel — double-click to reset |

---

## Project layout

```text
OpenTick/
├── src/
│   ├── index.html            App shell (CSS and JS are injected at build time)
│   ├── styles.css            All styles and every theme's CSS variables
│   ├── sw.js                 Service worker (network-first, cache fallback)
│   ├── icon.svg              Source icon for every platform
│   └── js/
│       ├── core.js           Dates, repeat rules, quick-add parser, store, change tracking, merge
│       ├── md.js             Markdown renderer
│       ├── views.js          All rendering (sidebar, list
