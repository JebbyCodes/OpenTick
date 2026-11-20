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
| `format` | `1`. A higher number means a newer OpenTick is needed (the app says so). |
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

OpenTick contacts the library only when you press one of those buttons. It sends nothing about you or your data. Everything it fetches goes through the same checks as a file from disk, and the file must match the size and SHA-256 the library's index lists.

**Adding yours.** Open a pull request to OpenTick-Packs with one file, `packs/<id>.json` (the repository's `CONTRIBUTING.md` has the steps; the GitHub web editor is enough). Robots check it and the maintainer reviews it:

- the app reads it **with no warnings** (nothing had to be dropped or changed);
- its `id` matches its file name, and `version` looks like `1.2.3` (and goes up when you update a pack that is already there);
- it is under a licence that lets everyone use and share it: `CC0-1.0`, `CC-BY-4.0`, `CC-BY-SA-4.0`, `MIT`, `Apache-2.0`, `ISC` or `Unlicense`;
- it has an author and a description, contains no personal data, and is under 400 KB;
- **a performance and error run:** the pack is installed into a real OpenTick in a headless browser (with the processor slowed down to about a phone's speed), and the app's start-up time, memory, screen-drawing time and console are compared with the same app without the pack. A pack that makes start-up or a section slow, or that makes the app throw an error, fails.

Once the pull request is merged, the library's website and index are rebuilt, and the pack's code starts working in every OpenTick within a few minutes. The code is worked out from the pack's `id`, so it never changes, and the check shows it in the pull request before it is merged.

**How the library is built** (for the curious, and for forks). `index.json` has one row per pack: `code`, `id`, `file`, `name`, `version`, `author`, `description`, `license`, `sections`, `themes`, `entries`, `tags`, `size`, `sha256`, `updated`. The app (`src/js/packlib.js`) reads it from the library's website, drops any row that is not well formed, and refuses a file that does not match its row. Point `PKL.base` at your own copy to run a library of your own.

## Compatibility

`format` only changes when old packs could no longer be read. New OpenTick versions keep reading every earlier format. An older OpenTick that meets a newer `format` refuses it politely instead of guessing.
