# OpenTick on a smartwatch

OpenTick has a **smartwatch layout**: the same app, the same data, the same sync and the same encryption, drawn for a small round or square screen. Instead of
the sidebar and the lists there are six full-screen pages you swipe or tap between (the dots at the bottom):

| Page | What it shows |
|---|---|
| **Now** | the time, the lesson or task that is on now or next, and how many tasks are left today |
| **Tasks** | today's and overdue tasks, a big tick to finish one, and **Add** (type or dictate; "Call mum 5pm !high" is understood as usual) |
| **Next** | today's timetable, with the lesson that is on now and the one after |
| **Habits** | tap a habit to check in for today |
| **Focus** | the focus timer: start, pause, skip |
| **More** | sync now, lock, the full Settings, and a way back to the full app |

Tasks, habits, the timer and sync are the app's own. Nothing is stored separately for the watch, so everything that syncs in the app syncs here, and everything
that encryption protects is protected here. The choice of layout (Settings → Appearance → **Smartwatch layout**: Automatic / On / Off, and the screen shape) is a
setting of that device and is never synced.

## Which watches

| Watch | What you get | How to get it | Status |
|---|---|---|---|
| **Wear OS 3 or newer** (Pixel Watch, Galaxy Watch 4 and later, TicWatch, Fossil Gen 6, and others) | the app itself, with the watch layout, its own reminders and sync | `OpenTick_<version>_android-watch-universal.apk` from a release, installed with `adb` (below) | built by the release workflow; not yet tried on real watches by the person who wrote it, so treat it as new |
| **Samsung Tizen watches** (Galaxy Watch, Watch Active, Watch3, Gear S3 and S2) | the same layout as a Tizen web app | `OpenTick_<version>_tizen-unsigned.wgt`, which **you must sign** with your own Samsung certificate before installing (below) | experimental: the web engine on the oldest models is older than the app was written for, so it may not start there |
| **Any device with a modern web browser or web view** | the layout in a browser | open `/watch/` on the hosted site, from the Docker image, or from `OpenTick_<version>_web-watch.zip` on your own server; or add `?watch` to any address | works (it is also the way to try the layout on a phone) |
| **Apple Watch** | not available | an Apple Watch app has to be written in Swift as a native watchOS app; there is no web view to run this app in | not possible from this code. Notifications from the iPhone app can still show on the watch (that is the iPhone and watch's own setting) |
| **Garmin, Fitbit, Zepp OS (Amazfit), Pebble, Huawei / Honor** | not available | each has its own SDK and programming language, so each would be a separate app written from scratch | not provided. A watch that mirrors its phone's notifications shows OpenTick's reminders like any other app's |

The honest summary: Wear OS is the one real native path, Tizen is a best effort, and the web edition works anywhere a browser does. The other platforms need
their own apps, and a half-working one would be worse than none.

## The Wear OS app

Requirements: a Wear OS 3 (or newer) watch with a working web view (watches from Google and Samsung have one).

1. On the watch: Settings → System → About → Versions, tap **Build number** seven times. Then Settings → Developer options → turn on **ADB debugging**
   and **Wireless debugging**.
2. On a computer with the Android platform tools: `adb pair <ip>:<port>` (the pairing code is on the watch), then `adb connect <ip>:<port>`.
3. `adb install OpenTick_<version>_android-watch-universal.apk`.

The app starts in the watch layout by itself. It keeps your data on the watch and syncs over WebDAV like the phone app: set the address in **More → Settings →
Sync** (dictation helps), or restore it from a backup. If you use encryption, the watch asks for the same passphrase as your other devices.

What it does not have: home-screen widgets (Wear OS has none; the files are included but do nothing), tiles and complications. Reminders are the app's own
notifications and are shown by the watch itself. A custom reminder sound applies while the app is open; notifications that the system shows use the watch's own sound.

## The Tizen app (unsigned)

Samsung only runs Tizen apps that are signed with a certificate that includes the watch's ID, so a ready-made installable file cannot be published. The `.wgt` in a release
is complete but unsigned:

1. Install Tizen Studio (with its Certificate Manager) and create a Samsung certificate for your own watch, following Samsung's Galaxy Watch developer documentation.
2. Unzip the `.wgt` into a folder and sign and package it with your certificate: `tizen package -t wgt -s <your-security-profile> -- <folder>`.
3. Turn on developer mode on the watch, connect it with `sdb connect <ip>`, and install it with `tizen install -n <signed>.wgt` (or run it from Tizen Studio).

The package asks for one permission, the network, which is needed for WebDAV sync (and the optional update check). Because the app runs from local files, a WebDAV server
must allow cross-origin requests (CORS), the same as for the web app.

## Making your own

`node build-app.mjs --watch --out site-watch` builds the web edition. `node scripts/watch/make-tizen-wgt.mjs --version 0.7.0 --out staged` makes the Tizen package.
`OPENTICK_WATCH=1 npx tauri android build --apk --target aarch64 armv7` (after `node scripts/android/android-widgets.mjs --watch`) makes the Wear OS APK. The
release workflow (`.github/workflows/build-watch.yml`) does exactly this.
