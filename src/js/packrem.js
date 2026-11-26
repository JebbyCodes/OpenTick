/* OpenTick pack reminders (0.9.1): declarative reminders for pack entries, run by the app's existing reminder scheduler (remind.js), synced through S.pkrem.
   There is NO second reminder engine. A section of a pack may declare reminders (section.reminders); remEntries() asks pkrEntries() for the occurrences that fall in a window,
   exactly as it does for tasks, lessons and countdowns, and checkReminders() / the background service (bg.js) fire them the same way.
     kinds:  date    – relative to a date field of the entry ("1 day before Finish by", "on the day"), several offsets per reminder
             repeat  – every n days / weeks / months at a time of day, per entry or once for the whole section (scope: 'section')
     the person can: switch one off for one entry or for the whole section, change its time, add reminders of their own to an entry (one-offs), snooze and dismiss.
   State that is the PERSON's (what they switched off, changed, dismissed, snoozed) lives in S.pkrem records, one per (pack, entry, reminder), with a deterministic id so two
   devices that set the same thing up end up with one record. Merging is deterministic (config: newest edit; acknowledgements: dismissed > snoozed > shown, then newest;
   one-offs: newest per item), so a reminder dismissed on one device is dismissed on all of them, and stays dismissed.
   What is NOT synced, on purpose: which notifications THIS device has already shown (S.fired, as for every other reminder) – each device notifies for itself.
   Permissions: the pack's own declared reminders need reminders.create_reminder (deny by default). Reminders the PERSON adds to an entry are theirs and need nothing. */

/* ---------- the record ---------- */
// (function declarations only: migrate() reaches these while core.js is still loading)
function pkrHash(s) { let a = 0x811c9dc5, b = 0x9e3779b9; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = Math.imul(b + c, 2246822519) >>> 0; b ^= b >>> 13; } return a.toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0'); }
function pkrRecId(packId, eid, rid) { return 'pr-' + pkrHash(packId + '|' + eid + '|' + rid); }
function pkrNormalise(r) {
  if (!r || typeof r !== 'object') return null;
  const n = v => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0), s = (v, k) => String(v == null ? '' : v).slice(0, k);
  const packId = /^[a-z0-9-]{1,40}$/.test(r.packId || '') ? r.packId : '', eid = /^[\w-]{0,60}$/.test(r.eid || '') ? (r.eid || '') : null, rid = /^[a-z0-9-]{0,30}$/.test(r.rid || '') ? (r.rid || '') : null;
  if (!packId || eid === null || rid === null) return null;
  const c = r.cfg && typeof r.cfg === 'object' && !Array.isArray(r.cfg) ? r.cfg : {}, bf = Array.isArray(c.bf) ? [...new Set(c.bf.filter(x => Number.isFinite(x) && x >= 0 && x <= 43200).map(Math.round))].sort((a, b) => a - b).slice(0, 5) : null;
  const cfg = { on: c.on === true || c.on === false ? c.on : null, tm: /^([01]\d|2[0-3]):[0-5]\d$/.test(c.tm || '') ? c.tm : '', bf: bf && bf.length ? bf : null };
  const ack = {}, aSrc = r.ack && typeof r.ack === 'object' && !Array.isArray(r.ack) ? r.ack : {};
  for (const k of Object.keys(aSrc).slice(0, 120)) { const a = aSrc[k]; if (k.length > 90 || !a || typeof a !== 'object' || !['d', 'z', 'n'].includes(a.s)) continue; ack[k] = { s: a.s, t: n(a.t), z: a.s === 'z' ? n(a.z) : 0, dev: s(a.dev, 60) }; }
  const once = {}, oSrc = r.once && typeof r.once === 'object' && !Array.isArray(r.once) ? r.once : {};
  for (const k of Object.keys(oSrc).slice(0, 40)) { const o = oSrc[k]; if (!/^[a-z0-9]{1,12}$/.test(k) || !o || typeof o !== 'object' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(o.at || '')) continue; once[k] = { at: o.at, t: s(o.t, 80), by: o.by === 'pack' ? 'pack' : 'user', x: o.x === true, u: n(o.u) }; }
  return { id: pkrRecId(packId, eid, rid), packId, eid, rid, cfg, cu: n(r.cu), ack, once, u: n(r.u) };
}
const pkrRank = s => (s === 'd' ? 3 : s === 'z' ? 2 : 1);
const pkrCmp = (a, b) => { const x = [pkrRank(a.s), a.t, a.z, a.dev], y = [pkrRank(b.s), b.t, b.z, b.dev]; for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; };
COLL_MERGE.pkrem = (x, y, w) => {
  const a = pkrNormalise({ ...x }), b = pkrNormalise({ ...y }); if (!a || !b) return w;
  const cfgFrom = a.cu !== b.cu ? (a.cu > b.cu ? a : b) : (prefCanon(a.cfg) <= prefCanon(b.cfg) ? a : b), ack = {}, once = {};
  for (const k of new Set([...Object.keys(a.ack), ...Object.keys(b.ack)])) ack[k] = !a.ack[k] ? b.ack[k] : !b.ack[k] ? a.ack[k] : pkrCmp(a.ack[k], b.ack[k]) >= 0 ? a.ack[k] : b.ack[k];
  for (const k of new Set([...Object.keys(a.once), ...Object.keys(b.once)])) once[k] = !a.once[k] ? b.once[k] : !b.once[k] ? a.once[k] : a.once[k].u !== b.once[k].u ? (a.once[k].u > b.once[k].u ? a.once[k] : b.once[k]) : (prefCanon(a.once[k]) <= prefCanon(b.once[k]) ? a.once[k] : b.once[k]);
  const m = pkrNormalise({ ...w, cfg: cfgFrom.cfg, cu: cfgFrom.cu, ack, once }); m.u = w.u;
  if (prefCanon({ ...m, u: 0 }) !== prefCanon({ ...w, u: 0 })) m.u = Math.max(x.u || 0, y.u || 0) + 1; // differs from the winner → it has to travel
  return m;
};
const pkrIndex = () => new Map((S.pkrem || []).map(r => [r.id, r]));
function pkrRecFor(packId, eid, rid) { const id = pkrRecId(packId, eid, rid); let r = S.pkrem.find(x => x.id === id); if (!r) { r = pkrNormalise({ packId, eid, rid }); S.pkrem.push(r); } return r; }
const pkrTick = prev => Math.max(Date.now(), (prev || 0) + 1);

/* ---------- what a section may declare (reminders on a section; function declarations: xsNormalise reaches this from migrate) ---------- */
function pkrKeepDefs(list) {
  const seen = {}, out = [], sid = v => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : '');
  for (const d of (Array.isArray(list) ? list : []).slice(0, 8)) {
    if (!d || typeof d !== 'object' || !/^[a-z0-9][a-z0-9-]{0,29}$/.test(d.id || '') || seen[d.id] || (d.kind !== 'date' && d.kind !== 'repeat')) continue; seen[d.id] = 1;
    const e = d.every && typeof d.every === 'object' ? d.every : {}, unit = ['day', 'week', 'month'].includes(e.unit) ? e.unit : 'day', nn = Math.min(365, Math.max(1, Math.round(+e.n) || 1));
    const bf = [...new Set((Array.isArray(d.before) ? d.before : [0]).filter(x => Number.isFinite(x) && x >= 0 && x <= 43200).map(Math.round))].sort((a, b) => a - b).slice(0, 5), sw = d.skipWhen && typeof d.skipWhen === 'object' && sid(d.skipWhen.field) ? { field: sid(d.skipWhen.field), equals: String(d.skipWhen.equals == null ? '' : d.skipWhen.equals).slice(0, 60) } : null;
    out.push({ id: d.id, name: String(d.name || '').trim().slice(0, 40) || 'Reminder', kind: d.kind, field: d.kind === 'date' ? sid(d.field) : '', before: bf.length ? bf : [0], time: /^([01]\d|2[0-3]):[0-5]\d$/.test(d.time || '') ? d.time : '09:00',
      every: { n: nn, unit }, days: [...new Set((Array.isArray(d.days) ? d.days : []).filter(x => Number.isInteger(x) && x >= 0 && x <= 6))].sort(), from: sid(d.from), until: sid(d.until), scope: d.scope === 'section' && d.kind === 'repeat' ? 'section' : 'entry',
      title: String(d.title || '').slice(0, 120), body: String(d.body || '').slice(0, 200), on: d.on !== false, skipDone: d.skipDone !== false, skipWhen: sw });
  }
  return out;
}
// the field references of a definition, mapped (pack keys → section field ids on install)
function pkrMapDefs(defs, ids) {
  const tok = t => String(t).replace(/\{([\w-]{1,24})\}/g, (m, k) => (k === 'title' ? m : ids[k] ? `{${ids[k]}}` : '')), f = k => (k && ids[k] ? ids[k] : '');
  return defs.map(d => ({ ...d, field: f(d.field), from: f(d.from), until: f(d.until), title: tok(d.title), body: tok(d.body), skipWhen: d.skipWhen && f(d.skipWhen.field) ? { ...d.skipWhen, field: f(d.skipWhen.field) } : null }));
}
// packClean hook: the reminders of a raw section, checked against its fields and against the permissions the pack asks for
function packRemindersClean(raw, section, fields, warn, perms) {
  if (raw == null) return []; if (!Array.isArray(raw)) { warn.push(`“${section.name}” has reminders in a form OpenTick does not understand, so they were left out.`); return []; }
  if (!raw.length) return [];
  const asked = new Set(perms ? perms.sections.flatMap(s => s.capabilities.map(c => pkpKey(s.id, c.id))) : []);
  if (!asked.has('reminders.create_reminder')) { warn.push(`The reminders of “${section.name}” need the permission reminders.create_reminder, which the pack does not ask for, so they were left out.`); return []; }
  const type = Object.fromEntries(fields.map(f => [f.key, f.type])), out = [];
  for (const d of pkrKeepDefs(raw)) {
    if (d.kind === 'date' && type[d.field] !== 'date') { warn.push(`The reminder “${d.name}” of “${section.name}” needs a date field and “${d.field || '?'}” is not one, so it was left out.`); continue; }
    for (const k of ['from', 'until']) if (d[k] && type[d[k]] !== 'date') { warn.push(`The reminder “${d.name}” has a “${k}” that is not a date field of “${section.name}”; it was ignored.`); d[k] = ''; }
    if (d.skipWhen && !type[d.skipWhen.field]) { warn.push(`The reminder “${d.name}” refers to a field that “${section.name}” does not have; that condition was ignored.`); d.skipWhen = null; }
    out.push(d);
  }
  if (raw.length > 8) warn.push(`Only the first 8 reminders of “${section.name}” were read.`);
  return out;
}

/* ---------- permissions: what a pack may do with reminders (§9) ---------- */
pkRegisterTarget({ id: 'reminders', name: 'Reminders', caps: {
  create_reminder: pkaCap('create', 'Remind you about its entries', () => 'Show notifications for its own entries at the times it declares (a due date, a repeat) and add one-off reminders to them. It does not touch the reminders on your tasks.'),
  view_own_reminders: pkaCap('read', 'See its own reminders', () => 'See which reminders this pack has set up and when they are due.'),
  view_user_reminders: pkaCap('read', 'See your reminders', s => `See when your own reminders on tasks are due${(s.fields || []).length ? ': ' + (s.fields || []).join(' and ') : ''}. Nothing else about the tasks.`, { fields: ['title', 'time'], defFields: ['time'] }),
  edit_own_reminders: pkaCap('modify', 'Change its own reminders', () => 'Change the time of reminders this pack set up.', { records: ['pack-created'] }),
  edit_user_reminders: pkaCap('modify', 'Change your reminders', () => 'Add or remove a reminder on one of your tasks, or change the time of a reminder you added to its entries.'),
  cancel_own_reminders: pkaCap('delete', 'Cancel its own reminders', () => 'Cancel reminders this pack set up. Nothing of yours.', { records: ['pack-created'] }),
  cancel_user_reminders: pkaCap('delete', 'Cancel your reminders', () => 'Cancel a reminder on one of your tasks, or one you added to its entries.'),
  snooze_dismiss: pkaCap('modify', 'Snooze or dismiss its reminders', () => 'Snooze or dismiss reminders this pack set up. Not yours.', { records: ['pack-created'] }),
} });
// who made a reminder: the app wrote it down in the record (declared reminders belong to their pack; a one-off says who added it)
function pkrOwns(packId, id) {
  const [rid, oid] = String(id).split('.'), r = (S.pkrem || []).find(x => x.id === rid && x.packId === packId); if (!r) return false;
  return oid ? !!(r.once[oid] && r.once[oid].by === 'pack') : r.rid !== '';
}

/* ---------- looking up ---------- */
const pkrSection = (packId, sid) => S.csections.find(s => s.id === sid && s.packId === packId) || null;
const pkrEntry = (packId, eid) => { const e = S.centries.find(x => x.id === eid), s = e && pkrSection(packId, e.sid); return s ? { e, s } : null; };
const pkrTime = at => new Date(at).getTime(); // 'YYYY-MM-DDTHH:MM' is read as the local time of this device: it follows time zones and daylight saving
function pkrFill(tpl, s, e) { return String(tpl || '').replace(/\{([\w-]{1,24})\}/g, (m, k) => { if (k === 'title') return e ? e.title : s.name; const f = s.fields.find(x => x.id === k), v = f && e ? (f.type === 'calculated' ? xfdFill(s, e, f) : xfdStored(s, e, f.id)) : null; return v == null || v === false || v === '' ? '' : f.type === 'date' && /^\d{4}-\d\d-\d\d$/.test(v) ? fmtDate(v) : Array.isArray(v) ? v.join(' ') : String(v); }).replace(/\s+/g, ' ').trim(); }
const pkrDay = k => { const [y, m, d] = k.split('-').map(Number); return { y, m, d, utc: Date.UTC(y, m - 1, d), dow: new Date(y, m - 1, d).getDay() }; };
// does the repeat fall on day k? (k and start are 'YYYY-MM-DD')
function pkrRepeatsOn(def, start, k, until) {
  if (k < start || (until && k > until)) return false;
  const a = pkrDay(start), b = pkrDay(k), diff = Math.round((b.utc - a.utc) / 864e5), n = def.every.n;
  if (def.every.unit === 'day') return diff % n === 0;
  if (def.every.unit === 'week') { const dows = def.days.length ? def.days : [a.dow]; return dows.includes(b.dow) && Math.floor((diff + a.dow) / 7) % n === 0; }
  const months = (b.y - a.y) * 12 + (b.m - a.m), last = new Date(b.y, b.m, 0).getDate(); return months >= 0 && months % n === 0 && b.d === Math.min(a.d, last);
}
function pkrDone(def, s, e) { // an entry that is finished (ticked, or the field the pack names says so) is not reminded about
  if (def.skipDone && s.checkable && e.done) return true;
  if (def.skipWhen) { const v = xfdStored(s, e, def.skipWhen.field); if (def.skipWhen.equals === '' ? !!v : String(v == null ? '' : v) === def.skipWhen.equals) return true; }
  return false;
}
// the effective settings of one reminder for one entry: the entry's own choice, else the whole section's, else what the pack declared
function pkrEff(idx, packId, def, eid) {
  const re = idx.get(pkrRecId(packId, eid, def.id)), rs = idx.get(pkrRecId(packId, '', def.id)), ce = re ? re.cfg : {}, cs = rs ? rs.cfg : {};
  return { on: ce.on != null ? ce.on : cs.on != null ? cs.on : def.on, tm: ce.tm || cs.tm || def.time, bf: ce.bf || cs.bf || def.before, rec: re || null };
}
const pkrPolicy = () => (S.settings && S.settings.pkrPolicy === 'first' ? 'first' : 'all');
function pkrAckSkips(a) { // → true when an acknowledgement means this occurrence must not notify on this device
  return !!a && a.s === 'n' && pkrPolicy() === 'first' && a.dev !== actDev(); // (dismissed and snoozed are handled by the caller)
}

// every occurrence of every pack reminder that falls in [from, to]; `add` is remEntries' own adder. `only` narrows it to one entry (the entry screen, the API)
function pkrEntries(from, to, add, day0, days, only) {
  if (!S.packs || !S.packs.length) return; const idx = pkrIndex();
  const emit = (s, e, rid, occ, at, ack, title, body) => {
    const key = `p|${pkrRecId(s.packId, e ? e.id : '', rid)}|${occ}`, x = { kind: 'pack', id: e ? e.id : '', sid: s.id, title, body, pk: s.packId, rid, occ };
    if (ack && ack.s === 'd') return;
    if (ack && ack.s === 'z') { if (ack.z) add(`${key}|z${ack.z}`, ack.z, ack.z + 864e5, x); return; } // a snooze replaces the original with a later one
    if (pkrAckSkips(ack)) return;
    add(key, at, at + 864e5, x);
  };
  for (const pr of S.packs) {
    if (pr.state === 'disabled') continue;
    const declared = pr.state === 'installed' && pkCan(pr.packId, 'reminders', 'create_reminder').ok; // (a removed pack, a missing permission, an unconfirmed device: nothing it declared runs)
    for (const s of S.csections.filter(x => x.packId === pr.packId && (!only || x.id === only.sid))) {
      const entries = xsEntries(s).filter(x => !only || x.id === only.id);
      if (declared) for (const def of s.reminders || []) {
        const scopeSec = def.scope === 'section'; if (scopeSec && only) continue;
        for (const e of scopeSec ? [null] : entries) {
          const eff = pkrEff(idx, pr.packId, def, e ? e.id : ''); if (!eff.on) continue;
          const rec = eff.rec || idx.get(pkrRecId(pr.packId, e ? e.id : '', def.id)), ackOf = o => (rec ? rec.ack[o] : null);
          if (e && pkrDone(def, s, e)) continue;
          const open = scopeSec ? xsEntries(s).filter(x => !pkrDone(def, s, x)) : null; if (scopeSec && !open.length) continue;
          const title = pkrFill(def.title || (e ? '{title}' : def.name), s, e) || def.name, body0 = pkrFill(def.body, s, e) || (scopeSec ? `${plural(open.length, 'entry').replace('entrys', 'entries')} in ${s.name}` : s.name);
          if (def.kind === 'date') {
            const d = xfdStored(s, e, def.field); if (!/^\d{4}-\d\d-\d\d$/.test(d || '')) continue;
            for (const off of eff.bf) { const at = pkrTime(`${d}T${eff.tm}`) - off * 60000, togo = off >= 1440 ? plural(Math.round(off / 1440), 'day') : off >= 60 ? plural(Math.round(off / 60), 'hour') : plural(off, 'minute'); emit(s, e, def.id, `${d}|${eff.tm}|${off}`, at, ackOf(`${d}|${eff.tm}|${off}`), title, off ? `${body0} · ${togo} to go` : body0); }
          } else {
            const startK = def.from && e && /^\d{4}-\d\d-\d\d$/.test(xfdStored(s, e, def.from) || '') ? xfdStored(s, e, def.from) : ymd(new Date(e ? e.created : s.created || Date.now())), untilK = def.until && e && /^\d{4}-\d\d-\d\d$/.test(xfdStored(s, e, def.until) || '') ? xfdStored(s, e, def.until) : '';
            for (let i = 0; i <= days; i++) { const k = ymd(addDays(day0, i)); if (!pkrRepeatsOn(def, startK, k, untilK)) continue; emit(s, e, def.id, `${k}|${eff.tm}`, pkrTime(`${k}T${eff.tm}`), ackOf(`${k}|${eff.tm}`), title, body0); }
          }
        }
      }
      // reminders added to an entry: by the person (always theirs) or by the pack through the API (needs the permission). A ticked-off entry is not reminded about.
      for (const e of entries) {
        const rec = idx.get(pkrRecId(pr.packId, e.id, '')); if (!rec || (s.checkable && e.done)) continue;
        for (const oid of Object.keys(rec.once)) { const o = rec.once[oid]; if (o.x || (o.by === 'pack' && !declared)) continue; emit(s, e, '', oid, pkrTime(o.at), rec.ack[oid], o.t || e.title, o.t ? e.title : s.name); }
      }
    }
  }
}

/* ---------- what the person does ---------- */
function pkrSet(packId, eid, rid, patch) { const r = pkrRecFor(packId, eid, rid); r.cfg = { ...r.cfg, ...patch }; r.cu = pkrTick(r.cu); r.u = Math.max(r.u, Date.now()); save(); return r; }
function pkrAck(packId, eid, rid, occ, s, z = 0) { // d dismissed · z snoozed until z · n shown on a device
  const r = pkrRecFor(packId, eid, rid), cur = r.ack[occ], next = { s, t: pkrTick(cur ? cur.t : 0), z: s === 'z' ? z : 0, dev: actDev() };
  if (!cur || pkrCmp(next, cur) > 0) r.ack[occ] = next;
  const keys = Object.keys(r.ack); if (keys.length > 100) for (const k of keys.sort((a, b) => r.ack[a].t - r.ack[b].t).slice(0, keys.length - 100)) delete r.ack[k]; // (the oldest first)
  r.u = Math.max(r.u, Date.now()); save(); return r;
}
function pkrAddOnce(packId, eid, at, title, by) {
  const r = pkrRecFor(packId, eid, ''); if (Object.values(r.once).filter(o => !o.x).length >= 20) return '';
  const oid = pkrHash(String(Math.random()) + Date.now()).slice(0, 8); r.once[oid] = { at, t: String(title || '').trim().slice(0, 80), by: by === 'pack' ? 'pack' : 'user', x: false, u: Date.now() }; r.u = pkrTick(r.u); save(); return `${r.id}.${oid}`;
}
function pkrOnce(id) { const [rid, oid] = String(id).split('.'), r = S.pkrem.find(x => x.id === rid); return r && oid && r.once[oid] ? { r, oid, o: r.once[oid] } : null; }
function pkrEditOnce(id, patch) { const x = pkrOnce(id); if (!x || x.o.x) return false; if (patch.at && /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(patch.at)) x.o.at = patch.at; if (patch.t != null) x.o.t = String(patch.t).slice(0, 80); x.o.u = pkrTick(x.o.u); x.r.u = pkrTick(x.r.u); save(); return true; }
function pkrDelOnce(id) { const x = pkrOnce(id); if (!x || x.o.x) return false; x.o.x = true; x.o.u = pkrTick(x.o.u); x.r.u = pkrTick(x.r.u); save(); return true; }
// the person's own "remind me" on an entry
function pkrRemindMe(s, e, at, title) { return pkrAddOnce(s.packId, e.id, at, title, 'user'); }
// next occurrences of an entry's reminders (the entry screen and the API): [{ at, title, pk, id, rid, occ, key }]
function pkrUpcoming(s, e, n = 5, now = Date.now()) {
  const out = [], day0 = new Date(now), to = now + 400 * 864e5; day0.setHours(0, 0, 0, 0);
  pkrEntries(now, to, (key, at, exp, x) => { if (exp >= now) out.push({ key, at, exp, ...x }); }, day0, 401, e);
  return out.sort((a, b) => a.at - b.at).slice(0, n);
}
function pkrOpen(x) { const e = S.centries.find(c => c.id === x.id), s = S.csections.find(c => c.id === x.sid); if (!s) return; U.page = s.id; U.pinKey = null; render(); if (e && typeof xsEditEntry === 'function') xsEditEntry(s, e); }
// called when one fires on this device: the other devices learn it was shown, and in the open app the person gets a button that opens the entry
function pkrFired(x) {
  const r = S.pkrem.find(q => q.id === pkrRecId(x.pk, x.id, x.rid)), cur = r && r.ack[x.occ];
  if (!cur || pkrRank(cur.s) < 2) pkrAck(x.pk, x.id, x.rid, x.occ, 'n');
  try { if (typeof document === 'undefined' || !document.hidden) toast(x.title, { label: x.id ? 'Open' : 'Show', fn: () => pkrOpen(x) }); } catch (e) { /* the notification was enough */ }
}
// snooze / dismiss one upcoming occurrence (from pkrUpcoming)
function pkrAckOcc(u, kind, mins) { pkrAck(u.pk, u.id, u.rid, u.occ, kind, kind === 'z' ? Date.now() + Math.max(1, Math.min(10080, mins | 0 || 10)) * 60000 : 0); return true; }
// a reminder of an entry that was deleted (on purpose) is no longer needed; a pack that was removed with its data takes its reminders along
function pkrGc() {
  const gone = r => (r.eid && S.tomb[r.eid]) || !S.packs.some(p => p.packId === r.packId);
  const dead = S.pkrem.filter(gone); if (dead.length) { S.pkrem = S.pkrem.filter(r => !gone(r)); save(); }
  return dead.length;
}

/* ---------- the API a pack's declared actions / code use (added to pkApi) ---------- */
function pkrMethods(packId, k) {
  const { gate, refuse, done } = k, T = 'reminders', bad = (op, cap, why, rec) => refuse(op, T, cap, { missing: pkpKey(T, cap), why }, rec);
  const own = (id) => { const [rid, oid] = String(id).split('.'), r = S.pkrem.find(x => x.id === rid && x.packId === packId); return r ? { r, oid } : null; };
  const show = (r, oid) => { const o = oid ? r.once[oid] : null; return { id: oid ? `${r.id}.${oid}` : r.id, entry: r.eid, ...(o ? { at: o.at, title: o.t, by: o.by } : { reminder: r.rid }) }; };
  return {
    remindCreate(entryId, o = {}) {
      const g = gate('remind-create', T, 'create_reminder', {}, ''); if (g.fail) return g.fail; const x = pkrEntry(packId, entryId);
      if (!x) return bad('remind-create', 'create_reminder', 'A pack can only add reminders to its own entries.', entryId);
      if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(o.at || '')) return bad('remind-create', 'create_reminder', 'A reminder needs a date and time like 2027-01-31T09:00.', entryId);
      const id = pkrAddOnce(packId, x.e.id, o.at, o.title, 'pack'); if (!id) return bad('remind-create', 'create_reminder', 'That entry has too many reminders.', entryId); return done('remind-create', T, 'create_reminder', id, { id });
    },
    remindList(entryId) {
      const g = gate('remind-list', T, 'view_own_reminders', {}, ''); if (g.fail) return g.fail; const out = [];
      for (const r of S.pkrem) if (r.packId === packId && (!entryId || r.eid === entryId)) { if (r.rid) out.push(show(r)); for (const oid of Object.keys(r.once)) if (!r.once[oid].x && r.once[oid].by === 'pack') out.push(show(r, oid)); }
      return done('remind-list', T, 'view_own_reminders', '', { reminders: out });
    },
    remindListUser() {
      const first = pkpCap(packId, pkpKey(T, 'view_user_reminders')), want = (first && first.scope.fields) || ['time'], g = gate('remind-user-list', T, 'view_user_reminders', { fields: want }, ''); if (g.fail) return g.fail;
      const now = Date.now(), list = remEntries(now, now + 14 * 864e5).filter(x => x.kind === 'task').slice(0, 50).map(x => { const o = { id: x.id }; if (want.includes('time')) o.time = new Date(x.at).toISOString(); if (want.includes('title')) o.title = x.title; return o; });
      return done('remind-user-list', T, 'view_user_reminders', '', { reminders: list });
    },
    remindEdit(id, o = {}) {
      const g = gate('remind-edit', T, 'edit_own_reminders', { recordId: id }, id); if (g.fail) return g.fail; const x = own(id);
      if (!x) return bad('remind-edit', 'edit_own_reminders', 'That reminder is gone.', id);
      if (x.oid) { if (!pkrEditOnce(id, o)) return bad('remind-edit', 'edit_own_reminders', 'That reminder cannot be changed.', id); } else if (/^([01]\d|2[0-3]):[0-5]\d$/.test(o.time || '')) pkrSet(packId, x.r.eid, x.r.rid, { tm: o.time }); else return bad('remind-edit', 'edit_own_reminders', 'Give a time like 18:30.', id);
      return done('remind-edit', T, 'edit_own_reminders', id);
    },
    remindEditUser(id, o = {}) { // a task of yours: add or remove "N minutes before"; or a reminder you added to one of its entries: change its time
      const g = gate('remind-user-edit', T, 'edit_user_reminders', {}, id); if (g.fail) return g.fail;
      const x = pkrOnce(id); if (x && x.r.packId === packId && x.o.by === 'user') { if (!pkrEditOnce(id, o)) return bad('remind-user-edit', 'edit_user_reminders', 'That reminder cannot be changed.', id); return done('remind-user-edit', T, 'edit_user_reminders', id); }
      const t = S.tasks.find(q => q.id === id && !q.deleted); if (!t) return bad('remind-user-edit', 'edit_user_reminders', 'That reminder is gone.', id);
      const m = Math.round(+o.add); if (!(m >= 0 && m <= 43200)) return bad('remind-user-edit', 'edit_user_reminders', 'Give the minutes before, like { add: 30 }.', id);
      remsSet(t, [...remsOf(t), m]); save(); return done('remind-user-edit', T, 'edit_user_reminders', id);
    },
    remindCancel(id) {
      const g = gate('remind-cancel', T, 'cancel_own_reminders', { recordId: id }, id); if (g.fail) return g.fail; const x = own(id); if (!x) return bad('remind-cancel', 'cancel_own_reminders', 'That reminder is gone.', id);
      if (x.oid) pkrDelOnce(id); else pkrSet(packId, x.r.eid, x.r.rid, { on: false }); return done('remind-cancel', T, 'cancel_own_reminders', id);
    },
    remindCancelUser(id, o = {}) {
      const g = gate('remind-user-cancel', T, 'cancel_user_reminders', {}, id); if (g.fail) return g.fail;
      const x = pkrOnce(id); if (x && x.r.packId === packId && x.o.by === 'user') { pkrDelOnce(id); return done('remind-user-cancel', T, 'cancel_user_reminders', id); }
      const t = S.tasks.find(q => q.id === id && !q.deleted); if (!t) return bad('remind-user-cancel', 'cancel_user_reminders', 'That reminder is gone.', id);
      remsSet(t, remsOf(t).filter(r => r !== (typeof o.minutes === 'number' ? o.minutes : o.at))); save(); return done('remind-user-cancel', T, 'cancel_user_reminders', id);
    },
    remindSnooze(id, minutes) { return ack(id, 'z', minutes, 'remind-snooze'); },
    remindDismiss(id) { return ack(id, 'd', 0, 'remind-dismiss'); },
  };
  function ack(id, kind, minutes, op) {
    const g = gate(op, T, 'snooze_dismiss', { recordId: id }, id); if (g.fail) return g.fail; const x = own(id); if (!x) return bad(op, 'snooze_dismiss', 'That reminder is gone.', id);
    const e = pkrEntry(packId, x.r.eid), next = e ? pkrUpcoming(e.s, e.e, 20).find(u => u.rid === x.r.rid || (x.oid && u.occ === x.oid)) : null;
    if (!next) return bad(op, 'snooze_dismiss', 'Nothing is due to snooze or dismiss.', id);
    pkrAckOcc(next, kind, minutes); return done(op, T, 'snooze_dismiss', id);
  }
}

/* ---------- the person's screens ---------- */
const pkrOffsets = [[0, 'At the time'], [60, '1 hour before'], [1440, '1 day before'], [2880, '2 days before'], [10080, '1 week before']];
const pkrWhen = at => `${fmtDate(ymd(new Date(at)))} ${fmtTime(`${String(new Date(at).getHours()).padStart(2, '0')}:${String(new Date(at).getMinutes()).padStart(2, '0')}`)}`;
function pkrEntryBlock(s, e) {
  if (!s.packId) return '';
  const idx = pkrIndex(), defs = (s.reminders || []).filter(d => d.scope !== 'section'), can = pkCan(s.packId, 'reminders', 'create_reminder'), up = pkrUpcoming(s, e, 4), rec = idx.get(pkrRecId(s.packId, e.id, ''));
  const once = rec ? Object.keys(rec.once).filter(o => !rec.once[o].x).map(o => ({ oid: o, ...rec.once[o] })).sort((a, b) => (a.at < b.at ? -1 : 1)) : [];
  const unit = b => (b >= 1440 ? plural(Math.round(b / 1440), 'day') : b >= 60 ? plural(Math.round(b / 60), 'hour') : plural(b, 'minute'));
  const rows = defs.map(d => { const eff = pkrEff(idx, s.packId, d, e.id); return `<label class="pkr-r"><input type="checkbox" data-pkrt="${esc(d.id)}"${eff.on ? ' checked' : ''}><span><b>${esc(d.name)}</b><small>${d.kind === 'date' ? eff.bf.map(b => (b ? unit(b) + ' before' : 'at the time')).join(', ') : 'repeats'} · ${esc(fmtTime(eff.tm))}</small></span><input type="time" data-pkrm="${esc(d.id)}" value="${esc(eff.tm)}" aria-label="Time for ${esc(d.name)}"></label>`; }).join('');
  const warn = defs.length && !can.ok ? `<p class="pkp-warn">${ic('alert', 14)} ${esc(can.why)} <button type="button" class="btn sm" data-pkpperm="${esc(s.packId)}">Review permissions</button></p>` : '';
  const next = up.length ? `<div class="pkr-up">${up.map((u, i) => `<div class="pkr-u"><span>${ic('bell', 12)} ${esc(pkrWhen(u.at))} · ${esc(u.title)}</span><button type="button" class="btn sm" data-pkrz="${i}">Snooze 1 h</button><button type="button" class="btn sm" data-pkrx="${i}">Dismiss</button></div>`).join('')}</div>` : '';
  const mine = once.length ? `<div class="pkr-up">${once.map(o => `<div class="pkr-u"><span>${ic('bell', 12)} ${esc(pkrWhen(pkrTime(o.at)))}${o.t ? ' · ' + esc(o.t) : ''}${o.by === 'pack' ? ' · set by the pack' : ''}</span><button type="button" class="btn sm" data-pkrd="${esc(o.oid)}" aria-label="Remove this reminder">${ic('x', 12)}</button></div>`).join('')}</div>` : '';
  const add = `<div class="pkr-add"><input type="date" data-pkrad value="${esc(ymd(addDays(new Date(), 1)))}" aria-label="Reminder date"><input type="time" data-pkrah value="09:00" aria-label="Reminder time"><input data-pkran maxlength="80" placeholder="What for (optional)" aria-label="What the reminder says"><button type="button" class="btn sm" data-pkrnew="${esc(e.id)}">${ic('plus', 12)} Remind me</button></div>`;
  return `<div class="pkr-box" data-pkrbox="${esc(e.id)}"><h4>${ic('bell', 14)} Reminders</h4>${warn}${rows}${next}${mine}${add}<p class="hint">Changes here are saved as you make them. A reminder on an entry you have ticked as done stays quiet.</p></div>`;
}
const pkrRedraw = (m, s, stored) => { const el = $('.pkr-box', m), fresh = stored && S.centries.find(x => x.id === stored.id); if (!el || !fresh) return; const tmp = document.createElement('div'); tmp.innerHTML = pkrEntryBlock(s, fresh); if (tmp.firstElementChild) el.replaceWith(tmp.firstElementChild); };
// the entry editor calls this first; it returns true when the click was one of ours
function pkrEntryClick(ev, m, s, stored) {
  const t = ev.target, hit = sel => (t.closest ? t.closest(sel) : null); if (!stored) return false;
  const nw = hit('[data-pkrnew]'); if (nw) { const d = $('[data-pkrad]', m).value, h = $('[data-pkrah]', m).value, n = $('[data-pkran]', m).value; if (!/^\d{4}-\d\d-\d\d$/.test(d) || !/^\d\d:\d\d$/.test(h)) { toast('Choose a date and time'); return true; } if (!pkrRemindMe(s, stored, `${d}T${h}`, n)) toast('That entry has too many reminders'); else { toast('Reminder added'); sfx('add'); } pkrRedraw(m, s, stored); return true; }
  const del = hit('[data-pkrd]'); if (del) { pkrDelOnce(`${pkrRecId(s.packId, stored.id, '')}.${del.dataset.pkrd}`); pkrRedraw(m, s, stored); return true; }
  const z = hit('[data-pkrz]') || hit('[data-pkrx]'); if (z) { const snooze = z.dataset.pkrz != null, u = pkrUpcoming(s, stored, 4)[+(snooze ? z.dataset.pkrz : z.dataset.pkrx)]; if (u) { pkrAckOcc(u, snooze ? 'z' : 'd', 60); toast(snooze ? 'Snoozed for an hour' : 'Dismissed'); } pkrRedraw(m, s, stored); return true; }
  return false;
}
// switches and times of the reminders on one entry (change events)
function pkrEntryChange(ev, m, s, stored) {
  const t = ev.target; if (!stored || !t || !t.dataset) return false;
  if (t.dataset.pkrt) { pkrSet(s.packId, stored.id, t.dataset.pkrt, { on: !!t.checked }); pkrRedraw(m, s, stored); return true; }
  if (t.dataset.pkrm) { if (/^([01]\d|2[0-3]):[0-5]\d$/.test(t.value || '')) pkrSet(s.packId, stored.id, t.dataset.pkrm, { tm: t.value }); pkrRedraw(m, s, stored); return true; }
  return false;
}
// Settings → the reminders of one pack, and how devices share the notifying
function pkrSettingsHtml(packId) {
  const secs = S.csections.filter(s => s.packId === packId && (s.reminders || []).length), idx = pkrIndex(), can = pkCan(packId, 'reminders', 'create_reminder');
  const rows = secs.map(s => `<h5>${esc(s.name)}</h5>` + s.reminders.map(d => { const eff = pkrEff(idx, packId, d, ''); return `<div class="pkr-r"><label><input type="checkbox" data-pkrsec="${esc(s.id)}:${esc(d.id)}"${eff.on ? ' checked' : ''}> <b>${esc(d.name)}</b></label><small>${esc(d.scope === 'section' ? 'for the whole section' : 'for each entry')} · ${d.kind === 'date' ? 'before a date' : 'repeats'}</small><input type="time" data-pkrsm="${esc(s.id)}:${esc(d.id)}" value="${esc(eff.tm)}" aria-label="Time for ${esc(d.name)}"></div>`; }).join('')).join('');
  return `<h3>Reminders · ${esc((pksRec(packId) || {}).name || packId)}</h3>${rows || '<p class="hint">This pack does not set any reminders.</p>'}`
    + (secs.length && !can.ok ? `<p class="pkp-warn">${ic('alert', 14)} ${esc(can.why)}</p>` : '')
    + `<h5>On your devices</h5><label class="pkr-pol"><span>When a reminder is due</span><select data-pkrpol>${opts([['all', 'Notify on every device'], ['first', 'Notify on the first device that gets it; the others stay quiet once they know']], pkrPolicy())}</select></label><p class="hint">Dismissing or snoozing on one device applies to all of them. Notifications also need the operating system to allow OpenTick to show them; that is separate from the pack’s permissions.</p><div class="mact"><span class="sp"></span><button type="button" class="pri" data-m="no">Done</button></div>`;
}
function pkrManager(packId, after) {
  openModal(pkrSettingsHtml(packId), m => {
    m.onchange = e => { const t = e.target; if (t.dataset.pkrsec) { const [sid, rid] = t.dataset.pkrsec.split(':'); pkrSet(packId, '', rid, { on: !!t.checked }); } else if (t.dataset.pkrsm) { const rid = t.dataset.pkrsm.split(':')[1]; if (/^([01]\d|2[0-3]):[0-5]\d$/.test(t.value || '')) pkrSet(packId, '', rid, { tm: t.value }); } else if (t.dataset.pkrpol) { S.settings.pkrPolicy = t.value === 'first' ? 'first' : 'all'; save(); } };
    m.onclick = e => { if (e.target.closest('[data-m]') || e.target.classList.contains('mback')) { closeModal(); if (after) after(); } };
  });
}
function pkrSettingsBtn(packId) { return S.csections.some(s => s.packId === packId && (s.reminders || []).length) ? `<button type="button" class="btn sm" data-m="pkrset" data-id="${esc(packId)}">Reminders</button>` : ''; }
