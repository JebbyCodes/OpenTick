/* OpenTick tooltips: every button says what it does.
   • Mouse / pen: hover a button for a moment and a tip appears (instantly once one has been shown a moment ago).
   • Touch: press and hold a button. The tip appears above your finger, and letting go does NOT press the button.
   • Keyboard: the tip shows when a button gets the keyboard focus (Tab); Esc hides it.
   The text is the button's own `data-tip`, `title` or `aria-label`, so nothing has to be written twice. The browser's own slow, unstyled
   tooltip is held back while ours is up, and put back afterwards. Settings → Accessibility → "Button tooltips" turns it all off.
   A shortcut written at the end of a title, "Settings (Ctrl+,)", is drawn as a key cap. */
const TIP = { el: null, on: null, cand: null, timer: 0, hideT: 0, press: null, pressT: 0, fired: false, warm: 0 };
// elements that carry their own tip. An aria-label only counts on a control: the label of a whole tab strip is not a tip for each button in it
const TIP_FIND = '[data-tip],[data-tip-held],[title],button[aria-label],[role=button][aria-label],[role=tab][aria-label],[role=switch][aria-label],a[aria-label],summary[aria-label],input[type=checkbox][aria-label]';
// what a finger can sensibly "hold": real controls only, never text, rows or things that can be dragged
const TIP_HOLD = 'button,[role=button],[role=tab],[role=menuitem],[role=switch],summary,a[href],select,input[type=checkbox],input[type=radio],input[type=range],.chk,.ib,.btn';
const tipOn = () => !(typeof S !== 'undefined' && S && S.settings && S.settings.tips && S.settings.tips.on === false);

function tipFind(t, forTouch) {
  if (!t || !t.closest) return null;
  const el = t.closest(TIP_FIND); if (!el) return null;
  if (el.closest('#tip,.ctx,textarea,[contenteditable=true],input:not([type=checkbox]):not([type=radio]):not([type=range])')) return null;
  if (forTouch && (!el.closest(TIP_HOLD) || el.closest('[draggable=true]'))) return null;
  return tipText(el) ? el : null;
}
function tipText(el) {
  const raw = el.getAttribute('data-tip') || el.getAttribute('title') || el.dataset.tipHeld || el.getAttribute('aria-label') || '';
  const t = raw.replace(/\s+/g, ' ').trim(); if (!t) return '';
  const vis = (el.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  return vis && vis === t.toLowerCase() ? '' : t; // a button that already says the same in words needs no tip
}
// the browser would show its own tooltip after a second: hold the title back while ours is on duty
function tipHold(el) { if (el.hasAttribute('title')) { el.dataset.tipHeld = el.getAttribute('title'); el.removeAttribute('title'); } }
function tipRelease(el) { if (el && el.dataset && el.dataset.tipHeld != null) { if (!el.hasAttribute('title')) el.setAttribute('title', el.dataset.tipHeld); delete el.dataset.tipHeld; } }

function tipHtml(t) {
  const m = t.match(/^(.*?)\s*\(([^()]{1,26})\)$/);
  return m && m[1] ? `${esc(m[1])} <kbd>${esc(m[2])}</kbd>` : esc(t);
}
function tipHide() {
  clearTimeout(TIP.timer); clearTimeout(TIP.hideT);
  if (TIP.cand) tipRelease(TIP.cand); TIP.cand = null;
  if (TIP.on) TIP.warm = Date.now(); TIP.on = null;
  if (TIP.el) { TIP.el.classList.remove('on'); const e = TIP.el; TIP.el = null; setTimeout(() => e.remove(), 130); }
}
function tipShow(el, touch) {
  const text = tipText(el); if (!text || !tipOn() || !document.contains(el)) return;
  if (TIP.el) { TIP.el.remove(); TIP.el = null; }
  const d = document.createElement('div'); d.id = 'tip'; d.className = 'tip'; d.setAttribute('role', 'tooltip'); d.setAttribute('aria-hidden', 'true'); d.innerHTML = tipHtml(text);
  document.body.appendChild(d);
  // the page may be zoomed (Settings → Appearance → Interface size): work in layout pixels, which is what left / top / offsetWidth use
  const k = (typeof Z !== 'undefined' && Z.r) || 1, zz = (typeof Z !== 'undefined' && Z.z) || 1, b = el.getBoundingClientRect();
  const r = { left: b.left / k, right: b.right / k, top: b.top / k, bottom: b.bottom / k, width: b.width / k };
  const vw = document.documentElement.clientWidth / zz, vh = document.documentElement.clientHeight / zz, w = d.offsetWidth, h = d.offsetHeight, gap = touch ? 14 : 8;
  let x = r.left + r.width / 2 - w / 2; x = Math.max(6, Math.min(x, vw - w - 6));
  let y = r.top - h - gap; if (y < 6) y = Math.min(vh - h - 6, r.bottom + gap); // above by default (a finger covers what is below); below when there is no room
  d.style.left = Math.round(x) + 'px'; d.style.top = Math.round(y) + 'px';
  requestAnimationFrame(() => d.classList.add('on'));
  TIP.el = d; TIP.on = el; TIP.cand = el; tipHold(el);
}

/* mouse and pen: hover */
document.addEventListener('pointerover', e => {
  if (e.pointerType === 'touch' || !tipOn()) return;
  const el = tipFind(e.target); if (!el) return;
  if (el === TIP.cand) return; tipHide(); TIP.cand = el; tipHold(el);
  TIP.timer = setTimeout(() => tipShow(el), Date.now() - TIP.warm < 700 ? 40 : 420);
}, true);
document.addEventListener('pointerout', e => {
  if (e.pointerType === 'touch') return;
  if (TIP.cand && !(e.relatedTarget && TIP.cand.contains(e.relatedTarget))) tipHide();
}, true);
document.addEventListener('pointerdown', e => { if (e.pointerType !== 'touch') tipHide(); }, true);
document.addEventListener('wheel', () => { if (TIP.cand) tipHide(); }, { passive: true, capture: true });
document.addEventListener('scroll', () => { if (TIP.cand || TIP.el) tipHide(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && (TIP.cand || TIP.el)) tipHide(); }, true);

/* keyboard: focus */
document.addEventListener('focusin', e => {
  if (!tipOn() || !e.target || !e.target.matches) return;
  try { if (!e.target.matches(':focus-visible')) return; } catch (err) { return; } // an old WebView without :focus-visible: no keyboard tips
  const el = tipFind(e.target); if (!el || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.type !== 'checkbox') return;
  tipHide(); TIP.cand = el; tipHold(el); TIP.timer = setTimeout(() => tipShow(el), 250);
});
document.addEventListener('focusout', () => tipHide());

/* touch: press and hold */
document.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'touch' || e.isPrimary === false) return;
  clearTimeout(TIP.pressT); tipHide(); TIP.fired = false; TIP.press = null;
  if (!tipOn()) return;
  const el = tipFind(e.target, true); if (!el) return;
  TIP.press = { el, x: e.clientX, y: e.clientY };
  TIP.pressT = setTimeout(() => {
    if (!TIP.press) return; TIP.fired = true; tipShow(el, true);
    try { if (navigator.vibrate) navigator.vibrate(10); } catch (err) { /* no vibration */ }
    TIP.hideT = setTimeout(tipHide, 2600);
  }, 450);
}, true);
document.addEventListener('pointermove', e => {
  if (!TIP.press || e.pointerType !== 'touch') return;
  if (Math.abs(e.clientX - TIP.press.x) > 10 || Math.abs(e.clientY - TIP.press.y) > 10) { clearTimeout(TIP.pressT); TIP.press = null; }
}, true);
const tipLift = () => { clearTimeout(TIP.pressT); TIP.press = null; if (TIP.fired) setTimeout(() => { TIP.fired = false; }, 600); };
document.addEventListener('pointerup', tipLift, true);
document.addEventListener('pointercancel', tipLift, true);
// the hold must not also press the button
document.addEventListener('click', e => { if (TIP.fired) { TIP.fired = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
document.addEventListener('contextmenu', e => { if (TIP.press || TIP.fired) e.preventDefault(); }, true);
