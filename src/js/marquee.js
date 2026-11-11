/* OpenTick marquee: a name that does not fit (a calendar chip, a timetable block, a task row in a narrow window, the "Next" line of a
   project card...) slides sideways to its very end, pauses, and slides back, so the whole name can be read without opening it.

   The element itself is the scroller (overflow-x with the scrollbar hidden) and the slide is its scrollLeft, moved a little every frame. That
   means two things the old CSS animation could not do: the slide always reaches the real end of the text, however wide that turns out to be
   (nothing is measured in advance, so there is nothing to get wrong or go stale when a card is resized or a font arrives), and the text can
   be moved by hand: swipe it on a touch screen, use a trackpad or Shift + wheel, or drag it with the mouse. While a hand is on it (hover,
   touch, a drag or a scroll) the slide holds still, and it carries on from wherever it was left a moment after the hand has gone.

   Purely visual: the text itself is never changed. With Animations off or "reduce motion" nothing moves by itself (the ellipsis stays) but
   the text can still be moved by hand. */
const MQ_SEL = '.mq, .ttl, .chip, .blk .bt, .blk .bm, .blk .tt-t, .bl > span, .gt-tt, .gt-c, .nt-tx, .nl, .wg-t, .lc-b span, .hm-dn, .ct-sel span, .xt b, .scl';
const MARQ = { on: false, set: new Map(), raf: 0, ts: 0, hover: null, drag: null, dragged: false, io: null, speed: 34, hold: 1200, rest: 2200 };
function mqCandidates(root) {
  const all = [...root.querySelectorAll(MQ_SEL)], inner = MQ_SEL.split(',').map(s => s.trim()).filter(s => s !== '.mq').join(',');
  return all.filter(el => !el.querySelector || !el.querySelector(inner)); // the innermost match only
}
// is anything allowed to move by itself? (Settings → Animations, and the system's "reduce motion")
function mqMotionOk() {
  if (document.documentElement.getAttribute('data-motion') === 'off') return false;
  return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
function mqOn(el) {
  if (MARQ.set.has(el)) return;
  el.classList.add('mq-on');
  MARQ.set.set(el, { pos: 0, dir: 1, wait: 500 + Math.random() * 1500, user: 0, last: 0, vis: true, max: 0, maxAt: 0 });
  if (MARQ.io) MARQ.io.observe(el);
  mqKick();
}
function mqOff(el) {
  el.classList.remove('mq-on', 'mq-drag'); MARQ.set.delete(el); if (MARQ.io) MARQ.io.unobserve(el);
  if (el.scrollLeft) el.scrollLeft = 0;
}
function mqScan(root) {
  if (typeof document === 'undefined' || !root || !root.querySelectorAll) return;
  const reads = [];
  for (const el of mqCandidates(root)) {
    if (el.closest && el.closest('input,textarea,select,[contenteditable=true]')) continue;
    const cs = getComputedStyle(el), clip = cs.whiteSpace === 'nowrap' && (cs.overflowX === 'hidden' || cs.overflowX === 'auto' || cs.overflow === 'hidden');
    // (a line cut short by an ellipsis is still wider than its box, so this needs no exact measurement: the slide takes its length from the element itself)
    reads.push([el, clip && el.scrollWidth - el.clientWidth > 2, MARQ.set.has(el)]);
  }
  for (const [el, over, on] of reads) { if (over && !on) mqOn(el); else if (!over && on) mqOff(el); } // writes after all the reads, so a long list is measured in one pass
  for (const el of [...MARQ.set.keys()]) if (!el.isConnected) { MARQ.set.delete(el); if (MARQ.io) MARQ.io.unobserve(el); }
}
function mqScanAll() { for (const id of ['main', 'side', 'detail', 'wgapp']) { const r = document.getElementById(id); if (r) mqScan(r); } const w = document.getElementById('modal'); if (w) mqScan(w); }

/* ---------- the slide ---------- */
function mqKick() { if (!MARQ.raf && MARQ.set.size && !document.hidden) { MARQ.ts = 0; MARQ.raf = requestAnimationFrame(mqTick); } }
function mqTick(ts) {
  MARQ.raf = 0; if (!MARQ.set.size || document.hidden) return;
  const dt = Math.min(64, MARQ.ts ? ts - MARQ.ts : 16), now = Date.now(), go = mqMotionOk(); MARQ.ts = ts;
  let moving = false;
  for (const [el, st] of MARQ.set) {
    if (!el.isConnected) { MARQ.set.delete(el); continue; }
    if (!go || !st.vis) continue;
    if (el === MARQ.hover || el === MARQ.drag || now < st.user) { st.pos = el.scrollLeft; moving = true; continue; } // a hand is on it: it stays where it is
    if (ts - st.maxAt > 400) { st.max = el.scrollWidth - el.clientWidth; st.maxAt = ts; if (st.max <= 1) { mqOff(el); continue; } } // (the real distance, read fresh)
    moving = true;
    if (st.wait > 0) { st.wait -= dt; continue; }
    st.pos = Math.max(0, Math.min(st.max, st.pos + st.dir * MARQ.speed * dt / 1000));
    el.scrollLeft = st.pos; st.last = el.scrollLeft;
    if (st.dir > 0 && st.pos >= st.max - 0.5) { st.dir = -1; st.wait = MARQ.hold; } else if (st.dir < 0 && st.pos <= 0.5) { st.dir = 1; st.wait = MARQ.hold; }
  }
  if (moving) MARQ.raf = requestAnimationFrame(mqTick); else if (MARQ.set.size) setTimeout(mqKick, 1200); // nothing to move right now (motion off, off screen): look again in a moment
}

/* ---------- by hand ---------- */
function mqHandOn(el) { const st = MARQ.set.get(el); if (st) { st.user = Date.now() + MARQ.rest; st.pos = el.scrollLeft; } }
function mqListen() {
  const mq = t => (t && t.closest ? t.closest('.mq-on') : null);
  // the mouse resting on it holds it still (so it can be read, or grabbed)
  document.addEventListener('pointerover', e => { MARQ.hover = e.pointerType === 'touch' ? null : mq(e.target); }, true);
  document.addEventListener('pointerleave', () => { MARQ.hover = null; }, true);
  // a scroll it did not make itself (touch swipe, trackpad, Shift + wheel, a drag) is a hand: give way, then carry on from there
  document.addEventListener('scroll', e => { const st = MARQ.set.get(e.target); if (st && Math.abs(e.target.scrollLeft - st.last) > 2) { mqHandOn(e.target); st.last = e.target.scrollLeft; } }, true);
  document.addEventListener('wheel', e => { const el = mq(e.target); if (el && (e.deltaX || e.shiftKey)) mqHandOn(el); }, { passive: true, capture: true });
  document.addEventListener('touchstart', e => { const el = mq(e.target); if (el) { mqHandOn(el); const st = MARQ.set.get(el); st.user = Date.now() + 8000; } }, { passive: true, capture: true });
  document.addEventListener('touchend', e => { const el = mq(e.target); if (el) mqHandOn(el); }, { passive: true, capture: true });
  // dragging it with the mouse (not where the row or chip itself is dragged to move it: that drag stays the row's)
  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch' || e.button !== 0) return; const el = mq(e.target); if (!el || el.closest('[draggable="true"]')) return;
    MARQ.dragged = false; const x0 = e.clientX, s0 = el.scrollLeft; let go = false;
    const move = ev => {
      if (!go && Math.abs(ev.clientX - x0) < 4) return;
      if (!go) { go = true; MARQ.drag = el; MARQ.dragged = true; el.classList.add('mq-drag'); try { el.setPointerCapture(e.pointerId); } catch (_) { /* gone */ } }
      el.scrollLeft = s0 - (ev.clientX - x0); mqHandOn(el);
    };
    const up = () => {
      document.removeEventListener('pointermove', move, true); document.removeEventListener('pointerup', up, true); document.removeEventListener('pointercancel', up, true);
      if (go) { el.classList.remove('mq-drag'); MARQ.drag = null; mqHandOn(el); try { el.releasePointerCapture(e.pointerId); } catch (_) { /* gone */ } setTimeout(() => { MARQ.dragged = false; }, 0); }
    };
    document.addEventListener('pointermove', move, true); document.addEventListener('pointerup', up, true); document.addEventListener('pointercancel', up, true);
  }, true);
  // a drag that moved the text is not a click on what holds it
  document.addEventListener('click', e => { if (MARQ.dragged) { e.preventDefault(); e.stopPropagation(); MARQ.dragged = false; } }, true);
}
function mqStart() {
  if (MARQ.on || typeof window === 'undefined' || typeof MutationObserver === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
  MARQ.on = true; let raf = 0, t = 0;
  const targets = ['main', 'side', 'detail', 'modal', 'wgapp'].map(id => document.getElementById(id)).filter(Boolean);
  if (typeof IntersectionObserver !== 'undefined') MARQ.io = new IntersectionObserver(es => { for (const x of es) { const st = MARQ.set.get(x.target); if (st) st.vis = x.isIntersecting; } });
  const rescan = (wait = 90) => { clearTimeout(t); t = setTimeout(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { obs.disconnect(); try { mqScanAll(); } catch (e) { /* cosmetic only */ } obs.takeRecords(); for (const r of targets) obs.observe(r, { childList: true, subtree: true }); }); }, wait); };
  const obs = new MutationObserver(() => rescan());
  for (const r of targets) obs.observe(r, { childList: true, subtree: true });
  // a card or panel that changes width (the details panel opening, the window resizing, a font arriving) is looked at again, so what now fits stops and what no longer fits starts
  window.addEventListener('resize', () => rescan(200));
  if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(() => rescan(120)); for (const r of targets) ro.observe(r); }
  if (document.fonts) { if (document.fonts.ready) document.fonts.ready.then(() => rescan(0)); if (document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => rescan(0)); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) mqKick(); });
  mqListen(); setTimeout(mqScanAll, 150);
}
