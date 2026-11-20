"""0.9: selecting several notes / contacts / habits / countdowns and editing them together, in the real UI (desktop and phone).
The header button starts selecting, a click picks instead of opening, Ctrl+click starts it, All / Esc work, the Edit sheet changes only what
is touched, Delete asks, and everything can be undone from the message afterwards."""
from lib import *

SETUP = """(() => {
  S.lists.push({ id: 'lb', name: 'Batch list', color: '#4772fa', sections: [] });
  S.notes = ['Alpha note', 'Beta note', 'Gamma note'].map((t, i) => newNote({ title: t, body: 'Body ' + i, tags: i === 0 ? ['old'] : [] }));
  S.contacts = ['Ann', 'Ben'].map(n => ctNormalise({ id: 'c-' + n, name: n, created: Date.now() }));
  S.habits = ['Read', 'Run'].map((n, i) => ({ id: 'h' + i, name: n, icon: '📚', color: '#4772fa', goal: { per: 'week', n: 3 }, created: todayStr(), log: {} }));
  S.countdowns = ['Trip', 'Exam'].map((n, i) => cdNormalise({ id: 'cd' + i, title: n, date: ymd(addDays(new Date(), 30 + i)), color: '#e5484d' }));
  flush(); return null; })()"""

def go(pg, page):
    pg.evaluate(f"U.page='{page}'; render()"); pg.wait_for_timeout(300)

def run(mobile, w):
    with sync_playwright() as p:
        b, ctx, pg = launch(p, mobile=mobile, w=w, h=780 if mobile else 850)
        pg.evaluate(SETUP)
        tap = (lambda s: pg.tap(s)) if mobile else (lambda s: pg.click(s))
        # ---- notes ----
        go(pg, 'notes')
        tap('#main [data-act=b2start]'); pg.wait_for_timeout(250)
        assert pg.evaluate("!!U.b2 && U.b2.kind === 'note'") and pg.evaluate("document.body.classList.contains('batch')")
        bar = pg.locator('#bbar').bounding_box(); assert bar['x'] >= 0 and bar['x'] + bar['width'] <= w + 1, ('the bar fits the screen', bar)
        assert 'Tap notes to select' in pg.inner_text('#bbar') and pg.locator('#bbar [data-act=b2edit]').is_disabled(), 'nothing picked yet'
        rows = pg.locator('#nt-items .nti[data-id]'); assert rows.count() == 3, rows.count()
        open_before = pg.evaluate("U.noteSel")  # (a wide screen has a note open already)
        tap('#nt-items .nti[data-id] >> nth=0'); tap('#nt-items .nti[data-id] >> nth=1'); pg.wait_for_timeout(200)
        assert pg.evaluate("U.b2.ids.size") == 2 and pg.evaluate("U.noteSel") == open_before, ('a tap picks, it does not open the note', open_before, pg.evaluate("U.noteSel"))
        assert '2 selected' in pg.inner_text('#bbar') and pg.locator('#nt-items .nti.picked').count() == 2
        tap('#nt-items .nti[data-id] >> nth=1'); assert pg.evaluate("U.b2.ids.size") == 1, 'a second tap unpicks'
        tap('#bbar [data-act=b2all]'); assert pg.evaluate("U.b2.ids.size") == 3, 'All picks every note shown'
        tap('#bbar [data-act=b2all]'); assert pg.evaluate("U.b2.ids.size") == 0, 'All again clears'
        tap('#bbar [data-act=b2all]')
        tap('#bbar [data-act=b2edit]'); pg.wait_for_timeout(300)
        sheet = pg.inner_text('#modal'); assert 'Edit 3 notes' in sheet and 'Only the fields you change' in sheet and 'Tags' in sheet and 'Pin' in sheet, sheet
        assert pg.locator('#b-ok').is_disabled(), 'nothing to apply until a field is touched'
        pg.fill('#modal [data-bk=addtags]', '#team, #Urgent'); pg.wait_for_timeout(100)
        pg.click('#modal .bseg [data-bv="1"]')
        assert '2 fields to change' in pg.inner_text('#modal'), pg.inner_text('#modal')
        pg.click('#modal [data-bk=deltag][data-bv=old]'); pg.wait_for_timeout(100)
        pg.click('#b-ok'); pg.wait_for_timeout(350)
        got = pg.evaluate("S.notes.map(n => [n.title, n.tags.slice().sort().join(','), !!n.pinned])")
        assert got == [['Alpha note', 'team,urgent', True], ['Beta note', 'team,urgent', True], ['Gamma note', 'team,urgent', True]], got
        assert pg.evaluate("U.b2") is None and not pg.evaluate("document.body.classList.contains('batch')"), 'selecting ends after Apply'
        assert 'Updated 3 notes' in pg.inner_text('#toast'), pg.inner_text('#toast')
        pg.click('#toast button'); pg.wait_for_timeout(300)
        got = pg.evaluate("S.notes.map(n => [n.tags.join(','), !!n.pinned])"); assert got == [['old', False], ['', False], ['', False]], ('Undo restores every field', got)
        # Escape leaves, Ctrl+click starts
        tap('#main [data-act=b2start]'); pg.wait_for_timeout(150); pg.keyboard.press('Escape'); pg.wait_for_timeout(200); assert pg.evaluate('U.b2') is None
        if not mobile:
            pg.click('#nt-items .nti[data-id] >> nth=2', modifiers=['Control']); pg.wait_for_timeout(200)
            assert pg.evaluate("U.b2 && U.b2.ids.size") == 1, 'Ctrl+click starts selecting with that note picked'
            pg.click('#nt-items .nti[data-id] >> nth=0', modifiers=['Shift']); pg.wait_for_timeout(200)
            assert pg.evaluate("U.b2.ids.size") == 3, 'Shift+click picks the range'
            pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        # delete: asks, deletes, undoes (and a deleted note is also gone from what linked to it)
        tap('#main [data-act=b2start]'); pg.wait_for_timeout(150); tap('#nt-items .nti[data-id] >> nth=0'); tap('#bbar [data-act=b2del]'); pg.wait_for_timeout(300)
        assert 'Delete 1 note' in pg.inner_text('#modal'); pg.click('#modal [data-m=ok]'); pg.wait_for_timeout(350)
        assert pg.evaluate("S.notes.length") == 2, 'deleted'
        pg.click('#toast button'); pg.wait_for_timeout(300); assert pg.evaluate("S.notes.length") == 3, 'Undo brings it back'
        # ---- contacts: favourite + colour + tags ----
        go(pg, 'contacts'); tap('#main [data-act=b2start]'); pg.wait_for_timeout(250)
        tap('#bbar [data-act=b2all]'); tap('#bbar [data-act=b2edit]'); pg.wait_for_timeout(300)
        assert 'Edit 2 contacts' in pg.inner_text('#modal') and 'Favourite' in pg.inner_text('#modal')
        pg.click('#modal .bseg [data-bv="1"]'); pg.click('#modal .bcol .cdot >> nth=2'); pg.click('#b-ok'); pg.wait_for_timeout(300)
        got = pg.evaluate("S.contacts.map(c => [!!c.fav, !!c.color])"); assert got == [[True, True], [True, True]], got
        # ---- habits and countdowns: colour (and a list for countdowns) ----
        go(pg, 'habits'); tap('#main [data-act=b2start]'); pg.wait_for_timeout(250)
        tap('#main .habit[data-id] >> nth=0'); pg.wait_for_timeout(150)
        assert pg.evaluate("S.habits[0].log && Object.keys(S.habits[0].log).length") == 0, 'a tap while selecting does not tick the habit'
        tap('#bbar [data-act=b2all]'); tap('#bbar [data-act=b2edit]'); pg.wait_for_timeout(300)
        pg.click('#modal .bcol .cdot >> nth=3'); pg.click('#b-ok'); pg.wait_for_timeout(300)
        cols = pg.evaluate("S.habits.map(h => h.color)"); assert cols[0] == cols[1] and cols[0] != '#4772fa', cols
        go(pg, 'countdowns'); tap('#main [data-act=b2start]'); pg.wait_for_timeout(250)
        tap('#bbar [data-act=b2all]'); tap('#bbar [data-act=b2edit]'); pg.wait_for_timeout(300)
        pg.select_option('#modal select[data-bk=home]', 'l:lb'); pg.click('#b-ok'); pg.wait_for_timeout(300)
        got = pg.evaluate("S.countdowns.map(c => c.listId)"); assert got == ['lb', 'lb'], got
        # leaving the page ends the selection
        tap('#main [data-act=b2start]'); pg.wait_for_timeout(150); go(pg, 'notes'); assert pg.evaluate('U.b2') is None, 'changing page drops the selection'
        assert not pg.errs, pg.errs
        b.close()

run(False, 1280)
run(True, 390)
print('batch selection browser tests passed (notes, contacts, habits, countdowns; desktop and phone)')
