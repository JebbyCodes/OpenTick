"""Settings → Keyboard in a real browser: record a key, see the verdict (free, taken, kept by the app), use it, sequences, Esc, remove, restore, and the layout on a phone."""
from lib import *

def rec(pg, aid):  # the "Add / Set" button of an action
    pg.click(f'[data-skrow="{aid}"] [data-ska="rec"]'); pg.wait_for_selector(f'[data-skrec="{aid}"] .sk-recbox')

with sync_playwright() as p:
    b, ctx, pg = launch(p)
    pg.evaluate("openSettings('keys')"); pg.wait_for_selector('#sk-ed .sk-er')
    assert pg.locator('#sk-ed .sk-er').count() > 30, 'every action is listed'
    assert pg.locator('.sk-bad').count() == 0, 'nothing needs attention on a fresh install'

    # 1. record a free key with the keyboard
    rec(pg, 'newtask'); pg.keyboard.press('Control+Shift+K')
    assert 'Ctrl' in pg.inner_text('.sk-pre') and 'K' in pg.inner_text('.sk-pre'), 'the keys pressed are shown'
    pg.wait_for_selector('[data-skver] .sk-vk', timeout=3000)
    assert pg.locator('[data-skver] .sk-bad').count() == 0, pg.inner_text('[data-skver]')
    pg.click('[data-ska="use"]'); pg.wait_for_timeout(200)
    assert pg.evaluate("skKeysOf(skById('newtask'))") == ['Mod+Shift+K'] or pg.evaluate("skKeysOf(skById('newtask')).includes('Mod+Shift+K')"), 'saved'
    assert pg.evaluate("S.shortcuts.length") == 1
    assert pg.locator('[data-skrow="newtask"] .sk-ch').count() >= 1 and 'Default' in pg.inner_text('[data-skrow="newtask"]'), 'shows its default, and a way back'
    assert pg.locator('.sk-recbox').count() == 0, 'the recorder closes'

    # 2. it works on the page
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    assert not pg.evaluate("!!document.querySelector('#modal.on')"), 'Esc closed the settings'
    pg.evaluate("document.activeElement && document.activeElement.blur()")
    pg.keyboard.press('Control+Shift+K'); pg.wait_for_timeout(200)
    assert pg.evaluate("document.activeElement && document.activeElement.id") == 'add', 'the new key focuses the task box'
    pg.evaluate("document.activeElement.blur()")

    # 3. Esc while recording stops the recording only; the window stays
    pg.evaluate("openSettings('keys')"); pg.wait_for_selector('#sk-ed .sk-er'); rec(pg, 'newnote'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    assert pg.locator('.sk-recbox').count() == 0 and pg.evaluate("!!document.querySelector('#modal.on')"), 'Esc cancels the recording, not the window'

    # 4. a key another action has: the conflict is named, and "take it" works
    rec(pg, 'newnote'); pg.keyboard.press('n'); pg.wait_for_selector('[data-skver] .sk-bad', timeout=3000)
    assert 'New task' in pg.inner_text('[data-skver]') and pg.locator('[data-ska="use"]').count() == 1
    pg.click('[data-ska="use"]'); pg.wait_for_timeout(150)
    assert pg.locator('.sk-recbox').count() == 1, 'a conflicting key is not saved by "Use this key"'
    # (n is New task's default key: the default keeps it, so only a free key can be taken; the offer to take it applies to keys the person set)
    pg.click('[data-ska="cancel"]')

    # 5. a key the app keeps for itself is refused, with the reason
    rec(pg, 'newnote'); pg.keyboard.press('Control+B'); pg.wait_for_selector('[data-skver] .sk-bad', timeout=3000)
    t = pg.inner_text('[data-skver]'); assert 'OpenTick keeps' in t and 'Bold' in t, t
    assert pg.locator('[data-ska="replace"]').count() == 0, 'no way to take a key the app needs'
    pg.click('[data-ska="cancel"]')

    # 6. typing it in; a sequence
    rec(pg, 'gotasks'); pg.fill('[data-sktype]', 'g then t'); pg.press('[data-sktype]', 'Enter'); pg.wait_for_selector('[data-skver] .sk-vk', timeout=3000)
    assert 'G' in pg.inner_text('.sk-pre') and 'T' in pg.inner_text('.sk-pre'); pg.click('[data-ska="use"]'); pg.wait_for_timeout(150)
    assert pg.evaluate("skKeysOf(skById('gotasks'))") == ['G T']
    # an invalid text is explained, not saved
    rec(pg, 'gonotes'); pg.fill('[data-sktype]', 'Hyper+Q'); pg.press('[data-sktype]', 'Enter'); pg.wait_for_selector('[data-skver] .sk-bad', timeout=3000)
    assert 'not a key' in pg.inner_text('[data-skver]'); pg.click('[data-ska="cancel"]')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pg.evaluate("U.page = 'calendar'; render()")
    pg.keyboard.press('g'); pg.keyboard.press('t'); pg.wait_for_timeout(250)
    assert pg.evaluate("U.page") == 'tasks', 'g then t goes to Tasks'

    # 7. a key the browser would keep: Alt+Left is the Back button; it is refused in a browser, with the reason
    pg.evaluate("openSettings('keys')"); pg.wait_for_selector('#sk-ed .sk-er'); rec(pg, 'today')
    pg.fill('[data-sktype]', 'Ctrl+T'); pg.press('[data-sktype]', 'Enter'); pg.wait_for_selector('[data-skver] .sk-bad', timeout=3000)
    assert 'browser keeps' in pg.inner_text('[data-skver]'), pg.inner_text('[data-skver]'); pg.click('[data-ska="cancel"]')

    # 8. remove a key and restore the default
    pg.click('[data-skrow="newtask"] [data-ska="reset"]'); pg.wait_for_timeout(150)
    assert pg.evaluate("skKeysOf(skById('newtask'))") == ['n'], 'back to n'
    assert pg.evaluate("S.shortcuts.length") == 1, 'only gotasks is left'
    pg.click('[data-skrow="gotasks"] [data-ska="del"]'); pg.wait_for_timeout(150)
    assert pg.evaluate("skKeysOf(skById('gotasks'))") == [] and pg.evaluate("S.shortcuts.length") == 0, 'removing the only key of an action that has none by default is just the default again'
    pg.click('[data-skrow="newtask"] [data-ska="del"]'); pg.wait_for_timeout(150)
    assert pg.evaluate("skKeysOf(skById('newtask'))") == [] and pg.evaluate("S.shortcuts.length") == 1, 'no key at all is a choice too'
    assert 'no shortcut' in pg.inner_text('[data-skrow="newtask"]')
    pg.click('[data-skrow="newtask"] [data-ska="reset"]'); pg.wait_for_timeout(150); assert pg.evaluate("S.shortcuts.length") == 0

    # 9. a held choice is shown as needing attention, with a way to change it
    pg.evaluate("S.shortcuts.push(skNormalise({ action: 'newlist', keys: ['n'], ku: 5, u: 5 })); skDirty(); skRepaint()"); pg.wait_for_selector('.sk-er .sk-bad')
    assert 'Needs attention' in pg.inner_text('[data-skrow="newlist"]') and 'switched off' in pg.inner_text('[data-skrow="newlist"]')
    assert pg.locator('#sk-ed > p.sk-bad').count() == 1 and 'need' in pg.inner_text('#sk-ed > p.sk-bad'), 'a summary at the top'

    # 10. search
    pg.fill('#sk-find', 'calendar'); pg.wait_for_timeout(150)
    n = pg.locator('#sk-ed .sk-er').count(); assert 0 < n < 10, n
    pg.fill('#sk-find', 'zzzzz'); pg.wait_for_timeout(150); assert 'No shortcut matches' in pg.inner_text('#sk-ed')
    pg.fill('#sk-find', '')

    # 11. restore everything
    pg.click('[data-ska="resetall"]'); pg.wait_for_selector('[data-m="ok"]'); pg.click('[data-m="ok"]'); pg.wait_for_selector('#sk-ed .sk-er'); pg.wait_for_timeout(200)
    assert pg.evaluate("S.shortcuts.length") == 0, 'everything is back to the defaults'

    # 12. with the keyboard only: Enter on "Add" must not capture the keyboard (Tab still walks on), and Esc gives the focus back
    pg.focus('[data-skrow="newnote"] [data-ska="rec"]'); pg.keyboard.press('Enter'); pg.wait_for_selector('[data-skrec="newnote"] .sk-recbox')
    assert pg.evaluate("SKR.listen") is False, 'opened with the keyboard: not listening yet'
    assert pg.evaluate("document.activeElement.hasAttribute('data-sktype')"), 'focus is in the text box'
    pg.keyboard.press('Tab'); assert pg.evaluate("document.activeElement.dataset.ska") in ('use', 'cancel') or pg.evaluate("document.activeElement.type") == 'checkbox', 'Tab moves on to the next control'
    pg.focus('[data-ska="listen"]'); pg.keyboard.press('Enter'); assert pg.evaluate("SKR.listen") is True, '"Record keys" starts listening'
    pg.keyboard.press('Shift+Q'); pg.wait_for_timeout(1100); assert 'Shift' in pg.inner_text('[data-skver]') or 'Q' in pg.inner_text('[data-skver]'), 'a key was recorded'
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    assert pg.locator('.sk-recbox').count() == 0 and pg.evaluate("!!document.querySelector('#modal.on')"), 'Esc leaves the recorder, not Settings'
    assert pg.evaluate("document.activeElement.dataset.ska") == 'rec' and pg.evaluate("SKR.on") is False, 'focus is back on the Add button; nothing is listening'
    pg.keyboard.press('Escape'); pg.wait_for_timeout(250); assert not pg.evaluate("!!document.querySelector('#modal.on')"), 'a second Esc closes Settings'
    # closing the window while recording never leaves the keyboard captured
    pg.evaluate("openSettings('keys')"); pg.wait_for_selector('#sk-ed .sk-er'); rec(pg, 'newnote'); pg.evaluate("closeModal()"); pg.wait_for_timeout(200)
    pg.keyboard.press('Control+Shift+K'); pg.keyboard.press('n'); pg.wait_for_timeout(200)
    assert pg.evaluate("SKR.on") is False, 'a recorder whose window is gone lets go of the keyboard'
    assert pg.evaluate("document.activeElement && document.activeElement.id") == 'add', 'and the keys work again'
    assert not pg.errs, pg.errs; b.close()

    # the phone layout: nothing wider than the screen, the editor still usable
    for w in (390, 320):
        b, ctx, pg = launch(p, mobile=True, w=w, h=740)
        pg.evaluate("openSettings('keys')"); pg.wait_for_selector('#sk-ed .sk-er'); pg.wait_for_timeout(200)
        over = pg.evaluate("(()=>{const w=document.documentElement.clientWidth;return [...document.querySelectorAll('#modal .sk-er, #modal .sk-tools, #modal .sk-ek')].filter(e=>e.getBoundingClientRect().right>w+1).length})()")
        assert over == 0, f'{over} editor parts run off a {w}px screen'
        assert pg.evaluate("document.documentElement.scrollWidth") <= w + 1, 'no sideways scrolling'
        assert not pg.errs, pg.errs; b.close()
print('shortcut editor browser tests passed')
