"""0.4 in a real browser: the phone note fills the screen, the habit icon is centred, Classes fits a phone without scrolling or
scrolling text, lessons show when they end and sit on the main timetable with their tasks, and the encryption lock screen works.
Needs a built app (node build-app.mjs) and Playwright; run with the others: python3 test/browser/run.py"""
from lib import *

NOTE = """(()=>{ S.notes=[{id:'n1',title:'Meeting notes',pinned:false,tags:['work','q4'],created:Date.now(),updated:Date.now(),body:'# Planning\\n\\nSome **bold** text.\\n\\n'+'More text here to fill the page. '.repeat(30)}]; U.page='notes'; U.noteSel='n1'; render(); })()"""
HABITS = """(()=>{ S.habits=[{id:'h1',name:'Drink water',icon:'💧',color:'#12a9c7',log:{}},{id:'h2',name:'Read',icon:'📚',color:'#e5484d',log:{}},{id:'h3',name:'Run',icon:'🏃',color:'#34b36b',log:{}}]; U.page='habits'; render(); })()"""
# Mon-Fri lessons in the seeded periods, three classes, one teacher; a timed task and an exam; "now" is fixed at Wednesday 10:10 (inside the 09:55-10:40 lesson)
CLASSES = """(()=>{
 S.school=[]; scSeedPeriods();
 const per=scPeriods().filter(p=>!p.brk);
 S.school.push({id:'t1',k:'teacher',name:'Mr Patel',email:''});
 [['m','Mathematics','#4772fa','B12','t1'],['e','English Literature','#e5484d','A3',''],['p','Physics','#34b36b','Lab 2','t1']].forEach(([id,name,color,room,teacherId])=>S.school.push({id,k:'subject',name,short:'',color,room,teacherId,icon:''}));
 const ids=['m','e','p']; let n=0;
 for (const day of [1,2,3,4,5]) for (let i=0;i<per.length;i++) S.school.push({id:'l'+(n++),k:'lesson',day,periodId:per[i].id,subjectId:ids[(day+i)%3],room:'',teacherId:'',week:0});
 const td=todayStr(), wk=ymd(addDays(new Date(),5));
 const mk=(id,title,o)=>({id,title,notes:'',listId:'inbox',due:td,time:null,priority:0,tags:[],subtasks:[],repeat:null,reminder:null,status:'open',section:null,created:Date.now(),order:9,...o});
 S.tasks.push(mk('dent','Call the dentist',{time:'11:00',dur:30}), mk('ex1','Chapter 4 test',{kind:'exam',subjectId:'p',due:wk,time:'09:00',dur:60,room:'Hall'}));
 S.settings.tt.mode='school'; U.page='timetable'; U.scTab='today'; save(); flush(); render(); })()"""
FIX_TIME = '2026-10-21T10:10:00'  # a Wednesday
PASS = 'correct horse battery staple'

with sync_playwright() as p:
    # ---- a note on a phone: the note itself gets the screen, the extras fold behind one button ----
    b, ctx, pg = launch(p, mobile=True, w=390, h=780)
    pg.evaluate(NOTE); pg.wait_for_timeout(300)
    r = pg.locator('#nt-ed').bounding_box()
    assert r['width'] >= 389 and r['height'] >= 778 and r['y'] <= 1, ('the open note fills the phone screen', r)
    assert pg.evaluate("getComputedStyle(document.querySelector('#tabbar')).display") == 'none', 'the tab bar is out of the way while a note is open'
    head = pg.locator('.ne-head').bounding_box(); assert head['height'] <= 56, ('a slim header', head)
    assert pg.locator('.ne-title').bounding_box()['y'] < 40, 'the title sits in the header row, not on a row of its own'
    ed = pg.locator('#n-ed').bounding_box(); assert ed['height'] >= 0.78 * 780, ('the editor gets most of the screen', ed)
    assert not pg.locator('#n-det').is_visible(), 'tags, list and attachments are folded away at first'
    assert pg.locator('.ne-dot').count() == 1, 'a dot says the note has details (tags)'
    assert not pg.locator('.ne-x').is_visible(), 'the footer keeps just the word count on a phone'
    assert pg.locator('.ne-tool').bounding_box()['height'] <= 60, 'the formatting tools are a single row'
    pg.click('[data-act=notedet]'); pg.wait_for_timeout(200)
    assert pg.locator('#n-det').is_visible() and pg.locator('[data-f=ntags]').is_visible() and pg.locator('[data-f=nhome]').is_visible(), 'the details open on tap'
    assert pg.locator('#n-det').bounding_box()['height'] <= 0.47 * 780 + 2, 'the details never take over the screen'
    pg.click('[data-act=notedet]'); pg.wait_for_timeout(100); assert not pg.locator('#n-det').is_visible()
    pg.evaluate("document.documentElement.style.setProperty('--vvh','330px')"); pg.wait_for_timeout(150)  # what the browser reports while the on-screen keyboard is up
    assert pg.locator('#nt-ed').bounding_box()['height'] <= 332 and pg.locator('.ne-tool').is_visible(), 'the note and its tools stay above the keyboard'
    pg.evaluate("document.documentElement.style.removeProperty('--vvh')")
    pg.click('[data-act=noteback]'); pg.wait_for_timeout(200)
    assert pg.evaluate("getComputedStyle(document.querySelector('#tabbar')).display") == 'flex', 'back at the list, the tab bar returns'
    assert not pg.errs, pg.errs; b.close()

    # ---- the same note on a desktop is unchanged: details always visible, no details button ----
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate(NOTE); pg.wait_for_timeout(300)
    assert pg.locator('#n-det').is_visible() and not pg.locator('.ne-dt').is_visible() and pg.locator('.sg-t').first.is_visible()
    assert pg.evaluate("getComputedStyle(document.querySelector('#nt-ed')).position") != 'fixed'
    assert not pg.errs, pg.errs; b.close()

    # ---- a habit's emoji sits in the middle of its circle ----
    b, ctx, pg = launch(p, mobile=False)
    pg.evaluate(HABITS); pg.wait_for_timeout(300)
    for m in pg.evaluate("""[...document.querySelectorAll('.habit .hi')].map(h=>{const e=h.querySelector('.emo'), hb=h.getBoundingClientRect(), r=document.createRange(); r.selectNodeContents(e); const g=r.getBoundingClientRect();
      return [g.left+g.width/2-(hb.left+hb.width/2), g.top+g.height/2-(hb.top+hb.height/2)]})"""):
        assert abs(m[0]) < 0.7 and abs(m[1]) < 1.5, ('habit icon off-centre', m)
    assert not pg.errs, pg.errs; b.close()

    # ---- Classes on a phone: everything visible, nothing scrolls sideways, no scrolling text ----
    b, ctx, pg = launch(p, mobile=True, w=390, h=780)
    pg.clock.set_fixed_time(FIX_TIME); pg.evaluate(CLASSES); pg.wait_for_timeout(300)
    assert 'Classes' in pg.inner_text('#main'), 'the page is called Classes, not School'
    assert 'School' not in pg.inner_text('#main').replace('School timetable', ''), 'no leftover "School" wording'
    pg.evaluate("U.scTab='week'; renderMain()"); pg.wait_for_timeout(300)
    g = pg.evaluate("(()=>{const e=document.querySelector('.sc-grid'); return [e.scrollWidth, e.clientWidth, document.documentElement.scrollWidth, innerWidth, e.querySelectorAll('.mq').length]})()")
    assert g[0] <= g[1] + 1 and g[2] <= g[3] + 1, ('the week fits the phone without sideways scrolling', g)
    assert g[4] == 0, 'class names wrap instead of scrolling'
    assert pg.locator('.sc-c.has').count() >= 20
    pg.evaluate("U.scTab='today'; renderMain()"); pg.wait_for_timeout(250)
    txt = pg.inner_text('#main'); assert '10:40' in txt, 'Today says when the lesson ends'; assert 'ends in' in txt, 'and how long is left'
    pg.evaluate("U.scTab='day'; renderMain()"); pg.wait_for_timeout(250)
    txt = pg.inner_text('#main'); assert '10:40' in txt and 'Call the dentist' in txt, 'the Day view is one agenda of lessons and tasks, with end times'
    assert not pg.errs, pg.errs; b.close()

    # ---- the same lessons and exam on the main timetable, with a task sitting on a lesson ----
    b, ctx, pg = launch(p, mobile=False)
    pg.clock.set_fixed_time(FIX_TIME); pg.evaluate(CLASSES)
    pg.evaluate("S.settings.tt.mode='plan'; S.settings.tt.view='week'; U.ttDate=new Date(); render()"); pg.wait_for_timeout(300)
    assert pg.locator('.blk.lsn').count() >= 20, 'lessons are drawn on the main timetable'
    n0 = pg.evaluate("S.tasks.length")
    lid = pg.evaluate("(()=>{const d=new Date(), x=scDayLessons(d).find(x=>x.p.start==='09:55'); return x.l.id})()")
    pg.evaluate(f"S.tasks.push(newTask({{id:'on',title:'Bring the compass',due:todayStr(),lessonId:'{lid}'}})); save(); render()"); pg.wait_for_timeout(300)
    hosted = pg.evaluate("ttItems(new Date()).items.filter(i=>i.k==='lesson'&&(i.tasks||[]).some(t=>t.id==='on')).length")
    assert hosted == 1, 'a task that belongs to a lesson sits on that lesson'
    assert 'Bring the compass' in pg.inner_text('#main'), 'and shows on the timetable'
    pg.locator('.blk.lsn').first.click(); pg.wait_for_selector('.mbox'); assert pg.locator('.mbox').is_visible(); pg.keyboard.press('Escape')
    assert pg.evaluate("S.tasks.find(t=>t.kind==='exam').title") == 'Chapter 4 test' and pg.evaluate("S.school.filter(r=>r.k==='exam').length") == 0, 'exams are tasks'
    assert not pg.errs, pg.errs; b.close()

    # ---- encryption: turn it on, reload to the lock screen, a wrong passphrase is refused, the right one opens the app ----
    b, ctx, pg = launch(p, mobile=True, w=390, h=800)
    pg.evaluate("S.tasks.push(newTask({id:'secret',title:'Top secret errand'})); save(); flush()")
    pg.evaluate("openSettings()"); pg.wait_for_timeout(300)
    pg.click('[data-m=vault]'); pg.wait_for_selector('[data-v=setup]'); pg.click('[data-v=setup]'); pg.wait_for_selector('#vk-1'); pg.wait_for_timeout(300)
    pg.fill('#vk-1', PASS); pg.fill('#vk-2', PASS); pg.check('#vk-ack'); pg.click('#vk-go')
    pg.wait_for_selector('.vk-key', timeout=90000); key = pg.inner_text('.vk-key'); assert len(key.replace('-', '').replace(' ', '')) >= 20, 'a recovery key is shown'
    pg.check('#vk-ok'); pg.click('#vk-done'); pg.wait_for_selector('.vk-stat'); pg.wait_for_timeout(300)
    pg.evaluate("closeModal()"); pg.wait_for_timeout(1200)  # the encrypted copy is written asynchronously
    raw = pg.evaluate("Object.keys(localStorage).map(k=>localStorage.getItem(k)).join('|')")
    assert 'Top secret errand' not in raw, 'the data is not readable in storage any more'
    pg.reload(); pg.wait_for_selector('#lock'); assert pg.locator('#main').inner_text().strip() == '' or 'Top secret errand' not in pg.content()
    pg.fill('#lk-i', 'wrong passphrase!!'); pg.press('#lk-i', 'Enter'); pg.wait_for_function("document.querySelector('#lk-e') && document.querySelector('#lk-e').textContent.length>0", timeout=60000)
    assert pg.locator('#lock').count() == 1, 'a wrong passphrase does not open the app'
    pg.fill('#lk-i', PASS); pg.press('#lk-i', 'Enter'); pg.wait_for_selector('#lock', state='detached', timeout=60000); pg.wait_for_timeout(400)
    assert pg.evaluate("S.tasks.some(t=>t.id==='secret')"), 'the right passphrase brings everything back'
    assert pg.locator('.encb').count() >= 1, 'the cloud icon carries the padlock while encryption is on'
    assert not pg.errs, pg.errs; b.close()
print('0.4 browser tests passed')
