"""0.9.0: number keys reach pinned views, held keys do not repeat, Statistics (history off / on, heatmap, filters) and the shared image."""
from lib import *
import base64, struct

SEED = """(()=>{
 S.settings.history.on = true;
 const today = new Date(); const A = {};
 for (let i = 0; i < 300; i++) { const d = new Date(today); d.setDate(d.getDate() - i); if ((i * 7) % 5 === 0) continue; const k = ymd(d), n = 1 + (i * 13) % 6;
   A[k] = { ['task.done|inbox|' + (8 + i % 10)]: n, ['task.add|inbox|' + (9 + i % 9)]: 1 + n % 3 }; if (i % 3 === 0) A[k]['note.add||' + (14 + i % 5)] = 1; if (i % 4 === 0) A[k]['habit.done||'] = 2; }
 S.activity.days = A; S.activity.on = Date.now(); S.activity.filled = Date.now(); U.page = 'stats'; render(); })()"""

with sync_playwright() as p:
    b, ctx, pg = launch(p, mobile=False)
    # ---- history is off by default: Statistics says so and shows nothing else ----
    assert pg.evaluate("S.settings.history.on") is False
    pg.evaluate("U.page='stats'; render()"); pg.wait_for_timeout(150)
    txt = pg.inner_text('#main'); assert 'needs History' in txt and 'Turn on history' in txt, txt
    assert pg.locator('#main .stcell').count() == 0
    pg.evaluate("U.page='history'; render()"); pg.wait_for_timeout(100); assert 'needs History' in pg.inner_text('#main')
    # the button turns it on
    pg.evaluate("U.page='stats'; render()"); pg.locator('[data-act=histon]').click(); pg.wait_for_timeout(250)
    assert pg.evaluate("S.settings.history.on") is True and pg.locator('#main .stcards').count() == 1
    assert pg.locator('#main .vtabs [role=tab]').count() == 2, 'Statistics and History are two views of one section'
    # ---- with data: heatmap, filters, scope ----
    pg.evaluate(SEED); pg.wait_for_timeout(200)
    assert pg.locator('#main .sthm .stcell:not(.none)').count() >= 90, 'the heatmap has a cell per day'
    assert pg.locator('#main .stcell.l4').count() > 0 and pg.locator('#main .stcell.l1').count() > 0
    pg.screenshot(path=str(ROOT / 'dist' / '..' / 'stats-wide.png')) if False else None
    n0 = pg.locator('#main .sthm .stcell:not(.none)').count()
    pg.select_option('[data-stf=range]', '30'); pg.wait_for_timeout(150)
    n1 = pg.locator('#main .sthm .stcell:not(.none)').count(); assert n1 == 30, (n0, n1)
    pg.locator('[data-act=stkind][data-k=note]').click(); pg.wait_for_timeout(120)
    assert 'Tasks completed' not in pg.inner_text('#main .stcards') and 'Notes written' in pg.inner_text('#main .stcards')
    pg.locator('[data-act=stclear]').click(); pg.wait_for_timeout(100)
    pg.locator('[data-act=stpanel][data-p=heat]').click(); pg.wait_for_timeout(100); assert pg.locator('#main .sthm').count() == 0
    pg.locator('[data-act=stpanel][data-p=heat]').click(); pg.wait_for_timeout(100); assert pg.locator('#main .sthm').count() == 1
    opts = pg.evaluate("[...document.querySelectorAll('[data-stf=scope] option')].map(o=>o.textContent.trim())"); assert opts[0] == 'Everything' and 'Inbox' in opts, opts
    assert pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), 'no sideways scroll'
    pg.screenshot(path='/tmp/claude-0/-home-claude/7ce7f030-40e3-5e1a-8889-ce9899cc92af/scratchpad/shots/stats-desktop.png')
    # ---- the shared image really turns into a PNG ----
    png = pg.evaluate("""async () => { const f = stFilter(), r = stCompute(f), pic = stSvg(f, r, {}); const blob = await stPng(pic, 1);
      const buf = new Uint8Array(await blob.arrayBuffer()); return { size: blob.size, type: blob.type, head: [...buf.slice(0, 8)], w: pic.w, h: pic.h }; }""")
    assert png['type'] == 'image/png' and png['head'] == [137, 80, 78, 71, 13, 10, 26, 10] and png['size'] > 5000, png
    data = pg.evaluate("""async () => { const f = stFilter(), r = stCompute(f), pic = stSvg(f, r, {}); const blob = await stPng(pic, 1); const b = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); }""")
    open('/tmp/claude-0/-home-claude/7ce7f030-40e3-5e1a-8889-ce9899cc92af/scratchpad/shots/stats-share.png', 'wb').write(base64.b64decode(data))
    pg.locator('[data-act=stshare]').click(); pg.wait_for_selector('.stprev svg'); assert pg.locator('.stprev svg').count() == 1
    pg.locator('#stnames').check(); pg.wait_for_timeout(100); pg.locator('[data-m=ok]').click(); pg.wait_for_timeout(100)
    # ---- the settings switch ----
    pg.evaluate("openSettings('data')"); pg.wait_for_timeout(150)
    assert pg.locator('#histset input[data-pf="history.on"]').is_checked(); pg.locator('#histset input[data-pf="history.on"]').uncheck(); pg.wait_for_timeout(150)
    assert pg.evaluate("S.settings.history.on") is False
    pg.keyboard.press('Escape'); pg.evaluate("closeModal(); U.page='stats'; render()"); assert 'needs History' in pg.inner_text('#main'), 'off again: nothing shown'
    # ---- number keys follow the sidebar, pins included ----
    pg.evaluate("S.settings.history.on = false; pinToggle('page:kanban'); U.page='tasks'; render()"); pg.wait_for_timeout(200)
    order = pg.evaluate("navShown()"); i = order.index('pin:page:kanban')
    pg.evaluate("document.activeElement && document.activeElement.blur()"); pg.keyboard.press(str(i + 1)); pg.wait_for_timeout(250)
    assert pg.evaluate("U.page") == 'kanban' and pg.evaluate("U.pinKey") == 'page:kanban', 'the pinned view has a working number'
    # ---- a held key acts once ----
    pg.evaluate("U.page='tasks'; U.pinKey=null; render(); window.__renders = 0; const r0 = render; window.render = function(){ window.__renders++; return r0.apply(this, arguments); };"); pg.wait_for_timeout(150)
    pg.evaluate("""() => { const fire = rep => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '2', code: 'Digit2', bubbles: true, cancelable: true, repeat: rep })); fire(false); for (let i = 0; i < 25; i++) fire(true); }""")
    pg.wait_for_timeout(300)
    r = pg.evaluate("window.__renders"); assert 1 <= r <= 2, f'a held 2 renders once, not {r} times'
    pg.evaluate("window.render = typeof r0 === 'undefined' ? window.render : window.render")
    assert not pg.errs, pg.errs
    b.close()

    # ---- a phone ----
    b, ctx, pg = launch(p, mobile=True)
    pg.evaluate(SEED); pg.wait_for_timeout(250)
    assert pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), 'the page does not scroll sideways'
    assert pg.locator('#main .stcards').count() == 1
    pg.screenshot(path='/tmp/claude-0/-home-claude/7ce7f030-40e3-5e1a-8889-ce9899cc92af/scratchpad/shots/stats-phone.png')
    assert not pg.errs, pg.errs
    b.close()
print('0.9.0 browser tests passed (statistics, keys, share image)')
