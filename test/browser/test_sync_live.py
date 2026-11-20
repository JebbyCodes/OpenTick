"""0.9.0: a note (or task) that is open while a newer copy arrives from another device is brought up to date where it stands.
Before, the open note stayed on its old text until you left it and came back, and typing in it saved the old text over the new one.
A "remote edit" here is what sync does: merge a newer copy into the data (applyMerged), then afterRemote() redraws."""
from lib import *

# what the other device did, applied the way syncNow applies it
REMOTE = """(fn) => { const r = JSON.parse(JSON.stringify(snapshot())); fn(r); const far = Date.now() + 60000;
  for (const c of ['notes', 'tasks']) for (const o of r[c]) if (o.__touch) { o.u = far; delete o.__touch; }
  applyMerged(mergeData(snapshot(), r)); afterRemote(); }"""

def remote(pg, js):
    pg.evaluate("(js) => { const fn = new Function('r', 'far', js); const r = JSON.parse(JSON.stringify(snapshot())); const far = Date.now() + 60000; fn(r, far); applyMerged(mergeData(snapshot(), r)); afterRemote(); }", js)

SETUP = """(() => { S.settings.notes.view = '%s'; const n = newNote({ title: 'Plan', body: 'old text here', tags: ['a'] }); S.notes = [n]; U.page = 'notes'; U.noteSel = n.id; U.nq = ''; flush(); render(); return n.id; })()"""
NOTE_EDIT = "const n = r.notes[0]; n.body = %s; n.title = %s; n.tags = ['a', 'b']; n.updated = far; n.u = far;"

with sync_playwright() as p:
    for mobile in (False, True):
        b, ctx, pg = launch(p, mobile=mobile, w=390 if mobile else 1280, h=780 if mobile else 800)
        tag = 'phone' if mobile else 'desktop'
        # ---- Preview: nobody is typing ----
        pg.evaluate(SETUP % 'preview'); pg.wait_for_timeout(150)
        assert 'old text here' in pg.inner_text('#n-pv')
        remote(pg, NOTE_EDIT % ("'new text from the other device'", "'Plan v2'"))
        pg.wait_for_timeout(200)
        assert 'new text from the other device' in pg.inner_text('#n-pv'), (tag, 'preview not updated')
        assert pg.input_value('.ne-title') == 'Plan v2', (tag, 'title not updated')
        assert pg.input_value('[data-f=ntags]') == '#a #b'
        # ---- Source mode, cursor in the text: updated in place, and typing carries on from the NEW text ----
        pg.evaluate(SETUP % 'write'); pg.wait_for_timeout(150)
        ta = pg.locator('#n-ta'); ta.click(); pg.keyboard.press('End'); pg.wait_for_timeout(50)
        assert pg.evaluate("document.activeElement.id") == 'n-ta'
        remote(pg, NOTE_EDIT % ("'new text from the other device'", "'Plan'"))
        pg.wait_for_timeout(250)
        assert pg.input_value('#n-ta') == 'new text from the other device', (tag, 'source text not updated while focused')
        assert pg.evaluate("document.activeElement.id") == 'n-ta', 'the cursor stays in the text'
        pg.keyboard.type('!'); pg.wait_for_timeout(300)
        body = pg.evaluate("S.notes[0].body"); assert body.endswith('device!') or body.endswith('!'), body
        assert 'new text' in body, (tag, 'typing wrote the old text back over the new', body)
        # ---- Title field ----
        pg.locator('.ne-title').click(); remote(pg, NOTE_EDIT % ("'new text from the other device!'", "'Renamed elsewhere'")); pg.wait_for_timeout(200)
        assert pg.input_value('.ne-title') == 'Renamed elsewhere', (tag, 'title not updated while focused')
        # ---- Blocks (the default editor): a block is focused ----
        pg.evaluate(SETUP % 'blocks'); pg.wait_for_timeout(250)
        pg.locator('#n-bed .bk-t, #n-bed .bk').first.click(); pg.wait_for_timeout(100)
        remote(pg, NOTE_EDIT % ("'block text from the other device'", "'Plan'")); pg.wait_for_timeout(300)
        txt = pg.inner_text('#n-bed'); val = pg.evaluate("[...document.querySelectorAll('#n-bed textarea')].map(t => t.value).join('|')")
        assert 'block text from the other device' in txt + val, (tag, 'block editor not updated', txt, val)
        pg.keyboard.type('X'); pg.wait_for_timeout(300); body = pg.evaluate("S.notes[0].body"); assert 'block text from the other device' in body, (tag, 'block typing overwrote the new text', body)
        # ---- the note was deleted on the other device while it is open and focused ----
        pg.evaluate(SETUP % 'write'); pg.wait_for_timeout(150); pg.locator('#n-ta').click()
        remote(pg, "r.notes = []; r.tomb[%s] = far;" % repr(pg.evaluate("S.notes[0].id"))); pg.wait_for_timeout(300)
        assert pg.evaluate("U.noteSel") in (None, ''), (tag, 'a deleted note is still open')
        assert pg.locator('#n-ta').count() == 0, (tag, 'the editor of a deleted note is still on screen')
        # ---- a task open in the panel, its title focused ----
        if not mobile:
            tid = pg.evaluate("(() => { const t = newTask({ title: 'Buy milk', notes: 'two litres' }); S.tasks.push(t); U.page = 'tasks'; U.nav = 'list:inbox'; U.sel = t.id; flush(); render(); return t.id; })()"); pg.wait_for_timeout(250)
            pg.locator('#detail .dtitle').click()
            remote(pg, "const t = r.tasks.find(x => x.title === 'Buy milk'); t.title = 'Buy oat milk'; t.notes = 'three litres'; t.u = far;"); pg.wait_for_timeout(250)
            assert pg.input_value('#detail .dtitle') == 'Buy oat milk', 'task title not updated while focused'
            assert 'Buy oat milk' in pg.inner_text('#main'), 'the list behind the panel follows'
            pg.keyboard.type('s'); pg.wait_for_timeout(250); assert pg.evaluate(f"getT('{tid}').title").startswith('Buy oat milk') and 'oat' in pg.evaluate(f"getT('{tid}').title")
            # the wide editor for a task's notes
            pg.evaluate(f"openNoteExpand('{tid}')"); pg.wait_for_timeout(300)
            remote(pg, "const t = r.tasks.find(x => x.title.startsWith('Buy oat milk')); t.notes = 'notes written elsewhere'; t.u = far + 1;"); pg.wait_for_timeout(300)
            got = pg.evaluate("document.querySelector('#x-ta').value + '|' + [...document.querySelectorAll('#x-bed textarea')].map(t => t.value).join('|') + '|' + document.querySelector('#x-pv').textContent")
            assert 'notes written elsewhere' in got, ('wide editor not updated', got)
            pg.keyboard.press('Escape')
        assert not pg.errs, pg.errs
        b.close()
print('live refresh after sync passed (preview, source, blocks, title, deleted note, task panel, wide task notes; desktop and phone)')
