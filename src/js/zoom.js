/* OpenTick interface size (Settings -> Appearance).
   The whole interface is scaled with the CSS `zoom` property on the root element. Unlike transform: scale(), `zoom` changes layout, so
   scrolling, hit-testing, focus rings, popovers and the timetable all see the real, larger or smaller boxes and nothing is clipped
   or mis-aimed. Three things still have to be told about it, because `zoom` does not touch them:
     1. Media queries (breakpoints) look at the real window, so a 150% interface in a 900px window should behave like a 600px window:
        every min / max width / height in the stylesheet is multiplied by the scale (the originals are kept, so it can be changed again).
     2. Pointer positions (clientX / clientY) are in real pixels while sizes in the CSS are in zoomed pixels: zc / zy / zd convert.
        Browsers differ on whether getBoundingClientRect() reports zoomed or unzoomed pixels, so that is measured, not assumed (Z.r).
     3. Viewport units (vh) are scaled by `zoom` too; the stylesheet divides them by --zf (the scale) so "90vh" still means 90% of the window.
   Printing always uses 100% (see the print rules in help styles). The value is a number between 0.8 and 1.5 in steps of 0.05. */
const Z = { z: 1, r: 1 }, Z_MIN = 0.8, Z_MAX = 1.5, Z_DEF = 1, Z_STEP = 0.05;
const clampScale = v => { const n = v == null || v === '' ? NaN : Number(v); return Number.isFinite(n) ? Math.min(Z_MAX, Math.max(Z_MIN, Math.round(n * 20) / 20)) : Z_DEF; };
const zPct = v => Math.round(clampScale(v) * 100);
// pointer coordinate -> the units getBoundingClientRect() uses; distance from an element edge to the pointer, in layout px; pointer travel in layout px
const zc = c => c / (Z.z / Z.r);
const zy = (client, edge) => (zc(client) - edge) / Z.r;
const zd = d => d / Z.z;
const zvw = () => (typeof window !== 'undefined' ? window.innerWidth : 1800) / Z.z; // the window's width in layout px

const MQ_ORIG = new WeakMap();
function zoomMedia(z) {
  if (typeof document === 'undefined' || !document.styleSheets) return;
  const walk = rules => { for (const r of rules) {
    if (r.media && r.media.mediaText !== undefined && r.cssRules) {
      if (!MQ_ORIG.has(r)) MQ_ORIG.set(r, r.media.mediaText);
      const n = MQ_ORIG.get(r).replace(/(min|max)-(width|height)\s*:\s*(\d*\.?\d+)px/g, (m, a, b, v) => `${a}-${b}: ${+(v * z).toFixed(2)}px`);
      if (r.media.mediaText !== n) r.media.mediaText = n;
    }
    if (r.cssRules) walk(r.cssRules);
  } };
  for (const sh of document.styleSheets) { let rules = null; try { rules = sh.cssRules; } catch (e) { /* a stylesheet from another origin: not ours */ } if (rules) walk(rules); }
}
function zoomProbe() { // are element rects reported in zoomed pixels (r = scale) or in layout pixels (r = 1)?
  if (typeof document === 'undefined' || !document.body || !document.body.appendChild || !document.createElement) return Z.z; // no layout engine (tests): assume zoomed pixels
  const p = document.createElement('div'); p.style.cssText = 'position:absolute;left:0;top:0;width:100px;height:100px;visibility:hidden;pointer-events:none';
  document.body.appendChild(p); const w = p.getBoundingClientRect().width; p.remove(); return w > 0 ? w / 100 : 1;
}
function applyScale(v, opt) {
  const z = clampScale(v == null ? S.settings.ui.scale : v), root = typeof document !== 'undefined' ? document.documentElement : null; Z.z = z;
  if (!root) return z;
  const st = root.style;
  if (st) { if (z === 1) { if (st.removeProperty) st.removeProperty('zoom'); } else st.zoom = String(z); if (st.setProperty) st.setProperty('--zf', String(z)); }
  if (root.dataset) root.dataset.scale = String(zPct(z));
  Z.r = zoomProbe(); zoomMedia(z);
  if (!(opt && opt.quiet)) { U.ttAvail = null; if (typeof renderMain === 'function') { try { render(); } catch (e) { /* first paint is not ready yet */ } } }
  return z;
}
function scaleSetting(m) { // the slider block inside Settings -> Appearance (also used by the command palette)
  return `<div class="zsec"><div class="zrow"><label for="zrange">Interface size</label><output id="zval" for="zrange">${zPct(S.settings.ui.scale)}%</output></div>
<div class="zctl"><button type="button" class="ib" data-zstep="-1" aria-label="Smaller" title="Smaller">${ic('minus')}</button>
<input id="zrange" type="range" min="${Z_MIN * 100}" max="${Z_MAX * 100}" step="${Z_STEP * 100}" value="${zPct(S.settings.ui.scale)}" aria-valuetext="${zPct(S.settings.ui.scale)} percent" list="zticks">
<button type="button" class="ib" data-zstep="1" aria-label="Larger" title="Larger">${ic('plus')}</button>
<button type="button" class="btn" data-zreset${zPct(S.settings.ui.scale) === 100 ? ' disabled' : ''}>Reset</button></div>
<datalist id="zticks"><option value="80"><option value="100"><option value="150"></datalist>
<div class="zlab" aria-hidden="true"><span>${Z_MIN * 100}% smaller</span><span>100% default</span><span>${Z_MAX * 100}% larger</span></div>
<p class="hint">Makes text, buttons and spacing larger or smaller everywhere in OpenTick. It is separate from your browser's zoom and from zooming the Gantt chart. Applied when you let go of the slider.</p></div>`;
}
function scaleBind(m) { // events for the block above
  const r = $('#zrange', m); if (!r) return;
  const show = v => { const o = $('#zval', m); if (o) o.textContent = v + '%'; r.setAttribute('aria-valuetext', v + ' percent'); };
  const commit = v => { S.settings.ui.scale = clampScale(v / 100); save(); applyScale(); const n = $('#zrange', m); if (n) { n.value = String(zPct(S.settings.ui.scale)); show(zPct(S.settings.ui.scale)); } const rs = $('[data-zreset]', m); if (rs) rs.disabled = zPct(S.settings.ui.scale) === 100; };
  r.addEventListener('input', () => show(+r.value));  // while dragging only the number moves: resizing the page under the finger would make the thumb run away
  r.addEventListener('change', () => commit(+r.value));
  $$('[data-zstep]', m).forEach(b => b.addEventListener('click', () => commit(zPct(S.settings.ui.scale) + (+b.dataset.zstep) * Z_STEP * 100)));
  const rs = $('[data-zreset]', m); if (rs) rs.addEventListener('click', () => commit(100));
}
