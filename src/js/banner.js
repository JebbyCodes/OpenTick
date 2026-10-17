/* OpenTick banners: an optional strip at the top of a list or a project — a colour, a gradient, a quiet pattern or a picture.
   list.banner / project.banner = { type: 'color'|'gradient'|'pattern'|'image', c, a, b, angle, pat, img, y, size }.
   Banners are meant to be calm: they are short, dimmed into the theme and faded into the page at the bottom; the picture is
   shrunk to a small JPEG when it is chosen, so it stays light on the saved data and on sync. Settings can hide them all.
   Every value is checked before it reaches CSS (a banner can arrive from another device through sync). */
const BANNER_GRADS = [
  ['Dawn', '#f6d365', '#fda085', 120], ['Ocean', '#4facfe', '#7fe0e8', 135], ['Meadow', '#96e6a1', '#d4fc79', 120], ['Orchid', '#a18cd1', '#fbc2eb', 120],
  ['Rose', '#ff9a9e', '#fad0c4', 120], ['Mint', '#84fab0', '#8fd3f4', 120], ['Dusk', '#6a7fdb', '#b983ff', 135], ['Sand', '#e6c9a8', '#f3e5d0', 120],
  ['Slate', '#56667a', '#2f3b4a', 135], ['Night', '#1c2b4a', '#3a5a7c', 135], ['Forest', '#2f6b4f', '#7fb77e', 135], ['Ember', '#e4572e', '#f3a712', 135],
];
const BANNER_PATS = {
  dots: ['Dots', c => `<svg xmlns='http://www.w3.org/2000/svg' width='20' height='20'><circle cx='3' cy='3' r='1.5' fill='${c}'/><circle cx='13' cy='13' r='1.5' fill='${c}'/></svg>`, 20],
  grid: ['Grid', c => `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><path d='M0 .5H24M.5 0V24' stroke='${c}' stroke-width='1' fill='none'/></svg>`, 24],
  lines: ['Lines', c => `<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><path d='M-2 14L14 -2M2 18L18 2' stroke='${c}' stroke-width='1.3' fill='none'/></svg>`, 16],
  waves: ['Waves', c => `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='16'><path d='M0 8Q10 0 20 8T40 8' stroke='${c}' stroke-width='1.3' fill='none'/></svg>`, 40],
  plus: ['Crosses', c => `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22'><path d='M11 7v8M7 11h8' stroke='${c}' stroke-width='1.3' fill='none'/></svg>`, 22],
};
const BANNER_TYPES = [['none', 'None'], ['color', 'Colour'], ['gradient', 'Gradient'], ['pattern', 'Pattern'], ['image', 'Image']];
const BANNER_IMG_RE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const BANNER_HEX = /^#[0-9a-fA-F]{6}$/;
const BANNER_IMG_MAX = 190 * 1024; // bytes of the stored picture
const bannerOk = b => !!b && typeof b === 'object' && ['color', 'gradient', 'pattern', 'image'].includes(b.type);
const bannerClean = b => {
  if (!bannerOk(b)) return null;
  const o = { type: b.type, size: b.size === 'slim' ? 'slim' : 'std' };
  if (BANNER_HEX.test(b.c || '')) o.c = b.c;
  if (BANNER_HEX.test(b.a || '')) o.a = b.a; if (BANNER_HEX.test(b.b || '')) o.b = b.b;
  o.angle = Number.isFinite(+b.angle) ? Math.max(0, Math.min(360, Math.round(+b.angle))) : 135;
  o.pat = BANNER_PATS[b.pat] ? b.pat : 'dots';
  o.y = Number.isFinite(+b.y) ? Math.max(0, Math.min(100, Math.round(+b.y))) : 50;
  if (typeof b.img === 'string' && BANNER_IMG_RE.test(b.img)) o.img = b.img;
  return o;
};
// the CSS declarations for a banner (empty string when it cannot be drawn)
function bannerCss(banner, fallback = '#4772fa') {
  const b = bannerClean(banner); if (!b) return '';
  if (b.type === 'color') return `background:${b.c || fallback}`;
  if (b.type === 'gradient') return `background:linear-gradient(${b.angle}deg,${b.a || '#4772fa'},${b.b || '#8e5cf7'})`;
  if (b.type === 'pattern') { const p = BANNER_PATS[b.pat], svg = p[1]('rgba(255,255,255,.34)'); return `background-color:${b.c || fallback};background-image:url("data:image/svg+xml,${encodeURIComponent(svg)}");background-size:${p[2]}px`; }
  if (b.type === 'image' && b.img) return `background:#222 url("${b.img}") center ${b.y}%/cover no-repeat`;
  return '';
}
function bannerHtml(kind, o) {
  if (!o || S.settings.banners === false) return ''; const css = bannerCss(o.banner, o.color); if (!css) return '';
  const b = bannerClean(o.banner);
  return `<button type="button" class="bnr${b.size === 'slim' ? ' slim' : ''} t-${b.type}" data-act="bannedit" data-kind="${kind}" data-id="${esc(o.id)}" style="${css}" title="Change the banner" aria-label="Change the banner"><span class="bnr-e">${ic('image', 13)}<small>Banner</small></span></button>`;
}
const bannerOf = (kind, id) => (kind === 'project' ? projectOf(id) : S.lists.find(l => l.id === id)) || null;
function bannerSet(o, b) { const c = bannerClean(b); if (c && b.type !== 'none') o.banner = c; else delete o.banner; }

// shrink a picked picture to a small JPEG data URL (≤ BANNER_IMG_MAX)
async function bannerImageFromFile(file) {
  if (!file || !/^image\//.test(file.type || '') && !/\.(png|jpe?g|gif|webp|bmp|avif|svg)$/i.test(file.name || '')) throw new Error('Please choose a picture (JPG, PNG, WebP…).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That picture could not be read.')); i.src = url; });
    let w = img.naturalWidth || img.width, h = img.naturalHeight || img.height; if (!w || !h) throw new Error('That picture could not be read.');
    let scale = Math.min(1, 1200 / w, 900 / h), q = 0.8, out = '';
    for (let i = 0; i < 8; i++) {
      const cw = Math.max(64, Math.round(w * scale)), ch = Math.max(32, Math.round(h * scale)), cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
      const cx = cv.getContext('2d'); cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, cw, ch); cx.drawImage(img, 0, 0, cw, ch);
      out = cv.toDataURL('image/jpeg', q);
      if (out.length * 0.75 <= BANNER_IMG_MAX) break;
      if (q > 0.5) q -= 0.1; else scale *= 0.8;
    }
    if (out.length * 0.75 > BANNER_IMG_MAX * 1.6) throw new Error('That picture is too detailed to keep as a banner. Try a smaller one.');
    return out;
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- the editor: used inside the list / project forms and in its own dialog ---------- */
const bannerSw = (cur, attr) => `<div class="sw">${COLORS.map(([c, n]) => `<button type="button" style="--c:${c}" class="${c === cur ? 'on' : ''}" data-${attr}="${c}" title="${n}" aria-label="${n}"></button>`).join('')}<input type="color" data-bnf="${attr === 'bc' ? 'c' : 'x'}" value="${BANNER_HEX.test(cur || '') ? cur : '#4772fa'}" title="Custom colour"></div>`;
function bannerPane(b, fallback) {
  if (b.type === 'color') return `<div class="lbl">Colour${bannerSw(b.c || fallback, 'bc')}</div>`;
  if (b.type === 'gradient') {
    const cur = BANNER_GRADS.findIndex(g => g[1] === b.a && g[2] === b.b && g[3] === b.angle);
    return `<div class="lbl">Gradient<div class="bn-grads">${BANNER_GRADS.map((g, i) => `<button type="button" class="${i === cur ? 'on' : ''}" data-bg="${i}" title="${g[0]}" aria-label="${g[0]}" style="background:linear-gradient(${g[3]}deg,${g[1]},${g[2]})"></button>`).join('')}</div></div>
<div class="bn-row"><label class="inl">From <input type="color" data-bnf="a" value="${b.a || '#4772fa'}"></label><label class="inl">To <input type="color" data-bnf="b" value="${b.b || '#8e5cf7'}"></label><label class="bn-ang">Angle <input type="range" min="0" max="360" step="5" data-bnf="angle" value="${b.angle}"><output>${b.angle}°</output></label></div>`;
  }
  if (b.type === 'pattern') return `<div class="lbl">Pattern<div class="bn-pats">${Object.entries(BANNER_PATS).map(([k, p]) => `<button type="button" class="${b.pat === k ? 'on' : ''}" data-bp="${k}" style="background-color:${b.c || fallback};background-image:url('data:image/svg+xml,${encodeURIComponent(p[1]('rgba(255,255,255,.4)'))}');background-size:${p[2]}px">${p[0]}</button>`).join('')}</div></div><div class="lbl">Colour${bannerSw(b.c || fallback, 'bc')}</div>`;
  if (b.type === 'image') return `<div class="bn-row"><button type="button" class="btn" data-bnact="pick">${ic('upload', 15)} ${b.img ? 'Choose another picture' : 'Choose a picture…'}</button>${b.img ? '<button type="button" class="btn" data-bnact="rmimg">Remove picture</button>' : ''}</div>
${b.img ? `<label class="bn-ang">Position <input type="range" min="0" max="100" data-bnf="y" value="${b.y}"><output>${b.y}%</output></label><p class="hint">Slide to choose which part of a tall picture shows. Pictures are shrunk to a small file on this device.</p>` : '<p class="hint">JPG, PNG or WebP. The picture is shrunk and softened so it stays quiet behind your list.</p>'}`;
  return '<p class="hint">No banner. Pick a type above to add one.</p>';
}
function bannerFields(d, fallback) {
  const b = d.banner;
  return `<div class="lbl bnf" id="bnf">Banner<div class="bn-prev-w"><div class="bnr bn-prev${b.size === 'slim' ? ' slim' : ''}" id="bn-prev" style="${bannerCss(b, fallback)}"></div></div>
<div class="seg full bn-tabs">${BANNER_TYPES.map(([k, n]) => `<button type="button" class="${b.type === k ? 'on' : ''}" data-bt="${k}">${n}</button>`).join('')}</div>
<div class="bn-pane" id="bn-pane">${bannerPane(b, fallback)}</div>
${b.type !== 'none' ? `<div class="bn-row"><span class="bn-l">Height</span><div class="seg">${[['slim', 'Slim'], ['std', 'Standard']].map(([k, n]) => `<button type="button" class="${(b.size || 'std') === k ? 'on' : ''}" data-bz="${k}">${n}</button>`).join('')}</div></div>` : ''}</div>`;
}
// d.banner is the draft being edited; `redraw` repaints the whole section, preview repaints just the strip
function bannerWire(m, d, fallback = () => '#4772fa') {
  const fb = () => (typeof fallback === 'function' ? fallback() : fallback);
  const prev = () => { const p = $('#bn-prev', m); if (p) { p.style.cssText = bannerCss(d.banner, fb()); p.classList.toggle('slim', d.banner.size === 'slim'); } };
  const redraw = () => { const f = $('#bnf', m); if (f) { f.outerHTML = bannerFields(d, fb()); } };
  const start = t => { // switching type keeps what still makes sense (colour, picture)
    const b = d.banner, c = b.c || fb(); d.banner = { ...b, type: t, size: b.size || 'std' };
    if (t === 'color') d.banner.c = c;
    if (t === 'gradient' && !(b.a && b.b)) { const g = BANNER_GRADS[0]; Object.assign(d.banner, { a: g[1], b: g[2], angle: g[3] }); }
    if (t === 'pattern') { d.banner.c = c; d.banner.pat = b.pat || 'dots'; }
  };
  const field = e => {
    const el = e.target, k = el.dataset && el.dataset.bnf; if (!k) return false;
    if (k === 'c' || k === 'a' || k === 'b') d.banner[k] = el.value;
    else if (k === 'x') { d.banner.c = el.value; }
    else if (k === 'angle' || k === 'y') { d.banner[k] = +el.value; const o = el.parentElement && el.parentElement.querySelector('output'); if (o) o.textContent = el.value + (k === 'angle' ? '°' : '%'); }
    prev(); if (e.type === 'change' && (k === 'c' || k === 'x')) { $$('[data-bc]', m).forEach(x => x.classList.toggle('on', x.dataset.bc === d.banner.c)); } return true;
  };
  return {
    input: e => field(e), change: e => field(e),
    click(e) {
      const b = e.target.closest('button'); if (!b || !$('#bnf', m) || !$('#bnf', m).contains(b)) return false;
      if (b.dataset.bt) { start(b.dataset.bt); if (b.dataset.bt === 'none') d.banner = { type: 'none' }; redraw(); return true; }
      if (b.dataset.bc) { d.banner.c = b.dataset.bc; $$('[data-bc]', m).forEach(x => x.classList.toggle('on', x === b)); prev(); return true; }
      if (b.dataset.bg != null) { const g = BANNER_GRADS[+b.dataset.bg]; Object.assign(d.banner, { a: g[1], b: g[2], angle: g[3] }); redraw(); return true; }
      if (b.dataset.bp) { d.banner.pat = b.dataset.bp; $$('[data-bp]', m).forEach(x => x.classList.toggle('on', x === b)); prev(); return true; }
      if (b.dataset.bz) { d.banner.size = b.dataset.bz; $$('[data-bz]', m).forEach(x => x.classList.toggle('on', x === b)); prev(); return true; }
      if (b.dataset.bnact === 'rmimg') { delete d.banner.img; redraw(); return true; }
      if (b.dataset.bnact === 'pick') {
        (async () => { try { const [f] = await pickFiles('image/*', false); if (!f) return; d.banner.img = await bannerImageFromFile(f); d.banner.y = 50; redraw(); } catch (err) { toast(err.message || 'Could not use that picture'); } })();
        return true;
      }
      return false;
    },
  };
}
const bannerDraft = b => (bannerOk(b) ? { ...bannerClean(b) } : { type: 'none', size: 'std' });
// banner choice for something that already exists, in a dialog of its own (click the banner, or use the list menu)
function openBannerDialog(kind, id) {
  const o = bannerOf(kind, id); if (!o) return; const d = { banner: bannerDraft(o.banner) };
  openModal(`<h3>Banner · ${esc(o.name)}</h3><div class="form one">${bannerFields(d, o.color)}</div><p class="hint">Banners are kept calm on purpose. You can hide them everywhere in Settings.</p><div class="mact">${bannerOk(o.banner) ? '<button class="danger" data-m="rm">Remove</button>' : ''}<span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="ok">Save</button></div>`, m => {
    const bw = bannerWire(m, d, () => o.color); m.oninput = bw.input; m.onchange = bw.change;
    m.onclick = e => {
      if (bw.click(e)) return;
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'ok') { bannerSet(o, d.banner); save(); closeModal(); refresh(); }
      else if (b.dataset.m === 'rm') { delete o.banner; save(); closeModal(); refresh(); }
      else closeModal();
    };
  }, 'wide');
}
