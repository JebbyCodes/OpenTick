/* OpenTick ambient background (Settings -> Appearance -> Background effects).
   A few large, soft gradient shapes that drift and slowly change form behind the app. It is made to cost almost nothing:
   plain CSS animations that only move / rotate / stretch (transform) and fade (opacity) five pre-painted layers, so the browser
   can run them on the GPU without redrawing text or recalculating layout, and there is no JavaScript loop. It stops while the page
   is hidden, and it is completely still when the system asks for reduced motion or "Animate" is off.
   The layer sits behind everything (z-index -1), takes no pointer events, and its colours come from the active theme, so every
   built-in and imported theme works in light and dark. Peak strength is capped so text keeps its contrast (tested for every theme). */
const BG_STYLES = [
  ['accent', 'Accent glow', 'The theme colour and its neighbours'],
  ['aurora', 'Aurora', 'Blue, teal and violet'],
  ['dusk', 'Dusk', 'Violet, rose and amber'],
  ['mist', 'Mist', 'Quiet neutral tones'],
];
const BG_SHAPES = [['blobs', 'Organic blobs', 'Soft, irregular forms'], ['circles', 'Soft circles', 'Round, gently drifting'], ['flow', 'Flowing forms', 'Long, slow ribbons']];
const BG_DEF = { on: true, animate: true, style: 'accent', shape: 'blobs', intensity: 60, speed: 100 };
let BG_AMAX = 0.12;
const BG_FIVE = '<i></i><i></i><i></i><i></i><i></i>';
const bgCfg = () => { const b = (S.settings && S.settings.bg) || {}; return { ...BG_DEF, ...b }; };
const bgNorm = b => { // defensive: settings may come from an older version or a hand-edited backup
  const o = { ...BG_DEF, ...(b || {}) }; o.on = !!o.on; o.animate = o.animate !== false;
  o.style = BG_STYLES.some(s => s[0] === o.style) ? o.style : BG_DEF.style; o.shape = BG_SHAPES.some(s => s[0] === o.shape) ? o.shape : BG_DEF.shape;
  o.intensity = Math.min(100, Math.max(10, Math.round(Number(o.intensity)) || BG_DEF.intensity)); o.speed = Math.min(200, Math.max(25, Math.round(Number(o.speed)) || BG_DEF.speed));
  return o;
};
const bgReduced = () => !!(typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
/* How strong may the shapes be on THIS theme? Each theme has its own text and background colours, and a few (Solarized, imported themes)
   start with modest contrast, so a fixed ceiling cannot be right for all of them. bgAmax() finds the strongest peak opacity that
   keeps body text at 4.5:1 (or what the theme itself has, if that is lower) and secondary text at 3:1 / within 20% of its own,
   in the worst case: a shape at full strength with two more overlapping at the soft edge of their gradients, for every colour the
   styles can use. The result is applied as --amax, so imported themes are covered too. */
function bgRgb(v) {
  v = String(v || '').trim(); let m;
  if ((m = /^#([0-9a-f]{3})$/i.exec(v))) return m[1].split('').map(c => parseInt(c + c, 16));
  if ((m = /^#([0-9a-f]{6})/i.exec(v))) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  if ((m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(v))) return [+m[1], +m[2], +m[3]];
  return null;
}
const bgHsl = (H, S, L) => { S /= 100; L /= 100; const k = n => (n + H / 30) % 12, a = S * Math.min(L, 1 - L), f = n => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)].map(x => Math.round(x * 255)); };
const bgLum = c => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const bgRatio = (a, b) => { const x = bgLum(a), y = bgLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const BG_FIXED = [bgHsl(205, 85, 58), bgHsl(168, 70, 48), bgHsl(265, 75, 66), bgHsl(268, 70, 62), bgHsl(335, 75, 62), bgHsl(32, 90, 58)];
function bgAmax(v) { // v: { bg, text, muted, acc, p1, p2 } as CSS colour strings
  const bg = bgRgb(v.bg), text = bgRgb(v.text), muted = bgRgb(v.muted || v.text); if (!bg || !text) return 0.12;
  const light = bgLum(bg) > 0.35, cap = light ? 0.12 : 0.16, glows = [v.acc, v.p1, v.p2, v.muted].map(bgRgb).filter(Boolean).concat(BG_FIXED);
  const t0 = bgRatio(text, bg), m0 = bgRatio(muted, bg), needT = Math.min(4.5, t0 * 0.9), needM = Math.min(3, m0 * 0.8);
  const ok = a => glows.every(g => { const x = [a, a * 0.45, a * 0.45].reduce((cur, k) => cur.map((c, i) => c * (1 - k) + g[i] * k), bg); return bgRatio(text, x) >= needT && bgRatio(muted, x) >= needM; });
  let lo = 0, hi = cap; if (ok(hi)) return hi;
  for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (ok(mid)) lo = mid; else hi = mid; }
  return Math.round(lo * 1000) / 1000;
}
function bgThemeVars() { const cs = getComputedStyle(document.documentElement), g = n => cs.getPropertyValue(n).trim(); return { bg: g('--bg'), text: g('--text'), muted: g('--muted'), acc: g('--acc'), p1: g('--p1'), p2: g('--p2') }; }
// is the active theme light? (the shapes are kept fainter on light themes)
function bgIsLight() {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(); let r, g, b, m;
    if ((m = /^#([0-9a-f]{3})$/i.exec(v))) { [r, g, b] = m[1].split('').map(c => parseInt(c + c, 16)); }
    else if ((m = /^#([0-9a-f]{6})/i.exec(v))) { r = parseInt(m[1].slice(0, 2), 16); g = parseInt(m[1].slice(2, 4), 16); b = parseInt(m[1].slice(4, 6), 16); }
    else if ((m = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(v))) { r = +m[1]; g = +m[2]; b = +m[3]; } else return false;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 150;
  } catch (e) { return false; }
}
function bgAttrs(c) { return `data-style="${c.style}" data-shape="${c.shape}" style="--bgfx-o:${(c.intensity / 100).toFixed(2)};--bgfx-sp:${(c.speed / 100).toFixed(2)};--amax:${BG_AMAX}"`; }
function bgApply() {
  if (typeof document === 'undefined' || !document.documentElement || !document.getElementById || !document.createElement) return; // no layout engine (unit tests)
  const c = bgNorm(S.settings.bg), root = document.documentElement; let el = document.getElementById('bgfx');
  if (!c.on) { if (el) el.remove(); root.classList.remove('bgfx', 'bgfx-still', 'bgfx-light'); return; }
  if (!el) { el = document.createElement('div'); el.id = 'bgfx'; el.className = 'bgfx-l'; el.setAttribute('aria-hidden', 'true'); el.innerHTML = BG_FIVE; document.body.insertBefore(el, document.body.firstChild); }
  el.dataset.style = c.style; el.dataset.shape = c.shape; el.style.setProperty('--bgfx-o', (c.intensity / 100).toFixed(2)); el.style.setProperty('--bgfx-sp', (c.speed / 100).toFixed(2));
  let am = 0.12; try { am = bgAmax(bgThemeVars()); } catch (e) { /* keep the cautious default */ } el.style.setProperty('--amax', String(am)); BG_AMAX = am;
  root.classList.add('bgfx'); root.classList.toggle('bgfx-light', bgIsLight()); root.classList.toggle('bgfx-still', !c.animate || bgReduced());
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => document.documentElement.classList.toggle('bgfx-paused', document.hidden)); // no animation work while nobody can see it
  try { const mq = window.matchMedia('(prefers-reduced-motion: reduce)'); (mq.addEventListener ? mq.addEventListener.bind(mq, 'change') : mq.addListener.bind(mq))(() => { bgApply(); const p = $('#bgprev'); if (p) bgSettingsPaint(); }); } catch (e) { /* no matchMedia */ }
}

/* ---------- the settings dialog ---------- */
const bgSwatch = k => `<span class="bg-sw bg-sw-${k}" aria-hidden="true"></span>`;
function bgSettingsHtml() {
  const c = bgNorm(S.settings.bg), red = bgReduced();
  const radio = (name, list, cur) => list.map(([k, n, d]) => `<label class="bg-opt${cur === k ? ' on' : ''}"><input type="radio" name="bg-${name}" value="${k}" data-bg="${name}"${cur === k ? ' checked' : ''}>${name === 'style' ? bgSwatch(k) : ''}<span><b>${n}</b><small>${d}</small></span></label>`).join('');
  return `<h3>Background effects</h3>
<div id="bgprev" class="bgfx-l bg-prev${bgIsLight() ? ' light' : ''}${!c.animate || red ? ' still' : ''}" ${bgAttrs(c)} role="img" aria-label="Preview of the background">${BG_FIVE}<span class="bg-prevt">Preview</span></div>
<div class="mrow tight"><label class="chkl"><input type="checkbox" data-bg="on"${c.on ? ' checked' : ''}> Show the animated background</label></div>
<div class="mrow tight"><label class="chkl"><input type="checkbox" data-bg="animate"${c.animate ? ' checked' : ''}${red ? ' disabled' : ''}> Let it move</label></div>
${red ? '<p class="hint">Your device asks apps to reduce motion, so the background stays still. Change that in your system accessibility settings.</p>' : '<p class="hint">Turn off “Let it move” for a still background. It also pauses by itself while OpenTick is in the background.</p>'}
<h4 class="mh">Style</h4><div class="bg-opts" role="radiogroup" aria-label="Style">${radio('style', BG_STYLES, c.style)}</div>
<h4 class="mh">Shapes</h4><div class="bg-opts" role="radiogroup" aria-label="Shapes">${radio('shape', BG_SHAPES, c.shape)}</div>
<h4 class="mh">Strength and speed</h4>
<div class="bg-rng"><label for="bg-int">Strength</label><input id="bg-int" type="range" min="10" max="100" step="5" value="${c.intensity}" data-bg="intensity"><output id="bg-int-o">${c.intensity}%</output></div>
<div class="bg-rng"><label for="bg-sp">Speed</label><input id="bg-sp" type="range" min="25" max="200" step="25" value="${c.speed}" data-bg="speed"${red || !c.animate ? ' disabled' : ''}><output id="bg-sp-o">${c.speed}%</output></div>
<div class="mact"><button data-m="reset">Restore defaults</button><button class="pri" data-m="back">Back to settings</button></div>`;
}
function bgSettingsPaint() { // re-draw the preview + page background from the saved settings
  const c = bgNorm(S.settings.bg), p = $('#bgprev'); bgApply();
  if (p) { p.dataset.style = c.style; p.dataset.shape = c.shape; p.style.setProperty('--amax', String(BG_AMAX)); p.style.setProperty('--bgfx-o', (c.intensity / 100).toFixed(2)); p.style.setProperty('--bgfx-sp', (c.speed / 100).toFixed(2)); p.classList.toggle('still', !c.animate || bgReduced()); p.classList.toggle('light', bgIsLight()); }
}
function openBgSettings() {
  openModal(bgSettingsHtml(), m => {
    const set = (k, v) => { S.settings.bg = bgNorm({ ...S.settings.bg, [k]: v }); bgSettingsPaint(); };
    m.onchange = e => {
      const el = e.target, k = el.dataset.bg; if (!k) return;
      if (el.type === 'checkbox') set(k, el.checked); else if (el.type === 'range') set(k, +el.value); else set(k, el.value);
      save(); $$('.bg-opt', m).forEach(o => o.classList.toggle('on', o.querySelector('input').checked));
      const sp = $('#bg-sp', m); if (sp) sp.disabled = bgReduced() || !bgNorm(S.settings.bg).animate;
    };
    m.oninput = e => { const el = e.target; if (el.type !== 'range' || !el.dataset.bg) return; const o = $(el.id === 'bg-int' ? '#bg-int-o' : '#bg-sp-o', m); if (o) o.textContent = el.value + '%'; S.settings.bg = bgNorm({ ...S.settings.bg, [el.dataset.bg]: +el.value }); bgSettingsPaint(); };
    m.onclick = e => {
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) { save(); closeModal(); openSettings(); } return; }
      if (b.dataset.m === 'back') { save(); closeModal(); openSettings(); }
      else if (b.dataset.m === 'reset') { S.settings.bg = { ...BG_DEF, on: !isAndroidApp() }; save(); bgSettingsPaint(); m.querySelector('.mbox').innerHTML = bgSettingsHtml(); }
    };
  });
}
