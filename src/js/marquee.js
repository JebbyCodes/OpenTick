/* OpenTick marquee: a name that does not fit (a calendar chip, a timetable block, a task row in a narrow window...) slides
   sideways, pauses at each end and slides back, so the whole name can be read without opening it. Hover or touch holds it still.
   Purely visual: the text itself is never changed, and with Animations off or "reduce motion" the usual ellipsis stays. */
const MQ_SEL = '.mq, .ttl, .chip, .blk .bt, .blk .bm, .blk .tt-t, .bl > span, .gt-tt, .gt-c, .nt-tx, .nl, .wg-t, .lc-b span, .hm-dn, .ct-sel span, .xt b, .scl';
let MQ_ON = false;
function mqCandidates(root) {
  const all = [...root.querySelectorAll(MQ_SEL)];
  return all.filter(el => !el.querySelector || !el.querySelector(MQ_SEL.split(',').map(s => s.trim()).filter(s => s !== '.mq').join(','))); // the innermost match only
}
function mqScan(root) {
  if (typeof document === 'undefined' || !root || !root.querySelectorAll) return;
  const els = mqCandidates(root), todo = [];
  for (const el of els) {
    if (el.closest && el.closest('input,textarea,select,[contenteditable=true]')) continue;
    const inner = el.firstElementChild && el.firstElementChild.classList.contains('mqi') && el.children.length === 1 ? el.firstElementChild : null;
    const cs = getComputedStyle(el); if (cs.whiteSpace !== 'nowrap' || (cs.overflowX !== 'hidden' && cs.overflow !== 'hidden')) { if (inner) todo.push([el, inner, 0]); continue; }
    const over = (inner ? inner.scrollWidth : el.scrollWidth) - el.clientWidth;
    if (over > 2 || inner) todo.push([el, inner, over]);
  }
  for (const [el, inner, over] of todo) { // writes after all the reads, so a long list is measured in one pass
    if (over > 2) {
      let w = inner; if (!w) { w = document.createElement('span'); w.className = 'mqi'; while (el.firstChild) w.appendChild(el.firstChild); el.appendChild(w); }
      el.classList.add('mq-on'); el.style.setProperty('--mqx', '-' + Math.ceil(over + 6) + 'px'); el.style.setProperty('--mqd', Math.max(5, Math.round(over / 18 + 3.5)) + 's'); el.style.setProperty('--mql', (Math.random() * 1.6).toFixed(2) + 's');
    } else if (inner) { while (inner.firstChild) el.insertBefore(inner.firstChild, inner); inner.remove(); el.classList.remove('mq-on'); el.style.removeProperty('--mqx'); }
  }
}
function mqScanAll() { for (const id of ['main', 'side', 'detail']) { const r = document.getElementById(id); if (r) mqScan(r); } const w = document.getElementById('modal'); if (w) mqScan(w); }
function mqStart() {
  if (MQ_ON || typeof window === 'undefined' || typeof MutationObserver === 'undefined' || typeof requestAnimationFrame === 'undefined') return;
  MQ_ON = true; let raf = 0, t = 0;
  const targets = ['main', 'side', 'detail', 'modal'].map(id => document.getElementById(id)).filter(Boolean);
  const obs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { obs.disconnect(); try { mqScanAll(); } catch (e) { /* cosmetic only */ } obs.takeRecords(); for (const r of targets) obs.observe(r, { childList: true, subtree: true }); }); }, 90); });
  for (const r of targets) obs.observe(r, { childList: true, subtree: true });
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { try { mqScanAll(); } catch (e) { /* cosmetic only */ } }, 200); });
  setTimeout(mqScanAll, 150);
}
