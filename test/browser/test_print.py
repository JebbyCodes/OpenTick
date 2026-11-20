"""0.9: printing, in the real UI. The print button and its dialog, the page that is built for paper (notes, task lists), the grids printed as
they are, and the PDF the browser makes from them (checked with pdftotext / pdfinfo): the right words are on it, the app's own chrome is not,
and a calendar or a week of the timetable fits on one page whatever the size of the window."""
import os, subprocess, tempfile
from lib import *

SETUP = """(() => {
  S.lists.push({ id: 'lp', name: 'Print list', color: '#4772fa', sections: ['Design', 'Launch'] });
  const mk = o => { const t = newTask({ listId: 'lp', ...o }); S.tasks.push(t); return t; };
  mk({ title: 'Loose task', due: todayStr() });
  mk({ title: 'Draft mockups', section: 'Design', due: todayStr(), time: '10:00', priority: 3, tags: ['design'], notes: 'Use the **new** palette', subtasks: [{ id: 'a', title: 'Collect assets', done: false }, { id: 'b', title: 'Pick fonts', done: true }] });
  mk({ title: 'Announce', section: 'Launch' }); mk({ title: 'Old thing', section: 'Launch', status: 'done' });
  S.slots = [{ id: 's1', title: 'Maths lecture', days: [new Date().getDay()], start: '09:00', end: '10:30', color: '#4772fa', loc: 'B12', notes: '', created: 1 }];
  const n = newNote({ title: 'Meeting with Anna', body: '## Agenda\\n\\n- Budget\\n- [ ] Send notes\\n\\n' + 'Lorem ipsum dolor sit amet. '.repeat(40), tags: ['meeting'] }); S.notes.push(n);
  S.notes.push(newNote({ title: 'Second note here', body: 'Short one', tags: [] }));
  flush(); return n.id; })()"""

# what the page does when the browser asks to print: the events build the page, the stub records it
HOOK = """(() => { window.__prints = []; window.print = () => { window.dispatchEvent(new Event('beforeprint')); const r = document.getElementById('printroot');
  window.__prints.push({ cls: document.body.className, root: r ? r.innerText : null, html: r ? r.innerHTML : null }); window.dispatchEvent(new Event('afterprint')); }; })()"""

def pdf_text(pg, name):
    """The page as the printer would see it: print media, the events fired, a real PDF, its words and its page count."""
    pg.evaluate("window.dispatchEvent(new Event('beforeprint'))"); pg.emulate_media(media='print'); pg.wait_for_timeout(250)
    f = os.path.join(tempfile.mkdtemp(), name + '.pdf'); pg.pdf(path=f, prefer_css_page_size=True, print_background=True)
    color = pg.evaluate("(() => { const e = document.querySelector('.pr-tt, .pr-note h1, .top h1'); return e ? getComputedStyle(e).color : null; })()")
    pg.emulate_media(media='screen'); pg.evaluate("window.dispatchEvent(new Event('afterprint'))")
    txt = subprocess.run(['pdftotext', '-layout', f, '-'], capture_output=True, text=True).stdout
    pages = int([l for l in subprocess.run(['pdfinfo', f], capture_output=True, text=True).stdout.split('\n') if l.startswith('Pages')][0].split()[1])
    return txt, pages, color

with sync_playwright() as p:
    b, ctx, pg = launch(p, mobile=False, w=1280, h=850)
    nid = pg.evaluate(SETUP); pg.evaluate(HOOK)
    # ---- a task list: the button, the dialog, the options, the page ----
    pg.evaluate("U.page='tasks'; U.nav='list:lp'; U.q=''; render()"); pg.wait_for_timeout(250)
    pg.locator('#main [data-act=print]').click(); pg.wait_for_timeout(250)
    dlg = pg.inner_text('#modal'); assert 'Print Print list' in dlg and 'Subtasks' in dlg and 'Completed tasks' in dlg, dlg
    assert pg.is_checked('[data-pr=notes]') and pg.is_checked('[data-pr=subs]') and not pg.is_checked('[data-pr=done]')
    pg.click('#modal [data-m=ok]'); pg.wait_for_timeout(400)
    assert len(pg.evaluate("window.__prints")) == 1, 'Print did not call window.print'
    r = pg.evaluate("window.__prints[0]"); assert 'printing' in r['cls'] and 'pr-doc' in r['cls'], r['cls']
    for w in ['Print list', 'Design', 'Launch', 'Loose task', 'Draft mockups', 'Collect assets', 'Pick fonts', 'new palette']: assert w in r['root'], (w, r['root'])
    assert 'Old thing' not in r['root'], 'completed tasks are left out unless asked for'
    assert pg.evaluate("document.body.className.includes('printing') || !!document.getElementById('printroot')") is False, 'the page is put back after printing'
    pg.evaluate("window.__prints = []"); pg.evaluate("ACT.print()"); pg.wait_for_timeout(200)
    pg.uncheck('[data-pr=notes]'); pg.uncheck('[data-pr=subs]'); pg.check('[data-pr=done]'); pg.click('#modal [data-m=ok]'); pg.wait_for_timeout(400)
    r = pg.evaluate("window.__prints[0]"); assert 'Old thing' in r['root'] and 'Collect assets' not in r['root'] and 'new palette' not in r['root'], r['root']
    # the PDF: the words are there, the app's chrome is not, in dark mode too (print is always light), and a list is more than a screenshot
    for theme in ('light', 'dark'):
        pg.evaluate(f"S.settings.theme = '{theme}'; applyTheme()"); pg.evaluate("U.pr = { notes: true, subs: true, done: false }")
        txt, pages, color = pdf_text(pg, 'list_' + theme)
        assert 'Draft mockups' in txt and 'Collect assets' in txt and 'Design' in txt, (theme, txt[:400])
        assert 'Settings' not in txt and 'Quick add' not in txt and 'Inbox' not in txt and 'Add task' not in txt, (theme, 'the sidebar or the add box leaked into the print', txt[:600])
        assert pages == 1 and color == 'rgb(0, 0, 0)', (theme, pages, color)
    # ---- notes: this note, or the whole view ----
    pg.evaluate("S.settings.theme = 'light'; applyTheme()")
    pg.evaluate(f"U.page='notes'; U.noteSel='{nid}'; U.pr = {{ scope: 'this', meta: true }}; render()"); pg.wait_for_timeout(300)
    pg.locator('#main [data-act=print]').first.click(); pg.wait_for_timeout(250)
    dlg = pg.inner_text('#modal'); assert 'This note' in dlg and 'in this view' in dlg, dlg
    pg.evaluate("closeModal()")
    txt, pages, color = pdf_text(pg, 'note')
    assert 'Meeting with Anna' in txt and 'Agenda' in txt and 'Budget' in txt and '#meeting' in txt, txt[:500]
    assert 'Second note here' not in txt and 'Settings' not in txt, ('only the note is printed', txt[:600])
    pg.evaluate(f"U.pr = {{ scope: 'view', meta: true }}")
    txt, pages, color = pdf_text(pg, 'notes_all'); assert 'Meeting with Anna' in txt and 'Second note here' in txt and pages >= 2, (pages, txt[:300])
    # ---- the grids, as they are: on one page, no menus ----
    for h in (850, 1200):
        pg.set_viewport_size({'width': 1280 if h == 850 else 1920, 'height': h}); pg.wait_for_timeout(200)
        for page in ('calendar', 'timetable'):
            pg.evaluate(f"U.page='{page}'; render()"); pg.wait_for_timeout(350)
            txt, pages, color = pdf_text(pg, f'{page}_{h}')
            assert pages == 1, (page, h, 'a calendar or a week of the timetable fits on one page', pages)
            assert 'Settings' not in txt and 'Inbox' not in txt, (page, 'the sidebar leaked into the print', txt[:300])
        assert 'Maths lec' in txt and '9:00' in txt, 'the timetable page lists its slot (the title may be clipped in its narrow column)'
    pg.evaluate("U.page='tasks'; U.nav='inbox'; render()")
    # ---- the event wiring: the grids get their class and lose it again; a page with no button prints as before ----
    pg.evaluate("window.__prints = []; U.page='calendar'; render()"); pg.wait_for_timeout(250)
    pg.locator('#main [data-act=print]').first.click(); pg.wait_for_timeout(350)
    r = pg.evaluate("window.__prints[0]"); assert 'pr-live' in r['cls'] and 'pr-p-calendar' in r['cls'] and r['root'] is None, r
    pg.evaluate("U.page='help'; render()"); pg.wait_for_timeout(200); assert pg.locator('#main [data-act=print]').count() == 0, 'the guide has its own print'
    pg.evaluate("window.dispatchEvent(new Event('beforeprint'))"); assert 'printing' not in pg.evaluate("document.body.className"), 'a page that is not printed here is left alone'
    pg.evaluate("window.dispatchEvent(new Event('afterprint'))")
    assert not pg.errs, pg.errs
    b.close()
print('printing passed in the real UI: dialog and options, notes and lists built for paper, grids on one page, real PDFs checked, nothing of the app chrome on paper')
