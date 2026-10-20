/* OpenTick markdown: small, dependency-free, safe by construction.
   All input is HTML-escaped FIRST; the only tags that ever reach the DOM are the ones generated here,
   and links are limited to http(s), mailto and tel. Raw HTML in notes is shown as text, never executed.
   Supported: headings (# and underlined), **bold**, *italic*, ~~strike~~, ==highlight==, H~2~O, x^2^, `code`, fenced and
   indented code (with colours for common languages), links, reference links, <autolinks> and bare URLs, images (http/https
   and inline png/jpg/gif/webp only), footnotes, > quotes, bullet / numbered / nested lists, - [ ] task lists (clickable),
   tables, horizontal rules, :emoji: shortcodes and [[wiki links]] to other notes. */
const MD_URL = /^(?:https?:\/\/|mailto:|tel:)[^\s"'<>]*$/i;
const MD_IMG = /^(?:ot-file:[\w-]+|https?:\/\/[^\s"'<>]*|data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+)$/i;
const MD_EMOJI = { smile: '😄', grin: '😁', joy: '😂', wink: '😉', heart: '❤️', thumbsup: '👍', '+1': '👍', '-1': '👎', tada: '🎉', fire: '🔥', star: '⭐', check: '✅', white_check_mark: '✅', x: '❌', warning: '⚠️', bulb: '💡', memo: '📝', book: '📖', calendar: '📅', clock: '🕒', rocket: '🚀', eyes: '👀', thinking: '🤔', pray: '🙏', clap: '👏', muscle: '💪', coffee: '☕', zap: '⚡', bug: '🐛', lock: '🔒', pushpin: '📌', question: '❓', sparkles: '✨' };
let MD_NOTE = null, MD_DEPTH = 0; const MD_NSEEN = []; // MD_NOTE(title) -> { id, title, body, self } | null lets ![[Note]] show another note
let MD_REFS = {}, MD_FN = null, MD_WIKI = null; // per-render state: link definitions, footnotes; MD_WIKI(title) -> { id, title } | null is set by the notes page
const MD_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const MD_CHK = /^\[([ xX])\](?:\s+(.*))?$/;
const MD_HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const MD_SEP = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;
const MD_LINK = (href, inner) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${inner}</a>`;

const MD_KW = new Set('function return const let var if else for while do class import from export default new try catch finally throw async await yield def elif lambda pass with as in is not and or None True False self fn pub use impl struct enum trait match mod mut loop true false null undefined typeof instanceof switch case break continue static public private protected void int float double string bool char long package interface extends implements this super SELECT FROM WHERE INSERT INTO UPDATE DELETE JOIN LEFT ON GROUP BY ORDER LIMIT CREATE TABLE VALUES SET AND OR NOT NULL select from where insert into update delete join left on group by order limit create table values set echo then fi done'.split(' '));
// tiny colouriser for fenced code that names a language; every piece of source is escaped, only our own <span>s are added
function mdHighlight(code, lang) {
  lang = String(lang || '').toLowerCase();
  if (!lang || /^(text|txt|plain|plaintext|md|markdown|none)$/.test(lang)) return esc(code);
  const hash = /^(py|python|sh|bash|zsh|shell|yaml|yml|toml|ruby|rb|r|ini|conf|dockerfile|make|makefile)$/.test(lang), sql = lang === 'sql', css = /^(css|scss|less)$/.test(lang);
  const com = hash ? '#[^\\n]*' : sql ? '--[^\\n]*' : css ? '\\/\\*[\\s\\S]*?\\*\\/' : '\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/';
  const re = new RegExp(`(${com})|("(?:\\\\.|[^"\\\\\\n])*"|'(?:\\\\.|[^'\\\\\\n])*'|` + '`(?:\\\\.|[^`\\\\])*`' + `)|(\\b\\d+(?:\\.\\d+)?\\b)|([A-Za-z_][\\w-]*)`, 'g');
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index)); last = re.lastIndex;
    const cls = m[1] ? 'c' : m[2] ? 's' : m[3] ? 'n' : MD_KW.has(m[4]) ? 'k' : '';
    out += cls ? `<span class="hl-${cls}">${esc(m[0])}</span>` : esc(m[0]);
  }
  return out + esc(code.slice(last));
}

function mdInline(src, noLinks) {
  const keep = [], hold = h => '\u0001' + (keep.push(h) - 1) + '\u0002';
  const fmt = s => s
    .replace(/\*\*\*(?=\S)([\s\S]*?\S)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\w])__(?=\S)([\s\S]*?\S)__(?!\w)/g, '$1<strong>$2</strong>')
    .replace(/\*(?=\S)([^*]*?\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\w])_(?=\S)([^_]*?\S)_(?!\w)/g, '$1<em>$2</em>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>')
    .replace(/==(?=\S)([^=\n]*?\S)==/g, '<mark>$1</mark>')
    .replace(/(^|[^~])~(?=[^\s~])([^~\s]+?)~(?!~)/g, '$1<sub>$2</sub>')
    .replace(/\^(?=[^\s^])([^^\s]+?)\^/g, '<sup>$1</sup>');
  let t = esc(src);
  t = t.replace(/\\([\\`*_[\]()#+\-.!~|])/g, (m, c) => hold(c));
  t = t.replace(/`([^`\n]+)`/g, (m, c) => hold(`<code>${c}</code>`));
  // images: ![alt](https://… "title"); in a title or chip they collapse to their alt text
  t = t.replace(/!\[([^\]\n]*)\]\(\s*([^)\s]+)(?:\s+&quot;[^)]*?&quot;)?\s*\)/g, (m, alt, url) => {
    if (!MD_IMG.test(url.replace(/&amp;/g, '&'))) return m;
    const of = url.match(/^ot-file:([\w-]+)$/); // an attached picture: filled in from this device's file store
    if (!noLinks) { const eh = of ? ((typeof fileKindById === 'function' ? fileKindById(of[1]) : '') && ['audio', 'video', 'pdf'].includes(fileKindById(of[1])) ? mdFileEmbed(of[1], MD_UNESC(alt)) : null) : mdEmbed(MD_UNESC(url), MD_UNESC(alt)); if (eh) return hold(eh); }
    if (of) return noLinks ? hold(alt) : hold(`<img class="fimg" data-file="${of[1]}" alt="${alt}" loading="lazy">`);
    return noLinks ? hold(alt) : hold(`<img src="${url}" alt="${alt}" loading="lazy" decoding="async" referrerpolicy="no-referrer">`);
  });
  // [[Note title]] and [[Note title|shown text]]: links between notes
  t = t.replace(/\[\[([^\]\n|]+)(?:\|([^\]\n]*))?\]\]/g, (m, name, shown) => {
    const label = (shown || name).trim(), n = !noLinks && MD_WIKI ? MD_WIKI(name.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")) : null;
    return hold(n ? `<a class="wl" data-note="${esc(n.id)}">${label}</a>` : `<span class="wl miss">${label}</span>`);
  });
  // footnote references: [^id] (the text comes from a "[^id]: …" line)
  if (MD_FN) t = t.replace(/\[\^([^\]\s]+)\]/g, (m, id) => {
    id = id.toLowerCase(); if (!(id in MD_FN.defs)) return m;
    let n = MD_FN.order.indexOf(id) + 1; if (!n) n = MD_FN.order.push(id);
    return hold(`<sup class="fnr">${n}</sup>`);
  });
  t = t.replace(/\[([^\]\n]*)\]\(\s*([^)\s]+)(?:\s+&quot;[^)]*?&quot;)?\s*\)/g, (m, txt, url) => {
    const of = url.match(/^ot-file:([\w-]+)$/); // an attached file: opens in the viewer
    if (of) return noLinks ? hold(fmt(txt || 'file')) : hold(`<a class="fl" data-file="${of[1]}" role="button" tabindex="0">${fmt(txt || 'file')}</a>`);
    if (!MD_URL.test(url.replace(/&amp;/g, '&'))) return m;
    return noLinks ? hold(fmt(txt || url)) : hold(MD_LINK(url, fmt(txt || url)));
  });
  // reference links: [text][ref], [ref][] and [ref]
  t = t.replace(/\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/g, (m, txt, ref, off, all) => {
    if (all[off - 1] === '\u0001' || /^\u0001\d+\u0002$/.test(txt)) return m;
    const d = MD_REFS[(ref || txt).toLowerCase()]; if (!d) return m;
    return noLinks ? hold(fmt(txt)) : hold(MD_LINK(d.url, fmt(txt)).replace('<a ', d.title ? `<a title="${d.title}" ` : '<a '));
  });
  if (!noLinks) {
    t = t.replace(/&lt;((?:https?:\/\/|mailto:)[^\s<>]*?)&gt;/g, (m, u) => (MD_URL.test(u.replace(/&amp;/g, '&')) ? hold(MD_LINK(u, u)) : m));
    t = t.replace(/\bhttps?:\/\/[^\s<>\u0001]+/g, u => {
      const m = u.match(/(?:[.,;:!?)\]]|&quot;|&#39;|&gt;)+$/), tail = m ? m[0] : '';
      if (tail) u = u.slice(0, -tail.length);
      return u.length > 8 ? hold(MD_LINK(u, u)) + tail : u + tail;
    });
  }
  t = t.replace(/(^|[^\w:]):([a-z][a-z0-9_+-]{1,20}):(?![\w:])/g, (m, pre, k) => (MD_EMOJI[k] ? pre + MD_EMOJI[k] : m));
  t = fmt(t);
  while (/\u0001\d+\u0002/.test(t)) t = t.replace(/\u0001(\d+)\u0002/g, (m, i) => keep[+i]);
  return t;
}

const mdCells = r => r.trim().replace(/^\|/, '').replace(/\|$/, '').replace(/\\\|/g, '\u0003').split('|').map(c => c.trim().replace(/\u0003/g, '|'));

/* ---------- embeds ----------
   ![caption](url) on a line of its own becomes a player when the address is a known one: YouTube, Vimeo, Spotify, a direct
   video / audio file, a PDF, or one of your own attachments. ![[Note title]] shows another note in place (two levels deep at most,
   and never a note inside itself). Only these hosts ever get a frame, and a frame is sandboxed; any other address stays a link. */
const MD_UNESC = s => String(s).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
function mdEmbed(raw, alt) {
  raw = String(raw || '').trim(); if (!/^https?:\/\//i.test(raw)) return null;
  const a = esc(alt || ''), u = esc(raw), SB = 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox';
  const frame = (src, cls, title) => `<div class="embed ${cls}"><iframe src="${esc(src)}" title="${esc(title)}" loading="lazy" sandbox="${SB}" allow="encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
  let m;
  if ((m = raw.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})(?:[?&#]|$)/i))) { const t = raw.match(/[?&#]t=(\d+)/); return frame('https://www.youtube-nocookie.com/embed/' + m[1] + (t ? '?start=' + t[1] : ''), 'emb-video', alt || 'YouTube video'); }
  if ((m = raw.match(/^https?:\/\/(?:www\.)?vimeo\.com\/(?:video\/)?(\d{5,12})(?:[/?#]|$)/i))) return frame('https://player.vimeo.com/video/' + m[1], 'emb-video', alt || 'Vimeo video');
  if ((m = raw.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]{10,30})/i))) return frame('https://open.spotify.com/embed/' + m[1].toLowerCase() + '/' + m[2], 'emb-spotify', alt || 'Spotify');
  const path = raw.split(/[?#]/)[0].toLowerCase();
  if (/\.(mp4|webm|ogv|mov|m4v)$/.test(path)) return `<div class="embed emb-video"><video controls preload="metadata" playsinline src="${u}" aria-label="${a}"></video></div>`;
  if (/\.(mp3|wav|m4a|oga|ogg|flac|aac|opus)$/.test(path)) return `<div class="embed emb-audio"><audio controls preload="none" src="${u}" aria-label="${a}"></audio></div>`;
  if (/\.pdf$/.test(path)) return `<div class="embed emb-pdf"><iframe src="${u}" title="${a || 'PDF'}" loading="lazy"></iframe><a class="emb-open" href="${u}" target="_blank" rel="noopener noreferrer">Open the PDF</a></div>`;
  return null;
}
// one of your own attachments, filled in by files.js once the bytes are read from this device's storage
const mdFileEmbed = (id, alt) => `<div class="embed emb-fe" data-fe="${esc(id)}" data-alt="${esc(alt || '')}"><span class="hint">Loading…</span></div>`;
function mdNoteEmbed(name) {
  const n = MD_NOTE ? MD_NOTE(name) : null;
  if (!n) return `<div class="embed emb-note miss"><span class="wl miss">${esc(name)}</span><small>No note with this title</small></div>`;
  const head = `<div class="emb-h">${typeof ic === 'function' ? ic('notes', 14) : ''}<a class="wl" data-note="${esc(n.id)}">${esc(n.title)}</a></div>`;
  if (n.self || MD_DEPTH >= 2 || MD_NSEEN.includes(n.id)) return `<div class="embed emb-note">${head}<small>Already shown, so it is not repeated here</small></div>`;
  const r = MD_REFS, f = MD_FN; MD_DEPTH++; MD_NSEEN.push(n.id);
  let body = ''; try { body = md(n.body); } finally { MD_DEPTH--; MD_NSEEN.pop(); MD_REFS = r; MD_FN = f; }
  return `<div class="embed emb-note">${head}<div class="md emb-b">${body || '<p class="hint">This note is empty.</p>'}</div></div>`;
}
const MD_EMB_NOTE = /^\s*!\[\[([^\]\n|]+)(?:\|[^\]\n]*)?\]\]\s*$/, MD_EMB_LINE = /^\s*!\[([^\]\n]*)\]\(\s*(\S+?)\s*\)\s*$/;
function mdEmbedLine(s) { // the html for a line that is only an embed, or null
  let m;
  if ((m = s.match(MD_EMB_NOTE))) return mdNoteEmbed(m[1].trim());
  if ((m = s.match(MD_EMB_LINE))) { const of = m[2].match(/^ot-file:([\w-]+)$/); if (of) { const k = typeof fileKindById === 'function' ? fileKindById(of[1]) : ''; return k === 'audio' || k === 'video' || k === 'pdf' ? mdFileEmbed(of[1], m[1]) : null; } return mdEmbed(m[2], m[1]); }
  return null;
}
function mdBlockStart(L, i) {
  if (MD_EMB_NOTE.test(L[i]) || (MD_EMB_LINE.test(L[i]) && mdEmbedLine(L[i]))) return true;
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
    if ((m = s.match(/^\s*(`{3,}|~{3,})\s*([\w+#.-]*)/))) {
      const f = m[1][0], lang = m[2], code = []; i++;
      while (i < L.length && !new RegExp('^\\s*' + f + '{3,}\\s*$').test(L[i])) code.push(L[i++]);
      i++; out.push(`<pre${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${mdHighlight(code.join('\n'), lang)}</code></pre>`); continue;
    }
    if (/^(?: {4}|\t)\S/.test(s)) { // indented code block
      const code = [];
      while (i < L.length && (/^(?: {4}|\t)/.test(L[i]) || (!L[i].trim() && i + 1 < L.length && /^(?: {4}|\t)\S/.test(L[i + 1])))) code.push(L[i++].replace(/^(?: {4}|\t)/, ''));
      out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue;
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
    { const eh = mdEmbedLine(s); if (eh) { out.push(eh); i++; continue; } }
    if (i + 1 < L.length && (m = L[i + 1].match(/^ {0,3}(=+|-+)\s*$/)) && !MD_ITEM.test(s)) { out.push(`<h${m[1][0] === '=' ? 1 : 2}>${mdInline(s.trim())}</h${m[1][0] === '=' ? 1 : 2}>`); i += 2; continue; }
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

function md(src) {
  if (!MD_DEPTH) MD_NSEEN.length = 0;
  const L = String(src ?? '').replace(/\r\n?/g, '\n').split('\n');
  MD_REFS = {}; MD_FN = { defs: {}, order: [] };
  let fence = false, m;
  for (let i = 0; i < L.length; i++) { // collect "[ref]: url" and "[^id]: text" lines; blanking them keeps checkbox line numbers true
    if (/^\s*(`{3,}|~{3,})/.test(L[i])) { fence = !fence; continue; }
    if (fence) continue;
    if ((m = L[i].match(/^ {0,3}\[\^([^\]\s]+)\]:\s*(.*)$/))) { MD_FN.defs[m[1].toLowerCase()] = m[2]; L[i] = ''; continue; }
    if ((m = L[i].match(/^ {0,3}\[([^\]^][^\]]*)\]:\s*(\S+)(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*$/)) && MD_URL.test(m[2])) { MD_REFS[esc(m[1]).toLowerCase()] = { url: esc(m[2]), title: esc(m[3] || m[4] || '') }; L[i] = ''; }
  }
  let html = mdBlocks(L, true);
  const fn = MD_FN; // footnote texts may themselves cite others, so render from a snapshot of the order
  if (fn.order.length) html += `<section class="mdfn"><hr><ol>${fn.order.slice().map(id => `<li>${mdInline(fn.defs[id])}</li>`).join('')}</ol></section>`;
  MD_REFS = {}; MD_FN = null;
  return html;
}

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
