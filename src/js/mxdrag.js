/* OpenTick matrix: moving a task between the four boxes without a mouse.
   Touch: press and hold a task (half a second, a short buzz confirms it), slide to another box and let go. A finger that moves
   before the press counts is a scroll and does nothing. The grid scrolls by itself when the finger nears its edge.
   Keyboard: Tab to a task, then Alt + arrow keys move it (left / right and up / down on the 2 x 2 grid; up / down on a phone's
   single column), Enter opens it. Mouse: the browser's own drag and drop (see main.js).
   All three end in the same place, matrixDrop / mxMove, so priority, due date, order and saving behave identically. */

// where an arrow key sends a task. `stacked` = the boxes are in one column (narrow screens)
function mxTarget(qi, key, stacked) {
  if (stacked) return key === 'ArrowUp' ? Math.max(0, qi - 1) : key === 'ArrowDown' ? Math.min(3, qi + 1) : qi;
  return key === 'ArrowLeft' || key === 'ArrowRight' ? (qi ^ 1) : key === 'ArrowUp' || key === 'ArrowDown' ? (qi ^ 2) : qi;
}
// the 2 x 2 layout puts "left" in column 0: moving left from column 0 (or right from column 1) stays put
function mxKeyDest(qi, key, stacked) {
  if (!stacked) { const col = qi & 1, row = qi >> 1; if ((key === 'ArrowLeft' && col === 0) || (key === 'ArrowRight' && col === 1) || (key === 'ArrowUp' && row === 0) || (key === 'ArrowDown' && row === 1)) return qi; }
  return mxTarget(qi, key, stacked);
}
function mxKeyMove(id, key) {
  const t = getT(id); if (!t || t.deleted) return false;
  const from = mxOf(t), to = mxKeyDest(from, key, narrow(820));
  if (to === from) return false;
  mxMove(t, to); save(); sfx('sched'); toast(`Moved “${t.title.slice(0, 40)}” to “${MQ[to].n}”`);
  renderSide(); renderMain();
  const r = $(`#main .task[data-id="${id}"]`); if (r && r.focus) r.focus();
  return true;
}
document.addEventListener('keydown', e => {
  if (U.page !== 'matrix' || $('#modal.on') || !e.target.closest) return;
  const row = e.target.closest('#main .quad .task[data-id]'); if (!row || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName)) return;
  if (e.altKey && /^Arrow(Left|Right|Up|Down)$/.test(e.key)) { e.preventDefault(); mxKeyMove(row.dataset.id, e.key); }
  else if ((e.key === 'Enter' || e.key === ' ') && e.target === row) { e.preventDefault(); row.click(); }
});

// touch: press and hold, slide, release
(() => {
  let g = null;
  const SEL = '#main .quad .task[data-id]';
  const under = (x, y) => (document.elementFromPoint ? document.elementFromPoint(x, y) : null);
  const quadAt = (x, y) => { const el = under(x, y); return el && el.closest ? el.closest('.quad') : null; };
  const finish = () => {
    if (!g) return;
    clearTimeout(g.timer); clearInterval(g.tick); if (g.ghost) g.ghost.remove();
    if (g.el && g.el.classList) g.el.classList.remove('drag');
    document.body.classList.remove('tdrag'); $$('.over').forEach(x => x.classList.remove('over'));
    if (g.on) { U.drag = null; U.tdrag = false; U.suppress = Date.now(); } // the click that ends the press must not open the task
    g = null;
  };
  const place = (x, y) => {
    const gh = g.ghost; gh.style.left = Math.round(x / Z.z - g.gw / 2) + 'px'; gh.style.top = Math.round(y / Z.z - g.gh / 2) + 'px';
    const z = quadAt(x, y); $$('.over').forEach(el => { if (el !== z) el.classList.remove('over'); }); if (z) z.classList.add('over');
  };
  document.addEventListener('touchstart', e => {
    if (U.page !== 'matrix' || U.bsel || e.touches.length !== 1) return;
    const el = e.target.closest && e.target.closest(SEL); if (!el || e.target.closest('.chk,button,input,select,textarea,a')) return;
    const t = e.touches[0]; finish(); g = { el, x0: t.clientX, y0: t.clientY, x: t.clientX, y: t.clientY, on: false };
    g.timer = setTimeout(() => {
      if (!g) return;
      const r = g.el.getBoundingClientRect(); g.on = true; U.drag = g.el.dataset.id; U.tdrag = true;
      g.gw = Math.min(r.width / Z.r, 260); g.gh = Math.min(r.height / Z.r, 64);
      const gh = g.ghost = g.el.cloneNode(true); gh.classList.add('tghost'); gh.removeAttribute('data-act'); gh.removeAttribute('draggable'); gh.removeAttribute('tabindex');
      for (const [k, v] of Object.entries({ position: 'fixed', margin: '0', width: g.gw + 'px', height: g.gh + 'px', zIndex: '300', pointerEvents: 'none', right: 'auto', bottom: 'auto' })) gh.style[k] = v;
      document.body.appendChild(gh); g.el.classList.add('drag'); document.body.classList.add('tdrag');
      try { if (navigator.vibrate) navigator.vibrate(18); } catch (_) { /* optional */ }
      place(g.x, g.y);
      g.tick = setInterval(() => { // scroll the grid while the finger sits near its top or bottom edge
        const sc = $('#main .matrix'); if (!sc || !g) return; const b = sc.getBoundingClientRect();
        const gy = zc(g.y); if (gy < b.top + 70 * Z.r) sc.scrollTop -= 12; else if (gy > b.bottom - 70 * Z.r) sc.scrollTop += 12;
        place(g.x, g.y);
      }, 16);
    }, 450);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!g) return; const t = e.touches[0];
    if (!g.on) { if (Math.hypot(t.clientX - g.x0, t.clientY - g.y0) > 10) finish(); return; } // moved before the press counted: it is a scroll
    e.preventDefault(); g.x = t.clientX; g.y = t.clientY; place(g.x, g.y);
  }, { passive: false });
  document.addEventListener('touchend', e => {
    if (!g) return;
    if (g.on) {
      const t = e.changedTouches[0], gh = g.ghost; if (gh) gh.style.display = 'none';
      const quad = quadAt(t.clientX, t.clientY), at = under(t.clientX, t.clientY);
      if (quad && getT(U.drag)) matrixDrop({ target: at }, quad);
    }
    finish();
  });
  document.addEventListener('touchcancel', finish);
  // the page going to the background (a call, the app switcher) must not leave a ghost or a half-finished drag behind
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
})();
