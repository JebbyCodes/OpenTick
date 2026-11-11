# Changelog

## 0.8.0

**Fixed**
- Fixed: **pressing Calendar lit the wrong button and opened Classes** when you had a view pinned (for example Classes). Calendar, or whichever section sits fourth, now lights up when you press it and opens itself. A pinned view is lit only when you pressed that pin, so two buttons are never lit at once.
- Fixed: **the "Next" line on a project card did not scroll to its end.** Long names that slide sideways (calendar chips, timetable blocks, task rows in a narrow window, the project card) now always travel to their real last letter. The old version measured the text in advance and could stop short.
- Fixed: a menu or a tooltip no longer closes by itself while a long name is sliding past.
- Fixed: the phone's tab bar fits six sections and **More** on a small screen, and More stays at the end when pins make the bar scroll. The printed Help guide's contents list is in two columns again.

**App**
- New: **drag a long name with your hand.** A name that is too long and slides can now be moved yourself: drag it with the mouse, swipe it on a touch screen, use a trackpad or Shift + mouse wheel. It holds still while you read and carries on a moment after you let go. With Animations off or "reduce motion" it does not move by itself but can still be dragged.
- New: **pinned views are part of the sections' order.** Drag a pin among the sections, or use **Move earlier / Move later** in its right-click (or press-and-hold) menu, or the arrows in Settings → Layout. One order for the sidebar and the phone's tab bar, kept on each device.
- New: **Contacts**, a book of the people you work and study with: name, nickname, role, organisation, any number of labelled emails and phone numbers, website, address, birthday, time zone, notes and tags, and **available hours** (the card says "Available now · until 3:00 PM" or "Free tomorrow from 9:00 AM", worked out in their time zone). Filter by available now, favourites, tags or class contacts; sort and search. Email and phone buttons open your own mail and phone apps; OpenTick sends nothing.
- New: **link people to your work.** A task, a note, a class or a section entry can be linked to any number of people, and the person's page lists everything linked to them. Write `@[Name]` in a note (or type `@` in the block editor, or use the Mention button in the toolbar) for a link to their page; rename a person and mentions follow. In the task box, `+anna` links a person ("Send the report +anna tomorrow").
- New: **teachers are contacts.** Every teacher in Classes is also a contact, with name, email and phone shared both ways, grouped as **Class contacts** on the Contacts page. Existing teachers become contacts the first time you open 0.8.0.
- New: **your own sections.** Make a section for anything (a reading list, recipes, spending, gift ideas, workouts) with the fields you choose: text, note, number, date, tick box, choice, rating, link or tags. Show it as a list, cards or a table, sort and group it, give it a colour and icon, search it, link people, pin it, hide it, use it as your start screen. **Add a section…** is in Settings → Layout and the command palette; seven templates are built in.
- New: **packs.** Settings → Sections & packs exports your sections as one small file, and adds a pack someone sent you (a file or pasted text). A pack holds only sections, starter entries and colours: no code, no internet, no access to your data, and it never switches your theme. Adding a pack always makes new sections and never overwrites yours. Four sample packs are in the repository's `marketplace/` folder (study planner, garden journal, home maintenance, calm themes) and published at `/marketplace/` on the website. A marketplace for packs and themes is planned and will use these same files; the author guide is `docs/PACKS.md`.
- Changed: search (Ctrl + K) finds people and your own sections' entries; the start screen can be Contacts or one of your sections; the Help page has chapters for Contacts and for sections and packs; the privacy policy covers both.

**Releases**
- New: **Prepare release** workflow (Actions → Prepare release). Type the version and it bumps every file, pushes `release/vX.Y.Z` and opens a pull request with a checklist; it never tags or publishes.
- New: **every release run ends with a status table** of all stages (required or optional, passed or failed), GitHub's release notes are grouped by pull request label (`.github/release.yml`), and CI checks the pack library (`npm run packs:check`), which the website also serves.
- Changed: `docs/RELEASING.md` is reorganised (quick start, what a run does, the workflows, release notes, CI, secrets, platform notes, troubleshooting).

**Sync and encryption**
- **The sync file is now schema 7.** It adds contacts, your sections and their entries, and the people linked to tasks, notes and classes. **Update every device to 0.8.0 before syncing between them:** an older version refuses a file written by a newer one ("please update this app") rather than guessing, and a 0.8.0 device reads an older file as having no contacts or sections and keeps its own. Deleting a contact or a section is carried to the other devices like any other deletion.
- Contacts, sections and entries are encrypted, backed up, exported and synced like tasks and notes: sealed when encryption is on and re-sealed when it is turned on, off or re-keyed. Tests cover every collection, merging edits from two devices, and encryption on and off.
- The layout (the order of sections and pins) stays a setting of the device and is never part of the sync file.

## 0.7.0

**App**
- New: **pin any page next to the sections.** Right-click (or press and hold on a touch screen) a page title or a tab, for example open Calendar and right-click **Classes**, and choose **Pin "Classes" to the sidebar** (to the tab bar on a phone). It appears beside Projects, Tasks, Notes, Calendar and Habits. It is a shortcut: the tab stays where it was. Right-click or press and hold a pinned button to open, move or unpin it. You can pin up to 10 pages: any view (Board, Matrix, Timeline, Templates, Countdowns, Time zones, Focus …), a way of looking at the Calendar (Month, Week, 3 days, Day, Agenda) or a page of Classes (Exams, Homework …). Settings → General → Layout lists the pins and lets you reorder them, and the command palette can pin and unpin the page you are on.
- New: **your own reminder sound.** Settings → Sound & focus → Reminder sound: choose an MP3, WAV, OGG or M4A file (up to 5 MB and 30 seconds). It replaces the built-in chime for reminders, the focus timer and the test notification, at the volume you set for sounds. Notifications that the system shows by itself (the Android background service, or the desktop app while its window is closed) use the system's own sound, which an app cannot replace; the setting says so.
- New: **check for updates, off by default.** Settings → About & privacy → Updates has **Check now** (one request when you press it) and **Check for updates automatically** (once a day while OpenTick is open, and it tells you once per new version). Nothing is downloaded or installed: it opens the release page. The only request goes to GitHub's public latest-release address for this project and carries nothing about you or your data. If you installed OpenTick from a store or package manager, update it there.
- New: **smartwatch layout.** Six full-screen pages for a small round or square screen (Now, Tasks, Next, Habits, Focus, More): tick tasks off, add one by typing or dictating, see today's timetable, check habits in, run the focus timer, sync and lock. It is the same app and the same data. Settings → Appearance → Smartwatch layout (Automatic / On / Off, and the screen shape); it turns on by itself in the watch builds and on watches that identify themselves, and `?watch` on the address tries it in any browser.
- Changed: the Help page has sections for pinned pages, the reminder sound, updates and the smartwatch layout, and the privacy policy says what the update check sends and when.

**Smartwatches and releases**
- New: **watch editions for every release.** `OpenTick_<version>_android-watch-universal.apk` for Wear OS 3 or newer (Pixel Watch, Galaxy Watch 4 and later, TicWatch and others), `OpenTick_<version>_tizen-unsigned.wgt` for Samsung's older Tizen watches (it is not signed: Samsung requires each installer to sign it with their own certificate), `OpenTick_<version>_web-watch.zip` for your own server, and `/watch/` on the hosted site and in the Docker image. The two watch packages are built by a new workflow, `build-watch.yml`, and are optional: if one fails, the release is still made without it and says so. `docs/WATCHES.md` explains each platform, how to install, and what cannot be done (Apple Watch, Garmin, Fitbit and Zepp watches each need an app written for them; their reminders can still arrive through the phone's notifications).
- Changed: **the README now keeps only the latest release's notes**, with older releases listed in CHANGELOG.md. The downloads are directly under the screenshots, and the screenshots are new. `npm run bump` no longer piles the previous release into the README.

**Sync and encryption**
- The sync file is unchanged (still schema 6), so older and newer versions keep syncing with each other. Pinned pages, the reminder sound, the update setting and the watch layout are settings of the device: they are never part of the sync file. They are sealed with the other settings when device encryption is on.
- The reminder sound file is stored in the same encrypted store as attachments: sealed when encryption is on, re-sealed when it is turned on, off or re-keyed, and removed when the settings are reset. Tests cover turning encryption on and off with a sound chosen, and a watch syncing with a phone through an encrypted file.

## 0.6.2

**App**
- Changed: **Calendar and Timetable are one Calendar now.** One switcher holds **Month**, **Week**, **3 days**, **Day**, **Agenda** and **Classes** (your school or course timetable, one tap away), next to Countdowns and Time zones. Month and Agenda list tasks by date; Week, 3 days and Day are the time grid with lessons, weekly slots and timed tasks (what the Timetable view was). Switching keeps the date you were looking at. Old saved layouts and links still work: the Timetable's saved view, the "Timetable" page in widgets and links, and a calendar left on Week or Day all land on the right view.
- Changed: **the Calendar's toolbar is the same everywhere and says what it does.** Back, **Today**, forward, one **Add** button, and a **More** menu (unscheduled tasks, second time zone, holidays and days off, timetable settings) instead of seven unlabelled icons. Inside Classes a labelled **Calendar** button goes back. The quick day strip is only shown on phones.
- Fixed: **Templates could not be reached from Notes on a computer.** The Notes / Templates switcher was hidden whenever a note was open, which on a computer is always. It now stays (it is only hidden on a phone while a note fills the screen), and the Notes page has a **New note from a template** button.
- Fixed: **keyboard shortcuts showed up on hover and were hard to see otherwise.** Key caps now sit on the sidebar pages, the search box and buttons with words on them all the time and never appear on hover; an icon button names its shortcut at the end of its tooltip, so hovering shows only the tooltip. Turning the setting off removes both.
- Fixed: **headings now match their tabs.** The Timeline tab opened a page headed "Gantt", Habits one headed "Habit", Board one headed "Boards"; every page is headed with its tab's name (Calendar's date range sits under the switcher).
- Fixed: **tapping a section in Settings made the strip of sections jump.** Settings is now a list of sections on the left (a strip on a phone that stays where it is) beside one scrolling pane; the strip is no longer inside the part that scrolls.
- New: **search in Settings.** Type in the box at the top: every setting answers with its section and what it does; picking one opens the section and flashes the setting.
- New: **search everything.** Press **/** or **Ctrl + K**, or click the search box in the sidebar. Tasks, notes, templates, lists, projects, tags, habits, countdowns, time zones, boards, timetable slots, pages, commands and settings all answer from one place, grouped, with the words you typed marked; **↑ ↓** choose, **Enter** opens, and "See all tasks" hands the words to the Tasks page's own search. The old sidebar box only searched tasks.
- Small: the Habits widget, page and tab are all "Habits"; the command palette says "Timeline" where it said "Gantt".

**Android widgets**
- Fixed (rebuilt, not just hardened): widgets that still showed "Can't load widget". This could not be reproduced without a device, so the cause is a best reading of how home screens apply a widget, and the widgets were rebuilt around it: every list widget is a small header plus **one small layout per row** added to a list box (no more 7–10 rows hidden inside one big layout), every view is found by its id (nothing is looked up by name, which a minified release build can break), nothing scrolls sideways like a marquee (that went through a call some launchers refuse), the box is cleared before rows are added, and the data file is found in the app's own folder first. If a widget still cannot be drawn it shows the small plain card with the reason. The Kotlin was compiled against the Android API here and the layouts are checked by `npm test`, but it has not been run on a phone: please say if a widget still fails and which one.
- Changed: the Timetable widget gets room and teacher on their own lines and drops the week arrows only on a very narrow widget; the Calendar widget shows the weeks that fit; month names shorten on a narrow widget.

**Sync and encryption**
- Nothing about the sync file or encryption changed (still schema 6); the Calendar merge and the search only change how things are shown, and the layout choices stay on the device.

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

## 0.6.0

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

**Sync and encryption** (sync format 5): templates, holidays, repeat ends, exceptions and reminders sync with everything else and are encrypted when encryption is on. Device settings (accessibility, shortcuts, background service) stay on the device.

**F-Droid**: the repository now carries Fastlane metadata (`fastlane/metadata/android`) and a draft F-Droid build recipe (`docs/fdroid/`).
