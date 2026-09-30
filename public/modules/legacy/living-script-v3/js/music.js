// ====================================================================
// MUSIC — the Jukebox player on the host's Stage. The engine picks the
// track (engine/jukebox.js: only made_on_paid_plan tracks, ever); this
// plays it, keeps the same mood going until the next cue, and ducks
// under speech.
//
//   const music = createMusic({ manifest, theme, onChange });
//   music.cue({ mood }) | music.cue({ stop: true })
//   music.duck(true / false)          // speech starting / finished
//   music.skip(); music.togglePause(); music.setVolume(0..1); music.playNow(mood)
//   music.state -> { mood, track, playing, paused, volume, missing }
// ====================================================================

import { pickTrack } from '../engine/jukebox.js';

const DUCK_TO = 0.25;   // share of the volume left under speech
const RAMP_MS = 300;
const FADE_OUT_MS = 1200;

export function createMusic({ manifest, theme, base = 'jukebox/', volume = 0.7, onChange = () => {} }) {
  const audio = new Audio();
  audio.preload = 'auto';
  let mood = null;
  let track = null;
  let paused = false;
  let ducked = false;
  let missing = false;
  let level = volume;
  let ramp = null;

  function target() { return level * (ducked ? DUCK_TO : 1); }

  function rampTo(value, ms, then) {
    clearInterval(ramp);
    const start = audio.volume;
    const steps = Math.max(1, Math.round(ms / 30));
    let i = 0;
    ramp = setInterval(() => {
      i += 1;
      audio.volume = Math.max(0, Math.min(1, start + (value - start) * (i / steps)));
      if (i >= steps) { clearInterval(ramp); ramp = null; if (then) then(); }
    }, 30);
  }

  function state() {
    return { mood, track: track ? { title: track.title, file: track.file } : null, playing: !!track && !audio.paused, paused, volume: level, missing };
  }

  function play(next) {
    track = next;
    missing = !next;
    if (!next) { audio.pause(); onChange(state()); return; }
    audio.src = base + next.file;
    audio.volume = 0;
    const p = audio.play();
    if (p && p.catch) p.catch((err) => console.warn('Music could not start (the page may need a click first).', err));
    rampTo(target(), RAMP_MS);
    paused = false;
    onChange(state());
  }

  audio.addEventListener('ended', () => {
    if (mood) play(pickTrack(manifest, { theme, mood, lastFile: track && track.file }));
  });
  audio.addEventListener('error', () => {
    console.warn('Music file failed to load:', audio.src);
    track = null;
    missing = true;
    onChange(state());
  });

  return {
    get state() { return state(); },

    cue({ mood: m, track: named = null, stop = false }) {
      if (stop) {
        mood = null;
        rampTo(0, FADE_OUT_MS, () => { audio.pause(); track = null; onChange(state()); });
        return;
      }
      mood = m;
      play(pickTrack(manifest, { theme, mood: m, track: named, lastFile: track && track.file }));
    },

    playNow(m) { this.cue({ mood: m }); },

    skip() {
      if (mood) play(pickTrack(manifest, { theme, mood, lastFile: track && track.file }));
    },

    togglePause() {
      if (!track) return;
      paused = !paused;
      if (paused) audio.pause(); else { audio.play().catch(() => {}); rampTo(target(), RAMP_MS); }
      onChange(state());
    },

    setVolume(v) {
      level = Math.max(0, Math.min(1, Number(v)));
      if (!ramp) audio.volume = target();
      onChange(state());
    },

    duck(on) {
      if (ducked === !!on) return;
      ducked = !!on;
      if (track && !paused) rampTo(target(), RAMP_MS);
    }
  };
}
