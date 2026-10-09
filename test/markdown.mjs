// Markdown renderer: formatting, safety, checklist toggling.
import assert from 'node:assert/strict';
import { makeApp } from './harness.mjs';
const { md, mdInline, mdToggleLine, mdStats } = makeApp();
const has = (h, s) => assert.ok(h.includes(s), `expected ${JSON.stringify(s)} in ${h}`);
const no = (h, s) => assert.ok(!h.includes(s), `did not expect ${JSON.stringify(s)} in ${h}`);

// inline
has(mdInline('**bold** and *it* and ~~gone~~ and `x*y*z`'), '<strong>bold</strong>');
has(mdInline('**bold** and *it* and ~~gone~~ and `x*y*z`'), '<em>it</em>');
has(mdInline('**bold** and *it* and ~~gone~~ and `x*y*z`'), '<del>gone</del>');
has(mdInline('`x*y*z`'), '<code>x*y*z</code>');            // nothing inside code is formatted
no(mdInline('snake_case_name and 2 * 3 * 4'), '<em>');       // no accidental emphasis
has(mdInline('a \\*literal\\* star'), '*literal*');
has(mdInline('[docs](https://example.com/a?b=1&c=2)'), 'href="https://example.com/a?b=1&amp;c=2"');
has(mdInline('[docs](https://example.com)'), 'rel="noopener noreferrer"');
has(mdInline('see https://example.com/x.'), '<a href="https://example.com/x"');   // trailing dot not part of the URL
no(mdInline('see https://example.com/x', true), '<a ');                            // titles never contain links
has(mdInline('[docs](https://example.com)', true), 'docs');

// safety: raw HTML is shown as text, dangerous schemes never become links
const evil = ['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '[x](javascript:alert(1))', '[x](JaVaScRiPt:alert(1))', '[x](data:text/html;base64,AAAA)', '[x](  vbscript:msgbox)', '<a href="javascript:alert(1)">x</a>', '"><svg onload=alert(1)>', '[x](https://a.com" onmouseover="alert(1))'];
for (const e of evil) for (const h of [md(e), mdInline(e), md('- ' + e), md('> ' + e), md('| a |\n|---|\n| ' + e + ' |'), md('# ' + e)]) {
  assert.ok(!/<(script|img|svg|iframe)/i.test(h), 'tag leaked: ' + h);
  assert.ok(!/href="(?!https?:|mailto:|tel:)/i.test(h), 'bad href: ' + h);
  assert.ok(!/ on\w+=/i.test(h.replace(/&quot;|&#39;/g, '')) || /&lt;|&quot;/.test(h), 'handler leaked: ' + h);
}
no(md('[x](https://a.com" onmouseover="alert(1))'), '" onmouseover');
has(md('<b>hi</b>'), '&lt;b&gt;hi&lt;/b&gt;');

// blocks
has(md('# Title\n\ntext'), '<h1>Title</h1>');
has(md('###### six'), '<h6>six</h6>');
no(md('#hashtag'), '<h1>');
has(md('a\nb'), 'a<br>b');
has(md('---'), '<hr>');
has(md('> quote **b**'), '<blockquote><p>quote <strong>b</strong></p></blockquote>');
has(md('```js\nconst a = "<b>";\n**not bold**\n```'), '<pre><code>const a = &quot;&lt;b&gt;&quot;;\n**not bold**</code></pre>');
has(md('```\nunterminated'), '<pre><code>unterminated</code></pre>');
has(md('- a\n- b'), '<ul><li><span class="mdtx">a</span></li><li><span class="mdtx">b</span></li></ul>');
has(md('3. x\n4. y'), '<ol start="3">');
has(md('- a\n  - b\n    - c\n- d'), '<ul><li><span class="mdtx">a</span><ul><li><span class="mdtx">b</span><ul><li><span class="mdtx">c</span></li></ul></li></ul></li><li><span class="mdtx">d</span></li></ul>');
has(md('para\n1986. was a year'), '1986. was a year');           // only "1." interrupts a paragraph
no(md('para\n1986. was a year'), '<ol');
has(md('| a | b |\n|:--|--:|\n| 1 | 2 |\n| 3 |'), '<th style="text-align:left">a</th><th style="text-align:right">b</th>');
has(md('| a | b |\n|---|---|\n| 1 \\| x | 2 |'), '<td>1 | x</td>');

// checklists: clickable, line-numbered, toggle round-trips
const note = 'Intro\n\n- [ ] one\n- [x] two\n  - [ ] nested\n\n```\n- [ ] in code\n```\n> - [ ] in quote\n1. [ ] numbered';
const h = md(note);
assert.equal((h.match(/class="mdchk"/g) || []).length, 4);          // one, two, nested, numbered
has(h, '<input type="checkbox" class="mdchk" data-mdl="2">');
has(h, 'data-mdl="3" checked');
has(h, 'class="mdt done"');
const t1 = mdToggleLine(note, 2); has(t1, '- [x] one'); assert.equal(mdToggleLine(t1, 2), note);
has(mdToggleLine(note, 3), '- [ ] two');
assert.equal(mdToggleLine(note, 0), note);                           // not a checkbox line: untouched
assert.equal(mdToggleLine(note, 99), note);
for (const m of h.matchAll(/data-mdl="(\d+)"/g)) assert.ok(/\[[ x]\]/.test(note.split('\n')[+m[1]]), 'data-mdl points at a checkbox line');
const st = mdStats(note); assert.equal(st.done, 1); assert.ok(st.total >= 4);
assert.equal(JSON.stringify(mdStats('no boxes')), '{"total":0,"done":0}');
assert.equal(md(''), ''); assert.equal(md(null), ''); assert.equal(md(undefined), '');
// CRLF input
has(md('- [ ] a\r\n- [ ] b'), 'data-mdl="1"');
// big pathological input finishes quickly
const t0 = Date.now(); md(('*a ' + '_b '.repeat(50) + '\n').repeat(300) + '['.repeat(2000) + '\n' + '- '.repeat(2000)); assert.ok(Date.now() - t0 < 2000, 'slow on pathological input');
console.log('markdown tests passed');
