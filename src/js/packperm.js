/* OpenTick pack permissions (0.9.1): what an installed pack may do with the rest of the app. Nothing is allowed unless the person said so.
   A pack is data, so it cannot call anything. What it can do is DECLARE things that OpenTick then does for it: actions on an entry ("create a task for this
   book"), a "related" panel, reminders. Every one of those goes through the capability API in packapi.js, and every step of that API asks pkCan() here first,
   in OpenTick itself and for every call (the screen is not the guard; a switched-off, removed or unconfirmed pack, a revoked capability or a field outside the
   granted scope is refused whatever called it, a button or a background reminder).

   A permission is ONE capability on ONE target, named as in the spec (Part C §12): 'tasks.search_records', 'notes.create_record', 'pack:<id>.list_records' …
   No capability covers a whole section, and a capability exists only if the app really implements it (packapi.js registers the targets; the manifest of a pack
   that asks for anything else has that request refused with a visible warning, never ignored silently).
   Scopes (§13) narrow a capability: fields (which fields it may see or change), records ('pack-created' = records this pack made through the API, as the
   APP recorded it; 'pack-linked' = records the pack's own entries are linked to), relationships (which link types). Ownership is never taken from the pack.

   State, synced and sealed with everything else (S.pkperms, one record per pack): { id 'pp-<packId>', packId, caps: { '<target>.<cap>': C }, u } where
     C = { rv, rk, gr, e, scope, ver, dev }   rv: when the person last revoked ('r') or denied ('d') it, rk which of the two; gr: when it was granted, e: the value
     of rv the person had in front of them when they granted it (the "epoch"), scope, ver (the pack version it was decided for), dev.
   It is granted only while e === rv: a grant made without knowing about a later revocation (another device revoked meanwhile) counts for nothing, and widening
   a scope is revoke + grant, which starts a new epoch. Merging two copies is therefore: rv = the larger, and the grants that belong to that epoch combine by
   INTERSECTING their scopes. Access can never widen by merging; revoking on any device wins everywhere; only a deliberate grant that was made knowing the revocation
   (an epoch that matches) brings it back. The rule is commutative, associative and idempotent (test/packperm.mjs).
   A device that joined this account after the permissions were decided asks the person to confirm them once before they apply on it (pkpDevice below).
   Every function reached by migrate() while core.js is still loading uses only function declarations and literals. */

/* ---------- the registry of what can be asked for ---------- */
const PKP_TARGETS = {}; // id -> { id, name, caps: { capId: { kind, title, describe(scope), fields?, defFields?, records?, scopes: [] } } }
function pkRegisterTarget(t) { if (t && typeof t.id === 'string' && t.caps) PKP_TARGETS[t.id] = t; return t; }
function pkpTarget(id) { // 'pack:<id>' (the sections of another pack) all share one description
  if (PKP_TARGETS[id]) return PKP_TARGETS[id];
  const m = /^pack:([a-z0-9-]{1,40})$/.exec(id || ''); if (!m || !PKP_TARGETS['pack:*']) return null;
  const o = PKP_TARGETS['pack:*'], other = typeof pksRec === 'function' ? pksRec(m[1]) : null;
  return { ...o, id, name: (other && other.name) || m[1] };
}
function pkpKey(target, cap) { return target + '.' + cap; }
function pkpSplit(key) { const i = key.lastIndexOf('.'); return [key.slice(0, i), key.slice(i + 1)]; }
function pkpArr(v) { return Array.isArray(v) ? v : []; }
function pkpSort(a) { return [...new Set(a)].sort(); } // (function declarations: migrate() uses them while core.js is still loading)

/* ---------- manifests: the top-level "permissions" of a pack (docs/PACKS.md) ---------- */
function packPermsClean(raw, pack, warn) {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) { warn.push('The permissions of this pack were not in a form OpenTick understands, so it asks for none.'); return null; }
  const out = [], seen = new Set(), rs = pkpArr(raw.sections);
  if (rs.length > 12) warn.push('Only the first 12 permission groups were read.');
  for (const sec of rs.slice(0, 12)) {
    if (!sec || typeof sec !== 'object') continue;
    const id = pkS(sec.id, 50), t = pkpTarget(id);
    if (!t) { warn.push(`This pack asks for access to “${id || '?'}”, which OpenTick does not offer, so that request was left out.`); continue; }
    const caps = [];
    for (const c of pkpArr(sec.capabilities).slice(0, 24)) {
      if (!c || typeof c !== 'object') continue;
      const cid = pkS(c.id, 40), def = t.caps[cid];
      if (!def) { warn.push(`The permission “${cid || '?'}” for ${t.name} does not exist in this version of OpenTick, so it was left out.`); continue; }
      if (seen.has(pkpKey(id, cid))) continue;
      const scope = pkpScopeClean(c.scope, def, t, cid, warn); if (!scope) continue;
      seen.add(pkpKey(id, cid)); caps.push({ id: cid, scope, required: c.required === true, reason: pkS(c.reason, 160) });
    }
    if (caps.length) out.push({ id, reason: pkS(sec.reason, 200), capabilities: caps });
  }
  return out.length ? { sections: out } : null;
}
// the scope as it will be shown AND enforced: every limit is explicit (a field list, a record rule), never left to "whatever the app decides later"
function pkpScopeClean(raw, def, t, cid, warn) {
  const sc = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}, out = {}, label = `“${cid}” for ${t.name}`;
  for (const k of Object.keys(sc)) if (!['fields', 'records', 'relationships'].includes(k)) warn.push(`The limit “${k}” of ${label} is not known, so it was ignored.`);
  if (def.fields) {
    const asked = pkpArr(sc.fields).map(f => pkS(f, 30)), ok = asked.filter(f => def.fields.includes(f)), bad = asked.filter(f => !def.fields.includes(f));
    if (bad.length) warn.push(`${label} named fields that cannot be shared (${bad.join(', ')}); they were left out.`);
    if (asked.length && !ok.length) { warn.push(`${label} had no usable field, so it was left out.`); return null; }
    out.fields = pkpSort(ok.length ? ok : (def.defFields || def.fields));
  } else if (sc.fields !== undefined) warn.push(`${label} cannot be limited by field, so the limit was ignored.`);
  if (def.records) {
    const r = sc.records === undefined ? def.records[0] : String(sc.records);
    if (!def.records.includes(r)) { warn.push(`${label} asked for records “${pkS(r, 20)}”, which OpenTick does not support for it, so it was left out. (Supported: ${def.records.join(', ')}.)`); return null; }
    out.records = r;
  } else if (sc.records !== undefined) warn.push(`${label} cannot be limited by record, so the limit was ignored.`);
  if (def.relationships) out.relationships = pkpSort(pkpArr(sc.relationships).map(x => pkS(x, 20)).filter(x => def.relationships.includes(x)).concat(pkpArr(sc.relationships).length ? [] : def.relationships));
  return out;
}

// the structure of a manifest kept on a pack's record (the real checks were made when the pack was read); only literals and function declarations, migrate() calls it
function pkpNormManifest(m) {
  if (!m || !Array.isArray(m.sections)) return null; const out = [];
  for (const sec of m.sections.slice(0, 12)) {
    if (!sec || typeof sec.id !== 'string' || !/^[a-z0-9:*-]{1,50}$/.test(sec.id)) continue; const caps = [];
    for (const c of (Array.isArray(sec.capabilities) ? sec.capabilities : []).slice(0, 24)) { if (!c || typeof c.id !== 'string' || !/^[a-z_]{1,40}$/.test(c.id)) continue; caps.push({ id: c.id, scope: pkpNormCap({ gr: 1, scope: c.scope }).scope, required: c.required === true, reason: String(c.reason == null ? '' : c.reason).slice(0, 160) }); }
    if (caps.length) out.push({ id: sec.id, reason: String(sec.reason == null ? '' : sec.reason).slice(0, 200), capabilities: caps });
  }
  return out.length ? { sections: out } : null;
}
function pkpDefaultScope(target, cap) { const t = pkpTarget(target), d = t && t.caps[cap], o = {}; if (!d) return o; if (d.fields) o.fields = pkpSort(d.defFields || d.fields); if (d.records) o.records = d.records[0]; return o; }

/* ---------- state ---------- */
function pkpNormCap(c) {
  if (!c || typeof c !== 'object') return null;
  const t = v => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0), sc = c.scope && typeof c.scope === 'object' && !Array.isArray(c.scope) ? c.scope : {}, scope = {};
  if (Array.isArray(sc.fields)) scope.fields = pkpSort(sc.fields.filter(x => typeof x === 'string' && x.length <= 30).slice(0, 12));
  if (sc.records === 'pack-created' || sc.records === 'pack-linked') scope.records = sc.records;
  if (Array.isArray(sc.relationships)) scope.relationships = pkpSort(sc.relationships.filter(x => typeof x === 'string' && x.length <= 20).slice(0, 6));
  const rv = t(c.rv), gr = t(c.gr) && t(c.e) <= rv ? t(c.gr) : 0; // (a grant that says it saw a revocation that never happened is not a grant)
  return { rv, rk: rv ? (c.rk === 'd' ? 'd' : 'r') : '', gr, e: gr ? t(c.e) : 0, scope: gr ? scope : {}, ver: String(c.ver == null ? '' : c.ver).slice(0, 20), dev: String(c.dev == null ? '' : c.dev).slice(0, 60) };
}
function pkpNormalise(r) {
  if (!r || typeof r !== 'object') return null;
  const packId = typeof r.packId === 'string' && /^[a-z0-9-]{1,40}$/.test(r.packId) ? r.packId : ''; if (!packId) return null;
  r.id = 'pp-' + packId; r.packId = packId; const caps = {}, src = r.caps && typeof r.caps === 'object' && !Array.isArray(r.caps) ? r.caps : {};
  for (const k of Object.keys(src).slice(0, 200)) if (/^[a-z0-9:-]{1,50}\.[a-z_]{1,40}$/.test(k)) { const c = pkpNormCap(src[k]); if (c) caps[k] = c; }
  r.caps = caps; return r;
}
const pkpRec = packId => (S.pkperms || []).find(r => r.packId === packId) || null;
// 'ask' (nothing decided) | 'granted' | 'denied' (said no at install) | 'revoked' (taken back later)
function pkpState(c) { if (!c) return 'ask'; if (c.gr > 0 && c.e === c.rv) return 'granted'; return c.rv > 0 ? (c.rk === 'd' ? 'denied' : 'revoked') : 'ask'; }
const pkpCap = (packId, key) => { const r = pkpRec(packId); return r ? r.caps[key] || null : null; };

function pkpScopeAnd(a, b) {
  const out = {}, rank = { 'pack-created': 1, 'pack-linked': 2 };
  for (const k of ['fields', 'relationships']) { if (a[k] || b[k]) out[k] = a[k] && b[k] ? a[k].filter(x => b[k].includes(x)) : (a[k] || b[k]).slice(); }
  if (a.records || b.records) out.records = a.records && b.records ? (rank[a.records] <= rank[b.records] ? a.records : b.records) : (a.records || b.records);
  return out;
}
function pkpMergeCap(a, b) {
  if (!a || !b) return a || b;
  const rv = Math.max(a.rv, b.rv), top = a.rv > b.rv ? a : b.rv > a.rv ? b : null;
  const rk = !rv ? '' : top ? top.rk : (a.rk === 'd' || b.rk === 'd' ? 'd' : 'r');
  const live = [a, b].filter(c => c.gr > 0 && c.e === rv).sort((x, y) => y.gr - x.gr || (x.dev < y.dev ? -1 : 1));
  if (!live.length) { const who = top || [a, b].sort((x, y) => y.gr - x.gr || (x.dev < y.dev ? -1 : 1))[0]; return { rv, rk, gr: 0, e: 0, scope: {}, ver: who.ver, dev: who.dev }; }
  return { rv, rk, gr: live[0].gr, e: rv, scope: live.length > 1 ? pkpScopeAnd(live[0].scope, live[1].scope) : live[0].scope, ver: live[0].ver, dev: live[0].dev };
}
COLL_MERGE.pkperms = (x, y, w) => {
  const nx = pkpNormalise({ ...x, caps: x.caps || {} }) || { caps: {} }, ny = pkpNormalise({ ...y, caps: y.caps || {} }) || { caps: {} }, caps = {}; // (both sides are made valid before they are compared)
  for (const k of new Set([...Object.keys(nx.caps), ...Object.keys(ny.caps)])) { const c = pkpMergeCap(nx.caps[k], ny.caps[k]); if (c) caps[k] = c; }
  const m = pkpNormalise({ ...w, caps }); m.u = w.u;
  if (prefCanon({ ...m, u: 0 }) !== prefCanon({ ...w, u: 0 })) m.u = Math.max(x.u || 0, y.u || 0) + 1; // differs from the winner → must propagate
  return m;
};
// "never widen" for the whole record: a stale copy that was deleted at least as recently as it was edited takes no part (see mergeData)

/* ---------- decisions (only ever made by the person, through the screens in packpermui.js) ---------- */
function pkpRecFor(packId) {
  let r = pkpRec(packId); if (!r) { r = pkpNormalise({ packId, caps: {} }); S.pkperms.push(r); } return r;
}
// grant: a new epoch when the scope widens (revoke first), the same epoch when it narrows or stays
function pkpGrant(packId, key, scope, ver) {
  const r = pkpRecFor(packId), cur = r.caps[key], now = Date.now(), st = pkpState(cur);
  let c = cur ? { ...cur } : { rv: 0, rk: '', gr: 0, e: 0, scope: {}, ver: '', dev: '' };
  if (st === 'granted' && prefCanon(pkpScopeAnd(c.scope, scope)) !== prefCanon(scope)) { c.rv = Math.max(now, c.rv + 1, c.gr + 1); c.rk = 'r'; } // the new scope is wider somewhere: a fresh epoch
  r.caps[key] = pkpNormCap({ ...c, gr: Math.max(now, c.gr + 1, c.rv + 1), e: c.rv, scope, ver, dev: actDev() }); pkpTouch(); return r.caps[key];
}
function pkpRevoke(packId, key, kind = 'r') {
  const r = pkpRec(packId); if (!r) { if (kind !== 'd') return false; } const rr = r || pkpRecFor(packId), c = rr.caps[key], now = Date.now();
  rr.caps[key] = pkpNormCap({ ...(c || {}), rv: Math.max(now, (c ? c.rv : 0) + 1, (c ? c.gr : 0) + 1), rk: kind, gr: 0, ver: c ? c.ver : '', dev: actDev() }); pkpTouch(); return true;
}
const pkpRevokeAll = packId => { const r = pkpRec(packId); if (!r) return 0; let n = 0; for (const k of Object.keys(r.caps)) if (pkpState(r.caps[k]) === 'granted') { pkpRevoke(packId, k, 'r'); n++; } return n; };
function pkpTouch() { const d = pkpDevice(); if (!d.seen) { d.seen = true; d.confirmed = true; } save(); } // a device that decides something itself has seen the permissions

/* ---------- this device: new devices confirm once ---------- */
// device-local (S.settings is not synced for this key): a device that RECEIVES permissions it never saw asks the person before they apply on it
function pkpDevice() { const s = S.settings; return s.pkDevice && typeof s.pkDevice === 'object' ? s.pkDevice : (s.pkDevice = { seen: false, confirmed: true }); }
function pkpArrived(hadBefore) { // called after a merge: permissions appeared on a device that had none and has not decided anything yet
  const d = pkpDevice(); if (d.seen || hadBefore) return;
  if (S.pkperms.some(r => Object.values(r.caps).some(c => pkpState(c) === 'granted'))) { d.seen = true; d.confirmed = false; d.since = Date.now(); } // (the caller stores it)
}
const pkpUnconfirmed = () => !pkpDevice().confirmed;
function pkpConfirmDevice() { const d = pkpDevice(); d.confirmed = true; d.seen = true; save(); pkAudit({ packId: '', op: 'confirm-device', target: '', rec: '', ok: true, cap: '' }); }

/* ---------- the question every operation asks ---------- */
// → { ok: true, scope } | { ok: false, missing: '<target>.<cap>', why }.  ctx: { fields: [..] | field: '..', recordId, relationship }
function pkCan(packId, target, capId, ctx = {}) {
  const key = pkpKey(target, capId), no = why => ({ ok: false, missing: key, why });
  const t = pkpTarget(target), def = t && t.caps[capId]; if (!def) return no(`OpenTick has no permission “${capId}” for ${target}.`);
  const st = typeof pksState === 'function' ? pksState(packId) : '';
  if (st !== 'installed') return no(st === 'disabled' ? 'This pack is switched off.' : st === 'removed' ? 'This pack has been removed.' : 'This pack is not installed.');
  if (target === 'pack:' + packId && def.kind !== 'create' && def.kind !== 'modify' && def.kind !== 'delete') return { ok: true, scope: {} }; // a pack reading its own sections needs no permission
  const c = pkpCap(packId, key), s = pkpState(c);
  if (s !== 'granted') return no(s === 'denied' ? 'You said no to this when the pack was added.' : s === 'revoked' ? 'You turned this off.' : 'You have not allowed this.');
  if (pkpUnconfirmed()) return no('This device is new to your account. Review the permissions your packs have on it first (Settings → Sections and packs).');
  const sc = c.scope || {}, want = ctx.fields || (ctx.field ? [ctx.field] : []);
  if (def.fields && want.length) { const miss = want.filter(f => !(sc.fields || []).includes(f)); if (miss.length) return no(`This permission does not include the field${miss.length > 1 ? 's' : ''} ${miss.join(', ')}.`); }
  if (def.records && ctx.recordId !== undefined) {
    const rule = def.records.includes(sc.records) ? sc.records : def.records[0], own = typeof pkpOwns === 'function' && pkpOwns(packId, target, ctx.recordId), linked = typeof pkpLinked === 'function' && pkpLinked(packId, target, ctx.recordId);
    if (!(rule === 'pack-linked' ? own || linked : own)) return no(rule === 'pack-linked' ? 'This permission only covers records this pack made or is linked to.' : 'This permission only covers records this pack made.');
  }
  if (ctx.relationship && def.relationships && !(sc.relationships || def.relationships).includes(ctx.relationship)) return no('This permission does not include that kind of link.');
  return { ok: true, scope: sc };
}

/* ---------- the activity log: S.pkact (sealed, synced; never the contents of a record) ---------- */
// An event is HISTORY, not a command: applying one that arrived from another device never runs anything. Only 'undone' changes, and only to true.
function pkpCleanAct(list) {
  const seen = new Set(), n = v => (Number.isFinite(v) && v > 0 ? Math.round(v) : 0), s = (v, k) => String(v == null ? '' : v).slice(0, k);
  return (Array.isArray(list) ? list : []).filter(e => e && typeof e.id === 'string' && /^pa-[\w-]{4,40}$/.test(e.id) && !seen.has(e.id) && seen.add(e.id)).map(e => ({
    id: e.id, packId: s(e.packId, 40), packVer: s(e.packVer, 20), op: s(e.op, 40), dev: s(e.dev, 60), target: s(e.target, 50), rec: s(e.rec, 60), ts: n(e.ts), ok: e.ok !== false, cap: s(e.cap, 90), why: s(e.why, 160),
    undone: e.undone === true, undoOf: e.undoOf ? s(e.undoOf, 40) : null, u: n(e.u) }));
}
COLL_MERGE.pkact = (x, y, w) => (x.undone === y.undone ? w : { ...w, undone: true, u: Math.max(x.u || 0, y.u || 0) + 1 }); // undone is sticky: never applied twice, never "un-undone"
function pkAudit(e) {
  const ev = { id: 'pa-' + uid().replace(/[^\w-]/g, '').slice(0, 14), packId: e.packId || '', packVer: e.packVer || (typeof pksRec === 'function' && pksRec(e.packId) ? pksRec(e.packId).version : ''), op: e.op, dev: actDev(), target: e.target || '', rec: e.rec == null ? '' : String(e.rec), ts: Date.now(),
    ok: e.ok !== false, cap: e.cap || '', why: e.ok === false ? String(e.why || '').slice(0, 160) : '', undone: false, undoOf: e.undoOf || null };
  S.pkact.push(ev);
  if (S.pkact.length > 2000) { // keep the newest; the events that say who made a record (creates) are kept the longest
    const drop = S.pkact.length - 2000, old = S.pkact.filter(x => x.op !== 'create').sort((a, b) => a.ts - b.ts).slice(0, drop), gone = new Set(old.map(x => x.id));
    S.pkact = S.pkact.filter(x => !gone.has(x.id)); if (S.pkact.length > 2000) S.pkact.sort((a, b) => a.ts - b.ts).splice(0, S.pkact.length - 2000);
  }
  save(); return ev;
}
// who made a record is what the APP wrote down when it made it, never what a pack says
const pkpOwns = (packId, target, id) => (target === 'reminders' && typeof pkrOwns === 'function' ? pkrOwns(packId, id) : S.pkact.some(e => e.packId === packId && e.op === 'create' && e.ok && !e.undone && e.target === target && e.rec === String(id)));
