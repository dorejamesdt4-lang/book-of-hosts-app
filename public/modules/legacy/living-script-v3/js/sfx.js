// ====================================================================
// SOUND EFFECTS — small sounds made in the browser (no files): the dice
// rattle and the soft chime on a player's phone. Both are quiet and
// short. They respect the "sound effects" setting (ls3.sfx, on unless
// the host turns it off) and only play after the page has had a click
// or tap (browsers block sound before that).
// ====================================================================

import { lsGet, lsSet } from './common.js';

const KEY = 'ls3.sfx';

export function sfxEnabled() { return lsGet(KEY, true) !== false; }
export function setSfxEnabled(on) { lsSet(KEY, !!on); }

let ctx = null;
function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// Call from any click/tap so later sounds are allowed.
export function unlockSfx() { if (sfxEnabled()) audio(); }

// About a second of dice rattling: a dozen short, filtered clicks that
// slow down as the dice settle.
export function rattle(durationMs = 1000) {
  if (!sfxEnabled()) return;
  const c = audio();
  if (!c) return;
  const out = c.createGain();
  out.gain.value = 0.18;
  out.connect(c.destination);
  const now = c.currentTime;
  let t = 0;
  let gap = 0.045;
  while (t < durationMs / 1000) {
    const len = 0.02;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200 + Math.random() * 1800;
    bp.Q.value = 3;
    src.connect(bp).connect(out);
    src.start(now + t);
    t += gap;
    gap *= 1.12;
  }
}

// A soft two-note chime (a gentle "it's your turn").
export function chime() {
  if (!sfxEnabled()) return;
  const c = audio();
  if (!c) return;
  const now = c.currentTime;
  [[659.25, 0], [880, 0.14]].forEach(([freq, at]) => {
    const osc = c.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(0, now + at);
    g.gain.linearRampToValueAtTime(0.12, now + at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.6);
    osc.connect(g).connect(c.destination);
    osc.start(now + at);
    osc.stop(now + at + 0.65);
  });
}
