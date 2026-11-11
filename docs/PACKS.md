# OpenTick packs

A **pack** is one small JSON file that carries **sections** and/or **themes** from one person to another. It is the format behind
*Settings → Sections & packs* (export, add from a file, add from pasted text) and the future **marketplace**: anything a marketplace lists is one of
these files, so a pack you make today will work there.

- [What a pack is (and is not)](#what-a-pack-is-and-is-not) · [Format](#format) · [Sections](#sections) · [Fields](#fields) · [Entries](#entries) · [Themes](#themes) · [Limits](#limits)
- [How the app reads a pack](#how-the-app-reads-a-pack) · [Making and sharing one](#making-and-sharing-one) · [The library](#the-library-marketplace) · [Compatibility](#compatibility)

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
| `format` | `1`. A higher number means a newer OpenTick is needed (the app says so). |
| `id` | Lower-case words joined by hyphens (40 characters at most). |
| `name`, `description`, `author`, `version`, `license`, `homepage` | Shown when the pack is previewed. `homepage` must be `https://` or `http://`. The library asks for a semantic version (`1.2.3`) and an open licence (see [The library](#the-library-marketplace)). |
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
3. Check the file: `npm run packs:check` (in the repository) reads every pack in `marketplace/` the way the app does and fails if the app would change anything in it.
4. Send the file to someone, or add it to the library.

## The library (marketplace)

`marketplace/` in the repository is the pack library. Until a marketplace is built into the app it is a plain folder of files you can download and add by hand.

```
marketplace/
  index.json          the list of packs
  packs/<id>.json     one file per pack
```

`index.json`:

```json
{ "opentick": "marketplace", "format": 1, "updated": "2026-11-10",
  "packs": [ { "id": "study-planner", "file": "packs/study-planner.json", "name": "Study planner", "version": "1.0.0",
               "author": "OpenTick", "description": "…", "license": "CC0-1.0", "sections": 1, "themes": 0, "entries": 3, "tags": ["study"] } ] }
```

To add a pack: put the file in `marketplace/packs/`, add its entry to `index.json` (the counts must match the file), and open a pull request. CI runs `npm run packs:check` and the pack tests. A pack is accepted when:

- the app reads it **with no warnings** (nothing had to be dropped or changed);
- its `id` matches its file name and its index entry, and `version` looks like `1.2.3`;
- it is under a licence that lets everyone use and share it: `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `MIT`, `Apache-2.0`, `ISC` or `Unlicense`;
- it has an author and a description, contains no personal data, and is under 400 KB.

The in-app marketplace will list this same index and install packs through the same checks as a file; nothing about the format will need to change. Because packs are data only, installing one from anywhere is as safe as opening a text file.

## Compatibility

`format` only changes when old packs could no longer be read. New OpenTick versions keep reading every earlier format. An older OpenTick that meets a newer `format` refuses it politely instead of guessing.
