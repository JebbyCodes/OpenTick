# Encryption, sync and statistics audit (0.9.1)

This is the audit behind release 0.9.1. It records what was found in the code, what was changed, and what is **still open**. Every statement about behaviour
names the test that checks it; a row marked *pending* describes something that is not finished in this release.

## 1. What the encryption is

OpenTick's optional vault (`src/js/vault.js`) is **end-to-end encryption, not only encryption at rest**:

* One random 256-bit data key (DEK) encrypts the data with AES-256-GCM (Web Crypto; no home-made primitives, no dependencies). A fresh 96-bit nonce is used for
  every blob, and the associated data binds a blob to this vault and to its purpose (`local`, `sync`, `backup`, `snapshot`, `file`, `cred`, `premerge`), so a
  blob cannot be passed off as another kind.
* The DEK is stored only *wrapped*: by a key derived from the passphrase (PBKDF2-HMAC-SHA256, 600 000 rounds, random salt) and, if the person made one, by a
  recovery key. In memory it is a non-extractable `CryptoKey`.
* The sync server (WebDAV, GitHub, file) only ever receives the sealed envelope. A new device joins by typing the passphrase; nothing else is shared.
* Three scopes are chosen independently: **device** (stored data, attachments, automatic restore points, sync logins), **backups** (exported files) and **sync**
  (the cloud copy).
* Everything added in 0.9.1 is an ordinary record of a collection in `COLL`, so it travels inside the same sealed payload and is covered by the same scopes:
  pack installs, permission decisions, pack activity, pack reminders, shortcuts, the statistics tally and the synced preferences.
  `test/syncall.mjs` enforces this: it iterates `COLL` and fails for a collection that has no factory, that does not arrive on a second device, or that leaves a
  readable trace in the cloud file.

**Key handling.** Changing the passphrase or the recovery key re-wraps the *same* DEK (header version `hv` goes up), so existing backups and devices keep working.
There is no in-place rotation of the DEK itself: to get a new DEK, turn encryption off and on again, which re-seals everything (`vaultDisable`, `vaultEnable`,
`vaultReseal`; attachments through `fileReseal`). The cryptographic parameters were not changed in 0.9.1.

**Analytics.** The app sends none. The pack-library usage statistics of OpenTick-Packs (a separate project, opt-in, anonymous) never include user content, keys
or pack data.

### Metadata that cannot be encrypted

| Where | What is readable | Why |
|---|---|---|
| Cloud file envelope | `app`, `kind`, `schema`, `enc` (sealed), the time it was written (`at`), the vault id, the key-derivation parameters and salt, the wrapped keys (useless without the passphrase), the header version, the compression flag and the nonce `iv`; the data itself is `ct` | a new device needs them to derive the key before it can open anything |
| Cloud file / folder | the file name `opentick.json`, its size and modification time, and so when you sync | the storage provider sees them |
| This device, `opentick.vault.v1` | the same header, the scopes, the auto-lock setting, and the **name of the last theme** (so the lock screen can be drawn in it) | needed before unlock |
| This device, `opentick.sync.v1` | provider, server address, folder, this device's random id, last-sync time | the logins in it are sealed when device encryption is on |
| This device, `opentick.wcmd` | the last widget → main-window command (a task id or a page name), until the next one overwrites it | cross-window message |

Without encryption turned on nothing is sealed: the sync file is plain JSON, as it always was.

## 2. Audit matrix

"Sealed" = covered by the vault scopes above when they are on. "Merge" is what happens when two devices have the record. `COLL` is the list the whole app derives
`snapshot`, `mergeData`, `applyMerged`, `EMPTY_DATA`, `parsePayload`, `fingerprint` and `replaceAll` from, so a record in it cannot be forgotten by one of them.

| Data | Lives in | Synced | Sealed | Merge | Deletion | Verified by |
|---|---|---|---|---|---|---|
| Tasks (incl. due dates, reminders, subtasks, file *metadata*) | `S.tasks` | yes | yes | newest edit per record | tombstone | `test/sync.mjs`, `test/syncall.mjs` |
| Notes | `S.notes` | yes | yes | newest edit | tombstone | same |
| Habits and check-ins | `S.habits` | yes | yes | per day, so ticks on two devices both survive | tombstone | `test/sync.mjs` |
| Calendar entries | the calendar has no records of its own: it shows tasks with dates, timetable slots (`S.slots`), classes (`S.school`) and countdowns (`S.countdowns`) | yes | yes | newest edit | tombstone | `test/syncall.mjs` |
| Projects, lists, tags, templates, zones, boards, contacts | `S.projects` … | yes | yes | newest edit | tombstone | `test/syncall.mjs` |
| Custom sections and their entries (what packs fill) | `S.csections`, `S.centries` | yes | yes | newest edit | tombstone | `test/syncall.mjs`, `test/v080.mjs` |
| Pack installation state, versions, configuration | `S.packs` | collection travels | yes | newest edit | tombstone | `test/syncall.mjs`, `test/packstate.mjs` (install record, switching off and on, removing keeps the data, a removal stands, adding again, deleting the data) |
| Pack permission decisions and scopes | `S.pkperms` | collection travels | yes | never widen (`COLL_MERGE.pkperms`): the later revocation wins, a grant made without knowing about it counts for nothing, two grants keep only the scope they share | tombstone | `test/syncall.mjs`, `test/packperm.mjs` (merge laws, revocation, enforcement at the API) |
| Pack activity history | `S.pkact` | collection travels | yes | newest edit; events are history, never re-run (an event has one id, so it is never doubled) | tombstone | `test/syncall.mjs`, `test/packperm.mjs` |
| Pack reminder definitions and states | `S.pkrem` | collection travels | yes | configuration: newest edit; acknowledgements: dismissed > snoozed > shown, then newest; one-off reminders: newest per item | tombstone | `test/syncall.mjs`, `test/packrem.mjs` |
| Keyboard shortcuts | `S.shortcuts` | collection travels | yes | newest edit | tombstone | `test/syncall.mjs`, `test/shortcuts.mjs` |
| Calculated fields, conditions, groups, templates | part of the section's field definitions in `S.csections`. A calculated **value** is never stored: every device works it out from the other fields | yes | yes | newest edit of the section | with the section | `test/xfields.mjs` |
| Links from a pack's entry to tasks and notes | `links` on the entry (`S.centries`) | yes | yes | with the entry | with the entry | OpenTick-Packs `test/reading-tracker.test.mjs` (the links arrive on a second device through the real encrypted sync file) |
| Records a pack created (tasks, notes) | ordinary `S.tasks` / `S.notes`; *who made them* is in the activity history (`S.pkact`) | yes | yes | newest edit | tombstone | `test/packperm.mjs`; OpenTick-Packs `test/reading-tracker.test.mjs` (a task made on one device counts as the pack's own on the other, and is not made twice) |
| **User preferences** | `S.settings` ↔ `S.prefs` | **yes (new)** | yes | newest change per key (see §3) | resetting settings propagates | `test/prefs-sync.mjs` |
| **User-facing statistics** | `S.acts` | **yes (new)** | yes | per key, the larger count | Reset statistics propagates | `test/stats-sync.mjs` |
| Attachment metadata (name, type, size) | on the record that owns the file | yes | yes | with the record | with the record | `test/syncall.mjs` |
| Attachment **bytes** | IndexedDB `file:<id>` | **no** (see §4) | yes, on the device when device encryption is on | – | removed with the record | `test/vault.mjs` (the attachment is stored sealed) |
| Focus-timer log | `S.pomo` | yes | yes | union | – | `test/sync.mjs` |
| History list ("what changed on this device") | `S.history` | no, on purpose | yes, on the device | – | – | `test/stats-sync.mjs` §3 |
| Which reminders have fired here | `S.fired` | no, on purpose | yes, on the device | – | – | – |
| Device settings (layout and sizes, pinned views, background services, bridge, update checks, e-ink and watch layouts, sounds, the recording switch of History, vibration, view state) | `S.settings` | no, on purpose | yes, on the device | – | – | `test/prefs-sync.mjs` checks each stays put |
| Sync logins | `opentick.sync.v1(.sec)` | no | sealed when device encryption is on | – | – | `test/vault.mjs` |
| Restore points and the pre-merge copy | IndexedDB `snap:*`, `…premerge` | no | sealed with the `snapshot` / `premerge` scopes | – | – | `test/vault.mjs` |
| Exports (backup file) | a file | – | sealed when the `backup` scope is on | – | – | `test/vault.mjs` |

Exports are `{ ...S }`, so a backup now also carries the new collections; restoring one restores the preferences and keeps the statistics already counted
(`test/prefs-sync.mjs` §7, `test/stats-sync.mjs` §6).

## 3. What changed in this audit

1. **Statistics differed between devices.** Cause: the tally behind the Statistics page (`S.activity`) was kept per device and never synced, so two devices of one
   person each showed only what they had counted themselves. Fix: the tally is now the synced collection `S.acts` — one record per device per day, counts merged
   per key by the larger value (a grow-only counter: commutative, associative, idempotent, tombstone-aware) — and the page is a pure function of those records
   (`actDays()`), so identical synced data gives identical numbers. The old per-device tally is adopted once into the device's own records.
   Proof: `test/stats-sync.mjs` runs independent devices through the real encrypted sync file (identical numbers after syncing, offline divergence then
   convergence in any order, re-syncing never changes a number, migration of 0.9.0 tallies without doubling, reset, merge laws).
2. **Preferences were never synced.** Now an allow-list (`PREF_SYNC` in `core.js`) travels as `S.prefs`, one record per key (`pf-<key>`):
   theme and custom themes, sort, grouping, first day of the week, new-task defaults, quiet hours, digest, tips, keyboard hints, clock, planner hours,
   accessibility (except vibration), focus-timer lengths (except "face down"), Gantt options (except pixel sizes), timetable hours (not its view), notes grouping.
   A key at its factory value has **no record** until somebody changes it, so a new device with defaults can never overwrite what was chosen elsewhere.
   A remote record cannot reach a key or sub-key outside the list, and a value of the wrong shape or type is ignored. Two devices changing the *same key* at the same
   time keep the newer change (all sub-keys of that key go with it). Resetting the settings (Delete everything → reset settings) deletes the records, which resets
   the same preferences on the other devices. After preferences arrive the theme and accessibility attributes are re-applied.
3. **Deterministic record ids no longer lose to old tombstones.** A record created with an id that was deleted earlier (`pf-…`, `ac-…`, `pp-…`) is now stamped
   newer than the tombstone, so it cannot be swallowed by the deletion that preceded it.
4. **`COLL_MERGE`** lets a collection supply its own merge rule (used by `acts` and by `pkperms`, which never widens access). A stale copy that was deleted at
   least as recently as it was edited takes no part in such a merge, so a reset or a revocation cannot be brought back by an old device.
5. **Schema 8** (`SYNC_V`): a 0.9.0 app refuses a schema-8 file with its existing "needs a newer OpenTick" message instead of silently dropping what it does not know.
6. **The release pipeline** failed on a stale generated file (`src/js/licenses.gen.js`) after dependency updates; it is regenerated (`npm run licenses`).

## 4. Known limits (not hidden)

* **Attachment bytes stay on the device they were added on** (their metadata syncs, and another device shows "not on this device"). This is the existing design to
  keep the sync file small. Syncing the bytes would need a separate chunked, sealed blob store on every provider; it is **not** done in 0.9.1.
* **`fired` is per device**, so with several devices each can notify for the same task reminder. Pack reminders have a setting (Settings → Sections & packs, a pack's **Reminders** button, *On your devices*): *Notify on every device* (the default) or *Notify on the first device that gets it; the others stay quiet once they know it was shown* (`test/packrem.mjs`). Dismissing or snoozing a pack reminder always syncs.
* **History list is per device** by design; only the counts behind Statistics are shared. History must be on for a device to *record*; a device with History off
  still shows everyone's counts.
* Statistics: a device that is offline, keeps counting, and syncs after someone pressed *Reset statistics* can bring its own older counts back; the day and the
  hour of an action are fixed by the time zone of the device that did it.
* Tombstones are kept 180 days. A device that has been offline longer than that can bring back something deleted in the meantime (existing behaviour).
* There is no separate offline queue: the local data *is* the queue. Every change is saved locally first and merged by id on the next sync (on the `online` event,
  when the tab becomes visible, on the auto-sync timer, or by hand), so a retry never duplicates a record. A failed sync is shown in the status icon
  (`error` / `offline` with the server's message), and nothing is discarded on failure.
* Mixed versions: 0.9.0 devices cannot sync with schema-8 files until updated.
* The preferences of one key are merged as a unit (§3.2), not per sub-key.

## 5. Adding data in the future

Add the collection's name to `COLL` in `core.js` and one factory to `test/syncall.mjs` (it fails otherwise). Everything else — saving, stamping, merging,
tombstones, sealing, export, restore, "delete everything" — follows from the list. Keep device-local state (delivery state, caches, "last shown") out of synced
records, because `stamp()` treats any change to a record as an edit.
