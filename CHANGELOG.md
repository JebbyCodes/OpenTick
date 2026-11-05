# Changelog

## 0.6.1

**App**
- Fixed: **the time was missing on phones.** One style rule hid the clock on every screen narrower than 820 px, so only the sync cloud was left. The date and time show again beside the cloud (as "Wed 4 Nov" on a phone), and tapping the clock opens Time zones; its tip lists the time in each of your saved places.
- Fixed: the **Shift + L** key hint on the "+" beside Lists was drawn inside a button too small for it and sliced off by the sidebar. Small icon buttons no longer carry key caps (the tooltip names the shortcut instead), and a test checks that no hint leaves the window or the sidebar.
- Fixed: **no more sideways wobble.** Lists and panels that scroll up and down no longer move left and right (or stretch at the edge), and strips that scroll sideways (view switcher, boards, tabs, the time-zone grid) no longer drag the page up and down.
- Changed: **less clutter, one place for each job.** The 13 views are grouped into five sections. **Tasks** holds the List, Board, Matrix and Timeline; **Notes** holds Notes and Templates; **Calendar** holds the Month, Timetable, Countdowns and Time zones; **Habits** holds Habits and Focus; Projects stays on its own. A slim switcher under each page's header moves between its views, a section reopens on the view you used last, and the phone tab bar now shows all five sections instead of four plus "More". Nothing was removed: every view keeps its shortcuts, links, widgets and saved data.
- Changed: keys **1–5** go to the sections, **V** / **Shift + V** step through the views of the section you are in, and the command palette still lists every view by name. Settings → Layout lists the sections, lets you hide single views and reorder sections (drag the section buttons too).
- Time zones are now part of the clock and the Calendar: open them from the clock, from Calendar → Time zones, or from the timetable's second-zone button.

**Android widgets**
- Fixed (hardened): widgets showing "Can't load widget". This could not be reproduced without a device, so every way a home screen can refuse a widget was closed: a widget that cannot be drawn now shows a small plain card with the reason and opens OpenTick when tapped (before it fell back to a layout of unfilled white shapes); the widgets start from one small initial and preview layout that cannot fail; the Focus widget's resize limit was larger than its width; widget views and layouts are kept by name in release builds; the background service always puts up a notification in time and can no longer take the app (and its widgets) down; and a test now checks every widget call reaches a view of the right type.

**Sync and encryption**
- Nothing about the sync file or encryption changed (still schema 6); layout choices stay on the device. A new test goes through every kind of data you can make (including countdowns, time zones, boards and templates), syncs it between two devices with encryption on, and checks nothing is readable in the file.

## 0.6.0 (unreleased)

**App**
- Fixed: stepping the timetable widget to next week and beyond showed "Can't load widget" on Android. The widget now gets four weeks of days, its steps are kept inside the data it holds (and shift when the data is older than today), the arrows gain week steps, and a widget that cannot be drawn falls back to a plain message instead of failing. The cause could not be reproduced without an Android device, so this hardens every path that could fail.
- Less cramped: Settings → Appearance → Spacing (Roomy is the new default, Standard is the old look, Compact fits more), the details panel waits until you pick a task, key hints show on hover, the view grid shows two rows with a More button, and the timetable has a one-line hint.
- New: **Countdowns**. To a date or an exact moment, in your own time or a fixed zone, yearly repeat, reminders, icon and colour, linked to lists, projects and tags. They show in a strip on those pages and on Today, and any task can start one.
- New: **Time zones**. Save the places you work with and see one day as a row of hours per zone, with working hours shaded and the shared hours marked. Make a task or a countdown from the chosen moment. The timetable can show a second zone beside the hours; a task keeps the zone it was planned in.
- New: **Boards**. Kanban boards with headings of your own (add, rename, recolour, reorder, limit, "done" headings that finish cards), scoped to everything, a list, a project or a tag. Drag with a mouse, press and hold on a touch screen, Alt + arrows, or the card's menu.
- New: **Connect other apps** (Settings → Integrations, off by default). One documented interface (pairing, permissions, x-callback links on Android and the installed web app, postMessage, change feed) so companion apps can read or add tasks, tick them off and log focus time; see `docs/INTEGRATION.md`.
- New: **Countdowns widgets**. A Countdowns mini-window on desktop (Settings → Widgets) and a Countdowns home-screen widget on Android. The Android widget works out days and hours from the clock each time it is drawn, so they stay right between refreshes.
- New: `opentick://` links now work on **desktop and iOS** as well (Linux and Windows register the scheme when Connect other apps is on; macOS and iOS declare it in their Info.plist). Links reach the running app through its existing single-instance socket, so a second copy never starts.
- Changed: **a task's time zone is now real.** A task planned in "New York 09:00" keeps that moment. Travel, and your own date and time shift; the plan, the reminder and a repeat's zone wall-time stay put (a daily 09:00 New York task is still 09:00 there after daylight saving ends). Changing the zone is not an edit, so nothing is synced when you merely travel.
- Countdowns, time zones and boards sync with everything else and are encrypted with it. The sync file is now schema 6; older versions refuse to overwrite it instead of dropping the new data.

## 0.5.3

**Releases and packaging**
- Docker is now part of every release. The release page has a Docker section with the image as downloads (`OpenTick_<version>_docker-amd64.tar.gz`, `-arm64`, `-armv7`, `-i386`) that load with `docker load`, a compose file pinned to that version, and the `docker run` command. Before, the image only went to the container registry and never showed on the Releases page.
- The Docker image is pushed to the registry only after the GitHub Release exists, so `latest` never moves for a release that did not happen. The image is started and checked (`/healthz`, the app and `/eink/`) before a release is made, and a warning says how to fix it if the registry package is still private.
- Fixed: pushing a version tag started two release workflows at once, each making its own release and each submitting to the Microsoft Store. The old `Build OpenTick` workflow is gone; Release is the only one.
- Fixed: two workflows deployed GitHub Pages and cancelled each other. There is one now.
- Fixed: the Snap Store upload failed whenever the release had both a 64-bit and an ARM64 Snap, and refused pre-release tags such as `v0.6.0-beta.1`. It now uploads every Snap.
- Fixed: the Microsoft Store publisher failed when its secrets were not set. Like the other stores, it now skips with a warning.
- Fixed: the browser tests in CI crashed before running because the runner had neither Pillow nor the PDF tools (`pdfinfo`, `pdftotext`). CI now installs them and checks they are present, and a test fails if a browser test ever needs something CI does not install.
- Removed workflows that duplicated others: `build.yml`, `deploy-web.yml`, `update-scoop-bucket.yml` and `test-snap.yml`.
- Every workflow now starts with a plain-language header (what it does, when it runs, which secrets it needs) and comments on each step. `docs/RELEASING.md` lists them all.

## 0.5.2

- Internal maintenance.

## 0.5.1

**App**
- Fixed: on phones the Day / 3 days / Week switch in the timetable was pushed off the screen. The toolbar now wraps and the switch has its own row.
- Tooltips on every button: hover with a mouse, press and hold on a touch screen (letting go does not press the button), or Tab to it. Settings → Accessibility → Button tooltips turns them off.
- E-ink mode for e-paper tablets and readers (Settings → Appearance → E-ink display): black on white with outlines instead of colour, no animation, larger targets, marks instead of colour, and page up / down buttons. It starts on automatically in the e-ink Android app and the web version at `/eink/`.
- Android: the background service now runs as a real foreground service whenever "Run in the background" is on, so OpenTick is listed under Active apps (before, it only started when a lesson was coming up). It shows your next lesson or reminder, asks for notification permission, and restarts after a reboot, an update or a swipe from recents.

**Releases and packaging**
- One workflow now builds, packs, signs and publishes everything when you push a version tag (`git push origin v0.5.1`), and the release description says what is new.
- Windows: installer (NSIS) and MSI for 64-bit, installer for 32-bit and ARM64, portable zips, and an MSIX (and a bundle) for the Microsoft Store.
- Linux: AppImage, .deb and .rpm for 64-bit and ARM64, plus the Snap (the Snap upload no longer fails on `chmod`).
- macOS: one universal .dmg for Apple Silicon and Intel. iOS: an .ipa, built when the Apple signing secrets are set (Apple only lets signed apps be installed).
- Android: universal APK, one APK per CPU (arm64-v8a, armeabi-v7a, x86, x86_64 for old and 32-bit phones), an App Bundle, and an e-ink APK.
- Docker image (`ghcr.io/jebbycodes/opentick`, 64-bit, ARM and 32-bit) and a self-hosting web zip.
- Checksums (`SHA256SUMS.txt`) and build-provenance attestations for every file.
- `npm run version:sync` now updates every file that carries the version (Cargo.lock, snap, MSIX manifest, F-Droid recipe, README, CHANGELOG, fastlane).

## 0.5.0

See "What's new in 0.5.0" in [README.md](README.md#whats-new-in-050) for the full list.

- Several reminders per task: any time before (minutes to weeks) or at an exact date and time; custom lead times for lessons and slots; quiet hours; morning summary.
- Background service: Android alarms (restored after reboot) and a persistent timetable notification with the room as its icon; desktop tray, close to tray, start at sign-in and reminders while hidden; iOS scheduled notifications; web service-worker notifications.
- Repeats: end on a date, custom rule, and per-date exceptions (different time, or skip).
- Holidays: coloured bands in the calendar and timetable that hide the class timetable.
- Room and teacher always visible on lessons (scrolling when long), in the grid, agenda, widgets and notifications; timetable widget shows start/end and the next days.
- Templates page with `{{variables}}`, questions, notes as answers, tags/list/project links.
- Keyboard shortcuts with key-cap hints, right-click menus, tabbed settings, many quality-of-life options and a full Accessibility section, in-app privacy policy.
- School options in the task panel collapse (collapsed by default, configurable).
- Sync format 5: templates and the new task fields sync and are encrypted.
- Fixed: the notes details button no longer shows an unexplained dot (it shows a count).
- F-Droid: Fastlane metadata and a draft build recipe in `docs/fdroid/`.
