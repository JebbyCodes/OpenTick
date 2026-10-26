# OpenTick

<div align="center">
  <img src="docs/images/banner.png" alt="OpenTick" width="180">

  **A TickTick-style task manager for web, desktop and mobile.**

  Plan your day, manage projects and track habits from one codebase. OpenTick is local-first, works offline, and does not require an account, subscription or hosted sync server.

  <a href="https://unlicense.org"><img src="https://img.shields.io/badge/license-Unlicense-blue.svg" alt="Unlicense"></a>
  <a href="https://tauri.app"><img src="https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white" alt="Tauri 2"></a>
  <a href="https://web.dev/progressive-web-apps/"><img src="https://img.shields.io/badge/PWA-installable-5A0FC8" alt="Installable PWA"></a>
  <a href="https://github.com/JebbyCodes/OpenTick/releases/latest"><img src="https://img.shields.io/github/v/release/JebbyCodes/OpenTick" alt="Latest release"></a>
  <a href="https://github.com/JebbyCodes/OpenTick/actions"><img src="https://img.shields.io/github/actions/workflow/status/JebbyCodes/OpenTick/build.yml" alt="Build status"></a>
</div>

<p align="center">
  <img src="docs/images/tasks.png" width="32%" alt="Task list">
  <img src="docs/images/timetable.png" width="32%" alt="Timetable">
  <img src="docs/images/gantt.png" width="32%" alt="Gantt chart">
</p>

## Download

Get the latest version from [GitHub Releases](https://github.com/JebbyCodes/OpenTick/releases/latest), or use one of the platform-specific options below.

### Windows

| Microsoft Store | Chocolatey | Scoop |
|:---:|:---:|:---:|
| <a href="https://apps.microsoft.com/detail/9pdnntk8tz39?hl=en-GB&gl=GB"><img src="https://get.microsoft.com/images/en-us%20dark.svg" alt="Get it from Microsoft" width="150"></a> | <a href="https://community.chocolatey.org/packages/opentick"><img src="docs/images/get-it-on-chocolatey.png" alt="Get it on Chocolatey" height="44"></a> | <a href="https://github.com/JebbyCodes/OpenTick-Scoop"><img src="docs/images/get-it-on-scoop.png" alt="Get it on Scoop" height="44"></a> |

### Android

| Orion Store | Obtainium | GitHub Releases |
|:---:|:---:|:---:|
| <a href="https://rookieenough.github.io/Orion-Data/redirect.html?id=opentick&icon=https%3A%2F%2Fraw.githubusercontent.com%2FJebbyCodes%2FOpenTick%2Frefs%2Fheads%2Fmain%2Fsrc%2Flogo.png"><img src="https://raw.githubusercontent.com/RookieEnough/Orion-Store/refs/heads/main/assets/orion-badge.png" alt="Get it on Orion Store" height="44"></a> | <a href="https://apps.obtainium.imranr.dev/redirect?r=obtainium%3A%2F%2Fapp%2F%7B%22id%22%3A%22com.opentick.app%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2FJebbyCodes%2FOpenTick%22%2C%22author%22%3A%22JebbyCodes%22%2C%22name%22%3A%22OpenTick%22%2C%22preferredApkIndex%22%3A0%2C%22additionalSettings%22%3A%22%7B%5C%22includePrereleases%5C%22%3Atrue%2C%5C%22fallbackToOlderReleases%5C%22%3Atrue%2C%5C%22enableVirusTotalScan%5C%22%3Atrue%2C%5C%22observedVersionName%5C%22%3A%5C%220.4.0%5C%22%2C%5C%22observedVersionCode%5C%22%3A4000%2C%5C%22observedPackageId%5C%22%3A%5C%22com.opentick.app%5C%22%7D%22%7D"><img src="docs/images/get-it-on-obtainium.png" alt="Get it on Obtainium" height="44"></a> | <a href="https://github.com/JebbyCodes/OpenTick/releases/latest"><img src="docs/images/get-it-on-github.png" alt="GitHub Releases" height="44"></a> |

### Linux

- [Snap Store](https://snapcraft.io/opentick)
- [GitHub Releases](https://github.com/JebbyCodes/OpenTick/releases/latest)

### Web, macOS and other builds

- **Web / PWA:** use the hosted web app when available, or build and host `dist/` over HTTPS.
- **macOS:** see [GitHub Releases](https://github.com/JebbyCodes/OpenTick/releases/latest) or build on a Mac.
- **Other packages:** check the [latest release](https://github.com/JebbyCodes/OpenTick/releases/latest) for the files currently published.

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
| Web / PWA | Build `dist/` and serve it over HTTPS. |
| Windows | Download a release installer or build from source. |
| macOS | Build on macOS with the Tauri prerequisites and Xcode where required. |
| Linux | Download an available release package or build from source. |
| Android | Download the APK from a release or build it with the Android SDK. |
| iOS | Requires macOS, Xcode and Apple signing configuration. |

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

```npm
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

Browser tests are available separately with `npm run test:browser`; see the test scripts and project files for their prerequisites.

## Project structure

- `src/` — application HTML, CSS and JavaScript
- `src-tauri/` — Tauri desktop/mobile shell and platform assets
- `test/` — Node test suites and test utilities
- `scripts/` — version, licence and asset-generation scripts
- `build-app.mjs` — creates the self-contained web build
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
