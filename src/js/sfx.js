'use strict';
/* OpenTick sound effects: short cues synthesized with the Web Audio API, so there are no audio files to ship or cache.
   Per device (S.settings.sound): { on, vol, haptic }. Browsers only allow audio after a tap or key press, so the audio
   context is created, and resumed, on the first pointer / key event. */
const SFX = { ctx: null, master: null, last: {} };
// note = [frequency Hz, start s, length s, wave, gain, bell]; "bell" adds a soft overtone for a glassy ring
const SOUNDS = {
  done: { label: 'Task complete', n: [[659.25, 0, .16, 'sine', 1, 1], [987.77, .075, .34, 'sine', .95, 1], [1318.5, .15, .5, 'sine', .35, 1]], buzz: [12] },
  undo: { label: 'Reopen', n: [[392, 0, .09, 'triangle', .8], [311.13, .07, .14, 'triangle', .7]], buzz: [8] },
  tick: { label: 'Tick (subtask, checklist)', n: [[1046.5, 0, .07, 'triangle', .7]], buzz: [6] },
  add: { label: 'Task added', n: [[523.25, 0, .07, 'sine', .8], [783.99, .06, .12, 'sine', .8]], buzz: [6] },
  sched: { label: 'Scheduled', n: [[587.33, 0, .06, 'sine', .8], [880, .05, .1, 'sine', .7]], buzz: [8] },
  trash: { label: 'Deleted', n: [[330, 0, .08, 'triangle', .9], [196, .06, .18, 'triangle', .8]], buzz: [14] },
  start: { label: 'Timer start', n: [[660, 0, .09, 'sine', .9, 1]], buzz: [10] },
  chime: { label: 'Timer / reminder', n: [[523.25, 0, .3, 'sine', .9, 1], [659.25, .18, .3, 'sine', .9, 1], [783.99, .36, .3, 'sine', .9, 1], [1046.5, .54, .9, 'sine', .9, 1]], buzz: [30, 60, 30] },
  streak: { label: 'Streak', n: [[523.25, 0, .12, 'triangle', .8, 1], [659.25, .09, .12, 'triangle', .8, 1], [783.99, .18, .14, 'triangle', .8, 1], [1046.5, .28, .55, 'sine', 1, 1], [1318.5, .36, .5, 'sine', .4, 1]], buzz: [10, 40, 10, 40, 24] },
  error: { label: 'Error', n: [[196, 0, .11, 'square', .35], [174.6, .12, .16, 'square', .35]], buzz: [40, 40, 40] },
};
const sfxDuration = k => (SOUNDS[k] ? Math.max(0.2, ...SOUNDS[k].n.map(n => n[1] + n[2])) : 0.3) + 0.1; // seconds a cue lasts, so a play button can show "playing" for as long
const sfxCfg = () => (S.settings && S.settings.sound) || { on: true, vol: 0.7, haptic: true };
function sfxCtx() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    if (!SFX.ctx) {
      SFX.ctx = new AC();
      SFX.master = SFX.ctx.createGain();
      const comp = SFX.ctx.createDynamicsCompressor(); // keeps several quick cues from clipping
      SFX.master.connect(comp); comp.connect(SFX.ctx.destination);
    }
    if (SFX.ctx.state === 'suspended' && SFX.ctx.resume) SFX.ctx.resume();
    return SFX.ctx;
  } catch (e) { return null; }
}
function sfxPlay(name) {
  const def = SOUNDS[name], ctx = sfxCtx(); if (!def || !ctx) return false;
  const now = ctx.currentTime + 0.01, vol = Math.max(0, Math.min(1, +sfxCfg().vol)) ** 1.6 * 0.4;
  SFX.master.gain.setValueAtTime(vol, now);
  for (const [f, at, len, wave, g = 1, bell] of def.n) {
    const voice = (freq, gain, type) => {
      const o = ctx.createOscillator(), e = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, now + at);
      e.gain.setValueAtTime(0.0001, now + at);
      e.gain.linearRampToValueAtTime(gain, now + at + 0.008);            // quick attack: no click
      e.gain.exponentialRampToValueAtTime(0.0001, now + at + len);       // natural decay
      o.connect(e); e.connect(SFX.master); o.start(now + at); o.stop(now + at + len + 0.05);
    };
    voice(f, g, wave);
    if (bell) voice(f * 2.01, g * 0.22, 'sine');
  }
  return true;
}
// play a named cue; honours the on/off setting, and never throws
function sfx(name, force) {
  try {
    const c = sfxCfg();
    if (!force && c.on === false) return;
    const t = Date.now(); if (!force && SFX.last[name] && t - SFX.last[name] < 45) return; SFX.last[name] = t;
    sfxPlay(name);
    if (!force && c.haptic !== false && SOUNDS[name] && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(SOUNDS[name].buzz);
  } catch (e) { /* sound is a nicety, never a failure */ }
}
function sfxUnlock() { if (sfxCfg().on !== false) sfxCtx(); }
if (typeof document !== 'undefined' && document.addEventListener) {
  for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, sfxUnlock, { passive: true, capture: true });
}
