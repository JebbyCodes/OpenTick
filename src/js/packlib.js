/* OpenTick pack library (0.9): browse the packs other people made, or type a pack's code, and add it.

   The library is its own project, JebbyCodes/OpenTick-Packs: people send a pull request with one pack file, it is checked by robots (the file is
   read with this app's own packParse, and the pack is installed into a real OpenTick to see that it starts fast and throws no errors) and by the
   maintainer, and only then published. Publishing builds index.json (one row per pack, with its code) and the website, on GitHub Pages.

   What this file does, and what it never does:
   • It asks the library for index.json (once you press Browse or type a code) and for the one pack file you pick. Nothing is requested until
     you ask, nothing about you or your data is sent (only what any web request carries: your IP address), and it is never done in the background.
     The one exception is opt-in and OFF by default: the anonymous "pack used" count (packstats.js, Settings > Sections & packs), which says which pack was used and
     nothing else, and is also what makes a retry after a lost answer a background request.
   • A pack is data. The file goes through the same packParse / packPreview / packInstall as a file from disk: it can add sections and colours and
     cannot run anything. You see what is in it before anything is added.
   • The index is checked as hard as the pack: a row that is malformed, has a bad code or points anywhere but packs/<id>.json is dropped. The pack
     file is checked against the size and the SHA-256 the index lists (a half-updated mirror or a changed file is refused), and its id must match.
   • A pack's CODE is 8 letters and digits, written XXXX-XXXX, from the alphabet 0-9 A-Z without I, L, O and U (so nothing looks like anything else).
     The library derives it from the pack's id, so it never changes. You may type it in any case, with or without the dash or spaces; O and I and L
     are read as 0, 1, 1.
   • "Installed" is read from the sections it made (packId) and, for colour-only packs, from a note kept on this device (settings.packsDone). */
const PKL = { base: 'https://jebbycodes.github.io/OpenTick-Packs/', repo: 'JebbyCodes/OpenTick-Packs', timeout: 15000, indexMax: 2 * 1024 * 1024, ttl: 10 * 60 * 1000, format: 1, idx: null, at: 0, tok: 0, ui: { q: '', kind: 'all', tag: '' } };
const PKL_CODE = /^[0-9A-HJKMNP-TV-Z]{8}$/;
const pkErr = (m, extra) => Object.assign(new Error(m), { pk: true }, extra || {});
const pkLine = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const pkN = v => { v = Math.floor(+v); return Number.isFinite(v) && v >= 0 ? Math.min(v, 1e6) : 0; };

// 'k7qm 3xrd' | 'K7QM-3XRD' | 'k7qm3xrd' -> 'K7QM-3XRD'; '' when it cannot be a code
function pkCode(raw) {
  const s = String(raw == null ? '' : raw).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return PKL_CODE.test(s) ? s.slice(0, 4) + '-' + s.slice(4) : '';
}
// what to show while it is being typed: letters and digits only, upper case, the dash after the fourth
function pkTyping(raw) {
  const s = String(raw == null ? '' : raw).toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').slice(0, 8);
  return s.length > 4 ? s.slice(0, 4) + '-' + s.slice(4) : s;
}

// ---------- the index ----------
function pkIndexClean(raw) {
  if (!raw || typeof raw !== 'object' || raw.opentick !== 'pack-index') throw pkErr('The library sent something that is not a pack index.');
  const fmt = Number(raw.format);
  if (!(fmt >= 1)) throw pkErr('The library sent something that is not a pack index.');
  if (fmt > PKL.format) throw pkErr('The library has moved to a newer format. Please update OpenTick, then try again.');
  const out = [], seen = new Set(); let skipped = 0;
  for (const e of (Array.isArray(raw.packs) ? raw.packs : []).slice(0, 5000)) {
    const id = e && typeof e.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id) && e.id.length <= 40 ? e.id : '', code = pkCode(e && e.code);
    if (!id || !code || e.file !== `packs/${id}.json` || seen.has(code)) { skipped++; continue; }
    seen.add(code);
    out.push({
      code, id, file: e.file, name: pkLine(e.name, 60) || id, version: pkLine(e.version, 20), author: pkLine(e.author, 60), description: pkLine(e.description, 300), license: pkLine(e.license, 40),
      sections: pkN(e.sections), themes: pkN(e.themes), entries: pkN(e.entries), size: pkN(e.size), sha: typeof e.sha256 === 'string' && /^[0-9a-f]{64}$/.test(e.sha256) ? e.sha256 : '',
      tags: (Array.isArray(e.tags) ? e.tags : []).map(t => pkLine(t, 24).toLowerCase()).filter(Boolean).slice(0, 6), updated: typeof e.updated === 'string' && /^\d{4}-\d\d-\d\d$/.test(e.updated) ? e.updated : '',
    });
  }
  return { packs: out, skipped, updated: typeof raw.updated === 'string' && /^\d{4}-\d\d-\d\d/.test(raw.updated) ? raw.updated.slice(0, 10) : '', usage: typeof pkstUrlOk === 'function' ? pkstUrlOk(raw.usage) : '' }; // usage: where the optional, opt-in usage counts go (packstats.js); '' when the library publishes none
}

// ---------- asking the library ----------
async function pkGet(path, max) {
  let timer;
  try {
    const r = await Promise.race([httpx('GET', PKL.base + path, { Accept: 'application/json' }), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timed out')), PKL.timeout); })]);
    if (r.status === 404) throw pkErr('That is not in the library (it may have been removed).');
    if (r.status === 403 || r.status === 429) throw pkErr('The library is limiting requests right now. Try again in a little while.');
    if (!r.ok) throw pkErr(`The library answered ${r.status}. Try again later.`);
    const text = await r.text();
    if (text.length > max) throw pkErr('That file is larger than a pack is allowed to be, so it was not opened.');
    return text;
  } catch (e) { throw e && e.pk ? e : pkErr('Could not reach the pack library. Are you online?'); } finally { clearTimeout(timer); }
}
async function pkSha(text) { try { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join(''); } catch (e) { return ''; } }
async function pkIndex(force) {
  if (!force && PKL.idx && Date.now() - PKL.at < PKL.ttl) return PKL.idx;
  const text = await pkGet('index.json', PKL.indexMax); let j; try { j = JSON.parse(text); } catch (e) { throw pkErr('The library sent something that is not a pack index.'); }
  PKL.idx = pkIndexClean(j); PKL.at = Date.now();
  if (typeof pkstLearn === 'function') pkstLearn(PKL.idx.usage); // (only does anything while the person has usage counting on)
  return PKL.idx;
}
// the row for a code, or null. A pack that was published a minute ago is not in a copy that is a few minutes old, so a miss looks again once.
async function pkFind(code) {
  let idx = await pkIndex(), hit = idx.packs.find(p => p.code === code);
  if (!hit && Date.now() - PKL.at > 30000) { idx = await pkIndex(true); hit = idx.packs.find(p => p.code === code); }
  return hit || null;
}
async function pkFetchPack(entry, retried) {
  const text = await pkGet(entry.file, PACK_MAX_BYTES);
  if (entry.sha) {
    const h = await pkSha(text);
    if (h && h !== entry.sha) {
      if (!retried) { const fresh = (await pkIndex(true)).packs.find(p => p.id === entry.id); if (fresh && fresh.sha !== entry.sha) return pkFetchPack(fresh, true); }
      throw pkErr('The file does not match the library’s index, so it was not opened. Try again in a few minutes.');
    }
  }
  let r; try { r = packParse(text); } catch (e) { throw pkErr('The pack could not be read: ' + (e && e.message || e)); }
  if (r.pack.id !== entry.id) throw pkErr('The file is not the pack the library lists under that code, so it was not opened.');
  return { ...r, entry };
}

// ---------- what is already here ----------
function pkInstalled(e) {
  const have = (S.csections || []).filter(s => s.packId === e.id), done = (S.settings.packsDone || {})[e.id], rec = typeof pksRec === 'function' ? pksRec(e.id) : null;
  if (rec && rec.state === 'removed') return null; // removed on any device: not installed (the sections it made are the person's own now)
  if (!have.length && !done && !rec) return null;
  const vers = [...have.map(s => s.packVer), done && done.v, rec && rec.version].filter(Boolean);
  let ver = ''; for (const v of vers) if (!ver || updNewer(v, ver)) ver = v;
  return { ver, newer: !!ver && updNewer(e.version, ver) };
}
const pkOpenOk = u => typeof u === 'string' && (u === PKL.base || u.startsWith(`https://github.com/${PKL.repo}/`));

// ---------- looking at one pack, and getting it ----------
function pkProblem(message, retry, again) {
  openModal(`<h3>${ic('alert', 18)} Could not open the pack</h3><p>${esc(message)}</p><div class="mact"><span class="sp"></span><button type="button" data-m="no">Close</button>${retry ? '<button type="button" class="pri" data-m="retry">Try again</button>' : ''}</div>`, m => {
    m.onclick = e => { const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) { closeModal(); if (again) again(); } return; } if (b.dataset.m === 'retry' && retry) retry(); else { closeModal(); if (again) again(); } };
  }, 'wide');
}
async function packOpenEntry(entry, again) {
  const tok = ++PKL.tok;
  openModal(`<h3>${esc(entry.name)}</h3><p class="hint pkl-wait">${ic('package', 14)} Getting it from the library…</p><div class="mact"><span class="sp"></span><button type="button" data-m="no">Cancel</button></div>`, m => {
    m.onclick = e => { const b = e.target.closest('[data-m]'); if (b || e.target.classList.contains('mback')) { PKL.tok++; closeModal(); if (again) again(); } };
  }, 'wide');
  try {
    const r = await pkFetchPack(entry); if (tok !== PKL.tok) return;
    packPreview(r.pack, r.warnings, again, entry);
  } catch (e) { if (tok !== PKL.tok) return; pkProblem(e && e.pk ? e.message : 'Something went wrong while opening the pack.', () => packOpenEntry(entry, again), again); }
}

// ---------- "Add a pack by code" ----------
function packCodeOpen(prefill, again) {
  openModal(`<h3>${ic('hash', 18)} Add a pack by code</h3><p class="hint">Every pack in the library has a code, like <b class="pkl-cc">K7QM-3XRD</b>. Type or paste one and OpenTick finds the pack. You look it over before anything is added.</p>`
    + `<input id="pkl-c" class="pkl-in" value="${esc(pkTyping(prefill))}" placeholder="XXXX-XXXX" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Pack code">`
    + `<p class="pkl-msg" id="pkl-e" role="status"></p>`
    + `<div class="mact"><button type="button" data-m="pklib">${ic('search', 14)} Browse instead</button><span class="sp"></span><button type="button" data-m="no">Cancel</button><button type="button" class="pri" data-m="ok" id="pkl-ok">Find pack</button></div>`, m => {
    const inp = $('#pkl-c', m), msg = $('#pkl-e', m), ok = $('#pkl-ok', m); let busy = false;
    const say = (t, bad) => { msg.textContent = t; msg.classList.toggle('bad', !!bad); if (bad) msg.setAttribute('role', 'alert'); else msg.setAttribute('role', 'status'); };
    const go = async given => {
      if (busy) return; const code = given || pkCode(inp.value);
      if (!code) { say(inp.value.trim() ? 'A code is 8 letters and digits, like K7QM-3XRD.' : 'Type the pack’s code first.', true); inp.focus(); return; }
      busy = true; ok.disabled = true; say('Looking in the library…');
      try {
        const hit = await pkFind(code); if (!m.isConnected && !$('#pkl-c')) return;
        if (!hit) { say('No pack has the code ' + code + '. Check it and try again.', true); return; }
        closeModal(); packOpenEntry(hit, () => packCodeOpen(code, again));
      } catch (e) { say(e && e.pk ? e.message : 'Something went wrong. Try again.', true); }
      finally { busy = false; ok.disabled = false; }
    };
    m.onclick = e => {
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) { closeModal(); if (again) again(); } return; }
      if (b.dataset.m === 'ok') go(); else if (b.dataset.m === 'pklib') { closeModal(); packLibraryOpen(again); } else { closeModal(); if (again) again(); }
    };
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
    if (pkCode(prefill)) go(pkCode(prefill)); else inp.focus(); // a code that came with the dialog (a link, a paste) is looked up straight away
  }, 'wide');
}

// ---------- the browser ----------
function pkMatches(p, ui) {
  if (ui.kind === 'sections' && !p.sections) return false; if (ui.kind === 'themes' && !p.themes) return false; if (ui.tag && !p.tags.includes(ui.tag)) return false;
  const q = ui.q.trim().toLowerCase(); if (!q) return true;
  const hay = [p.name, p.id, p.author, p.description, p.code, p.tags.join(' ')].join(' ').toLowerCase();
  return q.split(/\s+/).every(w => hay.includes(w) || (pkCode(w) && p.code === pkCode(w)));
}
function pkRowHtml(p) {
  const have = pkInstalled(p), counts = [p.sections ? plural(p.sections, 'section') : '', p.themes ? plural(p.themes, 'theme') : '', p.entries ? plural(p.entries, 'entry').replace('entrys', 'entries') : ''].filter(Boolean).join(' · ');
  return `<button type="button" class="pkl-row" data-code="${esc(p.code)}"><span class="pkl-ic">${ic(p.themes && !p.sections ? 'palette' : 'layers', 18)}</span><span class="pkl-n"><span class="pkl-t"><b>${esc(p.name)}</b>${p.version ? ` <em>v${esc(p.version)}</em>` : ''}${have ? `<span class="pkl-badge">${have.newer ? 'Update ' + esc(p.version) : 'Installed'}</span>` : ''}</span>${p.description ? `<small class="pkl-d">${esc(p.description)}</small>` : ''}<small class="pkl-m">${[p.author ? 'by ' + esc(p.author) : '', esc(counts)].filter(Boolean).join(' · ')}</small></span><code class="pkl-cc">${esc(p.code)}</code></button>`;
}
function packLibraryOpen(again) {
  const ui = PKL.ui; let state = 'loading', err = '';
  openModal(`<h3>${ic('package', 18)} Pack library</h3><input id="pkl-q" class="pkl-q" type="search" placeholder="Search by name, author, topic or code" autocomplete="off" aria-label="Search the library" value="${esc(ui.q)}">`
    + `<div class="pkl-chips" id="pkl-chips" role="group" aria-label="Filter"></div><div class="pkl-list" id="pkl-list" aria-live="polite"></div>`
    + `<div class="mact"><button type="button" data-m="pkcode">${ic('hash', 14)} Enter a code</button><button type="button" data-m="pkref" title="Ask the library again">${ic('refresh', 14)}</button><span class="sp"></span><button type="button" data-m="no">Close</button></div>`, m => {
    const list = $('#pkl-list', m), chips = $('#pkl-chips', m), q = $('#pkl-q', m);
    const paint = () => {
      if (state !== 'ok') {
        chips.innerHTML = ''; list.innerHTML = state === 'loading' ? `<p class="hint pkl-wait">${ic('package', 14)} Asking the library…</p>` : `<p class="pkl-msg bad" role="alert">${esc(err)}</p><button type="button" class="btn" data-m="pkref">Try again</button>`; return;
      }
      const all = PKL.idx.packs, tags = {}; for (const p of all) for (const t of p.tags) tags[t] = (tags[t] || 0) + 1;
      const top = Object.entries(tags).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 8).map(x => x[0]);
      const chip = (k, v, label) => `<button type="button" class="pkl-chip${(k === 'kind' ? ui.kind === v : ui.tag === v) ? ' on' : ''}" data-chip="${k}" data-v="${esc(v)}" aria-pressed="${k === 'kind' ? ui.kind === v : ui.tag === v}">${esc(label)}</button>`;
      chips.innerHTML = chip('kind', 'all', 'All') + chip('kind', 'sections', 'Sections') + chip('kind', 'themes', 'Themes') + top.map(t => chip('tag', t, '#' + t)).join('');
      const hits = all.filter(p => pkMatches(p, ui)).sort((a, b) => (b.updated || '').localeCompare(a.updated || '') || (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
      list.innerHTML = hits.length ? hits.map(pkRowHtml).join('') : `<p class="hint">${all.length ? 'Nothing matches. Try fewer words, or <b>All</b>.' : 'The library has no packs yet.'}</p>`;
    };
    const load = async force => { state = 'loading'; paint(); try { await pkIndex(force); state = 'ok'; } catch (e) { state = 'error'; err = e && e.pk ? e.message : 'Something went wrong. Try again.'; } if ($('#pkl-list')) paint(); };
    m.onclick = e => {
      const row = e.target.closest('.pkl-row'), chip = e.target.closest('[data-chip]'), b = e.target.closest('[data-m]');
      if (row) { const p = PKL.idx && PKL.idx.packs.find(x => x.code === row.dataset.code); if (p) { closeModal(); packOpenEntry(p, () => packLibraryOpen(again)); } return; }
      if (chip) { if (chip.dataset.chip === 'kind') ui.kind = chip.dataset.v; else ui.tag = ui.tag === chip.dataset.v ? '' : chip.dataset.v; paint(); return; }
      if (!b) { if (e.target.classList.contains('mback')) { closeModal(); if (again) again(); } return; }
      if (b.dataset.m === 'pkref') load(true); else if (b.dataset.m === 'pkcode') { closeModal(); packCodeOpen('', () => packLibraryOpen(again)); } else { closeModal(); if (again) again(); }
    };
    q.oninput = () => { ui.q = q.value; if (state === 'ok') paint(); };
    load(false); q.focus();
  }, 'wide xs-modal pkl');
}

// ---------- Settings → Sections & packs ----------
function packLibHtml() {
  return `<h4 class="mh">Pack library</h4><p class="hint" style="margin-top:0">Sections and colour themes made by other people. Every pack has a code, like K7QM-3XRD: type it in and OpenTick finds the pack, or browse the whole library.</p>`
    + `<div class="pkl-code"><input id="pkl-code" class="pkl-in" placeholder="Pack code, e.g. K7QM-3XRD" maxlength="14" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Pack code"><button type="button" class="btn pri" data-m="pkgo">Find</button></div>`
    + `<div class="ct-acts"><button type="button" class="btn" data-m="pklib">${ic('search', 14)} Browse the library…</button><button type="button" class="btn" data-m="pksite">${ic('external-link', 14)} Open the website</button><button type="button" class="btn" data-m="pkmake">${ic('upload', 14)} Share your own</button></div>`
    + `<p class="hint">${ic('shield', 13)} OpenTick only contacts the library when you press one of these, and sends nothing about you or your data. (The optional usage count below is off until you turn it on.) A pack is only ever data (sections and colours), never code, and you look it over before anything is added.</p>`;
}
function packLibAct(a, b, m, back) {
  if (a === 'pkgo') { const v = $('#pkl-code', m); const t = v ? v.value : ''; closeModal(); packCodeOpen(t, back); return true; }
  if (a === 'pklib') { closeModal(); packLibraryOpen(back); return true; }
  if (a === 'pksite') { openExternal(PKL.base); return true; }
  if (a === 'pkmake') { openExternal(`https://github.com/${PKL.repo}/blob/main/CONTRIBUTING.md`); return true; }
  return false;
}
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('input', e => { const t = e.target; if (t && t.classList && t.classList.contains('pkl-in')) { const v = pkTyping(t.value); if (v !== t.value) t.value = v; } });
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target && e.target.id === 'pkl-code') { e.preventDefault(); const b = $('[data-m=pkgo]'); if (b) b.click(); } });
}

// ---------- a link to a pack: ?pack=K7QM-3XRD on the web app (the library's website has the button) ----------
if (typeof location !== 'undefined' && typeof setTimeout === 'function') setTimeout(() => {
  if (typeof WIDGET !== 'undefined' && WIDGET) return;
  let q = ''; try { q = new URLSearchParams(location.search).get('pack') || ''; if (q) history.replaceState(null, '', location.pathname); } catch (e) { /* no link */ }
  if (!q) return;
  const go = n => { if (typeof Vault !== 'undefined' && Vault.locked && n < 60) setTimeout(() => go(n + 1), 1500); else packCodeOpen(q); }; // wait for the unlock, for a minute and a half at most
  go(0);
}, 1100);
