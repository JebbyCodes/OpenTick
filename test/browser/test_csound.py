"""0.7.0: a custom notification sound, chosen in Settings -> Sound & focus, kept on the device, played for the chime cue."""
import io, math, struct, wave
from lib import *

def tone(seconds, hz=660, rate=22050):
    b = io.BytesIO(); w = wave.open(b, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
    w.writeframes(b''.join(struct.pack('<h', int(9000 * math.sin(2 * math.pi * hz * i / rate))) for i in range(int(rate * seconds)))); w.close()
    return b.getvalue()

def pick(pg, name, data, mime='audio/wav'):
    with pg.expect_file_chooser() as fc:
        pg.locator('[data-csnd=pick]').first.click()
    fc.value.set_files({'name': name, 'mimeType': mime, 'buffer': data})
    pg.wait_for_timeout(700)

with sync_playwright() as p:
    for mobile in (False, True):
        b, ctx, pg = launch(p, mobile=mobile)
        pg.evaluate("openSettings('sound')"); pg.wait_for_timeout(300)
        assert 'built-in chime' in pg.inner_text('#csnd'), pg.inner_text('#csnd')
        # a file that is not sound is refused, and says why
        pick(pg, 'notes.mp3', b'this is not audio at all' * 20, 'audio/mpeg')
        assert pg.evaluate("S.settings.sound.custom") is None, 'a bad file is not kept'
        assert 'could not be read as sound' in pg.inner_text('#toasts, .toast, body'), 'the person is told'
        # one that is too long
        pick(pg, 'long.wav', tone(31))
        assert pg.evaluate("S.settings.sound.custom") is None
        # a good one
        pick(pg, 'bell.wav', tone(1.2))
        m = pg.evaluate("S.settings.sound.custom"); assert m and m['name'] == 'bell.wav' and m['size'] > 1000, m
        assert 'bell.wav' in pg.inner_text('#csnd') and pg.locator('[data-csnd=rm]').count() == 1
        # the chime cue now plays it (not the synthesized one)
        pg.evaluate("(() => { window.__src = 0; const o = AudioContext.prototype.createBufferSource; AudioContext.prototype.createBufferSource = function () { __src++; return o.apply(this, arguments); }; })()")
        pg.evaluate("sfx('chime', true)"); pg.wait_for_timeout(200)
        assert pg.evaluate("__src") >= 1, 'the chosen sound is played'
        pg.locator('[data-csnd=play]').first.click(); pg.wait_for_timeout(200)
        assert pg.evaluate("__src") >= 2, 'the Play button plays it'
        pg.screenshot(path=f'/tmp/claude-0/-home-claude/da1f3941-7fd6-5dd8-8906-6c2b051e6940/scratchpad/shots/csound-{"phone" if mobile else "desk"}.png')
        # the page does not scroll sideways, and it survives a reload
        assert pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1")
        pg.evaluate("save(); flush()"); pg.reload(); pg.wait_for_selector('#main'); pg.wait_for_timeout(500)
        assert pg.evaluate("csMeta() && csMeta().name") == 'bell.wav'
        assert pg.evaluate("csoundLoad(true)") is True, 'the stored file opens again after a reload'
        pg.evaluate("openSettings('sound')"); pg.wait_for_timeout(300)
        pg.locator('[data-csnd=rm]').first.click(); pg.wait_for_timeout(400)
        assert pg.evaluate("S.settings.sound.custom") is None and 'built-in chime' in pg.inner_text('#csnd')
        assert pg.evaluate("csoundHave()") is False, 'removed from storage too'
        assert not pg.errs, pg.errs; b.close()
print('test_csound: ok')
