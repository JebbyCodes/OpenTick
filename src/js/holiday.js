/* OpenTick holidays: spans of days off (half term, a trip, study leave) drawn as a clear coloured area wherever days are shown: the main
   timetable, the calendar (month, week, day, agenda) and the classes grid. Lessons are hidden on those days. They are the same
   records as the classes "days off" ({ k: 'off', from, to, label, color }), so they sync and are encrypted with the rest of the classes data. */
const HOL_DEF = '#e0a000';
const holOn = key => { const d = typeof key === 'string' ? pYmd(key) : key; return typeof scOff === 'function' ? scOff(d) : null; };
const holColor = o => (o && /^#[0-9a-f]{6}$/i.test(o.color || '') ? o.color : HOL_DEF);
const holName = o => (o && o.label) || 'Holiday';
const holRange = o => `${fmtDate(o.from)}${o.to && o.to !== o.from ? ' – ' + fmtDate(o.to) : ''}`;
const holAll = () => (typeof scOf === 'function' ? scOf('off') : []).slice().sort((a, b) => a.from.localeCompare(b.from));
// the label strip: sits at the top of a day's column or cell
const holBand = (o, cls = '') => `<div class="hol-band${cls ? ' ' + cls : ''}" style="--hc:${holColor(o)}" title="${esc(holName(o))} · ${esc(holRange(o))}">${ic('sun', 12)}<span class="mq">${esc(holName(o))}</span></div>`;
// holidays that touch a date range (inclusive keys)
const holIn = (from, to) => holAll().filter(o => o.from <= to && (o.to || o.from) >= from);

function holDlg() {
  const td = todayStr(), all = holAll(), end = o => o.to || o.from;
  const cur = all.filter(o => end(o) >= td), past = all.filter(o => end(o) < td).reverse();
  const row = o => `<button class="sc-offr hol-r" data-off="${esc(o.id)}" style="--hc:${holColor(o)}"><i class="hol-sw"></i><span>${esc(holName(o))}</span><small>${esc(holRange(o))}${o.from <= td && end(o) >= td ? ' · now' : ''}</small></button>`;
  openModal(`<h3>${ic('sun', 18)} Holidays</h3><p class="hint">Days off show as a coloured area on the timetable and calendar, and lessons are hidden on them.</p>
<div class="sc-offl-l">${cur.map(row).join('') || '<p class="hint">No holidays planned.</p>'}</div>
${past.length ? `<details class="hb-more"><summary>Past (${past.length})</summary><div class="sc-offl-l">${past.map(row).join('')}</div></details>` : ''}
<div class="mact"><button data-m="add" class="pri">${ic('plus', 14)} Add holiday</button><span class="sp"></span><button data-m="ok">Done</button></div>`, m => {
    m.onclick = e => {
      const r = e.target.closest('[data-off]'); if (r) { closeModal(); scOffDlg(scGet(r.dataset.off), holDlg); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'add') { closeModal(); scOffDlg(null, holDlg); } else closeModal();
    };
  });
}
const HOL_ACT = { holidays: () => holDlg() };
