/* OpenTick e-ink mode, for e-paper tablets and readers (Boox, Kindle, Kobo, reMarkable, Bigme…).
   What it changes, all on this device only:
     • pure black on white with solid outlines instead of colour, shadows, blur and transparency (e-paper cannot show them);
     • no animation, transitions or moving backgrounds, so the screen refreshes once per action, not once per frame;
     • larger tap targets, marks instead of colour for priority and overdue, bolder text;
     • "page up / page down" buttons at the edge, because dragging to scroll leaves ghosting on e-paper.
   Settings → Appearance → E-ink display: Automatic / On / Off.
   Automatic turns it on in the dedicated e-ink builds (the e-ink Android APK and the /eink/ web app), when the address has ?eink, and on
   browsers whose user-agent names a known e-reader. Many e-ink tablets look like ordinary Android phones, so if it is not detected, choose On. */
const EINK_UA = /\b(Kindle|Kobo|Onyx|BOOX|reMarkable|Likebook|Meebook|Bigme|Mobiscribe|iReader|Supernote|InkPalm|Inkbook|PocketBook)\b/i;
const einkMode = () => (S && S.settings && S.settings.eink && S.settings.eink.mode) || 'auto';
function einkAuto() {
  try {
    if (typeof OTMETA !== 'undefined' && OTMETA && OTMETA.eink) return true;
    if (typeof location !== 'undefined' && /[?&#]eink(=(1|on|true))?(&|$)/i.test((location.search || '') + (location.hash || ''))) return true;
    return typeof navigator !== 'undefined' && EINK_UA.test(navigator.userAgent || '');
  } catch (e) { return false; }
}
const einkOn = () => { const m = einkMode(); return m === 'on' || (m === 'auto' && einkAuto()); };

/* page up / page down: scroll the biggest scrolling area on screen (an open window first, else the page) by nearly a screenful */
function einkScroller() {
  for (const root of [document.querySelector('#modal.on .mbox'), document.getElementById('main')]) {
    if (!root) continue; let best = null, area = 0;
    for (const e of [root, ...root.querySelectorAll('*')]) {
      if (e.scrollHeight <= e.clientHeight + 8 || e.clientHeight < 80) continue;
      if (!/(auto|scroll)/.test(getComputedStyle(e).overflowY)) continue;
      const a = e.clientHeight * e.clientWidth; if (a > area) { area = a; best = e; }
    }
    if (best) return best;
  }
  return null;
}
function einkPage(dir) { const s = einkScroller(); if (s) s.scrollTop += dir * Math.max(120, Math.round(s.clientHeight * 0.88)); }
function einkPager(on) {
  if (typeof document === 'undefined' || !document.body) return;
  let el = document.getElementById('einkpg');
  if (!on) { if (el) el.remove(); return; }
  if (el) return;
  el = document.createElement('div'); el.id = 'einkpg'; el.setAttribute('role', 'group'); el.setAttribute('aria-label', 'Scroll');
  el.innerHTML = `<button type="button" data-pg="-1" aria-label="Page up" title="Page up">${ic('up', 26)}</button><button type="button" data-pg="1" aria-label="Page down" title="Page down">${ic('down', 26)}</button>`;
  el.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b) einkPage(+b.dataset.pg); });
  document.body.appendChild(el);
}

function einkSettingsHtml() {
  const e = S.settings.eink, on = einkOn();
  return `<h4 class="mh">E-ink display</h4>
<div class="form"><label>E-ink mode<select data-pf="eink.mode">${opts([['auto', 'Automatic' + (einkAuto() ? ' (on for this app)' : '')], ['on', 'On'], ['off', 'Off']], e.mode)}</select></label></div>
<label class="a11y-r tg"><span><b>Page up / down buttons</b><small>Two big buttons at the edge of the screen that scroll by a page. Only shown in e-ink mode.</small></span><input type="checkbox" data-pf="eink.pager"${e.pager !== false ? ' checked' : ''}></label>
<p class="hint">For e-paper screens: black on white, solid outlines instead of colour, no animation, larger buttons and marks instead of colours. ${on ? 'E-ink mode is on now; it overrides the theme.' : 'Choose On if your device is e-ink but was not detected.'} There is also a dedicated e-ink Android app and a web version at <b>/eink/</b> that start in this mode.</p>`;
}
