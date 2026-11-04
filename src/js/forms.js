/* OpenTick form dialog: one small helper for the dialogs of countdowns, time zones and boards (name, date, time, choices, colour, icon…).
   formDialog({ title, fields, ok, del, check }) -> Promise of { key: value } (or { _del: true } when Delete is pressed), null when cancelled.
   A field is { k, label, type, v, ...}:  text · textarea · date · time · number · select (opts) · check · color · icon · hint (text only).
   `check(values)` may return a message: the dialog stays open and shows it. */
function formDialog(o) {
  return new Promise(res => {
    const fields = o.fields.map(f => ({ ...f })), val = {};
    for (const f of fields) val[f.k] = f.v;
    const html = fields.map(f => {
      const id = 'fd-' + f.k, lab = f.label ? `<span>${esc(f.label)}</span>` : '';
      if (f.type === 'hint') return `<p class="hint">${esc(f.label || f.v || '')}</p>`;
      if (f.type === 'check') return `<label class="chkl fd-c"><input type="checkbox" data-fd="${f.k}"${f.v ? ' checked' : ''}> ${esc(f.label)}</label>`;
      if (f.type === 'select') return `<label>${lab}<select data-fd="${f.k}">${opts(f.opts, f.v)}</select></label>`;
      if (f.type === 'textarea') return `<label>${lab}<textarea data-fd="${f.k}" rows="${f.rows || 3}" placeholder="${esc(f.ph || '')}">${esc(f.v || '')}</textarea></label>`;
      if (f.type === 'color') return `<div class="lbl">${lab}<div class="sw" data-fdc="${f.k}">${COLORS.map(([c, n]) => `<button type="button" style="--c:${c}" class="${c === f.v ? 'on' : ''}" data-c="${c}" title="${n}" aria-label="${n}"></button>`).join('')}</div></div>`;
      if (f.type === 'icon') return `<div class="lbl">${lab}<button type="button" class="btn fd-ic" data-fdi="${f.k}">${f.v ? iconAny(f.v, 18) : ic('plus', 16)}<span>${f.v ? 'Change icon' : 'Choose an icon'}</span></button>${f.v ? `<button type="button" class="btn sm" data-fdx="${f.k}">Remove</button>` : ''}</div>`;
      return `<label>${lab}<input id="${id}" data-fd="${f.k}" type="${f.type || 'text'}" value="${esc(f.v ?? '')}" placeholder="${esc(f.ph || '')}" autocomplete="off"${f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}${f.step ? ` step="${f.step}"` : ''}></label>`;
    }).join('');
    openModal(`<h3>${esc(o.title)}</h3><div class="form one fd">${html}</div><div class="mact">${o.del ? '<button class="danger" data-m="del">Delete</button>' : ''}<span class="sp"></span><button data-m="no">Cancel</button><button class="pri" data-m="ok">${esc(o.ok || 'Save')}</button></div>`, m => {
      const read = () => {
        for (const f of fields) {
          const el = $(`[data-fd="${f.k}"]`, m); if (!el) continue;
          val[f.k] = f.type === 'check' ? el.checked : f.type === 'number' ? (el.value === '' ? null : +el.value) : el.value;
        }
        return { ...val };
      };
      const first = $('input[type=text],input:not([type]),input[type=date]', m); if (first && first.focus) first.focus();
      m.onclick = async e => {
        const cb = e.target.closest('[data-fdc] [data-c]');
        if (cb) { const k = cb.closest('[data-fdc]').dataset.fdc; val[k] = cb.dataset.c; $$('[data-fdc="' + k + '"] [data-c]', m).forEach(x => x.classList.toggle('on', x === cb)); return; }
        const ib = e.target.closest('[data-fdi]'), xb = e.target.closest('[data-fdx]');
        if (ib || xb) {
          const k = (ib || xb).dataset.fdi || xb.dataset.fdx, cur = read(); let pick = '';
          if (ib) { pick = await pickIcon(cur[k] || '', 'var(--acc)'); if (pick === null) pick = cur[k]; }
          formDialog({ ...o, fields: fields.map(f => ({ ...f, v: f.k === k ? pick : cur[f.k] })) }).then(res); return;
        }
        const b = e.target.closest('[data-m]');
        if (!b) { if (e.target.classList.contains('mback')) { closeModal(); res(null); } return; }
        if (b.dataset.m === 'no') { closeModal(); res(null); }
        else if (b.dataset.m === 'del') { closeModal(); res({ _del: true }); }
        else if (b.dataset.m === 'ok') {
          const v = read(), bad = o.check ? o.check(v) : ''; if (bad) { toast(bad); return; }
          closeModal(); res(v);
        }
      };
      m.onkeydown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); const ok = $('[data-m=ok]', m); if (ok) ok.click(); } };
    }, 'wide');
  });
}
