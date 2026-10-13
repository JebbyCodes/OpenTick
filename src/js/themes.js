/* OpenTick custom themes: import a .css (or .json) file, or paste CSS, and use it like a built-in theme.
   A theme is a set of CSS variables (--bg, --text, --acc, …) and may carry any extra rules. Everything is scoped to
   `html:root[data-custom="<id>"]`, so a theme only ever affects the app while it is selected, and a broken file cannot
   leak into the other themes. Imported CSS is sanitised: @import, scripts and remote url()s are dropped.
   Themes live in this device's settings (like the built-in choice), not in the synced data. */

// the variables every theme is expected to define (the rest of the app is built from these)
const THEME_VARS = [
  ['--bg', 'Page background'], ['--side', 'Sidebar and panels'], ['--text', 'Main text'], ['--muted', 'Secondary text'], ['--line', 'Borders'],
  ['--hover', 'Hover background'], ['--sel', 'Selected row'], ['--acc', 'Accent colour'], ['--on-acc', 'Text on the accent'], ['--red', 'Overdue / danger'],
  ['--p1', 'Low priority'], ['--p2', 'Medium priority'], ['--p3', 'High priority'], ['--card', 'Cards and blocks'], ['--shadow', 'Shadow of dialogs'],
];
const THEME_MAX = 200 * 1024;
const themeSlug = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'theme';
const customThemes = () => (S.settings && Array.isArray(S.settings.customThemes) ? S.settings.customThemes : []);
const customTheme = id => customThemes().find(c => c.id === id) || null;

// remove what must never run or load from imported CSS (everything else is kept as written)
function themeClean(css) {
  return String(css)
    .replace(/\/\*[\s\S]*?\*\//g, m => (/@(name|base)\b/i.test(m) ? m : '')) // drop comments, keep the two metadata ones
    .replace(/@import\b[^;]*;?/gi, '').replace(/@charset\b[^;]*;?/gi, '').replace(/@namespace\b[^;]*;?/gi, '')
    .replace(/expression\s*\(/gi, 'x(').replace(/javascript\s*:/gi, '').replace(/-moz-binding\s*:[^;}]*/gi, '').replace(/behavior\s*:[^;}]*/gi, '')
    .replace(/url\(\s*(['"]?)\s*([^)'"]*)\1\s*\)/gi, (m, q, u) => (/^(data:(?:image|font)\/|#)/i.test(u.trim()) ? m : 'none')) // only inline data and #fragments
    .replace(/<\/?style[^>]*>/gi, '');
}
// split CSS into top-level pieces: { sel, body } rules and { at, body } blocks (media, supports…) whose bodies are parsed again
function themeBlocks(css) {
  const out = []; let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i); if (open < 0) break;
    const head = css.slice(i, open).trim(); let d = 1, j = open + 1;
    while (j < css.length && d) { const c = css[j]; if (c === '"' || c === "'") { const e = css.indexOf(c, j + 1); j = e < 0 ? css.length : e; } else if (c === '{') d++; else if (c === '}') d--; j++; }
    const body = css.slice(open + 1, d ? css.length : j - 1);
    if (head) out.push(head.startsWith('@') ? { at: head, body } : { sel: head, body });
    i = j;
  }
  return out;
}
// make one selector apply only while this theme is on; the root / html / [data-theme] selectors become the theme's own root
function themeScopeSel(sel, id) {
  const root = `html:root[data-custom="${id}"]`, s = sel.trim().replace(/^:root\b(?:\[[^\]]*\])*|^html\b(?:\[[^\]]*\])*|^\[data-theme[^\]]*\](?:\[[^\]]*\])*/i, root);
  return s.startsWith(root) ? s : `${root} ${s}`;
}
function themeScope(css, id) {
  return themeBlocks(css).map(b => {
    if (b.sel) return b.sel.split(',').map(x => themeScopeSel(x, id)).join(',') + `{${b.body}}`;
    if (/^@(media|supports|container|layer)\b/i.test(b.at)) return `${b.at}{${themeScope(b.body, id)}}`;
    return `${b.at}{${b.body}}`; // @font-face, @keyframes: global by nature
  }).join('\n');
}
// a bare list of declarations ("--bg: #000; --text: #fff") or a JSON theme becomes ordinary CSS
function themeNormalise(text, fileName) {
  let t = String(text || '').replace(/^\uFEFF/, '').trim();
  if (!t) throw new Error('The file is empty.');
  if (t.length > THEME_MAX) throw new Error('That file is too large for a theme (limit 200 KB).');
  let meta = {};
  if (/^\s*\{/.test(t) && /"\s*:/.test(t)) { // JSON: { "name", "base", "vars": { "--bg": "#…" }, "css": "…" }
    let j; try { j = JSON.parse(t); } catch (e) { throw new Error('This looks like JSON but could not be read: ' + e.message); }
    meta = { name: j.name, base: j.base };
    const vars = j.vars || j.variables || j.colors || {};
    t = `:root{${Object.entries(vars).map(([k, v]) => `${String(k).startsWith('--') ? k : '--' + k}:${v};`).join('')}}\n${j.css || ''}`;
  }
  const cm = t.match(/\/\*[^*]*@name\s*:?\s*([^\n*]+)/i); if (cm) meta.name = cm[1].trim();
  const bm = t.match(/\/\*[^*]*@base\s*:?\s*([\w-]+)/i); if (bm) meta.base = bm[1].trim().toLowerCase();
  let css = themeClean(t);
  if (!css.includes('{') && /--[\w-]+\s*:/.test(css)) css = `:root{${css}}`;
  if (!css.trim()) throw new Error('No CSS found in that file.');
  if (!/--[\w-]+\s*:/.test(css) && !css.includes('{')) throw new Error('No theme variables found. Add colours such as --bg, --text and --acc.');
  const name = String(meta.name || (fileName || '').replace(/\.[^.]+$/, '') || 'My theme').trim().slice(0, 40) || 'My theme';
  return { name, base: meta.base, css: css.replace(/\/\*[\s\S]*?\*\//g, '').trim() };
}
const themeVar = (css, v) => { const m = String(css).match(new RegExp('(?:^|[;{\\s])' + v.replace(/-/g, '\\-') + '\\s*:\\s*([^;}]+)')); return m ? m[1].trim() : ''; };
// the base theme supplies every variable the file leaves out; "dark" / "light" pick a sensible built-in one
function themeBaseId(b, css) {
  b = String(b || '').toLowerCase();
  if (THEMES.some(t => t[0] === b && b !== 'auto')) return b;
  if (b === 'light') return 'light'; if (b === 'dark') return 'dark';
  const bg = themeVar(css, '--bg'), m = bg.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) { const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1], n = parseInt(h, 16), lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; return lum > 0.55 ? 'light' : 'dark'; }
  return 'gruvbox-dark';
}
// add or replace a theme from file text; returns the stored record
function themeImport(text, fileName) {
  const t = themeNormalise(text, fileName), id = 'custom:' + themeSlug(t.name), rec = { id, name: t.name, base: themeBaseId(t.base, t.css), css: t.css, added: Date.now() };
  const list = (S.settings.customThemes = customThemes()), i = list.findIndex(c => c.id === id);
  if (i >= 0) list[i] = rec; else list.push(rec);
  S.settings.theme = id; save(); applyTheme();
  return { rec, replaced: i >= 0 };
}
function themeRemove(id) {
  S.settings.customThemes = customThemes().filter(c => c.id !== id);
  if (S.settings.theme === id) S.settings.theme = DEFAULT_THEME;
  save(); applyTheme();
}
// theme buttons for the settings dialog: [id, name, background, text, accent]
function themeList() {
  return [...THEMES, ...customThemes().map(c => [c.id, c.name, themeVar(c.css, '--bg') || '#282828', themeVar(c.css, '--text') || '#ebdbb2', themeVar(c.css, '--acc') || '#fabd2f'])];
}
// put the selected custom theme's CSS on the page (or take it off again)
function themeApplyCustom() {
  const root = document.documentElement, c = customTheme(S.settings.theme);
  if (c) { root.dataset.theme = c.base || DEFAULT_THEME; root.dataset.custom = c.id; } else if (root.dataset) delete root.dataset.custom;
  let st = document.querySelector ? document.querySelector('#ot-custom') : null;
  if (c && !st && document.createElement && document.head) { st = document.createElement('style'); st.id = 'ot-custom'; document.head.appendChild(st); }
  if (st) st.textContent = c ? themeScope(c.css, c.id) : '';
}
// a starter file: every variable with the current theme's value, and a short guide
function themeTemplate() {
  const cs = typeof getComputedStyle === 'function' && document.documentElement.style ? getComputedStyle(document.documentElement) : null;
  const cur = THEMES.find(t => t[0] === (document.documentElement.dataset.theme || DEFAULT_THEME)) || THEMES[0];
  const val = v => (cs && cs.getPropertyValue(v).trim()) || '';
  return `/* @name: My theme */
/* @base: ${customTheme(S.settings.theme) ? customTheme(S.settings.theme).base : S.settings.theme === 'auto' ? 'gruvbox-dark' : cur[0]} */

/* Import this file in Settings → Appearance → Import theme.
   Change the colours below. Any variable you leave out keeps the value of the @base theme
   (gruvbox-dark, gruvbox-light, light, dark, nord, solarized-dark or dracula).
   Extra CSS rules are allowed too; they apply only while this theme is selected. */
:root {
${THEME_VARS.map(([v, d]) => `  ${v}: ${val(v) || '#888888'}; /* ${d} */`).join('\n')}
}

/* Example of an extra rule:
.task { border-radius: 12px; } */
`;
}

/* ---------- settings: the part of the Appearance section that deals with custom themes ---------- */
function themeSettingsHtml() {
  const cts = customThemes();
  return `<div class="ct"><div class="ct-acts"><button type="button" class="btn sm" data-m="themeimp">${ic('upload', 14)} Import theme…</button><button type="button" class="btn sm" data-m="themepaste">${ic('file-text', 14)} Paste CSS…</button><button type="button" class="btn sm" data-m="themetpl">${ic('download', 14)} Template</button></div>`
    + (cts.length ? `<div class="ct-list">${cts.map(c => `<div class="ct-row${S.settings.theme === c.id ? ' on' : ''}"><button type="button" class="ct-sel" data-th="${esc(c.id)}"><i class="ct-sw" style="background:${esc(themeVar(c.css, '--bg') || '#282828')}"><u style="background:${esc(themeVar(c.css, '--acc') || '#fabd2f')}"></u></i><span>${esc(c.name)}</span></button><button type="button" class="ib sm" data-m="themeexp" data-id="${esc(c.id)}" title="Save this theme as a file" aria-label="Export ${esc(c.name)}">${ic('download', 14)}</button><button type="button" class="ib sm" data-m="themedel" data-id="${esc(c.id)}" title="Remove this theme" aria-label="Remove ${esc(c.name)}">${ic('trash', 14)}</button></div>`).join('')}</div>` : '')
    + `<p class="hint">A theme is a CSS file that sets variables like <code>--bg</code>, <code>--text</code> and <code>--acc</code>. Use <b>Template</b> to get a starting point.</p></div>`;
}
const themeSectionHtml = () => `<div class="themes">${themeList().map(([k, n, b, t, a]) => `<button class="thm${S.settings.theme === k ? ' on' : ''}" data-th="${esc(k)}" style="--b:${esc(b)};--t:${esc(t)};--a:${esc(a)}" title="${esc(n)}"><i></i><span>${esc(n)}</span></button>`).join('')}</div>${themeSettingsHtml()}`;
const themeFile = c => `/* @name: ${c.name} */\n/* @base: ${c.base || DEFAULT_THEME} */\n${c.css}\n`;
function themePasteDialog(done) {
  openModal(`<h3>Paste a theme</h3><p class="hint">CSS with variables such as <code>:root{--bg:#101820;--text:#e8eef5;--acc:#4cc9f0}</code>. Optional first line: <code>/* @name: Ocean */</code></p><textarea id="th-css" class="th-ta" spellcheck="false" placeholder=":root {\n  --bg: #101820;\n  --text: #e8eef5;\n  --acc: #4cc9f0;\n}"></textarea><div class="mact"><button data-m="no">Cancel</button><button class="pri" data-m="ok">Add theme</button></div>`, m => {
    const ta = $('#th-css', m); ta.focus();
    m.onclick = e => {
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) { closeModal(); done(); } return; }
      if (b.dataset.m === 'ok') { try { const r = themeImport(ta.value, 'Pasted theme'); closeModal(); toast(r.replaced ? `Updated “${r.rec.name}”` : `Added “${r.rec.name}”`); done(); } catch (err) { toast(err.message); } } else { closeModal(); done(); }
    };
  }, 'wide');
}
