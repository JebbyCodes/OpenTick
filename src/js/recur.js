/* OpenTick repeats, the extra part of the task panel: a custom rule, an end date, and exceptions (one date at a different time, or skipped).
   task.until  last day it may happen on          task.exc  { 'YYYY-MM-DD': { time?, dur?, skip? } }
   Both are plain fields on the task, so they sync and are encrypted with everything else. */

// the rows under the "repeat" select: when it ends, and the exceptions
function repeatMoreHtml(t) {
  if (!t.repeat) return '';
  const ex = excList(t), ends = t.until ? 'date' : 'never';
  return `<div class="dr sub"><span class="dlab">Ends</span><select data-f="endmode" aria-label="When the repeat ends">${opts([['never', 'Never'], ['date', 'On a date']], ends)}</select>${t.until ? `<input type="date" data-f="until" value="${esc(t.until)}" min="${esc(t.due || '')}" aria-label="Last day">` : ''}</div>
<div class="dr top sub"><span class="dlab">Changes</span><div class="exl">${ex.map(k => `<button type="button" class="remchip exc${(t.exc[k] || {}).skip ? ' skip' : ''}" data-act="excedit" data-d="${esc(k)}" title="Edit this exception">${ic('clock', 12)} ${esc(excText(t, k))}</button>`).join('')}<button type="button" class="btn sm" data-act="excadd">${ic('plus', 12)} A different time on one date…</button></div></div>`;
}

// every N days / weeks / months / years, or on chosen weekdays
function repeatDlg(t) {
  const r = t.repeat || { every: 1, unit: 'week' }, ws = +S.settings.weekStart || 0, order = Array.from({ length: 7 }, (_, i) => (ws + i) % 7);
  openModal(`<h3>Repeat</h3><div class="form one">
<div class="lbl">Every<div class="rep-row"><input type="number" id="rp-n" min="1" max="999" step="1" value="${r.every || 1}" aria-label="How many"><select id="rp-u" aria-label="Unit">${opts([['day', 'days'], ['week', 'weeks'], ['month', 'months'], ['year', 'years']], r.unit)}</select></div></div>
<div class="lbl" id="rp-dw"${r.unit === 'week' ? '' : ' hidden'}>On these days<div class="dayp">${order.map(n => `<button type="button" class="dp${(r.days || []).includes(n) ? ' on' : ''}" data-d="${n}">${DAYS[n]}</button>`).join('')}</div><p class="hint">Pick days to repeat every week on exactly those days.</p></div></div>
<div class="mact"><button data-m="no">Cancel</button><button class="pri" data-m="ok">Save</button></div>`, m => {
    const sync = () => { $('#rp-dw', m).hidden = $('#rp-u', m).value !== 'week'; };
    m.onchange = e => { if (e.target.id === 'rp-u') sync(); };
    m.onclick = e => {
      const d = e.target.closest('.dp'); if (d) { d.classList.toggle('on'); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'no') { closeModal(); return; }
      const unit = $('#rp-u', m).value, every = Math.max(1, Math.min(999, Math.round(+$('#rp-n', m).value || 1))), days = unit === 'week' ? $$('.dp.on', m).map(x => +x.dataset.d).sort((a, c) => a - c) : [];
      t.repeat = days.length ? { every: 1, unit: 'week', days } : { every, unit };
      if (!t.due) t.due = todayStr();
      closeModal(); save(); refresh();
    };
  });
}

// add or edit one exception. k = the date being edited, or null for a new one
function excDlg(t, k) {
  const old = k ? (t.exc || {})[k] || {} : null;
  const dates = k ? [k] : [t.due, ...repeatDates(t, t.due, ymd(addDays(pYmd(t.due), 400)))].filter(d => !(t.exc && t.exc[d])).slice(0, 24);
  if (!dates.length) { toast('No more dates to change'); return; }
  const first = dates[0], base = validHM(tmEff(t, first)) ? tmEff(t, first) : (t.time || '09:00');
  openModal(`<h3>${k ? 'Edit this date' : 'A different time on one date'}</h3><div class="form one">
<label>Date<select id="ex-d" ${k ? 'disabled' : ''}>${opts(dates.map(d => [d, `${calDayLabel(d)}${validHM(tmEff(t, d)) ? ' · ' + fmtTime(tmEff(t, d)) : ''}`]), k || first)}</select></label>
<label class="chkl"><input type="checkbox" id="ex-skip"${old && old.skip ? ' checked' : ''}> Skip this date (it does not happen)</label>
<div id="ex-f"${old && old.skip ? ' hidden' : ''}><label>Time<input type="time" id="ex-t" value="${old && validHM(old.time) ? old.time : base}"></label><div class="lbl">Length${durHtml('exc', old && old.dur ? old.dur : durEff(t, first))}</div></div></div>
<div class="mact">${k ? '<button class="danger" data-m="del">Remove</button>' : ''}<span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="ok">Save</button></div>`, m => {
    m.onchange = e => { if (e.target.id === 'ex-skip') $('#ex-f', m).hidden = e.target.checked; };
    m.oninput = e => { const box = e.target.closest && e.target.closest('[data-dur=exc]'); if (box) durMark(box, durRead(box) || 0); };
    m.onclick = e => {
      const dp = e.target.closest('[data-dp]'); if (dp) { durSet($('[data-dur=exc]', m), +dp.dataset.dp); return; }
      const b = e.target.closest('[data-m]'); if (!b) { if (e.target.classList.contains('mback')) closeModal(); return; }
      if (b.dataset.m === 'no') { closeModal(); return; }
      const d = k || $('#ex-d', m).value;
      if (b.dataset.m === 'del') { if (t.exc) { delete t.exc[d]; if (!Object.keys(t.exc).length) delete t.exc; } }
      else {
        const e1 = {}; if ($('#ex-skip', m).checked) e1.skip = true; else { const tm = $('#ex-t', m).value, du = durRead($('[data-dur=exc]', m)); if (validHM(tm)) e1.time = tm; if (du) e1.dur = du; }
        if (!Object.keys(e1).length) { if (t.exc) { delete t.exc[d]; if (!Object.keys(t.exc).length) delete t.exc; } } else { t.exc = t.exc || {}; t.exc[d] = e1; }
      }
      closeModal(); save(); refresh(); renderMain();
    };
  });
}

const RECUR_ACT = {
  excadd: () => { const t = getT(U.sel); if (t && t.repeat && t.due) excDlg(t, null); },
  excedit: el => { const t = getT(U.sel); if (t) excDlg(t, el.dataset.d); },
};
