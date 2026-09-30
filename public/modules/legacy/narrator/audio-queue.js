// ====================================================================
// AUDIO QUEUE -- gapless Web Audio playback of speech chunks as they
// arrive. Each chunk is scheduled on the AudioContext clock to start
// exactly when the previous one ends; a few-ms fade at each edge stops
// clicks at the joins. The queue keeps every chunk of the take so it
// can be replayed without regenerating and exported as one WAV.
//
// It also precomputes a speech-level envelope per chunk and reports
// which chunk is playing and how loud it is right now, so the page can
// drive the talking mouth and level meter from the real audio.
//
//   const q = new AudioQueue({ onEnded });
//   q.unlock();                      // inside a click handler (autoplay rules)
//   q.startTake({ playbackRate, hold });  // new take; clears the old one.
//                                    // hold: buffer chunks without playing
//   q.enqueue({ audio, sampleRate, meta });
//   q.release();                     // start a held take (buffered chunks play back to back)
//   q.finishTake();                  // no more chunks coming
//   q.stop(); q.replay();
//   q.pause(); q.resume();           // freeze / continue the whole take
//   q.now() -> { chunk, level, elapsed, total } | null
//   q.getSamples() -> { samples, sampleRate }
// ====================================================================

const FADE_SECONDS = 0.004;
const START_LEAD_SECONDS = 0.06; // headroom for the first chunk / after an underrun
const ENVELOPE_WINDOW_SECONDS = 0.02;
const ENVELOPE_NORMALISE_PERCENTILE = 0.95;

function applyEdgeFades(samples, sampleRate) {
  const n = Math.min(Math.floor(sampleRate * FADE_SECONDS), Math.floor(samples.length / 2));
  for (let i = 0; i < n; i++) {
    const g = i / n;
    samples[i] *= g;
    samples[samples.length - 1 - i] *= g;
  }
}

// RMS per ~20ms window, normalised against a high percentile rather
// than the single loudest window (same approach as lib/talk-bridge.js).
function computeEnvelope(samples, sampleRate) {
  const windowSize = Math.max(1, Math.round(sampleRate * ENVELOPE_WINDOW_SECONDS));
  const frames = [];
  for (let i = 0; i < samples.length; i += windowSize) {
    const end = Math.min(i + windowSize, samples.length);
    let sumSq = 0;
    for (let j = i; j < end; j++) sumSq += samples[j] * samples[j];
    frames.push(Math.sqrt(sumSq / (end - i)));
  }
  const sorted = frames.slice().sort((a, b) => a - b);
  const norm = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ENVELOPE_NORMALISE_PERCENTILE))] || 1;
  return {
    levels: frames.map((v) => Math.max(0, Math.min(1, v / norm))),
    stepSeconds: windowSize / sampleRate
  };
}

function envelopeLevelAt(envelope, t) {
  if (!envelope.levels.length) return 0;
  const idx = Math.max(0, Math.min(envelope.levels.length - 1, Math.floor(t / envelope.stepSeconds)));
  return envelope.levels[idx];
}

export class AudioQueue {
  constructor({ onEnded, onScheduled } = {}) {
    this.ctx = null;
    this.onEnded = onEnded || null;
    // (chunk, gapSeconds) -- gap = silence since the previous chunk ended
    // (0 when back to back), null for the first chunk of a take.
    this.onScheduled = onScheduled || null;
    this.chunks = [];        // every chunk of the current take, in order
    this.sources = new Set();
    this.playbackRate = 1;
    this.takeStart = null;   // ctx time the first chunk started
    this.nextStart = 0;      // ctx time the next chunk should start
    this.complete = false;   // finishTake() called
    this.playing = false;
    this.held = false;       // buffering: chunks queue up but don't play yet
    this.paused = false;     // pause(): the clock is frozen until resume()
  }

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    }
    // A paused take stays frozen even while new chunks arrive.
    if (!this.paused && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // Suspending the AudioContext freezes its clock, so every scheduled
  // chunk (and now()) simply carries on from the same spot on resume().
  pause() {
    if (!this.ctx) return;
    this.paused = true;
    this.ctx.suspend();
  }

  resume() {
    if (!this.ctx) return;
    this.paused = false;
    this.ctx.resume();
  }

  startTake({ playbackRate = 1, hold = false } = {}) {
    this.stop();
    this.chunks = [];
    this.playbackRate = playbackRate;
    this.complete = false;
    this.held = hold;
  }

  release() {
    if (!this.held) return;
    this.held = false;
    this.unlock();
    this.chunks.forEach((chunk) => this._schedule(chunk));
    this._checkEnded();
  }

  enqueue({ audio, sampleRate, meta }) {
    this.unlock();
    if (!audio || !audio.length) return;
    applyEdgeFades(audio, sampleRate);
    const buffer = this.ctx.createBuffer(1, audio.length, sampleRate);
    buffer.copyToChannel(audio, 0);
    const chunk = {
      audio,
      sampleRate,
      buffer,
      meta: meta || {},
      envelope: computeEnvelope(audio, sampleRate),
      duration: buffer.duration / this.playbackRate, // on the playback timeline
      startAt: 0
    };
    this.chunks.push(chunk);
    if (!this.held) this._schedule(chunk);
  }

  finishTake() {
    this.complete = true;
    this._checkEnded();
  }

  // Everything in the current take has been generated.
  get hasCompleteTake() {
    return this.complete && this.chunks.length > 0;
  }

  stop() {
    this.held = false;
    this.paused = false;
    this.sources.forEach((src) => {
      src.onended = null;
      try { src.stop(); } catch (e) { /* already stopped */ }
    });
    this.sources.clear();
    this.playing = false;
    this.takeStart = null;
  }

  // Replays the whole (complete) take from the start.
  replay() {
    this.stop();
    this.unlock();
    this.chunks.forEach((chunk) => this._schedule(chunk));
  }

  _schedule(chunk) {
    const ctx = this.ctx;
    const earliest = ctx.currentTime + START_LEAD_SECONDS;
    // Back to back with the previous chunk; if generation fell behind
    // playback (an underrun), start as soon as possible instead.
    const startAt = (this.playing && this.nextStart >= earliest) ? this.nextStart : earliest;
    const gap = this.playing ? Math.max(0, startAt - this.nextStart) : null;
    const src = ctx.createBufferSource();
    src.buffer = chunk.buffer;
    // Pitch is applied as a playback-rate change (see narrator.js).
    src.playbackRate.value = this.playbackRate;
    src.connect(ctx.destination);
    src.start(startAt);
    src.onended = () => {
      this.sources.delete(src);
      this._checkEnded();
    };
    this.sources.add(src);
    chunk.startAt = startAt;
    this.nextStart = startAt + chunk.duration;
    if (!this.playing) {
      this.playing = true;
      this.takeStart = startAt;
    }
    if (this.onScheduled) this.onScheduled(chunk, gap);
  }

  _checkEnded() {
    if (!this.playing || !this.complete || this.sources.size) return;
    this.playing = false;
    this.takeStart = null;
    if (this.onEnded) this.onEnded();
  }

  // Playback position right now: the chunk under the playhead (null in
  // a gap or before the first chunk starts), its speech level, and the
  // elapsed / known-total seconds of the take.
  now() {
    if (!this.playing || !this.ctx) return null;
    const t = this.ctx.currentTime;
    let chunk = null;
    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i];
      if (t >= c.startAt && t < c.startAt + c.duration) { chunk = c; break; }
    }
    const level = chunk ? envelopeLevelAt(chunk.envelope, (t - chunk.startAt) * this.playbackRate) : 0;
    const total = this.chunks.reduce((sum, c) => sum + c.duration, 0);
    const elapsed = Math.max(0, Math.min(total, t - this.takeStart));
    return { chunk, level, elapsed, total };
  }

  totalDuration() {
    return this.chunks.reduce((sum, c) => sum + c.duration, 0);
  }

  // The whole take as one mono buffer (unpitched, as generated).
  getSamples() {
    const sampleRate = this.chunks.length ? this.chunks[0].sampleRate : 24000;
    const length = this.chunks.reduce((n, c) => n + c.audio.length, 0);
    const samples = new Float32Array(length);
    let offset = 0;
    this.chunks.forEach((c) => { samples.set(c.audio, offset); offset += c.audio.length; });
    return { samples, sampleRate };
  }
}
