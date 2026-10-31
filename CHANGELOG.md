# Changelog

## 0.5.3

- TODO: describe what is new in this release.

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
