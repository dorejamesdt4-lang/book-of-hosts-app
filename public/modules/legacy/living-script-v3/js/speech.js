// ====================================================================
// SPEECH — plays one voiced line at a time through the theme pack's
// voice FX, and reports how loud the *dry* speech is right now so the
// talking mouth follows the words (not the echo or the tape wobble).
//
//   const speech = createSpeech();
//   speech.setPreset('hall-echo');
//   speech.unlock();                     // inside a click (autoplay rules)
//   await speech.play({ audio, sampleRate, rate });
//   speech.level()                       // 0..1, for the mouth
//   speech.pause(); speech.resume(); speech.stop();
//
// `rate` is the pitch shift: the line was generated at pace / rate, so
// playing it back at `rate` restores the pace and moves the pitch.
// ====================================================================

import { createFx } from './voice-fx.js';

const START_LEAD = 0.05;
const ENVELOPE_WINDOW = 0.02;
const ENVELOPE_PERCENTILE = 0.95;

function computeEnvelope(samples, sampleRate) {
  const size = Math.max(1, Math.round(sampleRate * ENVELOPE_WINDOW));
  const frames = [];
  for (let i = 0; i < samples.length; i += size) {
    const end = Math.min(i + size, samples.length);
    let sum = 0;
    for (let j = i; j < end; j++) sum += samples[j] * samples[j];
    frames.push(Math.sqrt(sum / (end - i)));
  }
  const sorted = frames.slice().sort((a, b) => a - b);
  const norm = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ENVELOPE_PERCENTILE))] || 1;
  return { levels: frames.map((v) => Math.min(1, v / norm)), step: size / sampleRate };
}

export function createSpeech() {
  let ctx = null;
  let fx = null;
  let preset = 'none';
  let current = null; // { src, startAt, rate, env, resolve }
  let paused = false;

  function ensure() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      ctx = new Ctx();
    }
    if (!fx) {
      fx = createFx(ctx, preset);
      fx.output.connect(ctx.destination);
    }
    return ctx;
  }

  function finish(result) {
    if (!current) return;
    const c = current;
    current = null;
    c.src.onended = null;
    try { c.src.stop(); } catch (e) { /* already stopped */ }
    c.resolve(result);
  }

  return {
    get context() { return ctx; },
    get playing() { return !!current; },
    get paused() { return paused; },

    setPreset(next) {
      if (next === preset && fx) return;
      preset = next || 'none';
      if (fx) { fx.dispose(); fx = null; }
      if (ctx) ensure();
    },

    unlock() {
      ensure();
      if (!paused && ctx.state === 'suspended') ctx.resume();
    },

    // Resolves { done: true } when the line ends, { stopped: true } if cut off.
    play({ audio, sampleRate, rate = 1 }) {
      finish({ stopped: true });
      ensure();
      if (!paused && ctx.state === 'suspended') ctx.resume();
      const buffer = ctx.createBuffer(1, audio.length, sampleRate);
      buffer.copyToChannel(audio instanceof Float32Array ? audio : new Float32Array(audio), 0);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate;
      src.connect(fx.input);
      const startAt = ctx.currentTime + START_LEAD;
      src.start(startAt);
      return new Promise((resolve) => {
        current = { src, startAt, rate, env: computeEnvelope(audio, sampleRate), resolve };
        src.onended = () => finish({ done: true });
      });
    },

    level() {
      if (!current || !ctx) return 0;
      const t = (ctx.currentTime - current.startAt) * current.rate;
      if (t < 0) return 0;
      const idx = Math.floor(t / current.env.step);
      return idx < current.env.levels.length ? current.env.levels[idx] : 0;
    },

    stop() { finish({ stopped: true }); },

    pause() {
      paused = true;
      if (ctx) ctx.suspend();
    },

    resume() {
      paused = false;
      if (ctx) ctx.resume();
    }
  };
}
