<div align="center">
  <img src="docs/images/banner.png" alt="OpenTick" width="250">

  **A TickTick-style task manager that runs everywhere from one codebase.**

  Plan your day, manage projects and track habits from one codebase. OpenTick is local-first, works offline, and does not require an account, subscription or hosted sync server.
  
---
***Currently AI generated***;
- I intend on one-day "reverting" this project and human-tweaking it until eventually the AI work is subdued (like the ship of Theseus in a way).
---

  <a href="https://unlicense.org"><img src="https://img.shields.io/badge/license-Unlicense-blue.svg" alt="Unlicense"></a>
  <a href="https://tauri.app"><img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri 2"></a>
  <a href="https://web.dev/progressive-web-apps/"><img src="https://img.shields.io/badge/PWA-installable-5A0FC8" alt="Installable PWA"></a>
  <a href="https://github.com/JebbyCodes/OpenTick/releases/latest"><img src="https://img.shields.io/github/v/release/JebbyCodes/OpenTick" alt="Latest release"></a>
  <a href="https://github.com/JebbyCodes/OpenTick/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/JebbyCodes/OpenTick/ci.yml?label=tests" alt="Tests"></a>
  <a href="https://github.com/JebbyCodes/OpenTick/actions/workflows/release.yml"><img src="https://img.shields.io/github/actions/workflow/status/JebbyCodes/OpenTick/release.yml?label=release" alt="Release build"></a>
</div>

<p align="center">
  <img src="docs/images/tasks.png" width="32%" alt="Task list">
  <img src="docs/images/timetable.png" width="32%" alt="Timetable">
  <img src="docs/images/gantt.png" width="32%" alt="Gantt chart">
</p>

## What's new in 0.5.1

- Fixed: on phones the Day / 3 days / Week switch in the timetable was pushed off the screen. The toolbar now wraps and the switch has its own row.
- Tooltips on every button: hover with a mouse, press and hold on a touch screen (letting go does not press the button), or Tab to it. Settings → Accessibility → Button tooltips turns them off.
- E-ink mode for e-paper tablets and readers (Settings → Appearance → E-ink display): black on white with outlines instead of colour, no animation, larger targets, marks instead of colour, and page up / down buttons. It starts on automatically in the e-ink Android app and the web version at `/eink/`.
- Android: the background service now runs as a real foreground service whenever "Run in the background" is on, so OpenTick is listed under Active apps (before, it only started when a lesson was coming up). It shows your next lesson or reminder, asks for notification permission, and restarts after a reboot, an update or a swipe from recents.
- One workflow now builds, packs, signs and publishes everything when you push a version tag (`git push origin v0.5.1`), and the release description says what is new.
- Windows: installer (NSIS) and MSI for 64-bit, installer for 32-bit and ARM64, portable zips, and an MSIX (and a bundle) for the Microsoft Store.
- Linux: AppImage, .deb and .rpm for 64-bit and ARM64, plus the Snap (the Snap upload no longer fails on `chmod`).
- macOS: one universal .dmg for Apple Silicon and Intel. iOS: an .ipa, built when the Apple signing secrets are set (Apple only lets signed apps be installed).
- Android: universal APK, one APK per CPU (arm64-v8a, armeabi-v7a, x86, x86_64 for old and 32-bit phones), an App Bundle, and an e-ink APK.
- Docker image (`ghcr.io/jebbycodes/opentick`, 64-bit, ARM and 32-bit) and a self-hosting web zip.
- Checksums (`SHA256SUMS.txt`) and build-provenance attestations for every file.
- `npm run version:sync` now updates every file that carries the version (Cargo.lock, snap, MSIX manifest, F-Droid recipe, README, CHANGELOG, fastlane).

Earlier releases are listed in [CHANGELOG.md](CHANGELOG.md).

## What was new in 0.5.0

**Reminders and the background service**
- **Reminders any time before a task**: as many as you like per task, any amount (minutes, hours, days, weeks) or an exact date and time. Lessons and timetable slots get custom lead times too, plus optional quiet hours and a morning summary.
- **Background service on every platform**: Android schedules alarms (restored after a reboot); desktop keeps a tray icon, can close to the tray, start when you sign in and notify while the window is hidden; iOS schedules local notifications; the web app uses its service worker. Settings → Notifications.
- **Persistent timetable notification (Android)**: shows the lesson you are in or the next one with a countdown, expands to the whole day, and uses the room as its icon. The desktop tray shows the same.

**Tasks**
- **End a repeat on a date**, a **custom repeat rule** (every N days/weeks/months/years or chosen weekdays) and **exceptions**: a different time (or length) for one date, or skip it.
- **School options are collapsible** in the task panel (collapsed by default; remembered per task, and a setting decides the default).

**Timetable and calendar**
- **Room and teacher are always visible** on lessons, in the grid, agenda, widgets and notifications; long text scrolls instead of being cut off.
- **Holidays**: named, coloured date ranges that show as a band in the calendar and timetable, and hide the class timetable on those days. Manage them from the calendar or timetable toolbar.
- **Widgets**: the timetable widget shows start and end times, room and teacher on every row, and you can step through the next days.

**Templates (new page)**
- Write a template with `{{variables}}` (with `{{name|fallback}}`, built-ins like `{{today}}` and `{{note:Title}}`), choose the questions it asks (text, long text, number, date, choice, yes/no or another note as the answer), fill it in step by step with a live preview, then copy it, save it as a note or make a task. Templates have tags, a list and a project, and show up there too.

**Keyboard, mouse and accessibility**
- **Keyboard shortcuts everywhere** on computers, shown as key caps beside buttons, with a searchable cheat sheet (press `?`). Switched off on phones and tablets.
- **Right-click menus** that mirror each ⋯ button (tasks, lists, projects, tags, notes, templates, calendar days, timetable blocks).
- **Settings reorganised into tabs**, with new quality-of-life options (defaults for new tasks, confirm before delete, message duration) and a full **Accessibility** section: high contrast, bold text, a dyslexia-friendly font, text spacing, underlined links, do not rely on colour, greyscale, larger pointer and tap targets, strong focus outline, text labels on icon buttons, reduced motion and transparency.
- **Privacy policy** inside the app (Settings → About & privacy).
- The notes “details” button now shows a count instead of an unexplained dot.

**Sync and encryption**: templates, holidays, repeat ends, exceptions and reminders sync with everything else and are encrypted when encryption is on. Device settings (accessibility, shortcuts, background service) stay on the device.

**F-Droid**: the repository now carries Fastlane metadata (`fastlane/metadata/android`) and a draft F-Droid build recipe (`docs/fdroid/`).

## Download
Get the latest version from [GitHub Releases](https://github.com/JebbyCodes/OpenTick/releases/latest), or choose a platform-specific option below.

<div align="center">
  
### Windows

| Microsoft Store | GitHub Releases |
|:---:|:---:|
| <a href="https://apps.microsoft.com/detail/9pdnntk8tz39?hl=en-GB&amp;gl=GB"><img src="https://get.microsoft.com/images/en-us%20dark.svg" alt="Get it from Microsoft" width="180"></a> | <a href="https://github.com/JebbyCodes/OpenTick/releases/latest"><img src="docs/images/get-it-on-github.png" alt="Get it on GitHub" height="70"></a> |

| Chocolatey | Scoop |
|:---:|:---:|
| <a href="https://community.chocolatey.org/packages/opentick"><img src="docs/images/get-it-on-chocolatey.png" alt="Get it on Chocolatey" height="50"></a> | <a href="https://github.com/JebbyCodes/OpenTick-Scoop"><img src="docs/images/get-it-on-scoop.png" alt="Get it on Scoop" height="50"></a> |

### Android

| Orion Store | Obtainium |
|:---:|:---:|
| <a href="https://rookieenough.github.io/Orion-Data/redirect.html?id=opentick&amp;icon=https%3A%2F%2Fraw.githubusercontent.com%2FJebbyCodes%2FOpenTick%2Frefs%2Fheads%2Fmain%2Fsrc%2Flogo.png"><img src="https://raw.githubusercontent.com/RookieEnough/Orion-Store/refs/heads/main/assets/orion-badge.png" alt="Get it on Orion Store" height="50"></a> | <a href="https://apps.obtainium.imranr.dev/redirect?r=obtainium%3A%2F%2Fapp%2F%7B%22id%22%3A%22com.opentick.app%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2FJebbyCodes%2FOpenTick%22%2C%22author%22%3A%22JebbyCodes%22%2C%22name%22%3A%22OpenTick%22%2C%22preferredApkIndex%22%3A0%2C%22additionalSettings%22%3A%22%7B%5C%22includePrereleases%5C%22%3Atrue%2C%5C%22fallbackToOlderReleases%5C%22%3Atrue%2C%5C%22enableVirusTotalScan%5C%22%3Atrue%2C%5C%22observedVersionName%5C%22%3A%5C%220.4.0%5C%22%2C%5C%22observedVersionCode%5C%22%3A4000%2C%5C%22observedPackageId%5C%22%3A%5C%22com.opentick.app%5C%22%7D%22%7D"><img src="docs/images/get-it-on-obtainium.png" alt="Get it on Obtainium" height="70"></a> |

| GitHub Releases |
|:---:|
| <a href="https://github.com/JebbyCodes/OpenTick/releases/latest"><img src="docs/images/get-it-on-github.png" alt="Get it on GitHub" height="70"></a> |

### Linux

| Snap Store | GitHub Releases |
|:---:|:---:|
| <a href="https://snapcraft.io/opentick"><img alt="Get it from the Snap Store" src="https://snapcraft.io/en/dark/install.svg" width="150"></a> | <a href="https://github.com/JebbyCodes/OpenTick/releases/latest"><img src="docs/images/get-it-on-github.png" alt="Get it on GitHub" height="70"></a> |

### macOS & Web

| GitHub Releases |
|:---:|
| <a href="https://github.com/JebbyCodes/OpenTick/releases/latest"><img src="docs/images/get-it-on-github.png" alt="Get it on GitHub" height="70"></a> |
</div>

### Which file do I want?

Every release lists these with sizes, and a `SHA256SUMS.txt` to check them against.

| You have | Download |
|---|---|
| Windows 10 / 11, 64-bit | `OpenTick_x.y.z_x64-setup.exe` (or the `.msi`; `_x64-portable.zip` needs no install) |
| Windows, 32-bit or ARM | `_x86-setup.exe` or `_arm64-setup.exe` |
| Mac (Apple Silicon or Intel) | `OpenTick_x.y.z_universal.dmg` (not notarised: right-click → Open the first time) |
| Linux, 64-bit | `_amd64.AppImage` (any distro), `.deb` (Debian, Ubuntu), `.rpm` (Fedora, openSUSE) or the Snap |
| Linux ARM (Raspberry Pi 4/5, ARM laptops) | `_aarch64.AppImage`, `_arm64.deb`, `.aarch64.rpm` or the ARM64 Snap |
| Android phone or tablet | `_android-universal.apk` works everywhere. Smaller: `_android-arm64-v8a.apk` (modern), `_android-armeabi-v7a.apk` (older, 32-bit), `_android-x86_64.apk` / `_android-x86.apk` (Intel, emulators) |
| Android e-ink device | `_android-eink-universal.apk` (see [E-ink](#e-ink)) |
| iPhone / iPad | `.ipa` (only when the maintainers' Apple signing is set up; see [docs/RELEASING.md](docs/RELEASING.md)) |
| A server, NAS or any old machine with a browser | Docker, or `_web.zip` |

Android 7 or newer, Windows 10 or newer and macOS 10.15 or newer are needed. Windows 7/8 and 32-bit Linux are not supported by Tauri 2's web view; use the Docker image or the web app there. Obtainium users can add `apkFilterRegEx` = `universal` (or `arm64-v8a`) to pick one APK from each release.

### Docker

```sh
docker run -d -p 8080:8080 --name opentick ghcr.io/jebbycodes/opentick:latest
```

Open http://localhost:8080 (the e-ink edition is at `/eink/`). Images exist for 64-bit and 32-bit x86, ARM64 and ARMv7. Your data stays in your browser; the container only serves the app. [`docker/compose.example.yml`](docker/compose.example.yml) is a ready-made compose file.

## E-ink

For e-paper tablets and readers (Boox, reMarkable-style browsers, Kindle browsers, Kobo…): Settings → Appearance → **E-ink display** switches to black on white with outlines instead of colour, no animation or shadows, bigger touch targets, marks instead of colour, and **page up / down buttons** on the edge for scrolling without a flick. *Automatic* turns it on for known e-reader browsers and for the e-ink builds below.

- **Android:** `_android-eink-universal.apk` from a release starts in e-ink mode (it can be turned off in Settings).
- **Web:** open `/eink/` on the hosted site, in the Docker image, or in `_web-eink.zip`. Any other browser can add `?eink` to the address.

## Features

- **Tasks and lists:** priorities, tags, sections, subtasks, recurring tasks, reminders, attachments and batch editing.
- **Quick add:** natural-language dates, times, repeats, priorities, tags, lists and class markers.
- **Planning views:** calendar, kanban board, projects dashboard, Eisenhower matrix and Gantt chart.
- **Timetable and Classes:** recurring weekly slots, lessons, A/B weeks, days off, exams and homework.
- **Habits and focus:** streaks, history charts, and a Pomodoro timer with session tracking.
- **Markdown notes:** preview, checklists, note links, attachments and import/export.
- **Customisation:** themes, custom CSS themes, colours, banners, adjustable panels and keyboard shortcuts.
- **Widgets:** desktop mini-window, Android home-screen widgets and a compact web widget.
- **Offline-first storage:** data stays on your device unless you enable sync.
- **Optional encryption:** AES-256-GCM encryption for selected local data, backups and cloud sync, protected by a passphrase and recovery key.
- **Flexible sync:** WebDAV or a JSON file in a folder synced by another app; additional Git and S3-compatible providers are available.
- **Import and export:** JSON backups and imports from several task and note formats.

## Platforms

| Platform | How to run it |
|---|---|
| Web / PWA | Use the hosted site, the Docker image or `_web.zip` (serve over HTTPS for PWA install), or build `dist/` yourself. |
| Windows | Installer, MSI, portable zip or Store package; 64-bit, 32-bit and ARM64. |
| macOS | Universal `.dmg` (Apple Silicon and Intel). |
| Linux | AppImage, `.deb`, `.rpm` or Snap; 64-bit and ARM64. |
| Android | Universal APK, per-CPU APKs (including 32-bit ARM), an App Bundle and an e-ink APK. |
| iOS | `.ipa` built with Apple signing configured, or build from source in Xcode. |
| E-ink | Android e-ink APK, the `/eink/` web edition, or E-ink display in Settings. |

## Build from source

### Requirements

- [Node.js](https://nodejs.org/)
- For desktop builds: [Rust](https://www.rust-lang.org/) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/)
- For Android: Android SDK/NDK and Java
- For iOS: macOS, Xcode and Apple signing configuration

### Web / PWA

```sh
git clone https://github.com/JebbyCodes/OpenTick.git
cd OpenTick
npm install
npm run build:app
```

The built app is in `dist/`. Serve that directory over HTTPS to enable PWA installation and service-worker features.

### Development

```sh
npm install
npm run dev
```

### Desktop

```sh
npm run icons
npm run tauri dev
npm run tauri build
```

### Android

```sh
npx tauri android init
npx tauri android dev
npx tauri android build --apk
```

### iOS

```sh
npx tauri ios init
npx tauri ios dev
npx tauri ios build
```

iOS device builds need signing configured in Xcode. For platform-specific setup, follow the [Tauri documentation](https://tauri.app/).

## Data and privacy

OpenTick stores tasks and settings locally by default. Sync is optional.

- **Local data:** app data is stored in browser storage; attachments use IndexedDB.
- **Backups:** export your data to JSON and use the app's automatic local snapshots.
- **Sync:** use WebDAV or a supported file/provider option. Keep device clocks reasonably accurate because record conflicts are resolved using timestamps.
- **Encryption:** optional. Keep your recovery key somewhere safe; encrypted data cannot be recovered without the passphrase or recovery key.
- **WebDAV:** use HTTPS, especially on Android. Web/PWA sync can also require the server to allow browser CORS requests.

## Tests

Run the main test suite:

```sh
npm test
```

Browser tests (Python + Playwright with Chromium) run with `npm run test:browser`. `npm run lint:workflows` checks the GitHub workflow files, and `npm run version:check` confirms every file carries the same version.

## Project structure

- `src/` — application HTML, CSS and JavaScript
- `src-tauri/` — Tauri desktop/mobile shell and platform assets (`android-widgets/` holds the Android Kotlin and XML)
- `test/` — Node test suites; `test/browser/` has the Playwright tests
- `scripts/android/` — widget and service installer, signing, version check, APK naming
- `scripts/release/` — `bump-version.mjs` (`npm run bump` / `version:sync`), release notes, asset collection
- `scripts/legal/` — licence and privacy-policy generators
- `scripts/assets/`, `scripts/ci/` — icon generation; the workflow linter
- `packaging/msix/` — Microsoft Store package: manifest, assets, `build-msix.ps1`, `bundle-msix.ps1`
- `snap/` — `snapcraft.yaml` (builds from source) and `ci/` + `local/` (wraps the CI-built `.deb`)
- `Dockerfile`, `docker/` — the self-hosting image
- `.github/workflows/` — `ci`, `release`, `build-*`, `publish-*`, `deploy-pages` (see [docs/RELEASING.md](docs/RELEASING.md))
- `docs/` — privacy policy, F-Droid recipe, release guide
- `build-app.mjs` — creates the self-contained web build (`--eink` for the e-ink edition, `--out <dir>`)
- `package.json` — project version and commands

## Contributing

Bug reports and feature requests are welcome in [GitHub Issues](https://github.com/JebbyCodes/OpenTick/issues). For code changes:

1. Fork the repository and create a branch.
2. Run `npm install` and `npm test`.
3. Explain user-visible changes in the pull request and update `CHANGELOG.md` when appropriate.

## License

OpenTick is released under the [Unlicense](https://unlicense.org/). You can copy, modify, distribute and use it commercially.

## Acknowledgements

- [Tauri](https://tauri.app/) for the native application shell.
- The open-source *Timetable* app for the lesson-timetable model behind Classes.
- The authors of the themes and open-source projects whose formats OpenTick supports.
