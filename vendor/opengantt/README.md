# Vendored OpenGantt

`npm run sync:gantt` downloads the current OpenGantt app (`dist/Gantt.html`) and its README from
https://github.com/JebbyCodes/OpenGantt into this folder, together with `UPSTREAM.json` (commit, date, checksum, and any
chart keys the README documents that OpenTick does not handle yet).

`node build-app.mjs` ships `Gantt.html` as `dist/OpenGantt.html` and turns on the **OpenGantt** pane on the Gantt page.
Without these files the build still works; that pane is simply not offered.

CI (`.github/workflows/sync-opengantt.yml`) runs the sync every day and opens a pull request when upstream changed.
Commit the files this script writes.
