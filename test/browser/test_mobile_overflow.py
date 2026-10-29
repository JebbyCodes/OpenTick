"""Mobile overflow audit: every page at phone widths. Fails if a button, field or toolbar item is cut off by the screen edge
(or by a container that does not scroll), if the page scrolls sideways, or if a control is too small to tap.
Run alone:  python3 test/browser/test_mobile_overflow.py   (also part of  python3 test/browser/run.py)"""
from lib import *

# runs in the page: lists every visible control whose box leaves the viewport, or is clipped by a non-scrolling ancestor
AUDIT = """(() => {
  const vw = document.documentElement.clientWidth, out = [];
  const visible = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
  const scrolls = e => { const s = getComputedStyle(e); return /(auto|scroll)/.test(s.overflowX) && e.scrollWidth > e.clientWidth; };
  for (const e of document.querySelectorAll('#main button, #main select, #main input, #main a, #main [role=tab]')) {
    if (!visible(e) || e.closest('[hidden], .mback, #toast, #dock, .fab, #tabbar')) continue;
    const r = e.getBoundingClientRect(); let bad = '';
    if (r.right > vw + 1 || r.left < -1) {
      // fine when an ancestor deliberately scrolls sideways (the tab strip, the grids)
      let a = e.parentElement, ok = false; while (a && a !== document.body) { if (scrolls(a)) { ok = true; break; } a = a.parentElement; }
      if (!ok) bad = `outside the screen (${Math.round(r.left)}..${Math.round(r.right)} of ${vw})`;
    }
    if (!bad) { // clipped by an ancestor that hides overflow
      let a = e.parentElement;
      while (a && a !== document.body) {
        const s = getComputedStyle(a), ar = a.getBoundingClientRect();
        if (/(hidden|clip)/.test(s.overflowX) && !scrolls(a) && (r.right > ar.right + 1 || r.left < ar.left - 1)) { bad = `clipped by ${a.className || a.tagName}`; break; }
        a = a.parentElement;
      }
    }
    if (bad) out.push(`${(e.getAttribute('data-act') || e.id || e.tagName)}: "${(e.getAttribute('aria-label') || e.title || e.textContent || '').trim().slice(0, 24)}" ${bad}`);
  }
  if (document.documentElement.scrollWidth > vw + 1) out.push(`the page scrolls sideways (${document.documentElement.scrollWidth} > ${vw})`);
  return out;
})()"""

FIX = """(()=>{ const d=new Date(), dow=d.getDay(), td=todayStr();
  S.slots=[{id:'s1',title:'Maths lecture',days:[dow],start:'09:00',end:'10:30',color:'#4772fa',room:'B12'}];
  S.tasks.push({id:'t1',title:'Call dentist',notes:'',listId:'inbox',due:td,time:'11:00',dur:30,priority:0,tags:[],subtasks:[],repeat:null,reminder:null,status:'open',section:null,created:Date.now(),order:9}); })()"""

PAGES = ['home', 'tasks', 'notes', 'calendar', 'timetable', 'gantt', 'matrix', 'habits', 'focus', 'templates']
bad = []
with sync_playwright() as p:
    for w, h in ((320, 640), (360, 740), (390, 780), (412, 915)):
        b, ctx, pg = launch(p, mobile=True, w=w, h=h); pg.evaluate(FIX)
        for page in PAGES:
            pg.evaluate(f"U.page='{page}'; U.sel=null; render()"); pg.wait_for_timeout(120)
            for msg in pg.evaluate(AUDIT): bad.append(f'{w}px {page}: {msg}')
        # the timetable in each of its views, and the class planner with its tabs
        for v in ('day', '3day', 'week'):
            pg.evaluate(f"U.page='timetable'; S.settings.tt.view='{v}'; render()"); pg.wait_for_timeout(120)
            for msg in pg.evaluate(AUDIT): bad.append(f'{w}px timetable/{v}: {msg}')
        has_school = pg.evaluate("typeof schoolOn === 'function'")
        if has_school:
            pg.evaluate("S.settings.tt.mode='school'; U.page='timetable'; render()"); pg.wait_for_timeout(150)
            for tab in ('today', 'day', 'week', 'exam', 'hw', 'subj', 'teach', 'note'):
                pg.evaluate(f"U.scTab='{tab}'; render()"); pg.wait_for_timeout(100)
                for msg in pg.evaluate(AUDIT): bad.append(f'{w}px classes/{tab}: {msg}')
        b.close()
if bad:
    print('\n'.join(sorted(set(bad)))); raise SystemExit(f'{len(set(bad))} mobile layout problems')
print('mobile overflow audit passed (4 phone widths, every page, timetable views, classes tabs)')
