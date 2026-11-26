/* OpenTick pack permission screens (0.9.1). Three places, all built on pkCan / pkpGrant / pkpRevoke (packperm.js) and pkApi (packapi.js):
   1. the install screen (packPreview): every permission a pack asks for, one line each, with its own tick box, whether it is required, and why;
      on an update it shows only the DIFFERENCE and every new or wider permission starts un-ticked;
   2. Settings → Sections and packs → a pack's "Permissions": each capability, its state, its limits (fields, which records), allow / turn off, "turn all off";
   3. the activity list: what packs did or tried to do (never the contents), with Undo where the app can put it back.
   Plus the pieces on an entry of a pack's section: its action buttons, its "related" panel, and the picker that links an existing task or note.
   Nothing here grants anything by itself: a tick box that the person did not tick is a "no". */
const PKP_KIND = { discover: 'Looks', read: 'Reads', create: 'Creates', modify: 'Changes', delete: 'Deletes', link: 'Links', export: 'Exports', reminder: 'Reminders' };
const pkpScopeText = (def, sc) => [def.fields && (sc.fields || []).length ? 'Fields: ' + (sc.fields || []).map(f => f.replace('-', ' ')).join(', ') : '', def.records ? (sc.records === 'pack-linked' ? 'Records: made by this pack or linked to it' : 'Records: only ones this pack made') : ''].filter(Boolean).join(' · ');
const pkpLine = (key, scope) => { const [t, c] = pkpSplit(key), tg = pkpTarget(t), def = tg && tg.caps[c]; return def ? { tg, def, title: def.title, text: def.describe(scope || {}), kind: PKP_KIND[def.kind] || def.kind } : null; };
const pkpNameOf = packId => { const r = typeof pksRec === 'function' ? pksRec(packId) : null; return r ? r.name : packId || 'OpenTick'; };

/* ---------- 1. the install screen ---------- */
// what each requested capability is compared with: nothing before; or what was decided for the version that is installed
function pkpDiff(pack) {
  const out = [], rec = pkpRec(pack.id), had = rec ? Object.keys(rec.caps).filter(k => pkpState(rec.caps[k]) === 'granted') : [], asked = new Set();
  for (const sec of (pack.permissions || { sections: [] }).sections) for (const c of sec.capabilities) {
    const key = pkpKey(sec.id, c.id), cur = rec && rec.caps[key], st = pkpState(cur); asked.add(key);
    let tag = 'new'; if (st === 'granted') tag = prefCanon(pkpScopeAnd(cur.scope, c.scope)) === prefCanon(c.scope) ? 'same' : 'wider';
    out.push({ key, target: sec.id, sec, cap: c, tag, was: st });
  }
  return { rows: out, dropped: had.filter(k => !asked.has(k)), update: !!rec && had.length > 0 };
}
function pkpInstallBlock(pack) {
  if (!pack.permissions) return `<p class="hint">${ic('shield', 13)} This pack does not ask to use your tasks, notes or anything else. It only adds what you see above.</p>`;
  const d = pkpDiff(pack), by = {}; for (const r of d.rows) (by[r.target] = by[r.target] || []).push(r);
  const rows = Object.keys(by).map(t => { const tg = pkpTarget(t), sec = by[t][0].sec;
    return `<div class="pkp-g"><h4>${esc(tg ? tg.name : t)}</h4><p class="hint">${esc(sec.reason || 'The pack gave no reason.')}</p>` + by[t].map(r => {
      const l = pkpLine(r.key, r.cap.scope); if (!l) return '';
      const checked = r.tag === 'same' || (r.cap.required && r.tag === 'new'), locked = r.tag === 'same';
      const badge = r.tag === 'same' ? '<span class="pkp-b ok">Already allowed</span>' : r.tag === 'wider' ? '<span class="pkp-b warn">Wider than before</span>' : d.update ? '<span class="pkp-b warn">New in this version</span>' : '';
      return `<label class="pkp-r${locked ? ' lock' : ''}"><input type="checkbox" data-pkp="${esc(r.key)}"${checked ? ' checked' : ''}${locked ? ' disabled' : ''}><span><b>${esc(l.title)}</b> <span class="pkp-k ${esc(r.cap.scope ? l.def.kind : '')}">${esc(l.kind)}</span> <span class="pkp-b">${r.cap.required ? 'Required' : 'Optional'}</span>${badge}<small>${esc(l.text)}</small>`
        + `${pkpScopeText(l.def, r.cap.scope) ? `<small class="pkp-s">${esc(pkpScopeText(l.def, r.cap.scope))}</small>` : ''}${r.cap.reason ? `<small>Why: ${esc(r.cap.reason)}</small>` : ''}</span></label>`; }).join('') + '</div>'; }).join('');
  return `<div class="pkp-box"><h3 class="pkp-h">${ic('shield', 16)} ${d.update ? 'What changed in its permissions' : 'What it asks to be allowed to do'}</h3>`
    + `<p class="hint">${d.update ? 'Only the changes are shown. Anything new or wider starts switched off.' : 'Nothing is allowed unless you tick it. You can change any of these later in Settings, and take them back at any moment.'} A pack that does not get a permission still installs; the parts that need it just do not work.</p>${rows}`
    + (d.dropped.length ? `<p class="hint">${ic('alert', 13)} This version no longer asks for: ${esc(d.dropped.map(k => (pkpLine(k) || { title: k }).title).join(', '))}. Those are switched off.</p>` : '') + '</div>';
}
// read the tick boxes before the screen closes
function pkpReadDecisions(m, pack) {
  if (!pack.permissions || !m || !m.querySelectorAll) return null; const dec = {};
  m.querySelectorAll('[data-pkp]').forEach(el => { if (!el.disabled) dec[el.dataset.pkp] = !!el.checked; }); return dec;
}
function pkpApplyDecisions(pack, dec) {
  const d = pkpDiff(pack), ver = pack.version || ''; if (!pack.permissions) { for (const k of d.dropped) pkpRevoke(pack.id, k, 'r'); return; }
  for (const r of d.rows) {
    if (r.tag === 'same') continue; const yes = !!(dec && dec[r.key]);
    if (yes) { pkpGrant(pack.id, r.key, r.cap.scope, ver); pkAudit({ packId: pack.id, op: 'grant', target: r.target, ok: true, cap: r.key }); }
    else if (r.was === 'ask') pkpRevoke(pack.id, r.key, 'd'); // said no (or did not say yes) at install
  }
  for (const k of d.dropped) { pkpRevoke(pack.id, k, 'r'); pkAudit({ packId: pack.id, op: 'revoke', target: pkpSplit(k)[0], ok: true, cap: k }); }
  save();
}

/* ---------- 2. Settings: one pack's permissions ---------- */
const pkpPermBtn = packId => { const r = pksRec(packId); if (!r) return ''; const n = r.perms ? r.perms.sections.reduce((t, s) => t + s.capabilities.length, 0) : 0, on = pkpRec(packId) ? Object.values(pkpRec(packId).caps).filter(c => pkpState(c) === 'granted').length : 0;
  return (n || on ? `<button type="button" class="btn sm" data-m="pkpperm" data-id="${esc(packId)}">Permissions (${on}/${n})</button>` : '') + `<button type="button" class="btn sm" data-m="pkpact" data-id="${esc(packId)}">Activity</button>`; };
const pkpStateWords = { granted: ['Allowed', 'ok'], denied: ['Not allowed', 'no'], revoked: ['Turned off', 'no'], ask: ['Not decided', ''] };
function pkpManagerHtml(packId) {
  const r = pksRec(packId); if (!r) return '<p>This pack is not installed.</p>'; const rec = pkpRec(packId), man = r.perms ? r.perms.sections : [];
  const seen = new Set(), groups = man.map(sec => ({ id: sec.id, reason: sec.reason, caps: sec.capabilities.map(c => ({ key: pkpKey(sec.id, c.id), ask: c.scope, required: c.required, reason: c.reason })) }));
  groups.forEach(g => g.caps.forEach(c => seen.add(c.key)));
  if (rec) for (const k of Object.keys(rec.caps)) if (!seen.has(k) && pkpState(rec.caps[k]) === 'granted') { const [t] = pkpSplit(k); let g = groups.find(x => x.id === t); if (!g) groups.push(g = { id: t, reason: '', caps: [] }); g.caps.push({ key: k, ask: rec.caps[k].scope, required: false, reason: '' }); }
  if (!groups.length) return `<p class="hint">${esc(r.name)} does not ask for any permission.</p>`;
  return (pkpUnconfirmed() ? `<p class="pkp-warn">${ic('alert', 14)} This device is new to your account, so no permission applies on it yet. <button type="button" class="btn sm" data-m="pkpconf">Confirm them on this device</button></p>` : '')
    + groups.map(g => { const tg = pkpTarget(g.id);
      return `<div class="pkp-g"><h4>${esc(tg ? tg.name : g.id)}</h4>${g.reason ? `<p class="hint">${esc(g.reason)}</p>` : ''}` + g.caps.map(c => {
        const l = pkpLine(c.key, c.ask); if (!l) return ''; const cur = rec && rec.caps[c.key], st = pkpState(cur), sc = st === 'granted' ? cur.scope : c.ask, [w, cl] = pkpStateWords[st];
        const limits = (l.def.fields && (c.ask.fields || []).length > 1 ? `<div class="pkp-lim">${(c.ask.fields || []).map(f => `<label><input type="checkbox" data-pkf="${esc(c.key)}" value="${esc(f)}"${(sc.fields || []).includes(f) ? ' checked' : ''}> ${esc(f.replace('-', ' '))}</label>`).join('')}</div>` : '')
          + (l.def.records && c.ask.records === 'pack-linked' ? `<div class="pkp-lim"><label><input type="checkbox" data-pkr="${esc(c.key)}"${sc.records === 'pack-linked' ? ' checked' : ''}> Also records it is linked to (not only the ones it made)</label></div>` : '');
        return `<div class="pkp-r"><span><b>${esc(l.title)}</b> <span class="pkp-k ${esc(l.def.kind)}">${esc(l.kind)}</span> <span class="pkp-b ${cl}">${w}</span>${c.required ? ' <span class="pkp-b">Required</span>' : ''}<small>${esc(l.def.describe(sc))}</small>${pkpScopeText(l.def, sc) ? `<small class="pkp-s">${esc(pkpScopeText(l.def, sc))}</small>` : ''}${c.reason ? `<small>Why: ${esc(c.reason)}</small>` : ''}${limits}</span>`
          + `<span class="pkp-bt">${st === 'granted' ? `<button type="button" class="btn sm" data-m="pkprev" data-key="${esc(c.key)}">Turn off</button>` : `<button type="button" class="btn sm pri" data-m="pkpallow" data-key="${esc(c.key)}">Allow</button>`}</span></div>`; }).join('') + '</div>'; }).join('');
}
function pkpManager(packId, back) {
  const r = pksRec(packId); if (!r) { if (back) back(); return; }
  const draw = () => { const body = $('#pkp-body'); if (body) body.innerHTML = pkpManagerHtml(packId); };
  openModal(`<h3>${ic('shield', 18)} ${esc(r.name)}: permissions</h3><p class="hint">Each line is one thing the pack may do. Turning one off takes effect at once, on every device.</p><div id="pkp-body" class="pkp-body">${pkpManagerHtml(packId)}</div>`
    + `<div class="mact"><button type="button" class="btn danger" data-m="pkprevall">Turn everything off</button><button type="button" data-m="pkpact2">Activity</button><span class="sp"></span><button type="button" class="pri" data-m="no">Done</button></div>`, m => {
    m.onclick = e => {
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) { closeModal(); if (back) back(); } return; }
      const k = b.dataset.key, ver = r.version || '';
      if (b.dataset.m === 'no') { closeModal(); if (back) back(); }
      else if (b.dataset.m === 'pkpact2') { closeModal(); pkpActivity(packId, () => pkpManager(packId, back)); }
      else if (b.dataset.m === 'pkpconf') { pkpConfirmDevice(); draw(); toast('Permissions confirmed on this device'); }
      else if (b.dataset.m === 'pkprev') { pkpRevoke(packId, k, 'r'); pkAudit({ packId, op: 'revoke', target: pkpSplit(k)[0], ok: true, cap: k }); draw(); }
      else if (b.dataset.m === 'pkprevall') { const n = pkpRevokeAll(packId); pkAudit({ packId, op: 'revoke-all', ok: true, cap: '' }); draw(); toast(n ? `Turned off ${plural(n, 'permission')}` : 'Nothing was on'); }
      else if (b.dataset.m === 'pkpallow') {
        const man = r.perms ? r.perms.sections.flatMap(s => s.capabilities.map(c => [pkpKey(s.id, c.id), c.scope])) : [], asked = (man.find(x => x[0] === k) || [k, {}])[1], scope = { ...asked };
        const fs = [...m.querySelectorAll(`[data-pkf="${k}"]`)]; if (fs.length) { scope.fields = fs.filter(x => x.checked).map(x => x.value); if (!scope.fields.length) { toast('Pick at least one field'); return; } }
        const rc = m.querySelector(`[data-pkr="${k}"]`); if (rc) scope.records = rc.checked ? 'pack-linked' : 'pack-created';
        const asked2 = prefCanon(pkpScopeAnd(scope, asked)) === prefCanon(scope); if (!asked2) { toast('That is wider than the pack asked for'); return; }
        pkpGrant(packId, k, scope, ver); pkAudit({ packId, op: 'grant', target: pkpSplit(k)[0], ok: true, cap: k }); draw();
      }
    };
  }, 'wide xs-modal');
}

/* ---------- 3. the activity list ---------- */
const PKP_OPS = { create: 'Created a record', update: 'Changed fields of a record', complete: 'Marked a task done', reopen: 'Reopened a task', delete: 'Deleted (to the trash) a record it made', link: 'Linked an entry to a record', unlink: 'Removed a link', links: 'Looked at its links', search: 'Searched', list: 'Listed records', summary: 'Read a few details of a record', details: 'Read a record in full', stats: 'Read statistics', discover: 'Looked whether a section exists', discover_fields: 'Looked at the fields of a section', grant: 'You allowed it', revoke: 'You turned it off', 'revoke-all': 'You turned everything off', undo: 'Undid something it made', 'confirm-device': 'You confirmed permissions on a device', 'remind-create': 'Added a reminder to an entry', 'remind-list': 'Looked at its reminders', 'remind-user-list': 'Looked at when your reminders are due', 'remind-edit': 'Changed one of its reminders', 'remind-user-edit': 'Changed one of your reminders', 'remind-cancel': 'Cancelled one of its reminders', 'remind-user-cancel': 'Cancelled one of your reminders', 'remind-snooze': 'Snoozed one of its reminders', 'remind-dismiss': 'Dismissed one of its reminders' };
function pkpActivityHtml(packId, only) {
  const rows = S.pkact.filter(e => (!packId || e.packId === packId) && (only !== 'failed' || !e.ok) && (only !== 'done' || e.ok) && e.op !== 'undo').sort((a, b) => b.ts - a.ts).slice(0, 150);
  if (!rows.length) return '<p class="hint">Nothing yet. What a pack does through OpenTick (and what it is refused) is listed here, without the contents of your records.</p>';
  return rows.map(e => { const l = e.cap && e.cap.includes('.') ? pkpLine(e.cap) : null;
    return `<div class="pkp-a${e.ok ? '' : ' bad'}"><span><b>${esc(PKP_OPS[e.op] || e.op)}</b>${e.target && e.target !== e.packId ? ` <small>in ${esc((pkpTarget(e.target) || { name: (S.csections.find(s => s.id === e.target) || { name: e.target }).name }).name)}</small>` : ''}${packId ? '' : ` <small>· ${esc(pkpNameOf(e.packId))}</small>`}<small>${esc(new Date(e.ts).toLocaleString())}${e.ok ? '' : ' · refused: ' + esc(e.why || 'not allowed')}${l ? ' · ' + esc(l.title) : ''}${e.undone ? ' · undone' : ''}</small></span>`
      + (e.op === 'create' && e.ok && !e.undone ? `<button type="button" class="btn sm" data-m="pkpundo" data-id="${esc(e.id)}">Undo</button>` : '') + (!e.ok && e.packId ? `<button type="button" class="btn sm" data-m="pkpperm" data-id="${esc(e.packId)}">Review permissions</button>` : '') + '</div>'; }).join('');
}
function pkpActivity(packId, back, only = 'all') {
  openModal(`<h3>${ic('shield', 18)} ${packId ? esc(pkpNameOf(packId)) + ': activity' : 'Pack activity'}</h3><div class="pkp-flt"><select id="pkp-pk" aria-label="Pack"><option value="">All packs</option>${S.packs.map(p => `<option value="${esc(p.packId)}"${p.packId === packId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`
    + `<select id="pkp-f" aria-label="Show"><option value="all"${only === 'all' ? ' selected' : ''}>Everything</option><option value="done"${only === 'done' ? ' selected' : ''}>What was done</option><option value="failed"${only === 'failed' ? ' selected' : ''}>What was refused</option></select></div>`
    + `<div id="pkp-list" class="pkp-list">${pkpActivityHtml(packId, only)}</div><div class="mact"><span class="sp"></span><button type="button" class="pri" data-m="no">Done</button></div>`, m => {
    const draw = () => { $('#pkp-list', m).innerHTML = pkpActivityHtml($('#pkp-pk', m).value, $('#pkp-f', m).value); };
    m.onchange = e => { if (e.target.id === 'pkp-pk' || e.target.id === 'pkp-f') draw(); };
    m.onclick = e => {
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) { closeModal(); if (back) back(); } return; }
      if (b.dataset.m === 'no') { closeModal(); if (back) back(); }
      else if (b.dataset.m === 'pkpundo') { const r = pkpUndo(b.dataset.id); toast(r.ok ? 'Undone' : r.why); render(); draw(); }
      else if (b.dataset.m === 'pkpperm') { closeModal(); pkpManager(b.dataset.id, () => pkpActivity(packId, back, only)); }
    };
  }, 'wide xs-modal');
}
// Settings routes its clicks here (packs.js → packsSettingsAct)
function pkpAct(a, b, m, back) {
  if (a === 'pkpperm') { pkpManager(b.dataset.id, back); return true; }
  if (a === 'pkpact') { pkpActivity(b.dataset.id, back); return true; }
  if (a === 'pkpall') { pkpActivity('', back); return true; }
  if (a === 'pkpconf') { pkpConfirmDevice(); toast('Permissions confirmed on this device'); back(); return true; }
  return false;
}
// shown above the pack list in Settings
const pkpSettingsNote = () => (pkpUnconfirmed() ? `<p class="pkp-warn">${ic('alert', 14)} This device is new to your account. The permissions you gave your packs do not apply on it until you confirm them. <button type="button" class="btn sm" data-m="pkpconf">Confirm them</button></p>` : '')
  + (S.pkact.length ? `<p class="hint"><button type="button" class="btn sm" data-m="pkpall">Pack activity</button> What packs did or were refused, across all packs.</p>` : '');

/* ---------- on an entry of a pack's section: actions, related, the picker ---------- */
function pkpEntryBlock(s, e) {
  if (!s.packId || (!(s.actions || []).length && !(s.related || []).length)) return '';
  const acts = (s.actions || []).map(a => `<button type="button" class="btn sm" data-pkpa="${esc(a.id)}" title="${esc(pkaNeeds(a).map(([t, c]) => (pkpLine(pkpKey(t, c)) || { title: c }).title).join(' · '))}">${a.icon ? iconAny(a.icon, 14, 'layers') + ' ' : ''}${esc(a.name)}</button>`).join('');
  return `<div class="pkp-ent" data-pkpent="${esc(e.id)}"><h4>${ic('layers', 14)} From ${esc(s.pack || 'this pack')}</h4>${acts ? `<div class="pkp-acts">${acts}</div>` : ''}<div id="pkp-rel">${pkpRelatedHtml(s, e)}</div></div>`;
}
function pkpRelatedHtml(s, e) {
  const api = pkApi(s.packId); let out = '';
  for (const r of s.related || []) {
    const ids = api.links(e.id, r.target), head = `<h5>${esc(r.title || (r.target === 'tasks' ? 'Linked tasks' : 'Linked notes'))}</h5>`;
    if (!ids.ok) { out += `${head}<p class="hint">${esc(ids.why)} <button type="button" class="btn sm" data-pkpperm="${esc(s.packId)}">Review permissions</button></p>`; continue; }
    if (!ids.ids.length) { out += `${head}<p class="hint">Nothing linked yet.</p>`; continue; }
    out += head + ids.ids.map(id => { const x = api.summary(r.target, id, r.fields); if (!x.ok) return `<p class="hint">${esc(x.why)} <button type="button" class="btn sm" data-pkpperm="${esc(s.packId)}">Review permissions</button></p>`; if (!x.record) return '';
      const rec = x.record; return `<div class="pkp-rl"><b>${esc(rec.title || 'Untitled')}</b>${r.fields.filter(f => f !== 'title' && rec[f] != null && rec[f] !== '' && !(Array.isArray(rec[f]) && !rec[f].length)).map(f => `<span class="pkp-b">${esc(f.replace('-', ' '))}: ${esc(Array.isArray(rec[f]) ? rec[f].join(' ') : f === 'updated' ? new Date(rec[f]).toLocaleDateString() : rec[f])}</span>`).join('')}</div>`; }).join('');
  }
  return out;
}
function pkpPicker(s, e, a, after) {
  const target = pkaOps()[a.op].target, api = pkApi(s.packId), need = pkaNeeds(a).map(([t, c]) => pkCan(s.packId, t, c)).find(r => !r.ok);
  if (need) { pkAudit({ packId: s.packId, op: a.op, target: s.id, rec: e.id, ok: false, cap: need.missing, why: need.why }); toast(need.why, { label: 'Review', fn: () => pkpManager(s.packId, after) }); return; }
  openModal(`<h3>${esc(a.name)}</h3><p class="hint">Search your ${target === 'tasks' ? 'tasks' : 'notes'} by title and choose one. ${esc(s.pack || 'The pack')} only gets the link, not what is in it.</p><input id="pkp-q" class="pkl-q" type="search" placeholder="Search by title" autocomplete="off" aria-label="Search by title"><div id="pkp-res" class="pkp-list"></div><div class="mact"><span class="sp"></span><button type="button" data-m="no">Cancel</button></div>`, m => {
    const q = $('#pkp-q', m), res = $('#pkp-res', m); setTimeout(() => q.focus && q.focus(), 30);
    const run = () => { const r = api.search(target, q.value, { limit: 8 }); res.innerHTML = !r.ok ? `<p class="hint">${esc(r.why)}</p>` : r.records.length ? r.records.map(x => `<button type="button" class="pkp-pick" data-m="pick" data-id="${esc(x.id)}">${esc(x.title || 'Untitled')}</button>`).join('') : `<p class="hint">${q.value.trim() ? 'No match.' : 'Type to search.'}</p>`; };
    q.oninput = run; m.onclick = ev => { const b = ev.target.closest('[data-m]'); if (!b) { if (ev.target.classList.contains('mback')) { closeModal(); after(); } return; }
      if (b.dataset.m === 'pick') { const l = api.link(e.id, target, b.dataset.id); closeModal(); toast(l.ok ? 'Linked' : l.why); after(true); } else { closeModal(); after(); } };
  });
}
// the click handler of the entry editor calls this first; it returns true when the click was one of ours
function pkpEntryClick(ev, m, s, st, stored) {
  const rv = ev.target.closest('[data-pkpperm]'); if (rv) { closeModal(); pkpManager(rv.dataset.pkpperm, () => xsEditEntry(s, stored)); return true; }
  const b = ev.target.closest('[data-pkpa]'); if (!b || !stored) return false;
  const a = (s.actions || []).find(x => x.id === b.dataset.pkpa); if (!a) return true;
  const reopen = () => { const fresh = S.centries.find(x => x.id === stored.id); closeModal(); if (fresh) xsEditEntry(s, fresh); };
  if (a.op === 'link_task' || a.op === 'link_note') { pkpPicker(s, stored, a, reopen); return true; }
  const r = pkaRun(s, stored, a); st.links = stored.links ? JSON.parse(JSON.stringify(stored.links)) : undefined; // (the editor's copy follows what the action changed on the entry)
  if (r.ok) { toast(a.op.startsWith('create') ? 'Created and linked' : r.changed ? `Changed ${plural(r.changed, 'item')}` : 'Done'); sfx('add'); render(); pkstSection(s); const el = $('#pkp-rel', m); if (el) el.innerHTML = pkpRelatedHtml(s, stored); }
  else toast(r.why || 'Not allowed', { label: 'Review', fn: () => { closeModal(); pkpManager(s.packId, reopen); } });
  return true;
}
