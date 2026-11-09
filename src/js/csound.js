/* OpenTick custom notification sound: choose an audio file in Settings → Sound & focus and it plays in place of the built-in "Timer / reminder"
   chime. That one cue is what reminders, the focus timer and the test notification use, so one choice covers all of them.

   Where it lives. The file is kept on this device only, in IndexedDB under "sound:custom", written through fileRecord() like an attachment:
   with device encryption on it is sealed (name, type and bytes) and vaultReseal() seals / unseals it with the rest when encryption is turned on,
   off or re-keyed. It is never part of the sync file and never leaves the device. The settings keep only { name, type, size, at } (no audio),
   and that is per device like every other setting. On a device that has the settings but not the file (a restored backup, another phone) the
   built-in chime plays and Settings says the file is not here.

   What it does not do. It plays while OpenTick is open. A notification that the system shows by itself (the Android background service, the
   desktop service while the window is closed) uses the system's own notification sound, which the app cannot replace. */
const CS_KEY = 'sound:custom', CS_MAX = 5 * 1024 * 1024, CS_SECS = 30;
const CS = { buf: null, id: '', src: null, busy: null };
const csMeta = () => { const c = S.settings && S.settings.sound && S.settings.sound.custom; return c && typeof c === 'object' && c.name ? c : null; };
const csId = () => { const m = csMeta(); return m ? m.at + ':' + m.size : ''; };

// read the stored file and decode it, so it can start the instant a reminder fires. Resolves to true when it is ready to play.
async function csoundLoad(force) {
  const m = csMeta(); if (!m) { CS.buf = null; CS.id = ''; return false; }
  if (!force && CS.buf && CS.id === csId()) return true;
  if (CS.busy) return CS.busy;
  const job = (async () => {
    try {
      const blob = await fileOpen(await idb('readonly', s => s.get(CS_KEY)));
      const ctx = blob && sfxCtx(); if (!blob || !ctx || !ctx.decodeAudioData) { CS.buf = null; return false; }
      CS.buf = await ctx.decodeAudioData(await blob.arrayBuffer()); CS.id = csId(); return true;
    } catch (e) { CS.buf = null; return false; } // locked, missing or unreadable: the built-in chime is used
    finally { CS.busy = null; }
  })();
  CS.busy = job; return job;
}
function csoundStop() { const s = CS.src; CS.src = null; if (s) { try { s.onended = null; s.stop(); } catch (e) { /* it had already ended */ } } }
// play it; false means "use the built-in chime" (nothing chosen, not loaded yet, or no audio here)
function csoundPlay() {
  if (!csMeta()) return false;
  if (!CS.buf || CS.id !== csId()) { csoundLoad(); return false; } // not decoded yet: this one is the built-in chime, the next is yours
  const ctx = sfxCtx(); if (!ctx) return false;
  csoundStop();
  try {
    const src = ctx.createBufferSource(), g = ctx.createGain();
    g.gain.value = Math.max(0, Math.min(1, +sfxCfg().vol)) ** 1.6; // the same volume setting as every other cue
    src.buffer = CS.buf; src.connect(g); g.connect(ctx.destination);
    src.onended = () => { if (CS.src === src) CS.src = null; };
    src.start(); CS.src = src; return true;
  } catch (e) { return false; }
}

// use `file` as the reminder sound. Resolves to { ok: true, name } or { ok: false, error } with a sentence for the person.
async function csoundSet(file) {
  const name = String((file && file.name) || 'sound').slice(0, 120);
  if (!file || !file.size) return { ok: false, error: `“${name}” is empty, so it was not used.` };
  if (file.size > CS_MAX) return { ok: false, error: `“${name}” is larger than ${CS_MAX / 1048576} MB. Choose a shorter sound.` };
  const ctx = sfxCtx(); if (!ctx || !ctx.decodeAudioData) return { ok: false, error: 'Sound is not available here, so a custom sound cannot be used.' };
  let buf; try { buf = await ctx.decodeAudioData(await file.arrayBuffer()); } catch (e) { return { ok: false, error: `“${name}” could not be read as sound. Try an MP3, WAV, OGG or M4A file.` }; }
  if (!buf || !(buf.duration > 0)) return { ok: false, error: `“${name}” has no sound in it.` };
  if (buf.duration > CS_SECS) return { ok: false, error: `“${name}” is ${Math.round(buf.duration)} seconds long. A reminder sound can be up to ${CS_SECS} seconds.` };
  const type = file.type || (typeof mimeFromName === 'function' ? mimeFromName(name) : '') || '';
  try {
    const rec = await fileRecord(file, { name, type, size: file.size }, Date.now());
    await idb('readwrite', s => s.put(rec, CS_KEY));
    const back = await fileOpen(await idb('readonly', s => s.get(CS_KEY))); // never keep a record whose bytes did not make it into storage
    if (!back || back.size !== file.size) { try { await idb('readwrite', s => s.delete(CS_KEY)); } catch (e) { /* nothing to clean */ } throw new Error('it was not saved completely'); }
  } catch (e) { return { ok: false, error: `“${name}” could not be stored: ${(e && e.message) || 'storage error'}.` }; }
  csoundStop();
  if (!S.settings.sound) S.settings.sound = { on: true, vol: 0.7, haptic: true };
  S.settings.sound.custom = { name, type, size: file.size, at: Date.now() }; CS.buf = buf; CS.id = csId(); save();
  return { ok: true, name };
}
async function csoundRemove() {
  csoundStop(); CS.buf = null; CS.id = '';
  try { await idb('readwrite', s => s.delete(CS_KEY)); } catch (e) { /* nothing was stored */ }
  if (S.settings.sound) S.settings.sound.custom = null; save();
}
// forget the file and the choice (used when the settings are reset)
async function csoundWipe() { try { await csoundRemove(); } catch (e) { /* storage is optional */ } }
// is the chosen file really on this device? (the settings can arrive in a backup without it)
async function csoundHave() { try { return !!(await idb('readonly', s => s.get(CS_KEY))); } catch (e) { return false; } }

/* ---------- Settings → Sound & focus ---------- */
function csoundSettingsHtml(have) {
  const m = csMeta(), missing = m && have === false;
  return `<div class="csnd" id="csnd"><h4 class="mh">Reminder sound</h4>`
    + (m
      ? `<div class="mrow tight"><span class="csn">${ic('volume', 16)}<span class="csl"><b>${esc(m.name)}</b> <small class="hint">${esc(fileSize(m.size))}${missing ? ' · not on this device' : ''}</small></span></span></div>`
        + `<div class="mrow tight"><button class="btn sm" data-csnd="play"${missing ? ' disabled' : ''}>${ic('play', 13)} Play</button><button class="btn sm" data-csnd="pick">Choose another…</button><button class="btn sm" data-csnd="rm">Use the built-in chime</button></div>`
        + (missing ? '<p class="hint">The settings came from another device or a backup, so the file itself is not here. Choose it again, or use the built-in chime.</p>' : '')
      : `<div class="mrow tight"><span class="hint">Using the built-in chime.</span></div><div class="mrow tight"><button class="btn sm" data-csnd="pick">${ic('plus', 13)} Choose a sound file…</button></div>`)
    + `<p class="hint">Plays for reminders, the focus timer and the test notification while OpenTick is open. MP3, WAV, OGG or M4A, up to ${CS_MAX / 1048576} MB and ${CS_SECS} seconds. It stays on this device (it is not synced) and is encrypted with your attachments when device encryption is on. Notifications that the system shows by itself, such as when the phone app is closed, use the system's own sound; change that in your device's notification settings for OpenTick.</p></div>`;
}
async function csoundRefresh() {
  const el = typeof $ === 'function' ? $('#csnd') : null; if (!el) return;
  const have = csMeta() ? await csoundHave() : true; el.outerHTML = csoundSettingsHtml(have);
}
async function csoundAction(el) {
  const a = el.dataset.csnd;
  if (a === 'pick') {
    const fs = await pickFiles('audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus', false); if (!fs.length) return;
    const r = await csoundSet(fs[0]); toast(r.ok ? `“${r.name}” is now the reminder sound` : r.error, r.ok ? undefined : { label: 'OK', fn() {} });
    if (r.ok) sfx('chime', true);
  } else if (a === 'play') { if (await csoundLoad()) sfx('chime', true); else toast('This sound is not on this device. Choose it again.'); }
  else if (a === 'rm') { await csoundRemove(); toast('Back to the built-in chime'); }
  csoundRefresh();
}
