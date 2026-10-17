// Attachments: picking from a native dialog (desktop paths and Android content:// URIs), naming, typing, errors, duplicates.
import assert from 'node:assert/strict';
import { makeApp, fakeIndexedDB } from './harness.mjs';

const bytes = (...a) => new Uint8Array(a);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0]);
const fdb = fakeIndexedDB(), app = makeApp({ indexedDB: fdb });
const toasts = []; app.els['#toast'] = { classList: { add() {}, remove() {}, toggle() {} }, set textContent(v) { toasts.push(v); }, append() {} };
const empty = a => assert.equal(a.length, 0, 'expected an empty list');
const lastToast = () => toasts[toasts.length - 1] || '';

/* ---- names and types ---- */
assert.equal(app.nameFromPath('/home/me/Docs/report.pdf'), 'report.pdf');
assert.equal(app.nameFromPath('C:\\Users\\me\\notes.txt'), 'notes.txt');
assert.equal(app.nameFromPath('content://com.android.externalstorage.documents/document/primary%3ADocuments%2Fplan%20b.pdf'), 'plan b.pdf');
assert.equal(app.nameFromPath('content://com.android.providers.downloads.documents/document/msf%3A1000012345'), '', 'a provider id is not a file name');
assert.equal(app.nameFromPath('content://media/external/images/media/4411'), '', 'a bare number is not a file name');
assert.equal(app.nameFromPath(null), '');
assert.equal(app.mimeFromName('a.PDF'), 'application/pdf');
assert.equal(app.mimeFromName('noext'), '');
assert.deepEqual([...app.sniffFile(PDF)], ['pdf', 'application/pdf']);
assert.deepEqual([...app.sniffFile(PNG)], ['png', 'image/png']);
assert.equal(app.sniffFile(bytes(1, 2, 3)), null);
assert.equal(app.sniffFile(new Uint8Array(0)), null);

/* ---- error messages say what happened and what to do ---- */
const cls = (m, n = 'x.pdf') => app.classifyReadError(new Error(m), n);
assert.equal(cls('fs.read_file not allowed. Permissions associated with this command: fs:allow-read-file').kind, 'permission');
assert.equal(cls('forbidden path: content://x').kind, 'permission');
assert.equal(cls('No such file or directory (os error 2)').kind, 'missing');
assert.equal(cls('provider timed out').kind, 'provider');
assert.equal(cls('something odd').kind, 'read');
assert.ok(/choose it again/i.test(cls('denied').message) && /x\.pdf/.test(cls('denied').message), 'permission error is actionable and names the file');
assert.ok(/cloud/i.test(cls('network down').message));

/* ---- a fake native dialog + fs ---- */
function tauri({ picks, files, stat }) {
  const calls = { open: 0, read: [] };
  app.win.__TAURI__ = {
    dialog: { open: async () => { calls.open++; if (picks instanceof Error) throw picks; return picks; } },
    fs: { readFile: async p => { calls.read.push(p); const f = files[p]; if (f instanceof Error) throw f; if (f === undefined) throw new Error('No such file or directory (os error 2)'); return f; }, ...(stat ? { stat: async p => stat[p] } : {}) },
  };
  return calls;
}
const DL = 'content://com.android.providers.downloads.documents/document/msf%3A77';
const PRIM = 'content://com.android.externalstorage.documents/document/primary%3ADocuments%2Fplan.pdf';

// Android: a content URI with a readable name -> a File with that name and the right type
let c = tauri({ picks: PRIM, files: { [PRIM]: PDF } });
let out = await app.pickFiles();
assert.equal(out.length, 1); assert.equal(out[0].name, 'plan.pdf'); assert.equal(out[0].type, 'application/pdf'); assert.equal(out[0].size, PDF.length);
assert.deepEqual(c.read, [PRIM], 'the content URI is passed to the fs plugin untouched');

// Android: a provider id with no name -> the type is recovered from the bytes and the name gets an extension
tauri({ picks: DL, files: { [DL]: PNG } });
out = await app.pickFiles();
assert.equal(out.length, 1); assert.match(out[0].name, /^attachment-\d+\.png$/); assert.equal(out[0].type, 'image/png');

// several files, one of them unreadable: the good one is kept, the message names the bad one
const BAD = '/x/locked.pdf';
tauri({ picks: [PRIM, BAD], files: { [PRIM]: PDF, [BAD]: new Error('forbidden path') } });
out = await app.pickFiles();
assert.equal(out.length, 1); assert.equal(out[0].name, 'plan.pdf');
assert.ok(/locked\.pdf/.test(lastToast()) && /choose it again/i.test(lastToast()), lastToast());

// the same file picked twice is read once
c = tauri({ picks: [PRIM, PRIM], files: { [PRIM]: PDF } });
out = await app.pickFiles(); assert.equal(out.length, 1); assert.equal(c.read.length, 1);

// cancel -> nothing, no error
tauri({ picks: null, files: {} }); out = await app.pickFiles(); empty(out);
// the picker itself failing (no provider / no activity) is reported, not thrown
tauri({ picks: new Error('no activity found to handle the intent'), files: {} }); out = await app.pickFiles(); empty(out); assert.ok(/picker could not be opened/i.test(lastToast()));
// a file that is gone / empty / too large
tauri({ picks: '/x/gone.pdf', files: {} }); empty(await app.pickFiles()); assert.ok(/could not be found/.test(lastToast()));
tauri({ picks: '/x/empty.txt', files: { '/x/empty.txt': new Uint8Array(0) } }); empty(await app.pickFiles()); assert.ok(/is empty/.test(lastToast()));
tauri({ picks: '/x/huge.mp4', files: { '/x/huge.mp4': PDF }, stat: { '/x/huge.mp4': { size: app.FILE_MAX + 1 } } }); empty(await app.pickFiles()); assert.ok(/larger than 40 MB/.test(lastToast()));
// object-shaped results ({ path }) and an ArrayBuffer from the plugin are tolerated
tauri({ picks: { path: '/x/a.pdf' }, files: { '/x/a.pdf': PDF.buffer.slice(0) } }); out = await app.pickFiles(); assert.equal(out[0].name, 'a.pdf');

// a second tap while the dialog is open does not open a second dialog
let release; const gate = new Promise(r => { release = r; });
app.win.__TAURI__ = { dialog: { open: () => gate }, fs: { readFile: async () => PDF } };
const first = app.pickFiles(); const second = await app.pickFiles(); empty(second);
release('/x/a.pdf'); assert.equal((await first).length, 1);
assert.equal((await app.pickFiles().then(() => 1)), 1, 'the guard is released afterwards');

/* ---- attaching: stored, listed, deduplicated ---- */
delete app.win.__TAURI__;
const t = app.S.tasks[0], mk = (n, b, type = '') => new File([b], n, { type });
let added = await app.filesAdd('task', t.id, [mk('plan.pdf', PDF, 'application/pdf')]);
assert.equal(added.length, 1); assert.equal(t.files.length, 1); assert.ok(fdb.kv.has('file:' + added[0].id), 'bytes are in storage');
added = await app.filesAdd('task', t.id, [mk('plan.pdf', PDF, 'application/pdf')]);
assert.equal(added.length, 0); assert.equal(t.files.length, 1); assert.ok(/already attached/.test(lastToast()));
added = await app.filesAdd('task', t.id, [mk('plan.pdf', new Uint8Array([...PDF.slice(0, 8), 99]), 'application/pdf')]);
assert.equal(added.length, 1, 'same name, different content is kept');
added = await app.filesAdd('task', t.id, [mk('empty.txt', new Uint8Array(0))]);
assert.equal(added.length, 0); assert.ok(/is empty/.test(lastToast()));
assert.equal(t.files.length, 2);
// an unknown owner is ignored; storage failure leaves no half-record
empty(await app.filesAdd('task', 'nope', [mk('a.pdf', PDF)]));
const realOpen = fdb.open; fdb.open = () => { const o = {}; setTimeout(() => o.onerror && o.onerror(), 0); o.error = new Error('quota'); return o; };
const before = t.files.length; added = await app.filesAdd('task', t.id, [mk('new.pdf', PDF)]);
assert.equal(added.length, 0); assert.equal(t.files.length, before, 'no record without bytes'); assert.ok(/could not be stored/.test(lastToast()));
fdb.open = realOpen;
console.log('attachment tests passed');
