# Connecting other apps to OpenTick

OpenTick has one small, versioned interface for other apps: the **OpenTick Bridge** (v1). It is meant for companion apps such as a focus timer, a launcher or a dashboard. It is **off by default** and works entirely on the device: no server, no account.

- [How it works](#how-it-works) · [Pairing](#pairing) · [Transports](#transports) · [Commands](#commands) · [Errors](#errors) · [Events](#events) · [Opening a task in another app](#opening-a-task-in-another-app) · [The sync file](#the-sync-file) · [Security](#security)

## How it works

Every transport ends in the same dispatcher, so behaviour, permissions and limits are identical whichever you use. A request is `{ app, token, cmd, args }`; an answer is `{ ok: true, result }` or `{ ok: false, error: { code, message } }`.

The person switches the Bridge on in **Settings → Integrations**. An app then **pairs** once, the person chooses what it may do, and OpenTick gives the app a token.

## Pairing

`app` is your app's id: 2 to 40 characters from `a-z 0-9 . - _`, starting with a letter or digit (for example `com.example.focus`).

1. Call `pair` with `{ name, permissions: [...] }`. OpenTick shows who is asking (and from which origin) and the person ticks the permissions they allow. They may allow fewer than you asked for, so read `permissions` in the reply.
2. The reply carries a `token` **once**. Store it safely. OpenTick keeps only a hash, on this device only.
3. Send `app` and `token` with every later request. Pairing again replaces the token; **Disconnect** in Settings removes the app at once.

| Permission | Allows |
| --- | --- |
| `tasks:read` | `meta.list`, `tasks.list`, `tasks.get`, `tasks.changes`, `app.open` |
| `tasks:write` | `tasks.add`, `tasks.complete`, `tasks.reopen` |
| `focus:write` | `focus.record` |
| `countdowns:read` | `countdowns.list` |

`hello` needs no pairing and no permission.

## Transports

### 1. Links (x-callback-url)

```
opentick://x-callback-url/<command>?app=<id>&token=<token>&<arg>=<value>…&x-success=<url>&x-error=<url>&x-cancel=<url>
```

- Arguments are plain query parameters, or one JSON object in `args`.
- `opentick://<command>?…` also works. The installed web app answers `web+opentick:<command>?…`.
- On success OpenTick opens `x-success` with `ok=1` and `result=<JSON>` added. On failure it opens `x-error` with `ok=0`, `errorCode` and `errorMessage`. A declined pairing goes to `x-cancel` (or `x-error`).
- A reply may only go to a custom scheme, `https:`, or `http:` on `localhost` / `127.0.0.1`. `javascript:`, `data:`, `file:` and the like are never used.
- **Android:** `opentick://` links are registered (an invisible activity queues the link; the app handles it when it opens).
- **Web / installed web app:** `web+opentick:` links open `/?link=…`.
- **Desktop (Linux, Windows, macOS):** `opentick://` links open the running OpenTick (or start it) and are handled there. Linux and Windows register the scheme for the current user when you switch **Connect other apps** on, and remove it when you switch it off (Linux: a `.desktop` entry; Windows: `HKCU\Software\Classes\opentick`). macOS declares it in the app's `Info.plist`, so it is available once the app is installed. A Windows Store (MSIX) install cannot add the registration at run time.
- **iOS:** the scheme is declared in the app's `Info.plist`; a link opens OpenTick and is handled as above.
- A link is only acted on while **Connect other apps** is on, exactly like every other transport; with it off the link is ignored.

### 2. window.postMessage

From a page that embeds OpenTick (iframe) or opened it (popup):

```js
w.postMessage({ opentick: 1, id: 7, app: 'com.example.focus', token, cmd: 'tasks.list', args: { due: 'today' } }, 'https://opentick.example');
window.addEventListener('message', e => { if (e.data && e.data.opentick === 1 && e.data.id === 7) console.log(e.data.ok, e.data.result || e.data.error); });
```

Pairing over postMessage records the sender's **origin**; later requests from any other origin are refused. Messages from opaque (`null`) origins are ignored.

### 3. Files (read-only sharing)

See [The sync file](#the-sync-file).

## Commands

Dates are `YYYY-MM-DD`, times `HH:MM` (24-hour), moments are milliseconds since 1970.

| Command | Arguments | Result |
| --- | --- | --- |
| `hello` | none | `{ app, bridge, version, commands, permissions }` |
| `meta.list` | none | `{ lists, projects, tags }` |
| `tasks.list` | `scope` (`''`, `list:ID`, `project:ID`, `tag:name`), `status` (`open` default, `done`, `all`), `due` (`today`, `overdue`, `week`, a date), `q`, `since`, `limit` (1 to 500), `include` (`notes`) | `{ count, tasks }` |
| `tasks.get` | `id`, `include` | `{ task }` |
| `tasks.changes` | `since` (ms), `include` | `{ now, tasks, deleted }`: everything changed since, and ids deleted (any record type). Store `now` and pass it next time. |
| `tasks.add` | `title`, `notes`, `due`, `time`, `tz` (IANA), `durationMin`, `listId`, `tags`, `priority` (0 to 3) | `{ task }` |
| `tasks.complete` / `tasks.reopen` | `id` | `{ task }` (a repeating task moves to its next date) |
| `focus.record` | `minutes` (1 to 600), `taskId`, `endedAt` | `{ recorded: true }`, added to OpenTick's own focus history |
| `countdowns.list` | `scope` | `{ countdowns }` with `momentMs` |
| `app.open` | `op` (`open`, `page`, `nav`), `id` | `{ opened: true }` brings OpenTick forward |
| `pair` | `name`, `permissions` | `{ token, permissions }` |

A task looks like `{ id, title, status, due, time, tz, durationMin, priority, listId, list, tags, repeats, subtasks, created, updated, doneAt }`. Notes are left out unless you ask with `include: 'notes'`. `time` and `due` are the person's own local time; `tz` says which zone it was planned in.

Limits: 120 requests a minute per app; 500 tasks per call.

## Errors

`off` (Bridge switched off) · `locked` (OpenTick is locked) · `unknown_command` · `bad_args` · `unauthorized` (not paired, wrong token, wrong origin) · `forbidden` (permission not granted) · `not_found` · `denied` (the person declined) · `rate_limited` · `bad_origin` · `error`.

## Events

When the Bridge is on, OpenTick announces `task.completed` and `task.reopened` as `{ opentick: 1, event, task, at }` on the `BroadcastChannel` named `opentick.bridge` (same-origin windows, such as OpenTick's own widget windows), and by `postMessage` to the embedding or opening window when its origin is paired with `tasks:read`.

Between apps on a device, events are **pulled**: call `tasks.changes` with the last `now` you saw. This works whether or not either app was running.

## Opening a task in another app

Settings → Integrations has a link template, for example `myfocus://start?task={id}&title={title}&minutes={minutes}`. Placeholders: `{id} {title} {minutes} {list} {project} {tags} {due}`, URL-encoded for you. A task's menu then shows **Open in your other app**. Only custom schemes and `https:` are accepted.

A focus app can finish the loop with `focus.record`, which logs the session in OpenTick, or `tasks.complete`. Anything beyond that (levels, rewards, streaks) belongs in the other app; OpenTick only stores tasks and the time spent.

## The sync file

OpenTick's sync file (`opentick.json`, schema 7) is JSON with `tasks`, `lists`, `projects`, `tags`, `habits`, `notes`, `slots`, `templates`, `school`, `countdowns`, `zones`, `boards`, `contacts`, `csections`, `centries` and a `tomb` of deleted ids. `contacts` are people (name, emails, phones, available hours …); `csections` are the sections a person made (name, icon, colour, fields, view) and `centries` their entries (`sid` is the section, `vals` maps a field id to its value). Tasks, notes, subjects and entries may carry `contactIds`, the ids of the people linked to them (the link is kept on this side only; a contact's own list of links is worked out). A teacher in `school` carries `contactId`, the contact that mirrors it. Sections and packs are described in [PACKS.md](PACKS.md). A file with a lower `schema` than this one is read as having no contacts or sections, and they are kept as they are here. Each record has `u`, the time it last changed; the newest edit wins, record by record, and a deletion beats an older edit. A task's place on a board is `task.kb = { [boardId]: columnId }`.

If the person turned on encryption for sync, the file is sealed (AES-256-GCM, key derived from their passphrase) and is not readable by another app. Reading or writing it is therefore only for apps that share the passphrase; most apps should use the Bridge instead. Never write a file with a lower `schema` than you read.

## Security

- Off until the person turns it on; each app is approved individually, with the permissions the person chose.
- Tokens are random, shown once, stored hashed, on this device only. They are device settings: never in the sync file, backups or exports.
- Replies never go to `javascript:`, `data:`, `file:` or plain-http remote addresses.
- No command can reach the passphrase, the vault, sync credentials or attachments.
- When OpenTick is locked, every command answers `locked`.
