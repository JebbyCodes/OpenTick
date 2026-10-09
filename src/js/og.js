/* OpenTick ↔ OpenGantt.
   OpenGantt draws charts from a small YAML block (rows: label / plan / fact / notes / children / extra columns) that lives in a
   .yaml file or in a ```gantt fence of a Markdown (Obsidian) note. This file:
     1. reads/writes that YAML (a tolerant subset parser + a writer that keeps the chart's own header keys and the rest of a note),
     2. maps tasks <-> rows (task = row, subtasks = children, due/start = plan, actual start/done date = fact),
     3. keeps a list LINKED to a chart file: a three-way merge per task (what changed in the file vs. in OpenTick since the last sync),
     4. draws the in-app Gantt page. */

/* ---------- YAML subset ---------- */
const ogErr = (n, m) => Object.assign(new Error(`YAML line ${n + 1}: ${m}`), { yaml: true });
function ogStripC(s) {
  let q = '', out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { out += c; if (q === '"' && c === '\\') out += s[++i] ?? ''; else if (c === q) { if (q === "'" && s[i + 1] === "'") out += s[++i]; else q = ''; } }
    else if ((c === '"' || c === "'") && (!out.trim() || /[\s\[{,:]$/.test(out))) { q = c; out += c; }
    else if (c === '#' && (i === 0 || /\s/.test(s[i - 1]))) break;
    else out += c;
  }
  return out.replace(/\s+$/, '');
}
function ogQuoted(s, i = 0) {
  const q = s[i]; let v = ''; i++;
  for (; i < s.length; i++) {
    const c = s[i];
    if (q === '"' && c === '\\') { const n = s[++i]; v += ({ n: '\n', t: '\t', r: '\r', '"': '"', '\\': '\\', '/': '/', '0': '\0' })[n] ?? n; }
    else if (c === q) { if (q === "'" && s[i + 1] === "'") { v += "'"; i++; } else return { v, end: i + 1 }; }
    else v += c;
  }
  return { v, end: i };
}
function ogScalar(t) {
  t = t.trim();
  if (t === '' || t === '~' || /^null$/i.test(t)) return null;
  if (/^(true|false)$/i.test(t)) return t.toLowerCase() === 'true';
  if (/^-?(0|[1-9]\d*)(\.\d+)?$/.test(t)) return +t;
  if (t[0] === '"' || t[0] === "'") return ogQuoted(t).v;
  return t;
}
function ogFlow(s) {
  let i = 0;
  const ws = () => { while (i < s.length && /\s/.test(s[i])) i++; };
  const val = () => {
    ws();
    if (s[i] === '[') { i++; const a = []; ws(); while (i < s.length && s[i] !== ']') { a.push(val()); ws(); if (s[i] === ',') i++; ws(); } if (s[i] !== ']') throw new Error('YAML: unclosed [ in a list'); i++; return a; }
    if (s[i] === '{') {
      i++; const o = {}; ws();
      while (i < s.length && s[i] !== '}') {
        ws(); let k;
        if (s[i] === '"' || s[i] === "'") { const q = ogQuoted(s, i); k = q.v; i = q.end; } else { let j = i; while (j < s.length && !':,}'.includes(s[j])) j++; k = s.slice(i, j).trim(); i = j; }
        ws(); if (s[i] === ':') i++; o[k] = val(); ws(); if (s[i] === ',') i++; ws();
      }
      if (s[i] !== '}') throw new Error('YAML: unclosed { in a mapping'); i++; return o;
    }
    if (s[i] === '"' || s[i] === "'") { const q = ogQuoted(s, i); i = q.end; return q.v; }
    let j = i; while (j < s.length && !',]}'.includes(s[j])) j++;
    const t = s.slice(i, j); i = j; return ogScalar(t);
  };
  return val();
}
const ogBalanced = s => { let d = 0, q = ''; for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === q) q = ''; else if (q === '"' && c === '\\') i++; } else if (c === '"' || c === "'") q = c; else if (c === '[' || c === '{') d++; else if (c === ']' || c === '}') d--; } return d <= 0; };
function ogYamlParse(text) {
  const raw = String(text).replace(/\r\n?/g, '\n').split('\n');
  const L = raw.map((r, n) => {
    const lead = r.match(/^[ \t]*/)[0]; if (lead.includes('\t')) { if (r.trim() && !/^\s*#/.test(r)) throw ogErr(n, 'tabs cannot be used for indentation'); }
    const s = ogStripC(r).trim();
    return { n, raw: r, ind: r.length - r.trimStart().length, s };
  });
  let p = 0;
  const skip = () => { while (p < L.length && (!L[p].s || /^(---|\.\.\.)$/.test(L[p].s))) p++; };
  const isDash = s => s === '-' || s.startsWith('- ');
  const KEY = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s\[\]{}"'#,&*!|>%@`:-][^:]*?|-[^\s:][^:]*?)\s*:(?:\s+(.*)|$)/;
  const isKey = s => KEY.test(s);
  const flowOrScalar = v => {
    if ((v[0] === '[' || v[0] === '{')) { const n0 = p; while (!ogBalanced(v) && p < L.length) v += ' ' + L[p++].s; if (!ogBalanced(v)) throw ogErr(L[Math.max(0, n0 - 1)].n, 'unclosed [ or {'); return ogFlow(v); }
    return ogScalar(v);
  };
  function blockScalar(h, ind) {
    const lines = []; let bi = -1;
    while (p < L.length && (!L[p].raw.trim() || L[p].ind > ind)) {
      const r = L[p].raw;
      if (r.trim()) { if (bi < 0) bi = L[p].ind; lines.push(r.slice(Math.min(bi, L[p].ind))); } else lines.push('');
      p++;
    }
    while (lines.length && !lines[lines.length - 1]) lines.pop();
    let out = h[0] === '>' ? lines.join('\n').replace(/([^\n])\n(?=[^\n])/g, '$1 ') : lines.join('\n');
    if (!h.includes('-') && lines.length) out += '\n';
    return out;
  }
  function block(ind) { skip(); const l = L[p]; if (isDash(l.s)) return seq(l.ind); if (isKey(l.s)) return map(l.ind); p++; return flowOrScalar(l.s); }
  function seq(ind) {
    const a = [];
    for (;;) {
      skip(); const l = L[p]; if (!l || l.ind !== ind || !isDash(l.s)) break;
      const rest = l.s.slice(1).trim(), col = l.ind + l.s.length - rest.length;
      if (!rest) { p++; skip(); const n = L[p]; a.push(n && n.ind > ind ? block(n.ind) : null); }
      else if (isDash(rest)) { L[p] = { ...l, ind: col, s: rest }; a.push(seq(col)); }
      else if (isKey(rest)) { L[p] = { ...l, ind: col, s: rest }; a.push(map(col)); }
      else { p++; a.push(flowOrScalar(rest)); }
    }
    return a;
  }
  function map(ind) {
    const o = {};
    for (;;) {
      skip(); const l = L[p]; if (!l || l.ind !== ind || isDash(l.s)) break;
      const m = l.s.match(KEY); if (!m) throw ogErr(l.n, 'expected “key: value”');
      const k = m[1][0] === '"' || m[1][0] === "'" ? ogQuoted(m[1]).v : m[1].trim(), v = (m[2] || '').trim(); p++;
      if (v === '') { skip(); const n = L[p]; o[k] = n && n.ind > ind ? block(n.ind) : n && n.ind === ind && isDash(n.s) ? seq(ind) : null; }
      else if (/^[|>][+-]?$/.test(v)) o[k] = blockScalar(v, ind);
      else o[k] = flowOrScalar(v);
    }
    return o;
  }
  skip(); if (p >= L.length) return {};
  const v = block(L[p].ind); skip();
  if (p < L.length) throw ogErr(L[p].n, 'unexpected indentation');
  return v;
}

/* ---------- YAML writer ---------- */
function ogStr(v, flow) {
  if (v == null) return 'null';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return '[' + v.map(x => ogStr(x, true)).join(', ') + ']';
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  const bad = s === '' || /^\s|\s$/.test(s) || /[\n\t\r]/.test(s) || /(^|\s)#/.test(s) || /:(\s|$)/.test(s) || /^[-?:,\[\]{}#&*!|>'"%@`]/.test(s)
    || /^(true|false|null|yes|no|on|off|~)$/i.test(s) || /^-?\d+(\.\d+)?$/.test(s) || (flow && /[,\[\]{}]/.test(s));
  return bad ? JSON.stringify(s) : s;
}
const ogKey = k => (/^[A-Za-z_][\w .\-]*$/.test(k) && !/^(true|false|null|yes|no|on|off)$/i.test(k) ? k : JSON.stringify(k));
function ogKV(k, v, pad) {
  if (typeof v === 'string' && v.includes('\n') && !/^\s/.test(v.replace(/^\n+/, '')) && !/^\n/.test(v)) {
    const body = v.replace(/\n$/, '').split('\n');
    return [`${pad}${ogKey(k)}: ${v.endsWith('\n') ? '|' : '|-'}`, ...body.map(l => (l ? pad + '  ' + l : ''))];
  }
  return [`${pad}${ogKey(k)}: ${ogStr(v)}`];
}
function ogEmitRows(rows, ind) {
  const out = [], pad = ' '.repeat(ind);
  for (const r of rows) {
    let first = true;
    const put = lines => { if (first) { lines[0] = pad + '- ' + lines[0].slice(ind + 2); first = false; } out.push(...lines); };
    for (const k of Object.keys(r)) if (k !== 'children') put(ogKV(k, r[k], ' '.repeat(ind + 2)));
    if (r.children && r.children.length) { put([`${' '.repeat(ind + 2)}children:`]); out.push(...ogEmitRows(r.children, ind + 4)); }
  }
  return out;
}
// replace only the `rows:` block, keeping every other key (scale, mode, columns, title…) and comments exactly as they were
function ogMergeYaml(old, rows, headDefault) {
  const lines = old && old.trim() ? old.replace(/\r\n?/g, '\n').replace(/\n+$/, '').split('\n') : [];
  const i = lines.findIndex(l => /^rows\s*:/.test(l));
  let head, tail = [];
  if (!lines.length) head = headDefault;
  else if (i < 0) head = lines;
  else {
    head = lines.slice(0, i);
    let j = i + 1;
    while (j < lines.length && (!lines[j].trim() || /^\s/.test(lines[j]) || /^-(\s|$)/.test(lines[j]))) j++;
    while (j > i + 1 && !lines[j - 1].trim()) j--;
    tail = lines.slice(j);
  }
  return [...head, rows.length ? 'rows:' : 'rows: []', ...ogEmitRows(rows, 2), ...tail].join('\n') + '\n';
}

/* ---------- Markdown note: the first ```gantt fence ---------- */
const OG_FENCE = /(^|\r?\n)([ \t]*```gantt[^\r\n]*\r?\n)([\s\S]*?)((?:\r?\n)?[ \t]*```[ \t]*(?=\r?\n|$))/;
function ogExtract(text, fmt) {
  const m = OG_FENCE.exec(text);
  if (m) return { kind: 'md', yaml: m[3], m };
  return fmt === 'md' ? { kind: 'md', yaml: '', m: null } : { kind: 'yaml', yaml: text, m: null };
}
function ogCompose(text, yaml, fmt, title) {
  const ex = ogExtract(text || '', fmt), eol = /\r\n/.test(text || '') ? '\r\n' : '\n', y = yaml.replace(/\n/g, eol);
  if (ex.kind === 'yaml') return y;
  if (ex.m) {
    const m = ex.m, start = m.index + m[1].length + m[2].length, end = start + m[3].length;
    return text.slice(0, start) + y.replace(/\s+$/, '') + (/^\r?\n/.test(m[4]) ? '' : eol) + text.slice(end);
  }
  const body = '```gantt' + eol + y + '```' + eol;
  return (text && text.trim() ? text.replace(/\s+$/, '') + eol + eol : `# ${title || 'Gantt'}` + eol + eol) + body;
}
const ogFmtOf = name => (/\.(md|markdown)$/i.test(name || '') ? 'md' : 'yaml');

/* ---------- tasks <-> rows ---------- */
const OG_ISO = /^\d{4}-\d{2}-\d{2}$/;
const OG_RESERVED = new Set(['label', 'plan', 'fact', 'children', 'notes', 'priority', 'tags', 'otid', 'done']);
const OG_PRIO = ['', 'Low', 'Medium', 'High'];
const ogNoon = d => { const [y, m, dd] = d.split('-').map(Number); return new Date(y, m - 1, dd, 12).getTime(); };
const ogDated = t => !!(t.start || t.due || t.astart);
const ogExportable = t => !t.deleted && t.status !== 'wontdo' && !t.log && ogDated(t);
const ogDates = v => (Array.isArray(v) ? v : v == null ? [] : [v]).map(x => String(x).slice(0, 10)).filter(d => OG_ISO.test(d)).slice(0, 2);
function ogPlan(o) {
  if (!o.start && !o.due) return null;
  if (o.start && o.due) return o.start <= o.due ? [o.start, o.due] : [o.due, o.start];
  return [o.start || o.due];
}
function ogRowOfSub(s) {
  const r = { label: s.title }, plan = ogPlan(s); if (plan) r.plan = plan;
  if (s.done && s.aend) r.fact = [s.astart || s.start || s.due || s.aend, s.aend]; else if (!s.done && s.astart) r.fact = [s.astart];
  if (s.done && !r.fact) r.done = true;
  if (s.gx) Object.assign(r, s.gx);
  r.otid = s.id;
  if (s.children && s.children.length) r.children = s.children.map(ogRowOfSub);
  return r;
}
function ogRowOfTask(t) {
  const r = { label: t.title }, plan = ogPlan(t); if (plan) r.plan = plan;
  if (t.status === 'done') {
    const end = ymd(new Date(t.doneAt || Date.now())); let a = t.astart || t.start || ymd(new Date(t.created || Date.now()));
    if (a > end) a = end; r.fact = [a, end];
  } else if (t.astart) r.fact = [t.astart];
  if (t.notes && t.notes.trim()) r.notes = t.notes;
  if (t.priority) r.priority = OG_PRIO[t.priority];
  if (t.tags && t.tags.length) r.tags = t.tags;
  if (t.gx) Object.assign(r, t.gx);
  r.otid = t.id;
  if (t.subtasks && t.subtasks.length) r.children = t.subtasks.map(ogRowOfSub);
  return r;
}
function ogFields(r) {
  if (!r || typeof r !== 'object') r = { label: String(r ?? '') };
  const f = { title: String(r.label ?? '').trim() || 'Untitled', otid: r.otid != null ? String(r.otid) : null, start: null, due: null, astart: null, aend: null, done: false };
  const pl = ogDates(r.plan);
  if (pl.length === 1) f.due = pl[0]; else if (pl.length === 2) [f.start, f.due] = pl[0] <= pl[1] ? pl : [pl[1], pl[0]];
  const fa = ogDates(r.fact);
  if (fa.length === 2) { f.astart = fa[0] <= fa[1] ? fa[0] : fa[1]; f.aend = fa[0] <= fa[1] ? fa[1] : fa[0]; f.done = true; } else if (fa.length === 1) f.astart = fa[0];
  if (!fa.length && r.done === true) f.done = true;
  f.notes = typeof r.notes === 'string' ? r.notes.replace(/\s+$/, '') : r.notes == null ? '' : String(r.notes);
  const pr = typeof r.priority === 'number' ? r.priority : { low: 1, medium: 2, med: 2, high: 3 }[String(r.priority || '').toLowerCase()];
  f.priority = pr >= 0 && pr <= 3 ? pr : 0;
  f.tags = [...new Set((Array.isArray(r.tags) ? r.tags : r.tags == null ? [] : String(r.tags).split(/[\s,]+/)).map(x => String(x).replace(/^#/, '').toLowerCase()).filter(Boolean))].sort();
  f.gx = {}; for (const k of Object.keys(r).sort()) if (!OG_RESERVED.has(k)) f.gx[k] = r[k];
  f.children = Array.isArray(r.children) ? r.children.map(ogFields) : [];
  return f;
}
const ogHash = f => cyrb53(JSON.stringify([f.title, f.start, f.due, f.astart, f.aend, f.done, f.notes, f.priority, f.tags, f.gx, f.children.map(c => ogHash(c))]));
function ogApplySub(s, f) {
  s.title = f.title; s.done = f.done;
  for (const k of ['start', 'due', 'astart', 'aend']) { if (f[k]) s[k] = f[k]; else delete s[k]; }
  if (Object.keys(f.gx).length) s.gx = f.gx; else delete s.gx;
  const old = new Map((s.children || []).map(c => [c.id, c]));
  const kids = f.children.map(cf => { const c = (cf.otid && old.get(cf.otid)) || { id: cf.otid || uid() }; ogApplySub(c, cf); return c; });
  if (kids.length) s.children = kids; else delete s.children;
  return s;
}
function ogApplyTask(t, f) {
  t.title = f.title; t.start = f.start; t.due = f.due; t.astart = f.astart; t.notes = f.notes; t.priority = f.priority; t.tags = f.tags;
  if (Object.keys(f.gx).length) t.gx = f.gx; else delete t.gx;
  if (!t.due) { t.time = null; t.repeat = null; }
  if (f.done) { t.status = 'done'; t.doneAt = f.aend ? ogNoon(f.aend) : t.doneAt || Date.now(); } else if (t.status === 'done') { t.status = 'open'; delete t.doneAt; }
  const old = new Map(t.subtasks.map(c => [c.id, c]));
  t.subtasks = f.children.map(cf => { const c = (cf.otid && old.get(cf.otid)) || { id: cf.otid || uid() }; return ogApplySub(c, cf); });
  return t;
}
const ogTaskHash = t => ogHash(ogFields(ogRowOfTask(t)));

/* Merge parsed rows into a list. base = { taskId: hash at last sync }. Per task: only the file changed → take it; only OpenTick
   changed → keep it (it is written back); both → OpenTick wins and it is counted as a conflict. remove: rows deleted from the
   file trash the task (only if it was not edited here since). Returns the ids in file order for writing back. */
function ogMerge(listId, rows, base, remove) {
  const st = { pulled: 0, added: 0, removed: 0, conflicts: 0 }, order = [], seen = new Set();
  const live = () => S.tasks.filter(t => t.listId === listId && !t.deleted && t.status !== 'wontdo' && !t.log);
  const byId = new Map(live().map(t => [t.id, t]));
  let next = Math.max(0, ...S.tasks.filter(t => t.listId === listId).map(t => t.order || 0)) + 1000;
  for (const row of rows) {
    const f = ogFields(row), hF = ogHash(f), t = f.otid && byId.get(f.otid);
    if (t) {
      seen.add(t.id); order.push(t.id);
      const hT = ogTaskHash(t), b = base[t.id];
      if (hF === hT) continue;
      if (b === undefined || (hF !== b && hT === b)) { ogApplyTask(t, f); st.pulled++; }
      else if (hF !== b) st.conflicts++;
      continue;
    }
    if (f.otid && base[f.otid] !== undefined) continue; // known to this device and gone from the list since: the next write drops the row
    const anywhere = f.otid && S.tasks.some(x => x.id === f.otid) ? null : f.otid;
    const n = newTask({ id: anywhere || uid(), listId, order: next }); next += 1000;
    ogApplyTask(n, f); S.tasks.push(n); seen.add(n.id); order.push(n.id); st.added++;
  }
  if (remove) for (const t of live()) {
    if (seen.has(t.id) || !ogExportable(t) || base[t.id] === undefined) continue;
    if (ogTaskHash(t) === base[t.id]) { t.deleted = Date.now(); st.removed++; }
  }
  return { st, order };
}

/* ---------- linked files ---------- */
const OG_KEY = 'opentick.og.v1';
const OG = (() => { try { const c = JSON.parse(localStorage.getItem(OG_KEY)); if (c && c.links) return c; } catch (e) { /* none yet */ } return { links: {} }; })();
const ogSave = () => { try { localStorage.setItem(OG_KEY, JSON.stringify(OG)); } catch (e) { /* ignore */ } };
const ogNeedsPerm = () => Object.assign(new Error('Permission to use the chart file is needed — press “Sync now”.'), { perm: true });
async function ogPerm(h) {
  const o = { mode: 'readwrite' };
  if ((await h.queryPermission(o)) === 'granted') return;
  try { if ((await h.requestPermission(o)) === 'granted') return; } catch (e) { /* needs a click */ }
  throw ogNeedsPerm();
}
const OGIO = {
  async read(id) {
    const lk = OG.links[id], T = TAURI();
    if (T && T.fs && lk.path) { try { return await T.fs.readTextFile(lk.path); } catch (e) { if (/not found|no such file|os error 2|cannot find/i.test(String(e))) return null; throw e; } }
    const h = await idb('readonly', s => s.get('og:' + id)); if (!h) throw new Error('This chart file is not linked on this device — link it again');
    await ogPerm(h);
    try { return await (await h.getFile()).text(); } catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
  },
  async write(id, text) {
    const lk = OG.links[id], T = TAURI();
    if (T && T.fs && lk.path) { await T.fs.writeTextFile(lk.path, text); return; }
    const h = await idb('readonly', s => s.get('og:' + id)); await ogPerm(h);
    const w = await h.createWritable(); await w.write(text); await w.close();
  },
};
const ogLinkable = () => fileSupported();
async function ogChoose(create, name) {
  const T = TAURI(), filters = [{ name: 'OpenGantt chart', extensions: ['md', 'yaml', 'yml', 'txt'] }];
  try {
    if (T && T.fs && T.dialog) { const p = pathOf(create ? await T.dialog.save({ defaultPath: name, filters }) : await T.dialog.open({ multiple: false, filters })); return p ? { name: p.split(/[\\/]/).pop(), path: p } : null; }
    const types = [{ description: 'OpenGantt chart', accept: { 'text/markdown': ['.md'], 'text/yaml': ['.yaml', '.yml'], 'text/plain': ['.txt'] } }];
    const h = create ? await window.showSaveFilePicker({ suggestedName: name, types }) : (await window.showOpenFilePicker({ types }))[0];
    return { name: h.name, handle: h };
  } catch (e) { if (e.name !== 'AbortError') toast('Could not choose the file: ' + (e.message || e)); return null; }
}
async function ogPickText() {
  const T = TAURI();
  if (T && T.dialog && T.fs) { const p = pathOf(await T.dialog.open({ multiple: false, filters: [{ name: 'OpenGantt chart', extensions: ['md', 'yaml', 'yml', 'txt'] }] })); return p ? { name: p.split(/[\\/]/).pop(), text: await T.fs.readTextFile(p) } : null; }
  return new Promise(res => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.md,.markdown,.yaml,.yml,.txt,text/*'; i.onchange = async () => res(i.files[0] ? { name: i.files[0].name, text: await i.files[0].text() } : null); i.click(); });
}
const ogHead = list => [`title: ${ogStr(list.name)}`, `scale: ${(S.settings.gantt || {}).scale || 'week'}`, 'mode: both'];
function ogBuild(list, existingYaml) {
  const rows = S.tasks.filter(t => t.listId === list.id && ogExportable(t)).sort((a, b) => (a.order || 0) - (b.order || 0)).map(ogRowOfTask);
  return { rows, yaml: ogMergeYaml(existingYaml || '', rows, ogHead(list)) };
}
async function ogSync(listId, manual) {
  const lk = OG.links[listId], list = S.lists.find(l => l.id === listId);
  if (!lk || !list || lk.busy) return null;
  lk.busy = true; lk.status = 'busy'; ogPaint();
  try {
    const cur = await OGIO.read(listId), ex = cur && cur.trim() ? ogExtract(cur, lk.fmt) : { yaml: '' };
    const doc = ex.yaml.trim() ? ogYamlParse(ex.yaml) : {};
    if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('The file does not hold an OpenGantt chart (expected a “rows:” list)');
    if (doc.rows != null && !Array.isArray(doc.rows)) throw new Error('“rows:” must be a list');
    const fileRows = doc.rows || [], base = lk.base || {};
    const { st, order } = ogMerge(listId, fileRows, base, true);
    // rows go back in the file's order; tasks the file has not seen yet are appended
    const exp = S.tasks.filter(t => t.listId === listId && ogExportable(t)), byId = new Map(exp.map(t => [t.id, t]));
    const seq = [...order.filter(id => byId.has(id)).map(id => byId.get(id)), ...exp.filter(t => !order.includes(t.id)).sort((a, b) => (a.order || 0) - (b.order || 0))];
    const rows = seq.map(ogRowOfTask);
    const same = fileRows.length === rows.length && fileRows.every((r, i) => r && r.otid != null && String(r.otid) === rows[i].otid && ogHash(ogFields(r)) === ogHash(ogFields(rows[i])));
    let wrote = false;
    if (!same) {
      const text = ogCompose(cur || '', ogMergeYaml(ex.yaml, rows, ogHead(list)), lk.fmt, list.name);
      if (text !== (cur || '')) {
        if ((await OGIO.read(listId)) !== cur) throw new Error('The file changed while syncing — will retry');
        await OGIO.write(listId, text); wrote = true;
      }
    }
    lk.base = Object.fromEntries(seq.map((t, i) => [t.id, ogHash(ogFields(rows[i]))]));
    lk.last = Date.now(); lk.status = 'ok'; lk.msg = '';
    lk.stats = { ...st, wrote };
    if (st.pulled || st.added || st.removed) { save(); flush(); }
    ogSave();
    if (manual) toast(`OpenGantt: ${st.pulled + st.added + st.removed ? `pulled ${st.pulled + st.added + st.removed} change(s)` : 'nothing new in the file'}${wrote ? ', file updated' : ''}${st.conflicts ? `, ${st.conflicts} conflict(s) kept as in OpenTick` : ''}`);
    return lk.stats;
  } catch (e) {
    lk.status = e.perm ? 'perm' : 'error'; lk.msg = e.message || String(e); ogSave();
    if (manual || !e.perm) toast('OpenGantt: ' + lk.msg);
    return null;
  } finally {
    lk.busy = false; ogPaint();
    const ch = lk.stats && (lk.stats.pulled || lk.stats.added || lk.stats.removed);
    if ((manual || ch) && lk.status === 'ok') { try { refresh(); } catch (e) { /* not ready */ } }
  }
}
let ogTimer;
function ogSchedule(ms = 2500) { if (!Object.keys(OG.links).length) return; clearTimeout(ogTimer); ogTimer = setTimeout(ogSyncAll, ms); }
async function ogSyncAll() { for (const id of Object.keys(OG.links)) if (OG.links[id].auto !== false) await ogSync(id, false); }
const ogPaint = () => { const el = $('#ogstate'); if (el) el.innerHTML = ogStateHtml(U.ogList); };

function ogImportText(text, fileName, listId) {
  const fmt = ogFmtOf(fileName), ex = ogExtract(text, fmt);
  if (ex.kind === 'md' && !ex.m) throw new Error('No ```gantt block found in this note');
  const doc = ogYamlParse(ex.yaml);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || !Array.isArray(doc.rows)) throw new Error('No “rows:” list found');
  let list = listId && S.lists.find(l => l.id === listId), created = false;
  if (!list) {
    list = { id: uid(), name: String(doc.title || fileName.replace(/\.[^.]+$/, '') || 'Gantt'), color: COLORS[S.lists.length % COLORS.length][0], sections: [], created: Date.now() };
    S.lists.push(list); created = true;
  }
  const { st } = ogMerge(list.id, doc.rows, {}, false);
  save(); flush();
  return { list, created, ...st };
}
async function ogImport(listId) {
  try {
    const f = await ogPickText(); if (!f) return;
    const r = ogImportText(f.text, f.name, listId);
    if (!listId || r.created) setNav('list:' + r.list.id); else refresh();
    toast(`Imported into “${r.list.name}”: ${r.added} new, ${r.pulled} updated`);
  } catch (e) { toast('Import failed: ' + (e.message || e)); }
}
async function ogExport(listId, asBlock) {
  const list = listOf(listId), b = ogBuild(list, '');
  if (asBlock) { try { await navigator.clipboard.writeText('```gantt\n' + b.yaml + '```\n'); toast('Copied — paste it into an Obsidian note'); } catch (e) { toast('Could not copy: ' + (e.message || e)); } return; }
  const i = await askMenu('Export ' + list.name, [{ label: 'Obsidian note (.md)' }, { label: 'OpenGantt file (.yaml)' }]); if (i == null) return;
  const base = list.name.replace(/[^\w\- ]+/g, '').trim() || 'gantt';
  try { if (await saveText(base + (i === 0 ? '.md' : '.yaml'), i === 0 ? ogCompose('', b.yaml, 'md', list.name) : b.yaml)) toast('Exported'); } catch (e) { toast('Export failed: ' + (e.message || e)); }
}
async function ogLink(listId) {
  const list = listOf(listId), i = await askMenu('Link “' + list.name + '” to a chart file', [{ label: 'Use an existing file (.md note or .yaml)' }, { label: 'Create a new file' }]); if (i == null) return;
  const f = await ogChoose(i === 1, (list.name.replace(/[^\w\- ]+/g, '').trim() || 'gantt') + '.md'); if (!f) return;
  if (f.handle) await idb('readwrite', s => s.put(f.handle, 'og:' + listId));
  OG.links[listId] = { name: f.name, path: f.path || '', fmt: ogFmtOf(f.name), auto: true, base: {}, last: 0, status: 'busy' };
  ogSave(); await ogSync(listId, true);
}
async function ogUnlink(listId) { delete OG.links[listId]; ogSave(); try { await idb('readwrite', s => s.delete('og:' + listId)); } catch (e) { /* ignore */ } }
function ogStateHtml(listId) {
  const lk = OG.links[listId]; if (!lk) return '<p class="hint">Not linked to a file.</p>';
  const col = lk.status === 'error' || lk.status === 'perm' ? 'bad' : '';
  return `<p>${ic('link', 14)} <b>${esc(lk.name)}</b> · ${lk.status === 'busy' ? 'syncing…' : lk.last ? 'synced ' + ago(lk.last) : 'not synced yet'}</p>${lk.msg ? `<p class="${col}">${esc(lk.msg)}</p>` : ''}`;
}
function openOG(listId) {
  U.ogList = listId; const list = listOf(listId), lk = () => OG.links[listId], can = ogLinkable();
  const draw = () => `<h3>OpenGantt · ${esc(list.name)}</h3>
<div id="ogstate">${ogStateHtml(listId)}</div>
<div class="mrow">${lk() ? `<button class="pri" data-m="sync">Sync now</button><button data-m="auto">${lk().auto === false ? 'Auto-sync: off' : 'Auto-sync: on'}</button><button class="danger" data-m="unlink">Unlink</button>` : `<button class="pri" data-m="link"${can ? '' : ' disabled'}>Link to a file…</button>`}</div>
<div class="mrow"><button data-m="import">Import chart…</button><button data-m="export">Export file…</button><button data-m="block">Copy as Obsidian block</button></div>
<p class="hint">${can ? '' : 'Linking needs the desktop app or a Chromium browser (it writes to the file). Import and export work everywhere. '}Tasks with a start, due or actual-start date become rows; subtasks become children. A linked file is merged both ways: edit it in OpenGantt or Obsidian and the changes come back here.</p>
<div class="mact"><button class="pri" data-m="ok">Done</button></div>`;
  openModal(draw(), m => {
    const again = () => { $('.mbox', m).innerHTML = draw(); };
    m.onclick = async e => {
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      const a = b.dataset.m;
      if (a === 'ok') closeModal();
      else if (a === 'sync') { await ogSync(listId, true); again(); }
      else if (a === 'auto') { lk().auto = lk().auto === false; ogSave(); again(); }
      else if (a === 'unlink') { await ogUnlink(listId); again(); }
      else if (a === 'link') { closeModal(); await ogLink(listId); openOG(listId); }
      else if (a === 'import') { closeModal(); ogImport(listId); }
      else if (a === 'export') { closeModal(); ogExport(listId, false); }
      else if (a === 'block') ogExport(listId, true);
    };
  }, 'wide');
}
