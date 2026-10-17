"""Shared helpers for the real-browser tests (Chromium via Playwright). Run them all with:  python3 test/browser/run.py
They need `pip install playwright && playwright install chromium` and a built app (`npm run build`). They are not part of
`npm test`, which stays dependency-free."""
import os, pathlib
from playwright.sync_api import sync_playwright
ROOT = pathlib.Path(__file__).resolve().parents[2]
DIST = os.environ.get('DIST', str(ROOT / 'dist' / 'index.html'))

def launch(p, mobile=False, w=None, h=None, init=None, **kw):
    b = p.chromium.launch()
    if mobile:
        ctx = b.new_context(viewport={'width': w or 390, 'height': h or 780}, has_touch=True, is_mobile=True, device_scale_factor=2, **kw)
    else:
        ctx = b.new_context(viewport={'width': w or 1280, 'height': h or 800}, **kw)
    if init: ctx.add_init_script(init)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append('console.' + m.type + ': ' + m.text) if m.type == 'error' else None)
    pg.goto('file://' + DIST); pg.wait_for_selector('#main'); pg.errs = errs
    return b, ctx, pg

def touch(cdp, typ, x=None, y=None):
    cdp.send('Input.dispatchTouchEvent', {'type': typ, 'touchPoints': [] if typ in ('touchEnd', 'touchCancel') else [{'x': x, 'y': y}]})

def center(pg, sel):
    b = pg.locator(sel).first.bounding_box(); return b['x'] + b['width'] / 2, b['y'] + b['height'] / 2

# a day with a long slot, short slots and two timed tasks, for the timetable tests
TT_FIXTURE = """(()=>{
 const d=new Date(), dow=d.getDay(), td=todayStr();
 S.slots=[{id:'s1',title:'Maths lecture with a really long title that wraps',days:[dow],start:'09:00',end:'10:30',color:'#4772fa',room:'B12'},
  {id:'s2',title:'Gym',days:[dow],start:'12:00',end:'12:30',color:'#34b36b'},{id:'s3',title:'Stand-up',days:[dow],start:'14:00',end:'14:15',color:'#e5484d'},
  {id:'s4',title:'Lab',days:[dow],start:'15:00',end:'17:00',color:'#8e5cf7'}];
 const mk=(id,title,time,dur)=>({id,title,notes:'',listId:'inbox',due:td,time,dur,priority:0,tags:[],subtasks:[],repeat:null,reminder:null,status:'open',section:null,created:Date.now(),order:9});
 S.tasks.push(mk('t1','Call dentist','11:00',30), mk('t2','Quick email','13:00',15));
 U.page='timetable'; render(); })()"""
