"""0.8.0 in a real browser: the sidebar (Calendar lights up and opens Calendar, ordering), names that slide and can be moved by hand,
the @ menu in the block editor, Contacts, and custom sections from a pack."""
import json
from lib import *

LIT = "[...document.querySelectorAll('#side .pages .pg.on')].map(e=>e.dataset.pin?('pin:'+e.dataset.pin):(e.dataset.sec||e.dataset.page))"
NAV = "[...document.querySelectorAll('#side .pages [data-nk]')].map(e=>e.dataset.nk)"
PACKS = ROOT / 'marketplace' / 'packs'

with sync_playwright() as p:
    # ---------------------------------------------------------------- the sidebar
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate("S.settings.ui.pins=['school']; save(); U.page='tasks'; render()"); pg.wait_for_timeout(250)
    assert 'sec:contacts' in pg.evaluate(NAV), pg.evaluate(NAV)
    # the pinned Classes view opens, and is the only lit button
    pg.locator('#side .pg.pin[data-pin=school]').click(); pg.wait_for_timeout(300)
    assert pg.evaluate("schoolOn()") and pg.evaluate(LIT) == ['pin:school'], pg.evaluate(LIT)
    # pressing Calendar (it is not the first section, and a pin now sits after it) opens the Calendar, not Classes, and lights it
    pg.locator('#side .pg[data-sec=calendar]').click(); pg.wait_for_timeout(300)
    assert not pg.evaluate("schoolOn()"), 'Calendar must not open Classes'
    assert pg.evaluate(LIT) == ['calendar'], pg.evaluate(LIT)
    # and from another section too
    pg.locator('#side .pg[data-sec=notes]').click(); pg.wait_for_timeout(250)
    pg.locator('#side .pg[data-sec=calendar]').click(); pg.wait_for_timeout(300)
    assert pg.evaluate(LIT) == ['calendar'] and not pg.evaluate("schoolOn()")
    # the first section whatever its place: put Calendar first and last, it still lights and opens itself
    for order in (['sec:calendar'], ['pin:school', 'sec:calendar']):
        pg.evaluate("S.settings.ui.navOrder=%s; save(); render()" % json.dumps(order)); pg.wait_for_timeout(150)
        pg.locator('#side .pg[data-sec=tasks]').click(); pg.wait_for_timeout(200)
        pg.locator('#side .pg[data-sec=calendar]').click(); pg.wait_for_timeout(250)
        assert pg.evaluate(LIT) == ['calendar'], (order, pg.evaluate(LIT))
    # pins and sections are one list: the order in the sidebar is the order that was saved, pins included
    pg.evaluate("S.settings.ui.navOrder=['pin:school','sec:home','sec:tasks']; save(); render()"); pg.wait_for_timeout(150)
    nav = pg.evaluate(NAV); assert nav[:3] == ['pin:school', 'sec:home', 'sec:tasks'], nav
    # dragging a pin among the sections is a real move
    pg.locator('#side .pg[data-nk="pin:school"]').drag_to(pg.locator('#side .pg[data-nk="sec:notes"]')); pg.wait_for_timeout(250)
    nav = pg.evaluate(NAV); assert nav.index('pin:school') > nav.index('sec:tasks'), ('the pin moved out of first place', nav)
    assert pg.evaluate("S.settings.ui.pins") == ['school'] and not pg.errs, pg.errs

    # ---------------------------------------------------------------- names that slide, and can be moved by hand
    pg.evaluate("U.page='tasks'; render()"); pg.wait_for_timeout(200)
    pg.evaluate("""(()=>{ const d=document.createElement('div'); d.id='mqbox'; d.style.cssText='position:fixed;left:380px;top:120px;width:130px;z-index:50;background:var(--card);padding:6px';
      d.innerHTML='<div class="mq" id="mq1" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">The quarterly planning document for every stakeholder, finally</div>'; document.getElementById('main').appendChild(d); })()""")
    pg.wait_for_timeout(400)
    assert pg.evaluate("document.getElementById('mq1').classList.contains('mq-on')"), 'a name that does not fit starts to slide'
    # (the mouse is elsewhere: it slides all the way to the real end)
    pg.mouse.move(900, 600)
    pg.wait_for_function("(()=>{const e=document.getElementById('mq1'); return e.scrollLeft >= e.scrollWidth - e.clientWidth - 1.5})()", timeout=15000)
    assert pg.evaluate("document.getElementById('mq1').scrollLeft") > 30, 'it reached the end of the text'
    # a menu opened while a name slides stays open (the slide is not the page scrolling)
    pg.evaluate("ctxOpen(700, 300, [{label:'One', run(){}}, {label:'Two', run(){}}])"); pg.wait_for_timeout(2500)
    assert pg.evaluate("document.querySelectorAll('.ctx-i').length") == 2, 'a sliding name closed the menu'
    pg.keyboard.press('Escape')
    # drag it with the mouse: the text follows the hand and nothing underneath is clicked
    pg.evaluate("window.__clicks=0; document.getElementById('mqbox').addEventListener('click',()=>{window.__clicks++})")
    box = pg.locator('#mq1').bounding_box(); y = box['y'] + box['height'] / 2
    pg.evaluate("document.getElementById('mq1').scrollLeft=0"); pg.wait_for_timeout(100)
    pg.mouse.move(box['x'] + 100, y); pg.mouse.down(); pg.mouse.move(box['x'] + 70, y, steps=4); pg.mouse.move(box['x'] + 40, y, steps=4)
    moved = pg.evaluate("document.getElementById('mq1').scrollLeft"); pg.mouse.up(); pg.wait_for_timeout(100)
    assert moved > 40, ('dragging left moves the text', moved)
    assert pg.evaluate("window.__clicks") == 0, 'a drag is not a click'
    # and it holds still where it was left, then carries on afterwards
    held = pg.evaluate("document.getElementById('mq1').scrollLeft"); pg.mouse.move(900, 600); pg.wait_for_timeout(500)
    assert abs(pg.evaluate("document.getElementById('mq1').scrollLeft") - held) < 6, 'it waits for a moment after the hand has gone'
    # Shift + wheel (a trackpad swipe sends a sideways wheel the same way)
    pg.evaluate("document.getElementById('mq1').scrollLeft=0"); pg.mouse.move(box['x'] + 60, y); pg.mouse.wheel(90, 0); pg.wait_for_timeout(250)
    assert pg.evaluate("document.getElementById('mq1').scrollLeft") > 20, 'a sideways wheel moves it'
    # Animations off: nothing moves by itself, but the text can still be moved by hand
    pg.evaluate("document.documentElement.setAttribute('data-motion','off'); document.getElementById('mq1').scrollLeft=0"); pg.mouse.move(900, 600); pg.wait_for_timeout(1800)
    assert pg.evaluate("document.getElementById('mq1').scrollLeft") == 0, 'with Animations off it does not slide by itself'
    pg.mouse.move(box['x'] + 100, y); pg.mouse.down(); pg.mouse.move(box['x'] + 50, y, steps=5); pg.mouse.up()
    assert pg.evaluate("document.getElementById('mq1').scrollLeft") > 20, 'but it can still be dragged'
    pg.evaluate("document.documentElement.removeAttribute('data-motion')")
    assert not pg.errs, pg.errs; b.close()

    # ---------------------------------------------------------------- the project card's "Next" line reaches its end
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate("""(()=>{
      S.lists.push({id:'L1',name:'Alpha',color:'#4772fa',sections:[]});
      S.projects.push({id:'P1',name:'A project',color:'#8e5cf7',listIds:['L1']});
      S.tasks.push({id:'tx',title:'Finish the extremely long quarterly planning document and send it to every stakeholder involved',notes:'',listId:'L1',due:todayStr(),time:null,priority:0,tags:[],subtasks:[],repeat:null,reminder:null,status:'open',section:null,created:Date.now(),order:9});
      U.page='home'; render(); })()""")
    pg.mouse.move(5, 5)
    pg.wait_for_function("(()=>{const b=document.querySelector('.pc-x b'); return !!b && b.classList.contains('mq-on') && b.scrollLeft >= b.scrollWidth - b.clientWidth - 1.5 && b.scrollLeft > 20})()", timeout=30000)
    last = pg.evaluate("(()=>{const b=document.querySelector('.pc-x b'), r=document.createRange(); r.selectNodeContents(b); const t=r.getBoundingClientRect(), c=b.getBoundingClientRect(); return t.right - c.right})()")
    assert last <= 2, ('the last letter is in view at the end of the slide', last)
    assert not pg.errs, pg.errs; b.close()

    # ---------------------------------------------------------------- contacts, @ mentions and the block editor
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate("""(()=>{
      S.contacts.push(ctNormalise({id:'c1', name:'Ada Lovelace', role:'Maths tutor', org:'Analytical Engines', emails:[{l:'Work', v:'ada@example.org'}], phones:[{l:'Mobile', v:'+44 20 7946 0000'}], avail:{days:[1,2,3,4,5], start:'09:00', end:'17:00'}}),
                      ctNormalise({id:'c2', name:'Grace Hopper', nick:'grace', fav:true, tags:['navy']}));
      U.page='contacts'; render(); })()""")
    pg.wait_for_timeout(300)
    assert pg.locator('.pe-card').count() == 2, 'both people are listed'
    assert pg.locator('.pe-card', has_text='Ada Lovelace').locator('a[href^="mailto:"]').count() == 1, 'one tap to email'
    pg.locator('.pe-card .pe-main', has_text='Ada Lovelace').click(); pg.wait_for_timeout(300)
    assert 'ada@example.org' in pg.locator('#modal').inner_text(), 'the profile shows the email'
    assert 'Maths tutor' in pg.locator('#modal').inner_text()
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    # a note mentions a person by typing @ in the block editor
    pg.evaluate("U.page='notes'; U.noteSel=S.notes[0].id; render()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-ed][data-mode=blocks]').click()"); pg.wait_for_timeout(400)
    pg.locator('#n-bed .bk').first.click(); pg.wait_for_timeout(250)
    ta = pg.locator('#n-bed textarea').first
    ta.fill(''); ta.type('Call @Ad', delay=40); pg.wait_for_timeout(250)
    items = pg.evaluate("[...document.querySelectorAll('.bed-menu .bm-i b')].map(e=>e.textContent)")
    assert items == ['Ada Lovelace'], ('the @ menu lists matching people', items)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
    assert '@[Ada Lovelace]' in ta.input_value(), ta.input_value()
    # the mention is a link to the person once the note is shown
    pg.evaluate("document.querySelector('[data-ed][data-mode=preview]').click()"); pg.wait_for_timeout(350)
    assert pg.locator('#main a.ctm[data-ct="c1"]').count() >= 1, 'the mention is rendered as a person'
    assert not pg.errs, pg.errs; b.close()

    # ---------------------------------------------------------------- custom sections from a pack, in every view
    b, ctx, pg = launch(p, mobile=False)
    for name in ('study-planner', 'garden-journal', 'home-maintenance'):
        text = (PACKS / (name + '.json')).read_text()
        sid = pg.evaluate("(t)=>{const r=packParse(t); const i=packInstall(r.pack); U.page=i.sections[0].id; U.pinKey=null; render(); return i.sections[0].id}", text)
        pg.wait_for_timeout(250)
        assert pg.evaluate("document.querySelector('#side .pg.on') && (document.querySelector('#side .pg.on').dataset.sec || document.querySelector('#side .pg.on').dataset.page)") == sid, 'the new section is in the sidebar and lit'
        for v in ('list', 'cards', 'table'):
            pg.evaluate("(a)=>{const s=xsById(a[0]); s.view=a[1]; save(); render()}", [sid, v]); pg.wait_for_timeout(150)
            assert pg.locator('#main').inner_text().strip(), (name, v, 'something is drawn')
    assert pg.evaluate("S.csections.length") == 3 and pg.evaluate("S.centries.length") > 3
    # a pack's theme installs as a custom theme and does not switch the look by itself
    before = pg.evaluate("S.settings.theme")
    pg.evaluate("(t)=>{const r=packParse(t); packInstall(r.pack)}", (PACKS / 'calm-themes.json').read_text())
    assert pg.evaluate("S.settings.theme") == before, 'installing a theme does not change the current one'
    assert not pg.errs, pg.errs; b.close()

    # ---------------------------------------------------------------- the phone: the same sidebar rules in the tab bar
    b, ctx, pg = launch(p, mobile=True)
    pg.evaluate("S.settings.ui.pins=['school']; save(); U.page='tasks'; render()"); pg.wait_for_timeout(300)
    pg.evaluate("U.page='timetable'; S.settings.tt.mode='school'; U.pinKey='school'; render()"); pg.wait_for_timeout(250)
    assert pg.evaluate("[...document.querySelectorAll('#tabbar button.on')].map(e=>e.dataset.pin||e.dataset.page||e.dataset.sec)") in (['school'], ['pin:school'])
    nm = pg.evaluate("[...document.querySelectorAll('#tabbar [data-nk]')].map(e=>e.dataset.nk)")
    assert 'pin:school' in nm, nm
    assert pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), 'no sideways scroll on the page'
    assert not pg.errs, pg.errs; b.close()
print('test_v080: ok')
