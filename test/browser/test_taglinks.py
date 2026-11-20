"""0.9.0: linking by tags, in the real UI (desktop and phone): the task panel, a note's details, a person's profile, the
"Everything tagged" dialog, tags on lists and projects, and the live ![[tag:x]] list inside a note."""
from lib import *

AUDIT = """(root) => { const vw = document.documentElement.clientWidth, out = [];
  const R = document.querySelector(root); if (!R) return ['missing ' + root];
  const lim = Math.min(vw, R.getBoundingClientRect().right) + 1;
  for (const e of R.querySelectorAll('*')) { const s = getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || s.display === 'none' || e.closest('[hidden]') || e.closest('svg') || e.closest('.ne-tool')) continue; // (the formatting toolbar scrolls sideways on purpose)
    if (r.right > lim || r.left < -1) out.push(`${e.tagName}.${String(e.className || '').slice(0, 24)} ${Math.round(r.left)}..${Math.round(r.right)} (screen ${vw})`); }
  for (const sc of [R, ...R.querySelectorAll('.dbody, .mbox')]) if (sc.scrollWidth > sc.clientWidth + 1) out.push(`${sc.className || sc.tagName} is ${sc.scrollWidth}px wide in a ${sc.clientWidth}px box`);
  return out; }"""

SETUP = """(() => {
  S.lists.push({ id: 'lw', name: 'Website relaunch with a rather long list name', color: '#34b36b', sections: [], tags: ['anna'] });
  S.projects.push({ id: 'pr1', name: 'Relaunch', color: '#4772fa', listIds: ['lw'], tags: ['anna'] });
  const a = newTask({ title: 'Send Anna the quote', tags: ['anna', 'finance'], due: todayStr(), listId: 'lw' }), b = newTask({ title: 'Book the venue for the quarterly all-hands meeting', tags: ['anna'] }), c = newTask({ title: 'Unrelated', tags: ['other'] });
  S.tasks.push(a, b, c);
  const n = newNote({ title: 'Meeting with Anna', body: 'hello', tags: ['anna'] }); S.notes.push(n);
  S.contacts.push(ctNormalise({ id: 'ct1', name: 'Anna Smith', tags: ['anna'], created: 1 }));
  S.countdowns.push(cdNormalise({ id: 'cd1', name: 'Anna birthday', date: ymd(addDays(new Date(), 20)), tags: ['anna'] }));
  flush(); return { a: a.id, b: b.id, c: c.id, n: n.id }; })()"""

with sync_playwright() as p:
    for mobile in (False, True):
        tag = 'phone' if mobile else 'desktop'
        b, ctx, pg = launch(p, mobile=mobile, w=360 if mobile else 1280, h=740 if mobile else 850)
        ids = pg.evaluate(SETUP)
        # ---- the task panel ----
        pg.evaluate(f"U.page='tasks'; U.nav='today'; U.sel='{ids['a']}'; render()"); pg.wait_for_timeout(250)
        panel = pg.inner_text('#detail')
        assert 'Linked by tags' in panel, (tag, 'no block in the task panel')
        assert 'Book the venue' in panel and 'Meeting with Anna' in panel and 'Anna Smith' in panel and 'Anna birthday' in panel, (tag, panel[-900:])
        assert 'Unrelated' not in panel, 'a task without the tag is linked'
        bad = pg.evaluate(AUDIT, '#detail'); assert not bad, (tag, 'task panel overflow', bad)
        # a chip opens the thing: a note
        pg.locator('#detail [data-tlk=note]').first.click(); pg.wait_for_timeout(300)
        assert pg.evaluate("U.page") == 'notes' and pg.evaluate("U.noteSel") == ids['n'], (tag, 'the note chip did not open the note')
        # ---- the note's own block: appears once it has tags, and shows the tasks ----
        pg.evaluate("U.nDet = true; render()"); pg.wait_for_timeout(250)
        assert 'Linked by tags' in pg.inner_text('#n-det') or 'Linked by tags' in pg.inner_text('#n-tl'), (tag, 'no block in the note')
        pg.fill('[data-f=ntags]', '#zzz'); pg.press('[data-f=ntags]', 'Tab'); pg.wait_for_timeout(500)
        assert pg.inner_text('#n-tl').strip() == '' or 'Nothing else has #zzz' in pg.inner_text('#n-tl'), (tag, 'the block did not follow the tags field', pg.inner_text('#n-tl'))
        pg.fill('[data-f=ntags]', '#anna'); pg.press('[data-f=ntags]', 'Tab'); pg.wait_for_timeout(500)
        assert 'Send Anna the quote' in pg.inner_text('#n-tl'), (tag, 'tasks missing from the note block')
        bad = pg.evaluate(AUDIT, '#nt-ed'); assert not bad, (tag, 'note editor overflow', bad)
        # ---- "See all": the dialog ----
        pg.locator('#n-tl [data-tlall]').first.click(); pg.wait_for_timeout(300)
        dlg = pg.inner_text('#modal'); assert 'Everything tagged' in dlg and 'Anna Smith' in dlg and 'Relaunch' in dlg, (tag, dlg[:400])
        assert 'Copy' in dlg and '![[tag:anna]]' in dlg
        bad = pg.evaluate(AUDIT, '#modal .mbox'); assert not bad, (tag, 'dialog overflow', bad)
        pg.locator('#modal [data-tlf=task]').click(); pg.wait_for_timeout(150)
        dlg = pg.inner_text('#modal'); assert 'Send Anna the quote' in dlg and 'Anna Smith' not in dlg, (tag, 'the kind filter did not filter')
        pg.locator('#modal [data-tlk=task]').first.click(); pg.wait_for_timeout(300)
        assert pg.evaluate("document.querySelector('#modal').classList.contains('on')") is False and pg.evaluate("U.sel") in (ids['a'], ids['b']), (tag, 'a row did not open its task')
        # ---- a live list inside a note, in the preview ----
        pg.evaluate(f"S.settings.notes.view = 'preview'; S.notes.find(n => n.id === '{ids['n']}').body = 'Everything for Anna:\\n\\n![[tag:anna]]\\n\\nThere are {{{{tag:anna.count}}}} things.'; U.page = 'notes'; U.noteSel = '{ids['n']}'; U.sel = null; render()"); pg.wait_for_timeout(300)
        pv = pg.inner_text('#n-pv'); assert 'Send Anna the quote' in pv and 'Anna Smith' in pv and 'There are 8 things.' in pv or 'There are 7 things.' in pv or 'There are 9 things.' in pv, (tag, pv)
        n_before = pg.evaluate("document.querySelectorAll('#n-pv .emb-tag [data-tlk]').length")
        pg.evaluate("(() => { const t = newTask({ title: 'Added later', tags: ['anna'] }); S.tasks.push(t); save(); notePaint(); })()"); pg.wait_for_timeout(300)
        assert pg.evaluate("document.querySelectorAll('#n-pv .emb-tag [data-tlk]').length") == n_before + 1, (tag, 'the list in the note did not follow a newly tagged task')
        pg.locator('#n-pv .emb-tag [data-tlk=contact]').first.click(); pg.wait_for_timeout(300)
        assert 'Anna Smith' in pg.inner_text('#modal'), (tag, 'the person row did not open the profile')
        # ---- the person's profile lists what shares the tag ----
        prof = pg.inner_text('#modal').lower(); assert 'linked by tags' in prof and 'meeting with anna' in prof and 'website relaunch' in prof, (tag, prof[-700:])
        bad = pg.evaluate(AUDIT, '#modal .mbox'); assert not bad, (tag, 'profile overflow', bad)
        pg.keyboard.press('Escape'); pg.evaluate("closeModal()")
        # ---- lists and projects take tags from their forms ----
        pg.evaluate("openListForm(S.lists.find(l => l.id === 'lw'))"); pg.wait_for_timeout(250)
        assert pg.input_value('#pk-tags') == '#anna', (tag, 'the list form does not show its tags'); assert 'share these tags' in pg.inner_text('#modal'), 'no hint with a link'
        pg.fill('#pk-tags', '#anna #Web  #web'); pg.click('#modal [data-m=save]'); pg.wait_for_timeout(250)
        assert pg.evaluate("JSON.stringify(S.lists.find(l => l.id === 'lw').tags)") == '["anna","web"]', (tag, 'list tags not saved')
        pg.evaluate("openListForm(S.lists.find(l => l.id === 'lw'))"); pg.wait_for_timeout(200); pg.fill('#pk-tags', ''); pg.click('#modal [data-m=save]'); pg.wait_for_timeout(250)
        assert pg.evaluate("'tags' in S.lists.find(l => l.id === 'lw')") is False, 'clearing the field removes the tags'
        pg.evaluate("openProjectForm(S.projects[0])"); pg.wait_for_timeout(250); assert pg.input_value('#pk-tags') == '#anna'
        bad = pg.evaluate(AUDIT, '#modal .mbox'); assert not bad, (tag, 'project form overflow', bad)
        pg.fill('#pk-tags', '#anna #launch'); pg.click('#modal [data-m=save]'); pg.wait_for_timeout(250)
        assert pg.evaluate("JSON.stringify(S.projects[0].tags)") == '["anna","launch"]', (tag, 'project tags not saved')
        # ---- the tag page has a button for everything ----
        pg.evaluate("setNav('tag:anna')"); pg.wait_for_timeout(250)
        pg.locator('#main [data-tlall=anna]').click(); pg.wait_for_timeout(250); assert 'Everything tagged' in pg.inner_text('#modal'); pg.evaluate("closeModal()")
        # ---- the picker (toolbar / slash menu) ----
        pg.evaluate(f"S.settings.notes.view = 'write'; U.page = 'notes'; U.noteSel = '{ids['n']}'; render()"); pg.wait_for_timeout(250)
        pg.evaluate("tagRefInsert(document.querySelector('#n-ta'))"); pg.wait_for_timeout(250)
        bad = pg.evaluate(AUDIT, '#modal .mbox'); assert not bad, (tag, 'tag picker overflow', bad)
        pg.fill('#tg-q', 'ann'); pg.wait_for_timeout(100); pg.locator('#tg-l [data-tg=anna]').click(); pg.wait_for_timeout(150)
        assert '![[tag:anna]]' in pg.inner_text('#tg-2'), (tag, 'preview source missing')
        pg.locator('[data-tgas=count]').click(); pg.wait_for_timeout(100); assert '{{tag:anna.count}}' in pg.inner_text('#tg-2')
        pg.locator('[data-tgas=embed]').click(); pg.select_option('[data-tgk=kind]', 'task'); pg.wait_for_timeout(100); assert '![[tag:anna.tasks]]' in pg.inner_text('#tg-2')
        pg.click('#tg-ok'); pg.wait_for_timeout(250); assert '![[tag:anna.tasks]]' in pg.input_value('#n-ta'), (tag, 'not inserted into the note')
        assert not pg.errs, pg.errs
        b.close()
print('tag linking passed in the real UI (desktop and phone): task panel, note block, dialog, live list in a note, profile, list and project forms, tag page, picker')
