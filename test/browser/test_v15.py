"""0.3 in a real browser: mouse drag in the matrix (no HTML5 drag), full-screen notes, folding sections, the Projects home screen as the start
screen, auto-scrolling names, embeds, the Classes timetable, and every widget view."""
from lib import *
KINDS = ['tasks', 'lists', 'projects', 'notes', 'calendar', 'timetable', 'matrix', 'habits', 'focus']
with sync_playwright() as p:
    # matrix: a plain mouse drag between boxes works, and rows are not natively draggable (desktop web views can swallow that)
    b, ctx, pg = launch(p, mobile=False, w=1280, h=800)
    pg.evaluate("S.tasks.push(newTask({title:'Drag me',id:'dm',listId:'inbox',due:todayStr(),priority:3})); save(); U.page='matrix'; render()"); pg.wait_for_timeout(200)
    assert pg.evaluate("document.querySelector('.matrix .task').getAttribute('draggable')") is None
    q0 = pg.evaluate("mxOf(getT('dm'))"); target = 3 if q0 != 3 else 0
    sx, sy = center(pg, '.matrix .task[data-id=dm]'); tx, ty = center(pg, f'.quad[data-qi="{target}"] .qb')
    pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(sx + 10, sy + 10, steps=3); pg.mouse.move(tx, ty, steps=8)
    assert pg.evaluate("!!document.querySelector('.tghost')"), 'a ghost follows the pointer'
    pg.mouse.up(); pg.wait_for_timeout(200)
    assert pg.evaluate("mxOf(getT('dm'))") == target, 'dropped in the other box'
    assert not pg.evaluate("document.querySelector('.tghost')") and not pg.evaluate("document.body.classList.contains('mdrag')")
    # a click without moving still opens the task; Escape cancels a drag
    pg.click('.matrix .task[data-id=dm]'); pg.wait_for_timeout(150); assert pg.evaluate("U.sel") == 'dm'
    assert not pg.errs, pg.errs; b.close()

    # notes: full screen and Esc, the list toggle, an icon
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate("U.page='notes'; render()"); pg.wait_for_timeout(200)
    w0 = pg.evaluate("document.querySelector('#nt-ed').getBoundingClientRect().width")
    pg.click('.ne-lt'); pg.wait_for_timeout(150); assert pg.evaluate("document.querySelector('#nt-ed').getBoundingClientRect().width") > w0 + 200, 'hiding the list widens the editor'
    pg.click('.ne-lt'); pg.click('.ne-fs'); pg.wait_for_timeout(250)
    r = pg.evaluate("(()=>{const r=document.querySelector('#nt-ed').getBoundingClientRect();return [r.left,r.top,r.width,r.height,innerWidth,innerHeight]})()")
    assert abs(r[0]) < 2 and abs(r[1]) < 2 and abs(r[2] - r[4]) < 2 and abs(r[3] - r[5]) < 2, r
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150); assert not pg.evaluate("document.body.classList.contains('nfull')")
    assert not pg.errs, pg.errs; b.close()

    # folding sections + the sidebar tree + start screen
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate("""S.lists.push({id:'wk',name:'Work2',color:'#e5484d',sections:[]},{id:'wk2',name:'Plan',color:'#30a46c',sections:[],parent:'wk'});
      S.projects.push({id:'pr',name:'Launch',color:'#4772fa',listIds:['wk']}); S.tasks.push(newTask({title:'Own',listId:'wk'}),newTask({title:'Sub',listId:'wk2'})); S.settings.home='home'; save(); setNav('project:pr'); render()""")
    pg.wait_for_timeout(250); assert pg.locator('.gtog').count() == 2
    pg.click('.gtog >> nth=1'); pg.wait_for_timeout(300); assert pg.evaluate("document.querySelectorAll('.gtog')[1].classList.contains('closed')")
    pg.click('[data-act=gfoldall]'); pg.wait_for_timeout(200); assert pg.evaluate("[...document.querySelectorAll('.gtog')].every(x=>x.classList.contains('closed'))")
    pg.click('[data-act=pexp][data-pid=pr]'); pg.wait_for_timeout(150); assert pg.locator('.navrow.sub').count() >= 2, 'the project opens in the sidebar'
    pg.reload(); pg.wait_for_selector('#main'); pg.wait_for_timeout(500); assert pg.evaluate("U.page") == 'home' and pg.locator('.pcard').count() == 1
    pg.click('.pcard'); pg.wait_for_timeout(200); assert pg.evaluate("U.nav") == 'project:pr'
    assert not pg.errs, pg.errs; b.close()

    # long names scroll sideways instead of being cut off
    b, ctx, pg = launch(p, mobile=False, w=1000, h=800)
    pg.evaluate("S.tasks.push(newTask({title:'An extremely long task name that will certainly not fit inside a calendar chip at all, not even close',due:todayStr()})); save(); U.page='calendar'; render()")
    pg.wait_for_timeout(900); assert pg.locator('.mq-on').count() >= 1, 'a truncated chip scrolls'
    assert pg.evaluate("getComputedStyle(document.querySelector('.mq-on > .mqi')).animationName") == 'mq'
    pg.emulate_media(reduced_motion='reduce'); pg.evaluate("render()"); pg.wait_for_timeout(700)
    assert pg.evaluate("[...document.querySelectorAll('.mq-on > .mqi')].every(e=>getComputedStyle(e).animationName==='none')"), 'reduced motion stops it'
    assert not pg.errs, pg.errs; b.close()

    # embeds render as players and notes inside notes
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate("""S.notes.push(newNote({id:'a1',title:'Inner',body:'inner **text**'}),newNote({id:'a2',title:'Outer',body:'![[Inner]]\\n\\n![clip](https://youtu.be/dQw4w9WgXcQ)\\n\\n![](https://example.com/x.mp3)'}));
      save(); U.page='notes'; U.noteSel='a2'; render(); edSetMode('n','preview')""")
    pg.wait_for_timeout(400)
    assert pg.locator('.embed.emb-note strong').count() >= 1 and pg.locator('iframe[src*="youtube-nocookie"]').count() >= 1 and pg.locator('audio').count() >= 1
    assert pg.evaluate("document.querySelector('iframe').getAttribute('sandbox')").startswith('allow-scripts')
    assert not pg.errs, pg.errs; b.close()

    # the Classes timetable (its exams and homework are ordinary tasks)
    b, ctx, pg = launch(p, mobile=False)
    n0 = pg.evaluate("S.tasks.length"); pg.evaluate("U.page='timetable'; render()"); pg.wait_for_timeout(150)
    pg.click('[data-act=scmode][data-m=school]'); pg.click('[data-act=scsetup]'); pg.click('[data-act=sctab][data-t=subj]'); pg.click('[data-act=scadd]')
    pg.fill('[data-k=name]', 'Maths'); pg.click('.mbox [data-m=save]'); pg.click('[data-act=sctab][data-t=week]'); pg.click('.sc-c >> nth=0')
    pg.select_option('[data-k=subjectId]', index=1); pg.click('.mbox [data-m=save]'); pg.wait_for_timeout(200)
    assert pg.evaluate("S.school.filter(r=>r.k==='lesson').length") == 1 and pg.locator('.sc-c.has').count() == 1
    pg.click('[data-act=sctab][data-t=hw]'); pg.click('[data-act=scadd]'); pg.fill('#sw-title', 'Read chapter 3'); pg.click('.mbox [data-m=ok]'); pg.wait_for_timeout(200)
    assert pg.evaluate("S.tasks.filter(t=>t.kind==='homework').length") == 1 and pg.evaluate("S.tasks.length") == n0 + 1, 'homework is a real task'
    assert pg.locator('.sc-list .chk').count() == 1; pg.click('.sc-list .chk'); pg.wait_for_timeout(150)
    assert pg.evaluate("S.tasks.find(t=>t.kind==='homework').status") == 'done'
    pg.click('[data-act=scmode][data-m=plan]'); pg.wait_for_timeout(150); assert pg.locator('.tt-scroll').count() == 1, 'the planner is still there'
    assert not pg.errs, pg.errs; b.close()

    # every widget view renders without errors, in a small window
    b, ctx, pg = launch(p, mobile=False, w=360, h=560)
    for k in KINDS:
        w = ctx.new_page(); errs = []; w.on('pageerror', lambda e: errs.append(str(e)))
        w.goto('file://' + DIST + '?widget=1&w=' + k); w.wait_for_selector('#wgapp'); w.wait_for_timeout(250)
        assert w.evaluate("document.getElementById('wgapp').dataset.kind") == k and w.evaluate("document.querySelector('.wg-h b').textContent.length") > 0, k
        assert w.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), k + ' does not scroll sideways'
        assert not errs, (k, errs); w.close()
    b.close()
print('0.3 browser tests passed')
