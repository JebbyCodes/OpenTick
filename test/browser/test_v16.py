"""0.5: tabbed settings, accessibility options, shortcuts sheet, context menu, templates."""
from lib import *
with sync_playwright() as p:
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate("openSettings()"); pg.wait_for_timeout(300)
    tabs = pg.evaluate("[...document.querySelectorAll('.stb')].map(e=>e.textContent.trim())")
    assert len(tabs) >= 8, tabs
    for i in range(len(tabs)):
        pg.locator('.stb').nth(i).click(); pg.wait_for_timeout(120)
    pg.locator('.stb', has_text='Accessibility').first.click(); pg.wait_for_timeout(150)
    pg.wait_for_timeout(200)
    pg.screenshot(path='/tmp/claude-0/-home-claude/297f6ff2-1876-5aa4-ac7f-f4ffc5676bdb/scratchpad/set-a11y.png')
    pg.evaluate("prefSet('a11y.contrast', true); a11yApply()")
    assert pg.evaluate("document.documentElement.hasAttribute('data-hc')"), 'contrast flag set'
    assert not pg.errs, pg.errs; b.close()
    b, ctx, pg = launch(p, mobile=False)
    pg.keyboard.press('?'); pg.wait_for_timeout(250); assert pg.locator('.skrow, .sk-row, kbd').count() > 5
    pg.keyboard.press('Escape')
    pg.evaluate("S.tasks.push(newTask({title:'Right',id:'rc',listId:'inbox'})); save(); U.page='tasks'; setNav('all'); render()"); pg.wait_for_timeout(200)
    pg.click('.task[data-id=rc]', button='right'); pg.wait_for_timeout(200); assert pg.locator('.ctxm, .ctx-menu, [role=menu]').count() >= 1
    assert not pg.errs, pg.errs; b.close()

# room and teacher stay inside even a short lesson block, on a phone and on a desktop week
SEED = """(()=>{scSeedPeriods(); const per=scPeriods().filter(p=>!p.brk), d=new Date().getDay();
  S.school.push({id:'su1',k:'subject',name:'Physics',color:'#4772fa',icon:'calculator'},{id:'te1',k:'teacher',name:'Dr Okafor'});
  per.slice(0,3).forEach((p,i)=>S.school.push({id:'l'+i,k:'lesson',day:d,periodId:p.id,subjectId:'su1',teacherId:'te1',room:'Lab '+i,week:0}));
  save(); U.page='timetable'; render(); document.querySelectorAll('*').forEach(e=>{if(e.scrollHeight>e.clientHeight+50&&e.id!=='main')e.scrollTop=0});})()"""
with sync_playwright() as p:
    for mobile in (True, False):
        b, ctx, pg = launch(p, mobile=mobile); pg.evaluate(SEED); pg.wait_for_timeout(400)
        bad = pg.evaluate("[...document.querySelectorAll('.blk.lsn')].filter(b=>{const l=b.querySelector('.lw');if(!l)return true;const r=l.getBoundingClientRect(),q=b.getBoundingClientRect();return r.bottom>q.bottom+1||r.height<8}).length")
        assert pg.locator('.blk.lsn').count() >= 3 and bad == 0, ('room/teacher clipped', mobile, bad)
        assert not pg.errs, pg.errs; b.close()
