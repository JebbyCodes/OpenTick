# OpenTick

A TickTick-style task manager that runs everywhere from one codebase: **web (PWA), Windows, macOS, Linux, Android and iOS**.
Built with [Tauri 2](https://tauri.app) around a dependency-free HTML/CSS/JS front end (same approach as OpenGantt). This is AI-generated.

## What's in it

- **Smart lists**: Inbox, Today, Tomorrow, Next 7 Days, All, Completed, Won't Do, Trash
- **Lists, tags, sub-tasks, Markdown notes**, priorities, due date + time, drag to reorder
- **Natural-language quick add**: `Pay rent every month 9am !high #bills ~Personal`
  (durations: `for 45min`, `for 1.5h` · dates: today, tomorrow, mon, next week, in 3 days, dec 5, 2026-12-05 · times: 5pm, 17:30 · repeats: daily, every 2 weeks, every mon, wed, weekdays · priority: `!high` `!medium` `!low` · `#tag` · `~list`)
- **Repeating tasks** (completing one rolls it to the next date and logs the completion)
- **Reminders** (native notifications on desktop/mobile, browser notifications on the web)
- **Board (kanban) view** per list, with sections and drag-and-drop
- **Calendar** (month), **Eisenhower matrix**, **Habit tracker** with streaks, **Focus** (Pomodoro timer + stats)
- **Coloured tags**: tap a tag in a task's details (or open a tag and use the `…` menu) to give it a colour or rename it; the colour shows everywhere the tag appears and syncs between devices
- **Timetable** (week and day views): weekly recurring slots with days, start/end, colour, location, notes and reminders; drag to move, pull the bottom edge to resize, click an empty spot to add; overlap warnings; a "now" line; configurable day hours and weekends. **Tasks join the timetable**: a task with a time (and a duration, e.g. `Study 4pm for 90min`) appears on the grid, untimed tasks sit in the all-day row, drag tasks from the task list onto the grid to schedule them, and a task can be linked to a slot (shown inside the slot on its day)
- **OpenGantt integration** ([OpenGantt](https://github.com/JebbyCodes/OpenGantt), same author): a built-in **Gantt** view, import/export of OpenGantt charts (`.md` note, `.yaml`, or an Obsidian ```` ```gantt ```` block), and **live two-way linking** of a list to a chart file (see below)
- **Themes**: Gruvbox Dark (default), Gruvbox Light, Light, Dark, Nord, Solarized Dark, Dracula, or match the system
- Group / sort options, search (`/` or Ctrl+K), JSON export & import
- **Markdown** in notes (Write / Preview, formatting toolbar, Ctrl+B / I / K, Enter continues lists) and inline in task titles; checklists in notes are clickable and show a `done/total` badge on the task
- **Sync** between devices via **WebDAV** (Nextcloud, ownCloud, Synology, …) or a **file in a folder another tool already syncs** (Syncthing, Dropbox, OneDrive, iCloud Drive, …)
- Offline-first: data lives on the device (localStorage); sync is optional

## Markdown

Supported: headings, `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, fenced code blocks, links and bare URLs, `>` quotes, bullet / numbered / nested lists, `- [ ]` task lists, tables, `---`.
Raw HTML is never rendered (it is shown as text) and only `http(s)`, `mailto` and `tel` links are created. Links open in the system browser. Task titles get the inline formatting only (no links, so clicking a task still opens it). Sub-task titles and habit names stay plain text.

## OpenGantt

OpenTick reads and writes the YAML that [OpenGantt](https://github.com/JebbyCodes/OpenGantt) draws (`rows:` with `label`, `plan`, `fact`, `notes`, `children` and extra columns), whether it sits in a `.yaml` file or in the first ```` ```gantt ```` block of a Markdown note.

**Gantt view.** The *Gantt* tab draws your tasks the OpenGantt way: a bar for the plan (start → due; a single date is a diamond), a striped bar for the actual (actual start → the day you finished), and an open task with an actual start as a progress bar up to today with the % of the plan elapsed. Subtasks are children (collapse with the chevron), scale is day / week / month, mode is plan / actual / both. Click a bar to open the task. Set dates in a task's details under **Gantt dates** (*Start*, *Actual start*; the due date is the plan end).

**Mapping**

| OpenTick | OpenGantt row |
|---|---|
| task title | `label` |
| start → due date (due only = one date) | `plan: [start, end]` / `plan: [date]` |
| actual start; done tasks end on the day they were completed | `fact: [start]` (open) / `fact: [start, end]` (finished) |
| notes | `notes` |
| priority, tags | `priority: High`, `tags: [a, b]` |
| subtasks (any depth) | `children` |
| unknown columns in a chart (e.g. `owner`) | kept on the task and written back unchanged |
| task id | `otid` (a hidden-by-default extra column that lets edits find the right task again) |

Only tasks with a start, due or actual-start date are exported (undated, deleted, won't-do and repeat-log entries are not). A finished subtask without dates is written as `done: true`.

**Import / export / copy.** In a list: the link icon → *Import chart…* (into this list), *Export file…* (`.md` note or `.yaml`), *Copy as Obsidian block*. Settings → *Import OpenGantt chart…* creates a new list from a file.

**Link a list to a chart file** (desktop app or a Chromium browser, because it writes the file): link icon → *Link to a file…* and pick an existing `.md` / `.yaml` or create one. From then on OpenTick keeps the chart's `rows:` in step with the list, after you edit (a couple of seconds later), when you come back to the app, every 3 minutes, or with *Sync now*.

- For a `.md` note only the `gantt` block is touched; the front matter, other blocks and the rest of the note stay byte for byte. For any file, the chart's own keys (`scale`, `mode`, `columns`, `title`, comments…) are kept; only `rows:` is rewritten.
- It is a **three-way merge per task**: OpenTick remembers what each task looked like at the last sync. Changed only in the file → pulled in. Changed only in OpenTick → written out. Changed in both → the OpenTick version wins (the Sync dialog toast counts it). A row you delete in OpenGantt moves the task to the Trash; new rows become new tasks (and get an `otid`). A file that cannot be parsed is never overwritten.
- Rows keep the file's order; reordering tasks in OpenTick does not reorder the chart.
- Links are per device (the file handle or path stays on the device); the dates, notes and other task data themselves sync through normal OpenTick sync, so two devices linked to the same synced file converge.
- The format is implemented from OpenGantt's README (I could not read its source). If you use features of OpenGantt not listed there, they are preserved as custom columns, but tell me if something does not round-trip.

## Timetable

Open the **Timetable** tab. Slots repeat weekly, so one slot like "Maths · Mon + Wed 09:00–10:30" appears every week.

- **Add**: click an empty spot on the grid, or *+ Slot*. Pick days, times, colour, location, notes and an optional reminder (a notification before it starts).
- **Move / resize**: drag a block to another day or time (15-minute steps); drag its bottom edge to change the end. Moving a block of a multi-day slot moves just that day. On touch screens use the edit dialog.
- **Overlaps** are shown side by side with a red outline and a warning in the editor.
- **Tasks**: a task due on a day with a time shows as a dashed block (duration from the task, default 30 min); without a time it is listed under *all day*. Drag a task from the *Tasks* panel onto the grid (or the all-day row) to schedule it. In a task's details, *Timetable slot* links it to a slot; it is then listed inside that slot on its due day (and picks the slot's next day if it has no date). In a slot's editor you can add tasks straight to it.
- **Views**: *Week* / *Day* (click a day header), arrows and *Today*. The grid shows 07:00–21:00 by default (change it in the sliders menu) and grows if something is outside those hours.

## Themes

Settings → pick a theme. The default is **Gruvbox Dark**. Colours come from CSS variables at the top of `src/styles.css`; to add a theme copy one `:root[data-theme=…]` block, change the values, and add an entry to `THEMES` in `src/js/core.js`. Existing installs that were on the old "Match system" default move to Gruvbox Dark once; an explicit Light/Dark choice is kept.

## Sync

Settings → **Sync…**. Tasks, lists, tag colours, timetable slots, habits and focus history are kept identical across devices. Theme, sort/group and other view settings stay per device. The sync file format changed in 0.3 (tag colours + timetable); devices still on 0.2 will say they need updating instead of overwriting the new data.

**How it works.** One file, `OpenTick/opentick.json`, lives on the provider. A sync downloads it, merges it with the local data, and uploads the result if anything differs. Uploads are conditional (`If-Match`), so if another device wrote in between, OpenTick simply re-merges and retries.
Every task, list and habit records when it last changed; the most recent edit to a record wins, and deletions are remembered (for 180 days) so they are not undone by a device that still has the old copy. Habit check-ins merge day by day and focus sessions are unioned, so nothing is lost when two devices touch the same habit. Different edits to *different* tasks never conflict; two edits to the *same* task keep the later one. Devices' clocks should be roughly right.
Sync runs on start, ~5 s after you stop editing, every 3 minutes, when the app regains focus or the network returns, and when you click the cloud icon. *Undo last merge* in the Sync dialog restores the data from just before the last sync brought in changes.

**WebDAV.** Enter the server address, a folder name (created if missing), username and an **app password** (the password is stored on this device only, never in backups or on the server). Nextcloud: `https://HOST/remote.php/dav/files/USERNAME/`. Use HTTPS (Android blocks plain HTTP).

- **Desktop and mobile apps** send requests from native code, so no server setup is needed.
- **Web/PWA** is subject to the browser's CORS rules, so the server must answer preflight requests. For Nextcloud/Apache add, for the WebDAV location:
  ```
  Header always set Access-Control-Allow-Origin "https://your-opentick-host"
  Header always set Access-Control-Allow-Headers "Authorization, Content-Type, If-Match, If-None-Match"
  Header always set Access-Control-Allow-Methods "GET, PUT, MKCOL, PROPFIND, OPTIONS"
  Header always set Access-Control-Expose-Headers "ETag"
  ```
  (and answer `OPTIONS` with 2xx without requiring a login). If that is not possible, use the desktop/mobile app or the file provider.

**File or synced folder** (desktop app, or Chromium-based browsers): choose a `.json` file inside a folder that Syncthing, Dropbox, OneDrive, iCloud Drive or a Nextcloud client already keeps in sync. A browser asks you to re-grant file access after a restart; press *Sync now*.

**Adding a provider** (S3, Dropbox, …): add an object with `read(cfg, rev)` and `write(cfg, text, rev, isNew)` to `PROVIDERS` in `src/js/sync.js` (see the comment at the top of that file) plus its form fields in `openSync()`.

## Run it

Web, no install: open `dist/index.html` (after `npm run build:app`), or host `dist/` anywhere. Served over HTTPS it is an installable PWA.

```
npm install
npm run dev            # http://localhost:1420 with live rebuild
npm test               # parser, recurrence, markdown, merge, sync, timetable, tag-colour and theme tests (mock WebDAV server included)
node test/dav-mock.mjs # standalone WebDAV mock with CORS on :8080 for trying sync by hand (user me / password secret)
```

### Desktop (Windows, macOS, Linux)

Needs Node, Rust and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```
npm run icons          # generates src-tauri/icons from src/icon.svg (once)
npm run tauri dev
npm run tauri build    # installers land in src-tauri/target/release/bundle
```

### Android

Needs Android Studio / SDK + NDK and `JAVA_HOME` (see Tauri's mobile prerequisites).

```
npx tauri android init
npx tauri android dev
npx tauri android build --apk
```

### iOS (and macOS)

Needs a Mac with Xcode and an Apple developer team for device builds.

```
npx tauri ios init
npx tauri ios dev
npx tauri ios build
```

### CI

`.github/workflows/build.yml` builds Windows, macOS and Linux installers on a `v*` tag and publishes the web build to GitHub Pages.

## Layout

```
src/index.html, styles.css      shell + styles
src/js/core.js                  dates, repeat rules, quick-add parser, store, change tracking + merge
src/js/md.js                    markdown renderer
src/js/sync.js                  sync providers (WebDAV, file), engine, dialog
src/js/views.js                 all rendering (sidebar, list, board, calendar, timetable, matrix, habits, focus, detail)
src/js/main.js                  modals, file + notification bridges, pomodoro, events
build-app.mjs                   bundles src/ into dist/index.html (no dependencies)
src-tauri/                      Tauri 2 shell (notification, dialog, fs, http, opener, persisted-scope plugins)
```

## Known gaps

- Sync is one file with last-writer-wins per record (no per-field merging, no end-to-end encryption: use a server you trust or an encrypted folder). Settings are not synced.
- The Tauri side (HTTP/opener plugins, capabilities) was written without a Rust toolchain at hand: run `npm run tauri dev` once and report anything the compiler objects to.
- Reminders fire while the app is running; scheduling them while the app is closed on mobile needs the notification plugin's scheduled notifications (next step).
- Calendar is month-only (the Timetable has the week/day views); no filters or shared lists yet.
- Timetable: slots repeat every week (no A/B weeks, term dates or one-off exceptions yet); drag and resize use a mouse, on touch screens edit times in the dialog.
- Board cards drag with a mouse; on touch screens change the section in the task details.

## Layout, Gantt and shortcuts (v0.5)

- **Panels:** drag the edge of the sidebar, details panel, timetable tray or Gantt table to resize (double-click resets). `[` hides the sidebar, `]` the details, `\` both. Hidden panels return as drawers.
- **Sidebar:** fold sections, drag lists and view tabs to reorder, drop a task on a list/Today/Tomorrow/Trash, hide views in Settings.
- **Command palette:** `Ctrl/Cmd+Shift+P` jumps to views, lists, tasks and actions (themes, compact density, Gantt zoom/columns/print). `?` lists all shortcuts.
- **Gantt:** drag bars to move/resize, drag unscheduled tasks onto the timeline, zoom (`Ctrl`+scroll), choose and reorder table columns, print / save as PDF.
- **OpenGantt sync:** `npm run sync:gantt` vendors the upstream app into `vendor/opengantt/` and adds an **OpenGantt** pane to the Gantt page; `npm run check:gantt` tells you if you are behind. CI does this daily (`.github/workflows/sync-opengantt.yml`). Optional: in the OpenGantt repo, a workflow that sends a `repository_dispatch` event of type `opengantt-updated` to this repo updates it on every push.
