"""Advanced fields in a real browser (src/js/xfform.js, xfedit.js): the entry editor updates as you type (conditions, formulas, messages), required and limits
stop a save and say why, multi-select search, groups, templates, and the section editor (details, conditions, formula preview, groups, templates), also on a phone."""
from lib import *
import json

SECTION = """(() => {
  const s = xsNormalise({ id: 'x-bt', name: 'Books', title: 'Title', view: 'cards', color: '#8e5cf7',
    fgroups: [{ id: 'info', name: 'Book information', desc: 'What it is' }, { id: 'prog', name: 'Reading progress' }],
    fields: [
      { id: 'author', name: 'Author', type: 'text', fg: 'info', ph: 'Who wrote it', desc: 'As on the cover' },
      { id: 'status', name: 'Status', type: 'select', opts: ['To read', 'Reading', 'Finished'], def: 'To read', req: true, fg: 'prog' },
      { id: 'total', name: 'Total pages', type: 'number', min: 1, int: true, fg: 'prog', fmt: { unit: 'pages' } },
      { id: 'read', name: 'Pages read', type: 'number', min: 0, int: true, fg: 'prog' },
      { id: 'pct', name: 'Percentage done', type: 'calculated', formula: 'min(100, round(100 * [read] / [total], 1))', fmt: { style: 'percent', dec: 1, bar: true }, fg: 'prog' },
      { id: 'fin', name: 'Date finished', type: 'date', when: { field: 'status', equals: 'Finished' }, fg: 'prog' },
      { id: 'genres', name: 'Genres', type: 'multiselect', opts: ['Fiction', 'Science', 'History', 'Poetry', 'Travel', 'Biography', 'Art', 'Music', 'Cooking', 'Sport'], max: 2 },
      { id: 'link', name: 'Link', type: 'url' }],
    tpls: [{ id: 'ebook', name: 'Ebook', desc: 'On a device', title: 'New ebook', vals: { status: 'Reading', genres: ['Fiction'] } }] });
  S.csections.push(s); U.page = s.id; render(); return s.id; })()"""

def vis(pg, sel): return pg.locator(sel).first.is_visible()
def msg(pg, fid): return pg.locator(f'#xe-{fid}').inner_text() if pg.locator(f'#xe-{fid}').is_visible() else ''
def overflow(pg, sel): return pg.evaluate("s => { const e = document.querySelector(s); return e.scrollWidth - e.clientWidth }", sel)

with sync_playwright() as p:
    b, ctx, pg = launch(p)
    pg.evaluate(SECTION)
    pg.evaluate("xsEditEntry(xsById('x-bt'), null)"); pg.wait_for_selector('#modal.on .xs-form')

    # 1. the form: groups with headings, help text, required mark, the calculated field is read-only, the conditional field is hidden
    legends = pg.locator('.xs-fg > legend').all_text_contents()
    assert legends == ['Book information', 'Reading progress'], legends
    assert pg.locator('.xs-fg').first.inner_text().count('What it is') == 1
    assert pg.get_by_label('Author').get_attribute('placeholder') == 'Who wrote it'
    assert 'As on the cover' in pg.inner_text('#xd-author')
    assert pg.get_by_label('Author').get_attribute('aria-describedby') == 'xd-author xe-author'
    assert pg.locator('[data-fld="status"] .xs-rq').count() == 1 and pg.locator('[data-fld="status"] select').get_attribute('aria-required') == 'true'
    assert pg.input_value('[data-xv="status"]') == 'To read', 'a new entry starts with the default'
    assert pg.locator('[data-xv="pct"]').count() == 0 and pg.locator('[data-xc="pct"]').count() == 1, 'a calculated field has no input'
    assert not vis(pg, '[data-fld="fin"]'), 'Date finished waits for Status = Finished'
    assert pg.locator('[data-xv="total"]').get_attribute('min') == '1'

    # 2. shown when: appears the moment the choice is made, goes away again, and keeps what was typed
    pg.select_option('[data-xv="status"]', 'Finished'); assert vis(pg, '[data-fld="fin"]'), 'shown at once'
    pg.fill('[data-xv="fin"]', '2026-03-04')
    pg.select_option('[data-xv="status"]', 'Reading'); assert not vis(pg, '[data-fld="fin"]')
    pg.select_option('[data-xv="status"]', 'Finished'); assert pg.input_value('[data-xv="fin"]') == '2026-03-04', 'a hidden field keeps its value'
    pg.select_option('[data-xv="status"]', 'Reading')
    # a group box whose fields are all hidden goes away with them
    pg.evaluate("(() => { const s = xsById('x-bt'); s.fields.find(f => f.id === 'fin').fg = 'extra'; s.fgroups.push({ id: 'extra', name: 'When done' }); })()")
    pg.evaluate("closeModal(); xsEditEntry(xsById('x-bt'), null)"); pg.wait_for_selector('#modal.on .xs-form')
    assert not vis(pg, '[data-fgrp="extra"]'), 'a group with nothing to show is not shown'
    pg.select_option('[data-xv="status"]', 'Finished'); assert vis(pg, '[data-fgrp="extra"]') and vis(pg, '[data-fld="fin"]')
    pg.select_option('[data-xv="status"]', 'Reading'); assert not vis(pg, '[data-fgrp="extra"]')
    pg.evaluate("(() => { const s = xsById('x-bt'); s.fields.find(f => f.id === 'fin').fg = 'prog'; s.fgroups = s.fgroups.filter(g => g.id !== 'extra'); closeModal(); xsEditEntry(s, null); })()"); pg.wait_for_selector('#modal.on .xs-form')

    # 3. calculated: follows the typing; an empty input gives an empty answer, a bad one an error on the field, never a crash
    assert '—' in pg.inner_text('[data-xc="pct"]')
    pg.fill('[data-xv="total"]', '300'); assert '—' in pg.inner_text('[data-xc="pct"]'), 'one input missing: empty, not 0'
    pg.fill('[data-xv="read"]', '120'); assert '40.0%' in pg.inner_text('[data-xc="pct"]'), pg.inner_text('[data-xc="pct"]')
    assert pg.locator('[data-xc="pct"] .xs-pb').count() == 1 and pg.get_attribute('[data-xc="pct"] .xs-pb', 'aria-valuenow') == '40', 'a progress bar'
    pg.fill('[data-xv="read"]', '999'); assert '100.0%' in pg.inner_text('[data-xc="pct"]'), 'capped by the formula'
    pg.fill('[data-xv="total"]', '0'); assert 'Division by zero' in pg.inner_text('[data-xc="pct"]')
    pg.fill('[data-xv="total"]', '300'); pg.fill('[data-xv="read"]', '120')

    # 4. messages: nothing is said about a field until a person has been there; then the rule and the field are named, and they follow the typing
    assert msg(pg, 'link') == '' and msg(pg, 'genres') == ''
    pg.fill('[data-xv="link"]', 'not a web address'); assert msg(pg, 'link') == '', 'still typing in a field for the first time: no message yet'
    pg.focus('[data-xv="author"]'); assert 'web address' in msg(pg, 'link'), msg(pg, 'link')
    assert pg.get_attribute('[data-xv="link"]', 'aria-invalid') == 'true'
    pg.fill('[data-xv="link"]', 'example.com'); assert msg(pg, 'link') == '' and pg.get_attribute('[data-xv="link"]', 'aria-invalid') is None, 'the message goes as soon as the value is right'
    pg.fill('[data-xv="total"]', '-5'); assert 'at least 1' in msg(pg, 'total'), 'a field already visited is checked as you type: ' + msg(pg, 'total')
    pg.fill('[data-xv="total"]', '2.5'); assert 'whole number' in msg(pg, 'total')
    pg.fill('[data-xv="total"]', '300'); assert msg(pg, 'total') == ''

    # 5. multi-select: its own search, a count, a limit
    assert pg.locator('[data-xms="genres"]').count() == 1, 'more than eight options: a search box'
    pg.fill('[data-xms="genres"]', 'sci'); assert pg.locator('[data-xm="genres"] label:visible').count() == 1
    pg.fill('[data-xms="genres"]', ''); assert pg.locator('[data-xm="genres"] label:visible').count() == 10
    pg.check('[data-xmv="genres"][value="Fiction"]', force=True); pg.check('[data-xmv="genres"][value="Art"]', force=True)
    assert '2 selected' in pg.inner_text('[data-xmc="genres"]')
    pg.check('[data-xmv="genres"][value="Music"]', force=True); assert 'at most 2' in msg(pg, 'genres'), msg(pg, 'genres')
    pg.uncheck('[data-xmv="genres"][value="Music"]', force=True); assert msg(pg, 'genres') == ''

    # 6. save is stopped by a rule, says which, and keeps the form open with the first problem in focus
    pg.fill('[data-xv="link"]', 'not a web address'); pg.select_option('[data-xv="status"]', '')
    pg.click('[data-m=save]'); pg.wait_for_timeout(150)
    assert pg.evaluate("!!document.querySelector('#modal.on .xs-form')"), 'the form stays open'
    assert 'required' in msg(pg, 'status') and 'web address' in msg(pg, 'link'), 'every problem is shown, not only the first'
    assert pg.evaluate("document.activeElement && document.activeElement.dataset.xv") == 'status', 'the first problem has the focus'
    assert pg.evaluate("S.centries.filter(e => e.sid === 'x-bt').length") == 0
    pg.select_option('[data-xv="status"]', 'Reading'); pg.fill('[data-xv="link"]', 'example.com')

    # 7. a template fills what is empty and never what was typed
    pg.fill('[data-k=title]', 'My own title'); pg.select_option('[data-xv="status"]', 'To read')
    pg.select_option('[data-xtpl]', 'ebook'); pg.wait_for_timeout(100)
    assert pg.input_value('[data-k=title]') == 'My own title', 'a typed title is kept'
    assert pg.input_value('[data-xv="status"]') == 'Reading', 'a field that still had its starting value takes the template’s'
    assert pg.input_value('[data-xv="total"]') == '300', 'what was typed stays'
    assert pg.locator('[data-xmv="genres"]:checked').count() == 2, 'chosen genres stay (Fiction, Art), the template does not add to what is there'
    assert pg.input_value('[data-xtpl]') == '', 'the picker is ready for next time'

    # 8. save: the entry holds what was typed, nothing calculated, and the hidden value that was typed earlier
    pg.select_option('[data-xv="status"]', 'Finished'); pg.fill('[data-xv="fin"]', '2026-05-06'); pg.select_option('[data-xv="status"]', 'Reading')
    pg.click('[data-m=save]'); pg.wait_for_timeout(200)
    assert not pg.evaluate("!!document.querySelector('#modal.on')"), 'saved'
    e = pg.evaluate("S.centries.filter(e => e.sid === 'x-bt')[0]")
    assert e['title'] == 'My own title' and e['vals']['total'] == 300 and e['vals']['read'] == 120 and e['vals']['status'] == 'Reading' and e['vals']['link'] == 'example.com', e
    assert 'pct' not in e['vals'], 'a calculated value is not stored'
    assert e['vals']['fin'] == '2026-05-06', 'a hidden field keeps its value'
    assert sorted(e['vals']['genres']) == ['Art', 'Fiction']
    page = pg.inner_text('#xs-list'); assert '40.0%' in page and 'My own title' in page and '2026' not in page, 'the page shows the result, and not the hidden date: ' + page
    assert pg.locator('.xs-pb').count() >= 1

    # 9. editing it again shows its values, the calculated one included
    pg.click('[data-act=xsedit]'); pg.wait_for_selector('#modal.on .xs-form')
    assert pg.input_value('[data-xv="total"]') == '300' and '40.0%' in pg.inner_text('[data-xc="pct"]') and not vis(pg, '[data-fld="fin"]')
    pg.click('[data-m=no]')

    # 10. an entry that breaks a rule (it came from another device) is flagged on the page, never changed
    pg.evaluate("S.centries.push(xeNormalise({ id: 'e-bad', sid: 'x-bt', title: 'From elsewhere', vals: { total: -3 }, created: 1 })); renderMain()")
    assert pg.locator('.xs-warn').count() == 1 and 'at least 1' in pg.get_attribute('.xs-warn', 'title')
    assert pg.evaluate("xsById('x-bt') && S.centries.find(e => e.id === 'e-bad').vals.total") == -3
    pg.click('.xs-attn'); assert pg.locator('.xs-card').count() == 1, 'only the entry that needs attention'; pg.click('.xs-attn'); assert pg.locator('.xs-card').count() == 2
    pg.evaluate("S.centries = S.centries.filter(e => e.id !== 'e-bad'); renderMain()")

    # 11. the section editor: details of a field, a condition, a group, a template, the formula preview
    pg.evaluate("xsEditSection(xsById('x-bt'))"); pg.wait_for_selector('#modal.on #xs-fields')
    pg.click('[data-fr="0"] [data-m="fdet"]'); pg.wait_for_selector('[data-fx="author"]')
    assert pg.get_attribute('[data-fr="0"] [data-m="fdet"]', 'aria-expanded') == 'true'
    pg.fill('[data-fx="author"] [data-fd="desc"]', 'Full name'); pg.check('[data-fx="author"] [data-fd="req"]')
    pg.click('[data-fx="author"] [data-m="wadd"]'); pg.wait_for_selector('[data-fx="author"] [data-wr]')
    pg.select_option('[data-fx="author"] [data-wf]', 'status'); pg.wait_for_timeout(50); pg.select_option('[data-fx="author"] [data-wo]', 'notEquals'); pg.wait_for_timeout(50)
    pg.select_option('[data-fx="author"] [data-wv]', 'To read')
    pg.click('[data-fr="4"] [data-m="fdet"]'); pg.wait_for_selector('[data-fx="pct"] [data-fd="formula"]')
    assert pg.input_value('[data-fx="pct"] [data-fd="formula"]') == 'min(100, round(100 * [Pages read] / [Total pages], 1))', 'a person sees names, not ids'
    assert 'With nothing filled in' in pg.inner_text('[data-xfpv]') or 'For' in pg.inner_text('[data-xfpv]')
    pg.fill('[data-fx="pct"] [data-fd="formula"]', '[Pages read] +'); assert 'bad' in pg.get_attribute('[data-xfpv]', 'class') and pg.inner_text('[data-xfpv]').strip() != ''
    pg.select_option('[data-fx="pct"] [data-xfins]', 'total'); assert '[Total pages]' in pg.input_value('[data-fx="pct"] [data-fd="formula"]'), 'insert a field at the cursor'
    pg.fill('[data-fx="pct"] [data-fd="formula"]', '[Pages read] * 2'); assert 'ok' in pg.get_attribute('[data-xfpv]', 'class'), pg.inner_text('[data-xfpv]')
    assert '240' in pg.inner_text('[data-xfpv]'), 'a live preview with the first entry: ' + pg.inner_text('[data-xfpv]')
    # a formula that does not work stops the save and says where
    pg.fill('[data-fx="pct"] [data-fd="formula"]', '[Nope] + 1'); pg.click('[data-m=save]'); pg.wait_for_timeout(100)
    assert pg.evaluate("!!document.querySelector('#xs-fields')"), 'the editor stays open'
    assert pg.evaluate("xsById('x-bt').fields.find(f => f.id === 'pct').formula").startswith('min(100'), 'nothing was saved'
    pg.fill('[data-fx="pct"] [data-fd="formula"]', '[Pages read] * 2')
    # a group and a template
    pg.click('[data-m="gadd"]'); pg.fill('[data-gr="2"] [data-gn]', 'Extras'); pg.click('[data-m="tadd"]'); pg.wait_for_selector('[data-tr="1"] [data-tn]'); pg.fill('[data-tr="1"] [data-tn]', 'Paperback'); pg.fill('[data-tr="1"] [data-tt]', 'Paperback: ')
    pg.fill('[data-tr="1"] [data-tx] [data-tv="total"]', '350')
    pg.click('[data-m=save]'); pg.wait_for_timeout(250)
    assert not pg.evaluate("!!document.querySelector('#modal.on')"), 'saved'
    sec = pg.evaluate("xsById('x-bt')"); f = {x['id']: x for x in sec['fields']}
    assert f['author']['desc'] == 'Full name' and f['author']['req'] is True and f['author']['when'] == {'field': 'status', 'notEquals': 'To read'}, f['author']
    assert f['pct']['formula'] == '[read] * 2', 'stored with ids: ' + f['pct']['formula']
    assert [g['name'] for g in sec['fgroups']] == ['Book information', 'Reading progress', 'Extras'] and len(sec['tpls']) == 2 and sec['tpls'][1]['vals'] == {'total': 350} and sec['tpls'][1]['title'] == 'Paperback:'
    assert f['total']['min'] == 1 and f['total']['int'] is True and f['total']['fmt'] == {'unit': 'pages'}, 'what was not opened is untouched'

    # removing all groups and all templates leaves a section with none (nothing old is kept behind)
    pg.evaluate("xsEditSection(xsById('x-bt'))"); pg.wait_for_selector('#xs-fields')
    while pg.locator('[data-m="grm"]').count(): pg.click('[data-m="grm"]')
    while pg.locator('[data-m="trm"]').count(): pg.click('[data-m="trm"]')
    pg.click('[data-m=save]'); pg.wait_for_timeout(250)
    sec = pg.evaluate("xsById('x-bt')"); assert 'fgroups' not in sec and 'tpls' not in sec, (sec.get('fgroups'), sec.get('tpls'))
    assert all('fg' not in f for f in sec['fields']), 'and no field is left pointing at a group'

    # 12. turning a field with values into a calculated one: asked first, and the values go
    pg.evaluate("S.centries.push(xeNormalise({ id: 'e-l', sid: 'x-bt', title: 'L', vals: { link: 'a.com', total: 10 }, created: 2 }))")
    pg.evaluate("xsEditSection(xsById('x-bt'))"); pg.wait_for_selector('#xs-fields')
    pg.select_option('[data-fr="7"] [data-ft]', 'calculated'); pg.wait_for_timeout(50)
    pg.click('[data-fr="7"] [data-m="fdet"]'); pg.fill('[data-fr="7"] [data-fd="formula"]', '[Total pages] / 2')
    pg.click('[data-m=save]'); pg.wait_for_selector('[data-m=ok]'); assert 'now calculated' in pg.inner_text('#modal'), pg.inner_text('#modal')
    pg.click('[data-m=ok]'); pg.wait_for_timeout(200)
    assert pg.evaluate("S.centries.find(e => e.id === 'e-l').vals.link") is None and pg.evaluate("xsById('x-bt').fields.find(f => f.id === 'link').type") == 'calculated'
    assert pg.evaluate("xfdState(xsById('x-bt'), S.centries.find(e => e.id === 'e-l').vals).calc.link.v") == 5

    # 13. a phone: the form and the editor fit the screen
    b2, ctx2, pm = launch(p, mobile=True, w=360, h=740); pm.evaluate(SECTION)
    pm.evaluate("xsEditEntry(xsById('x-bt'), null)"); pm.wait_for_selector('#modal.on .xs-form'); pm.select_option('[data-xv="status"]', 'Finished')
    assert overflow(pm, '#modal .mbox') <= 1 and overflow(pm, '#modal .xs-form') <= 1, ('entry form overflows', overflow(pm, '#modal .mbox'))
    pm.click('[data-m=no]'); pm.evaluate("xsEditSection(xsById('x-bt'))"); pm.wait_for_selector('#xs-fields')
    pm.click('[data-fr="0"] [data-m="fdet"]'); pm.click('[data-fx="author"] [data-m="wadd"]'); pm.click('[data-fr="4"] [data-m="fdet"]')
    assert overflow(pm, '#modal .mbox') <= 1, ('section editor overflows', overflow(pm, '#modal .mbox'))
    assert pm.evaluate("(() => { const w = document.querySelector('[data-wr]'); return w.scrollWidth - w.clientWidth })()") <= 1
    assert pm.errs == [], pm.errs
    b2.close()

    assert pg.errs == [], pg.errs
    b.close()
print('advanced fields in a real browser: OK')
