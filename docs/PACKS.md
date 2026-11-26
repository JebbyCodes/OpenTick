# OpenTick packs

A **pack** is one small JSON file that carries **sections** and/or **themes** from one person to another. It is the format behind
*Settings → Sections & packs* (export, add from a file, add from pasted text, **add by code**) and the **pack library**: everything the library lists is
one of these files.

- [What a pack is (and is not)](#what-a-pack-is-and-is-not) · [Format](#format) · [Sections](#sections) · [Fields](#fields) · [Entries](#entries) · [Themes](#themes) · [Limits](#limits)
- [How the app reads a pack](#how-the-app-reads-a-pack) · [Making and sharing one](#making-and-sharing-one) · [The pack library](#the-pack-library) · [Compatibility](#compatibility)

## What a pack is (and is not)

A pack is **data only**. It has no code, no scripts, no remote files and no CSS rules: a section is a list of named fields and some optional starter
entries; a theme is a set of colour variables. OpenTick checks everything in a file and cuts it down to what the format knows *before* keeping anything,
and nothing in a pack is ever run or inserted as HTML. Adding a pack only **adds** (new sections with new ids, new themes). It never changes or
removes what you already have, never reads your data, never contacts the internet and never switches the theme you are using.

## Format

```json
{
  "opentick": "pack",
  "format": 1,
  "id": "reading-list",
  "name": "Reading list",
  "version": "1.0.0",
  "author": "Your name",
  "description": "Books to read, reading now and finished.",
  "license": "CC0-1.0",
  "homepage": "https://example.com/reading-list",
  "sections": [ … ],
  "themes":   [ … ]
}
```

| Key | Meaning |
| --- | --- |
| `opentick` | Always `"pack"`. A file without it is refused. |
| `format` | `1` for a pack that uses only what 0.9.0 knew, `2` for a pack that uses [advanced fields](#advanced-fields-format-2), [actions, related entries, reminders or permissions](#actions-related-entries-reminders-and-permissions-format-2). Use the lowest number that holds everything in the pack (the app's *Export as a pack* does). A higher number than the app knows means a newer OpenTick is needed (the app says so). |
| `id` | Lower-case words joined by hyphens (40 characters at most). |
| `name`, `description`, `author`, `version`, `license`, `homepage` | Shown when the pack is previewed. `homepage` must be `https://` or `http://`. The library asks for a semantic version (`1.2.3`) and an open licence (see [The pack library](#the-pack-library)). |
| `sections`, `themes` | At least one of them must have something in it. |

## Sections

```json
{
  "name": "Books", "icon": "book-open", "color": "#8e5cf7", "title": "Title",
  "view": "cards", "checkable": false,
  "sort": { "f": "rating", "dir": "desc" }, "group": "status",
  "fields": [ … ], "entries": [ … ]
}
```

| Key | Meaning |
| --- | --- |
| `name` | The section's name in the sidebar (40 characters). Required. |
| `icon` | An icon name from OpenTick's icon set (for example `book-open`, `leaf`, `home`, `graduation`, `gift`, `map`). An unknown name falls back to a default icon. |
| `color` | `#rgb` or `#rrggbb`. |
| `title` | What each entry's first line is called (“Title”, “Recipe”, “Place”). |
| `view` | `list`, `cards` or `table`. People can change it later. |
| `checkable` | `true` gives every entry a tick box, so the section works like a to-do list. |
| `sort` | `{ "f": <field key>, "dir": "asc" \| "desc" }`. `f` may also be `"title"` or `"created"` (date added). Entries with no value for the field go last either way. |
| `group` | The key of a `select` or `check` field to group by, or `""`. |

## Fields

Each field is `{ "key", "name", "type", "opts" }`. `key` (letters, digits, `-` and `_`, 24 characters) is how entries refer to the field inside the pack; OpenTick gives every field a fresh id when the pack is added.

| `type` | Value in an entry | Notes |
| --- | --- | --- |
| `text` | a string (500 characters) | one line |
| `note` | a string (5 000 characters) | several lines, Markdown |
| `number` | a number | |
| `date` | `"YYYY-MM-DD"` | |
| `check` | `true` | a tick box; leave it out for unticked |
| `select` | one of `opts` | `opts` is the list of choices (30 at most, 40 characters each); also what `group` and `sort` follow |
| `rating` | `1` to `5` | shown as stars |
| `url` | `"https://…"` | only `http` and `https` links are ever made clickable |
| `tags` | `["a", "b"]` | lower-case words |
| `multiselect` | `["a", "b"]` | several of `opts` (format 2) |
| `calculated` | *(none: it is worked out)* | read-only, from a `formula` (format 2) |

## Advanced fields (format 2)

A field can say much more than its type. Every property below is optional; a pack that uses any of them (or `multiselect`, `calculated`, `groups` or `templates`) is `"format": 2`.

```json
{
  "key": "pages-read", "name": "Pages read", "type": "number",
  "description": "Where you are now", "placeholder": "e.g. 120", "default": 0, "required": false,
  "min": 0, "max": 5000, "integer": true,
  "format": { "unit": "pages", "decimals": 0, "thousands": true },
  "group": "progress",
  "visibleWhen": { "field": "status", "in": ["Reading", "Finished"] }
}
```

| Property | Applies to | Meaning |
| --- | --- | --- |
| `description` | every type | A line of help under the field (200 characters). |
| `placeholder` | text, note, url, number, date, select, tags, multiselect | The grey hint in an empty box (60). |
| `default` | every type but `calculated` | What a **new** entry starts with. A date may be `"today"`. It must fit the field's own rules, or it is left out. |
| `required` | every type but `check` and `calculated` | An entry cannot be saved while the field is shown and empty. |
| `min`, `max` | `number`: the smallest and largest value. `date`: `"YYYY-MM-DD"` or `"today"`. `multiselect`, `tags`: how many may be chosen. | A range nobody could meet (`min` above `max`) is left out, with a warning. |
| `minLength`, `maxLength` | text, note, url | How long the text may be. |
| `integer` | number | Whole numbers only. |
| `format` | number, calculated, date | How the value is shown: `prefix`, `suffix` (spaces you type are kept), `unit`, `decimals` (0 to 6), `style` (`number`, `integer`, `percent` shows 45 as 45%, `ratio` shows 0.45 as 45%, and for calculated fields `date`), `thousands` (`false` turns grouping off), `dateFormat` (`short`, `long`, `iso`), `progress` (`true` draws a bar) and `progressMax` (the value at which the bar is full, 100 unless set; for `ratio` 1 is full). |
| `group` | every type | The `key` of one of the section's `groups`. |
| `visibleWhen` | every type | When the field is shown, see below. |

**Groups and templates** belong to the section:

```json
"groups": [ { "key": "progress", "name": "Reading progress", "description": "optional" } ],
"templates": [ { "key": "ebook", "name": "Ebook", "description": "optional", "title": "New ebook",
                 "notes": "optional", "values": { "status": "Reading", "genres": ["Fiction"] } } ]
```

Fields without a group come first in the entry form, then each group in its own box. A template is a starting point for a new entry: its `values` (by field key) are written over the field defaults, and applying it to an entry that is being edited fills only what is empty, never what was typed. Up to 8 groups and 8 templates per section.

**`visibleWhen`** says when a field is shown. One condition is `{ "field": <key>, <test> }`, the test being one of `"equals": v`, `"notEquals": v`, `"in": [..]`, `"notIn": [..]` or `"filled": true | false`. `{ "all": [..] }` and `{ "any": [..] }` combine up to four conditions (one level deep). `equals: ""` means "has no value"; for a tick box `equals: true` means ticked. A field that is hidden **keeps whatever was typed** but counts as empty for everything else: other conditions, formulas, required and the other rules, the list, the search and the sort. A condition that leads back to itself (A shown when B, B shown when A) is left out with a warning.

**Calculated fields** have `"type": "calculated"` and a `formula`:

```json
{ "key": "percentage-done", "name": "Percentage done", "type": "calculated",
  "formula": "min(100, round(100 * [pages-read] / [total-pages], 1))",
  "format": { "style": "percent", "decimals": 1, "progress": true } }
```

A formula is read by a small parser inside OpenTick (`src/js/formula.js`): it is **never run as code**, there is no `eval`, no `Function`, and nothing in it can reach anything but the numbers, dates, tick boxes and ratings of the same entry. It has numbers, `+ - * / % ^` and parentheses, comparisons (`< <= > >= = == != <>`, giving 1 or 0), the constants `pi`, `e`, `true` and `false`, and the functions `min`, `max`, `round(x, digits)`, `abs`, `floor`, `ceil`, `sqrt`, `pow`, `mod`, `sum`, `avg`, `clamp(x, lo, hi)`, `if(test, then, else)`, `and`, `or`, `not`, `n(x)` (a missing value as 0), `blank(x)` and `today()`. `[key]` names a field; in the app's editor people write `[Field name]` and OpenTick stores ids, so a rename breaks nothing.

- An input that is **empty makes the result empty** (not 0): a half-filled entry shows nothing instead of a wrong number. Use `n([x])` to count a missing value as 0.
- Dividing by zero, a missing field, a field that is text, tags or a choice (only numbers, dates, tick boxes and ratings can be used), a formula that refers to itself (even through other formulas), and a formula over 300 characters, 120 steps or 24 levels deep are all **errors**: the field shows a warning with the reason and the entry can still be saved. In the app's editor, a formula that does not work cannot be saved.
- A calculated field is **not stored**. It is worked out whenever it is shown, so it can never disagree with its inputs, and it is never synced; every device works out the same value. Dates are whole days, so `today() - [started]` is a number of days.
- A calculated field can be used by other formulas and by `visibleWhen`, shown in the list, sorted by and searched. **Pack actions and reminders read stored values**: a reminder can follow a stored date field, not a calculated one. A hidden field counts as empty for them too, and `{key}` in a message or link gives a calculated field's result as it is shown.

**What the app does with all of this.** When a pack is read, every value is checked: a property of the wrong kind for a field, a default or template value its own field would refuse, an unknown group, a condition that needs a field the section does not have, a formula that does not work, or an entry value that breaks a rule (a number out of range, a choice that is not in `opts`, a link that is not a web address, a text too long) is left out and listed in the warnings; the library's checks require **no warnings**. An entry that is missing a required value is **kept** and marked *needs attention* on the page: nothing a person has is ever deleted by a rule. Data that arrives by **sync** is treated the same way: it is never discarded for breaking a rule, only marked, so a device that is behind (or ahead) cannot lose entries on another.

## Actions, related entries, reminders and permissions (format 2)

A pack is data, so it can never *run* anything. What a section can do is **declare** things that OpenTick then does for it, and OpenTick does them only as far as the person has allowed. The Reading tracker pack (`packs/reading-tracker.json` in the [pack library](https://github.com/JebbyCodes/OpenTick-Packs), from library version 1.1.0) is a complete example that uses all four.

### Permissions: `permissions`

A pack that wants to touch Tasks, Notes or reminders lists what it needs at the top level. Each permission is **one capability on one target**; there is no "everything in Tasks".

```json
"permissions": { "sections": [
  { "id": "tasks", "reason": "So a book can have its own reading tasks.", "capabilities": [
    { "id": "search_records",      "scope": { "fields": ["title"] },                     "required": false, "reason": "Look up a task you already have by its title." },
    { "id": "view_record_summary", "scope": { "fields": ["title", "status", "due-date"] }, "required": false },
    { "id": "create_record",       "required": false },
    { "id": "complete_record",     "scope": { "records": "pack-created" },              "required": false }
  ] },
  { "id": "reminders", "capabilities": [ { "id": "create_reminder", "required": false } ] }
] }
```

| Target | Capabilities (scope that can narrow them) |
| --- | --- |
| `tasks` | `discover_section`, `discover_fields`, `list_records`, `search_records` (fields: `title`, `tags`), `view_record_summary` (fields: `title`, `status`, `due-date`, `priority`, `tags`), `view_record_details`, `create_record`, `update_specific_fields` (fields; records), `delete_own_records`, `link_records`, `view_relationships`, `unlink_own_records`, `complete_record` (records), `reopen_record` (records) |
| `notes` | `discover_section`, `discover_fields`, `list_records`, `search_records` (fields: `title`, `tags`), `view_record_summary` (fields: `title`, `tags`, `updated`), `view_record_details`, `create_record`, `update_specific_fields` (fields; records), `delete_own_records`, `link_records`, `view_relationships`, `unlink_own_records` |
| `habits` | `discover_section`, `list_records` (title only), `read_statistics` |
| `projects` | `discover_section`, `list_records` (title only), `search_records` (title only) |
| `pack:<id>` (another installed pack's sections) | `discover_section`, `list_records`, `search_records` (title), `view_record_summary` (title, done) |
| `reminders` | `create_reminder`, `view_own_reminders`, `view_user_reminders`, `edit_own_reminders`, `edit_user_reminders`, `cancel_own_reminders`, `cancel_user_reminders`, `snooze_dismiss` |

**Scopes** make a permission smaller and are shown to the person in plain words. `fields` is which fields may be read or changed; `records` is `pack-created` (only records this pack made through OpenTick, as OpenTick recorded it, never as the pack says) or `pack-linked` (records the pack's own entries are linked to). A capability that does not exist, a field that cannot be shared or a record rule that is not supported is **left out with a warning in the preview**, never silently widened. The limits are 12 permission groups and 24 capabilities in each. `required` only decides whether the box starts ticked on the install screen (and shows a "Required" label); the person can untick it, and a pack that is refused a permission still installs, with the parts that need it not working. A pack that marks nothing `required` (as the library's Reading tracker does) asks for nothing by default.

**How the person decides.** The preview shows every permission with what it reads or changes and why. **Nothing is allowed unless it is ticked**, and only a permission the pack marks `required` starts ticked. They can change any of them later in *Settings → Sections & packs* (the pack's **Permissions** button) and take one back at any moment. Decisions are stored with the rest of the person's data, so they are synced and sealed like it. A permission that is revoked on any device is revoked everywhere (a grant made without knowing about a later revocation counts for nothing), and merging two devices can only ever narrow a scope. A device that joins an account **after** permissions were decided asks the person to review them once before they apply there; until then nothing a pack declared runs on it.

**Enforcement is in OpenTick, not on the screen.** Every call a pack's declarations lead to, from a button, a panel or a background reminder, asks the permission check first. A switched-off or removed pack, a revoked permission or a field outside its scope is refused whatever called it, and the refusal is written to the activity list. That list (*Settings → Sections & packs*, the pack's **Activity** button) records what each pack did or was refused, with the permission involved but **never the contents** of a task, note or reminder, and a task or note a pack created can be undone from it.

### Actions: `actions` (up to 8 in a section)

An action is a button on an entry.

```json
{ "id": "reading-task", "name": "Add a reading task", "icon": "checklist", "op": "create_task", "link": true,
  "map": { "title": "Read {title}", "due": "{finish-by}", "notes": "{author}", "tags": "reading" } }
```

| `op` | Does | Permissions it needs |
| --- | --- | --- |
| `create_task` | adds a task (`map`: `title`, `due`, `notes`, `priority`, `tags`) | `tasks.create_record` (+ `tasks.link_records` with `"link": true`) |
| `create_note` | adds a note (`map`: `title`, `body`, `tags`) | `notes.create_record` (+ `notes.link_records` with `"link": true`) |
| `link_task`, `link_note` | links a task or note the person picks by title | `search_records`, `link_records`, `view_record_summary` on that target |
| `complete_linked` | marks the linked tasks done | `tasks.view_relationships`, `tasks.complete_record` |
| `reopen_linked` | opens them again | `tasks.view_relationships`, `tasks.reopen_record` |

In `map`, `{title}` is the entry's title and `{field-key}` is the value of one of the section's fields. An action whose permissions are not in the pack's `permissions` could never run, so it is **left out with a warning**. An action only ever runs when the person presses it. With `complete_linked` and a `records: "pack-created"` scope, a task the person linked themselves is left alone.

### Related entries: `related` (one per target, `tasks` and `notes`)

A panel on an entry that lists the tasks or notes linked to it: `{ "target": "tasks", "fields": ["title", "status", "due-date"], "title": "Reading tasks" }`. It needs `view_relationships` and `view_record_summary` on that target, and shows only the fields the permission allows (for Tasks: `title`, `status`, `due-date`, `priority`, `tags`; for Notes: `title`, `tags`, `updated`).

### Reminders: `reminders` (up to 8 in a section)

```json
{ "id": "finish-by", "name": "Finish by", "kind": "date", "field": "finish-by", "before": [1440, 0], "time": "09:00",
  "title": "Finish {title}", "skipWhen": { "field": "status", "equals": "Paused" } },
{ "id": "read-a-little", "name": "Read a little", "kind": "repeat", "every": { "n": 1, "unit": "day" }, "time": "20:00",
  "from": "started", "until": "finished", "on": false }
```

| Key | Meaning |
| --- | --- |
| `id`, `name` | Lower-case id (30 characters, unique in the section) and the name the person sees. |
| `kind` | `date`: at a date field of the entry. `repeat`: every `every.n` `day`/`week`/`month` (n up to 365), optionally only on `days` (0 Sunday to 6 Saturday). |
| `field` | For `date`: the date field. If it is empty or the field is hidden, there is no reminder. |
| `before` | For `date`: minutes before the date's `time` (up to five values, each 0 to 43200). `[1440, 0]` is a day before and on the day. |
| `time` | `HH:MM`, the person's local time. |
| `from`, `until` | For `repeat`: date fields that bound it. An empty `from` is the day the entry was created; an empty `until` means no end. |
| `scope` | `entry` (the default) or, for `repeat`, `section`: one reminder for the whole section that lists how many entries are open. |
| `title`, `body` | Text with `{title}` and `{field-key}`. |
| `on` | Whether it starts switched on (default `true`). The person can switch each reminder on or off, for one entry or the whole section, and set its time. |
| `skipDone`, `skipWhen` | Skip ticked-off entries (default `true`) or entries whose field equals a value. |

Reminders need `reminders.create_reminder`; without it they are left out with a warning, and until the person allows it nothing is scheduled. There is no second reminder engine: they appear in OpenTick's own reminder list and can be snoozed or dismissed like any other, and what the person dismissed on one device stays dismissed on another. The person can also add one-off reminders to an entry themselves, which do not need any permission.

### Installing, switching off, removing and syncing

Installing a pack, its permission decisions, its reminder settings, its sections and entries and the activity list all travel with the account's own sync (and its encryption). **Events are not replayed**: a task a pack created on one device exists once because the *task* is synced, and an action is never run again on another device merely because its entry in the activity list arrived. Switching a pack off, or removing it, keeps the person's entries and any tasks and notes it made; it only stops what the pack declared.

## Library-only: `tags`

A pack that is submitted to the [pack library](https://github.com/JebbyCodes/OpenTick-Packs) may carry one more top-level field, `"tags": ["study", "school"]`: up to six lower-case words that the library's website and the in-app browser use to find the pack by topic. OpenTick itself ignores the field when it adds a pack, so a pack with or without it behaves the same.

## Entries

```json
{ "title": "Dune", "vals": { "author": "Frank Herbert", "status": "Finished", "rating": 5 }, "notes": "Read it twice.", "done": false }
```

`vals` is keyed by the field `key`s. Starter entries are optional (a pack of empty sections is fine and often best). Links to people (`contactIds`) are never part of a pack, in either direction.

## Themes

```json
{ "name": "Forest", "base": "dark", "vars": { "--bg": "#16201b", "--text": "#e3ede6", "--acc": "#5fbf8a" } }
```

`base` is `dark` or `light` (what the theme is closest to). `vars` may use only these variables, and a theme must set at least `--bg`, `--text` and `--acc`:

`--bg` page · `--side` sidebar and panels · `--text` · `--muted` · `--line` borders · `--hover` · `--sel` selected row · `--acc` accent · `--on-acc` text on the accent · `--red` overdue · `--p1` `--p2` `--p3` priorities · `--card` · `--shadow`

A value is a colour (`#rgb`, `#rrggbb`, `rgb()`, `rgba()`, `hsl()`) or, for `--shadow`, a box-shadow of at most 80 characters made of letters, digits and `# ( ) , . % / -`. Anything containing `url`, `var(`, `import`, `expression` or `javascript` is refused, as is a value with unbalanced brackets. Themes are added to *Settings → Appearance → Custom themes*; the person picks one.

## Limits

12 sections, 24 fields per section, 500 entries per section, 30 choices per field, 6 themes, 2 MB per file. If a pack is over a limit the app reads what fits and says what it left out. The library keeps packs under 400 KB.

## How the app reads a pack

`packClean` (in `src/js/packs.js`) builds a **new** object from the file: keys the format does not name are not copied, text is cleaned of control characters and cut to length, colours and links are checked, entry values are cut to their field's type, and anything that does not fit is dropped with a plain-language **warning** in the preview (*“2 values in ‘Books’ did not fit their field and were left out”*). Text is always shown as text (escaped), and notes are rendered as Markdown without raw HTML.

## Making and sharing one

1. Build the section in the app. Set up its fields, view, sort and grouping.
2. *Settings → Sections & packs → Export as a pack*. Choose the sections and whether to include the entries. Give it a name, author and licence.
3. Send the file to someone, or share it with everyone by adding it to the [pack library](#the-pack-library) (below). The library's checks read your file the way the app does and tell you if the app would change anything in it.

## The pack library

The library is its own repository, **[OpenTick-Packs](https://github.com/JebbyCodes/OpenTick-Packs)**, and its website lists every pack with a preview, a download button and a **code**.

**Using it, in the app.** *Settings → Sections & packs → Pack library* (or the command palette, or *New section → By code…*):

- **Type a code.** Every pack has a code like `K7QM-3XRD` (8 letters and digits, no I, L, O or U, so nothing looks like anything else). Type it in any case, with or without the dash. OpenTick finds the pack, shows what is in it, and adds it when you say so.
- **Browse.** Search by name, author, topic or code, filter by sections or themes, and open any pack to look inside before adding it.
- **From the website.** Each pack on the website has the same code, a Download button (the plain file, which *Add a pack…* reads) and an *Open in OpenTick* link for the web app.

OpenTick contacts the library only when you press one of those buttons. It sends nothing about you or your data. (The one optional exception, [pack usage counts](#pack-usage-counts-optional-off-by-default), is off until you turn it on.) Everything it fetches goes through the same checks as a file from disk, and the file must match the size and SHA-256 the library's index lists.

### Pack usage counts (optional, off by default)

The library's website can show "Used 1,245 times" for a pack and sort by "Most used". The numbers come from people who turned on **Settings → Sections & packs → Pack usage counts**. It is **off** until you turn it on; while it is off OpenTick makes no request and makes no token. (If you turned it on before, the device keeps a short list of the packs it already counted, only on the device, so that turning it back on does not count them twice.)

- **What counts as use:** after a pack was added *from the library* (never from a file or pasted text), the first time on this device that you save or tick off one of its entries, run one of its actions, or pick one of its colour themes. Adding a pack, browsing the library and downloading a file are not use. A pack is counted once per device.
- **What is sent, once per pack per device:** the pack's id and a random code made for that pack on that device, and nothing else. No entry, note, task, name or field value; no account, user or device identifier; no version. The code is there only so that a retry is not counted twice; it is deleted from the device as soon as the service confirms the count, is never shared by two packs, and is not synced. A request like any other carries the IP address; the service does not store it.
- **Where it goes:** the address of the library's usage service, which the library publishes in `index.json` (`"usage"`). OpenTick checks it (https only, no login, no query) and learns it only while counting is on. If the library publishes none, nothing can be sent and nothing is shown. If the service cannot be reached the count waits on the device and is tried again later; turning counting off throws away what is still waiting.
- **What the numbers mean:** only people who turned counting on are in them, so the real number of people using a pack is higher, and two devices of the same person count twice. They are a guide, not a ranking of quality. The website says so beside the figures and never shows a made-up zero: with no figures available it shows no number at all.

How the service works, what it keeps (a total per pack and a hash of each code for 60 days) and how to put it online: [`usage/README.md`](https://github.com/JebbyCodes/OpenTick-Packs/blob/main/usage/README.md) in the library's repository.

**Adding yours.** Open a pull request to OpenTick-Packs with one file, `packs/<id>.json` (the repository's `CONTRIBUTING.md` has the steps; the GitHub web editor is enough). Robots check it and the maintainer reviews it:

- the app reads it **with no warnings** (nothing had to be dropped or changed);
- its `id` matches its file name, and `version` looks like `1.2.3` (and goes up when you update a pack that is already there);
- it is under a licence that lets everyone use and share it: `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `MIT`, `Apache-2.0`, `ISC` or `Unlicense`;
- it has an author and a description, contains no personal data, and is under 400 KB;
- **a performance and error run:** the pack is installed into a real OpenTick in a headless browser (with the processor slowed down to about a phone's speed), and the app's start-up time, memory, screen-drawing time and console are compared with the same app without the pack. A pack that makes start-up or a section slow, or that makes the app throw an error, fails.

Once the pull request is merged, the library's website and index are rebuilt, and the pack's code starts working in every OpenTick within a few minutes. The code is worked out from the pack's `id`, so it never changes, and the check shows it in the pull request before it is merged.

**How the library is built** (for the curious, and for forks). `index.json` has one row per pack: `code`, `id`, `file`, `name`, `version`, `author`, `description`, `license`, `sections`, `themes`, `entries`, `tags`, `size`, `sha256`, `updated`. The app (`src/js/packlib.js`) reads it from the library's website, drops any row that is not well formed, and refuses a file that does not match its row. Point `PKL.base` at your own copy to run a library of your own.

## Compatibility

`format` only changes when old packs could no longer be read. New OpenTick versions keep reading every earlier format; a pack that uses nothing new stays `"format": 1` and works in every version that reads packs. An older OpenTick that meets a newer `format` refuses it politely instead of guessing, which is why a pack that uses advanced fields says `2` and a 0.9.0 app says it needs a newer OpenTick instead of showing a calculated field as an empty text box.

A pack that says `format: 1` but uses format 2 features is still read by this version (with a warning, so the author fixes the number). Sections made before 0.9.1 are unchanged by it: a field that has none of the new properties is stored exactly as before.
