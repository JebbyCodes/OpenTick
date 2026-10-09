/* OpenTick markdown: small, dependency-free, safe by construction.
   All input is HTML-escaped FIRST; the only tags that ever reach the DOM are the ones generated here,
   and links are limited to http(s), mailto and tel. Raw HTML in notes is shown as text, never executed.
   Supported: headings, **bold**, *italic*, ~~strike~~, `code`, fenced code, links + bare URLs, > quotes,
   bullet / numbered / nested lists, - [ ] task lists (clickable), tables, horizontal rules. */
const MD_URL = /^(?:https?:\/\/|mailto:|tel:)[^\s"'<>]*$/i;
const MD_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const MD_CHK = /^\[([ xX])\](?:\s+(.*))?$/;
const MD_HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const MD_SEP = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const MD_LINK = (href, inner) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${inner}</a>`;

function mdInline(src, noLinks) {
  const keep = [], hold = h => '\u0001' + (keep.push(h) - 1) + '\u0002';
  const fmt = s => s
    .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/\*(?=\S)([^*]*?\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
  let t = esc(src);
  t = t.replace(/\\([\\`*_[\]()#+\-.!~|])/g, (m, c) => hold(c));
  t = t.replace(/`([^`\n]+)`/g, (m, c) => hold(`<code>${c}</code>`));
  t = t.replace(/!?\[([^\]\n]*)\]\(\s*([^)\s]+)(?:\s+&quot;[^)]*?&quot;)?\s*\)/g, (m, txt, url) => {
    if (!MD_URL.test(url.replace(/&amp;/g, '&'))) return m;
    return noLinks ? hold(fmt(txt || url)) : hold(MD_LINK(url, fmt(txt || url)));
  });
  if (!noLinks) {
    t = t.replace(/\bhttps?:\/\/[^\s<>\u0001]+/g, u => {
      const m = u.match(/(?:[.,;:!?)\]]|&quot;|&#39;|&gt;)+$/), tail = m ? m[0] : '';
      if (tail) u = u.slice(0, -tail.length);
      return u.length > 8 ? hold(MD_LINK(u, u)) + tail : u + tail;
    });
  }
  t = fmt(t);
  while (/\u0001\d+\u0002/.test(t)) t = t.replace(/\u0001(\d+)\u0002/g, (m, i) => keep[+i]);
  return t;
}

const mdCells = r => r.trim().replace(/^\|/, '').replace(/\|$/, '').replace(/\\\|/g, '\u0003').split('|').map(c => c.trim().replace(/\u0003/g, '|'));

function mdBlockStart(L, i) {
  const s = L[i];
  if (/^\s*(```|~~~)/.test(s) || /^ {0,3}#{1,6}\s/.test(s) || MD_HR.test(s) || /^\s*>/.test(s)) return true;
  const m = s.match(MD_ITEM);
  if (m && (!/\d/.test(m[2][0]) || parseInt(m[2], 10) === 1)) return true; // only "1." may interrupt a paragraph
  return s.includes('|') && i + 1 < L.length && L[i + 1].includes('|') && MD_SEP.test(L[i + 1]);
}

// `chk` = render task-list checkboxes (top level only: their data-mdl is the line number in the source)
function mdBlocks(L, chk) {
  const out = []; let i = 0, m;
  while (i < L.length) {
    const s = L[i];
    if (!s.trim()) { i++; continue; }
    if ((m = s.match(/^\s*(`{3,}|~{3,})/))) {
      const f = m[1][0], code = []; i++;
      while (i < L.length && !new RegExp('^\\s*' + f + '{3,}\\s*$').test(L[i])) code.push(L[i++]);
      i++; out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue;
    }
    if ((m = s.match(/^ {0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/))) { out.push(`<h${m[1].length}>${mdInline(m[2])}</h${m[1].length}>`); i++; continue; }
    if (MD_HR.test(s)) { out.push('<hr>'); i++; continue; }
    if (/^\s*>/.test(s)) {
      const q = []; while (i < L.length && /^\s*>/.test(L[i])) q.push(L[i++].replace(/^\s*> ?/, ''));
      out.push(`<blockquote>${mdBlocks(q, false)}</blockquote>`); continue;
    }
    if (MD_ITEM.test(s)) {
      const items = [];
      while (i < L.length) {
        const x = L[i].match(MD_ITEM);
        if (x && !MD_HR.test(L[i])) {
          let text = x[3], box = null;
          const c = chk ? text.match(MD_CHK) : null;
          if (c) { box = { on: c[1] !== ' ', ln: i }; text = c[2] || ''; }
          items.push({ ind: x[1].replace(/\t/g, '    ').length, ol: /\d/.test(x[2][0]), num: parseInt(x[2], 10), text, box });
          i++;
        } else if (items.length && L[i].trim() && /^\s+\S/.test(L[i])) { items[items.length - 1].text += '\n' + L[i].trim(); i++; }
        else if (!L[i].trim() && i + 1 < L.length && MD_ITEM.test(L[i + 1]) && !MD_HR.test(L[i + 1])) i++;
        else break;
      }
      out.push(mdList(items)); continue;
    }
    if (s.includes('|') && i + 1 < L.length && L[i + 1].includes('|') && MD_SEP.test(L[i + 1])) {
      const head = mdCells(s), al = mdCells(L[i + 1]).map(c => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : /^:-/.test(c) ? 'left' : ''));
      const cell = (tag, v, k) => `<${tag}${al[k] ? ` style="text-align:${al[k]}"` : ''}>${mdInline(v || '')}</${tag}>`;
      let h = `<div class="mdtbl"><table><thead><tr>${head.map((v, k) => cell('th', v, k)).join('')}</tr></thead><tbody>`;
      i += 2;
      while (i < L.length && L[i].trim() && L[i].includes('|')) { const r = mdCells(L[i++]); h += `<tr>${head.map((_, k) => cell('td', r[k], k)).join('')}</tr>`; }
      out.push(h + '</tbody></table></div>'); continue;
    }
    const p = [];
    while (i < L.length && L[i].trim() && !(p.length && mdBlockStart(L, i))) p.push(L[i++]);
    out.push(`<p>${mdInline(p.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }
  return out.join('');
}

function mdList(items) {
  let h = '';
  const st = [];
  for (const it of items) {
    const tag = it.ol ? 'ol' : 'ul';
    while (st.length && st[st.length - 1].ind > it.ind) h += `</li></${st.pop().tag}>`;
    const top = st[st.length - 1];
    if (!top || top.ind < it.ind) { h += `<${tag}${it.ol && it.num !== 1 ? ` start="${it.num}"` : ''}>`; st.push({ ind: it.ind, tag }); }
    else { h += '</li>'; if (top.tag !== tag) { h += `</${top.tag}><${tag}>`; top.tag = tag; } }
    const body = `<span class="mdtx">${mdInline(it.text).replace(/\n/g, '<br>')}</span>`;
    h += it.box
      ? `<li class="mdt${it.box.on ? ' done' : ''}"><input type="checkbox" class="mdchk" data-mdl="${it.box.ln}"${it.box.on ? ' checked' : ''}>${body}`
      : `<li>${body}`;
  }
  while (st.length) h += `</li></${st.pop().tag}>`;
  return h;
}

const md = src => mdBlocks(String(src ?? '').replace(/\r\n?/g, '\n').split('\n'), true);

// flip the checkbox on source line `n` (the number the renderer put in data-mdl)
function mdToggleLine(src, n) {
  const L = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  if (L[n] != null) L[n] = L[n].replace(/^(\s*(?:[-*+]|\d{1,9}[.)])\s+\[)([ xX])(\])/, (m, a, b, c) => a + (b === ' ' ? 'x' : ' ') + c);
  return L.join('\n');
}
function mdStats(src) {
  const s = String(src ?? ''), all = s.match(/^\s*(?:[-*+]|\d{1,9}[.)])\s+\[[ xX]\]/gm) || [];
  return { total: all.length, done: all.filter(x => /\[[xX]\]$/.test(x)).length };
}
