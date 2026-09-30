// lib/talk-bridge.js
//
// Page-side ES module. Drives a talking-enabled (v2) character
// animation's mouth from real speech audio, entirely via postMessage --
// it never touches the sandboxed iframe's DOM (that iframe runs
// sandbox="allow-scripts" with no allow-same-origin, so contentDocument
// access would be blocked anyway, and would violate the design even if
// it weren't).
//
// Preferred architecture (see the handoff doc in
// dore-animation-library/prompts/): Kokoro already returns raw Float32
// audio samples and a sample rate, so the speech envelope is computed
// once from those samples up front, then looked up against
// audioEl.currentTime on every tick. That keeps play/pause/seek all
// trivially correct -- there is no separate "timer" pretending to be
// speech; the envelope position always follows the real playhead.
//
// Exports:
//   attach(audioEl, iframeEl)
//       Convenience wrapper with no sample data (see note below).
//   attachSamples(float32, sampleRate, audioEl, iframeEl)
//       The real path: precomputes an RMS envelope from the given
//       samples and syncs it against audioEl during play/pause/seek.
//   detach()
//       Tears down whatever is currently attached (if anything) and
//       sends a final talk-stop to its iframe.
//   testTalk(iframeEl, durationMs)
//       Sends a synthetic speech-like level pattern (varying 0..1, with
//       short pauses) for ~durationMs, then talk-stop. Independent of
//       attach/attachSamples -- no audio, no Kokoro model load. Used by
//       the TEST TALK button on seumas-engine.html to visually check a
//       v2 animation's talking response without recording anything.
//
// Message format sent to the iframe (target origin "*" -- the iframe's
// origin is opaque because of its sandbox, so a real origin can't be
// named; the receiver verifies identity via event.source instead):
//   { source: "dore-narrator-talk", type: "talk-start", level }
//   { source: "dore-narrator-talk", type: "talk-level", level }
//   { source: "dore-narrator-talk", type: "talk-stop",  level: 0 }

const UPDATE_INTERVAL_MS = 33; // ~30/sec
const SMOOTHING = 0.4; // exponential moving average factor per tick
const RMS_WINDOW_SECONDS = 0.02; // 20ms
const NORMALISE_PERCENTILE = 0.95; // high percentile, not the raw peak

function send(win, type, level) {
  if (!win) return;
  try {
    win.postMessage({ source: 'dore-narrator-talk', type: type, level: level }, '*');
  } catch (e) {
    // iframe torn down mid-flight -- nothing to do
  }
}

// Precomputes an RMS envelope from raw Float32 samples: one value per
// ~20ms window, normalised against a high percentile of the loudest
// windows (rather than the single loudest sample) so one transient peak
// doesn't crush the rest of the envelope toward zero.
function computeEnvelope(float32, sampleRate) {
  const windowSize = Math.max(1, Math.round(sampleRate * RMS_WINDOW_SECONDS));
  const frames = [];
  for (let i = 0; i < float32.length; i += windowSize) {
    const end = Math.min(i + windowSize, float32.length);
    let sumSq = 0;
    for (let j = i; j < end; j++) sumSq += float32[j] * float32[j];
    frames.push(Math.sqrt(sumSq / (end - i)));
  }

  const sorted = frames.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * NORMALISE_PERCENTILE));
  const norm = sorted[idx] || 1;

  return {
    levels: frames.map((v) => Math.max(0, Math.min(1, v / norm))),
    stepSeconds: windowSize / sampleRate
  };
}

function levelAtTime(envelope, t) {
  if (!envelope || !envelope.levels.length) return 0;
  let idx = Math.floor(t / envelope.stepSeconds);
  if (idx < 0) idx = 0;
  if (idx >= envelope.levels.length) idx = envelope.levels.length - 1;
  return envelope.levels[idx];
}

let current = null; // the one active attach()/attachSamples() binding, if any

function stopLoop(state) {
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
}

function startLoop(state) {
  stopLoop(state);
  state.timer = setInterval(() => {
    const win = state.iframeEl && state.iframeEl.contentWindow;
    if (!win) return;
    const raw = levelAtTime(state.envelope, state.audioEl.currentTime);
    state.smoothed += (raw - state.smoothed) * SMOOTHING;
    send(win, 'talk-level', state.smoothed);
  }, UPDATE_INTERVAL_MS);
}

export function detach() {
  if (!current) return;
  const state = current;
  current = null;

  stopLoop(state);
  state.audioEl.removeEventListener('play', state.onPlay);
  state.audioEl.removeEventListener('pause', state.onPause);
  state.audioEl.removeEventListener('ended', state.onEnded);
  state.audioEl.removeEventListener('seeking', state.onSeeking);
  state.audioEl.removeEventListener('seeked', state.onSeeked);

  const win = state.iframeEl && state.iframeEl.contentWindow;
  send(win, 'talk-stop', 0);
}

// float32/sampleRate may be null -- see attach() below.
export function attachSamples(float32, sampleRate, audioEl, iframeEl) {
  detach();

  const envelope = (float32 && sampleRate) ? computeEnvelope(float32, sampleRate) : null;
  const state = { audioEl, iframeEl, envelope, timer: null, smoothed: 0 };

  state.onPlay = () => {
    const win = state.iframeEl && state.iframeEl.contentWindow;
    state.smoothed = levelAtTime(state.envelope, state.audioEl.currentTime);
    send(win, 'talk-start', state.smoothed);
    startLoop(state);
  };
  state.onPause = () => {
    stopLoop(state);
    send(state.iframeEl && state.iframeEl.contentWindow, 'talk-stop', 0);
  };
  state.onEnded = state.onPause;
  state.onSeeking = () => {
    send(state.iframeEl && state.iframeEl.contentWindow, 'talk-level', levelAtTime(state.envelope, state.audioEl.currentTime));
  };
  state.onSeeked = state.onSeeking;

  audioEl.addEventListener('play', state.onPlay);
  audioEl.addEventListener('pause', state.onPause);
  audioEl.addEventListener('ended', state.onEnded);
  audioEl.addEventListener('seeking', state.onSeeking);
  audioEl.addEventListener('seeked', state.onSeeked);

  current = state;
  if (!audioEl.paused) state.onPlay(); // already playing at attach time

  return { detach };
}

// Convenience variant with no sample data. Without real samples there
// is nothing to derive an honest envelope from, so this intentionally
// reports level 0 throughout rather than fabricating movement (talking
// still flips true/false correctly via talk-start/talk-stop). The real
// path for actual Kokoro playback is attachSamples(); this exists only
// so attach(audioEl, iframeEl) is available per the spec for any future
// caller that has an audio element but no separate sample buffer.
export function attach(audioEl, iframeEl) {
  return attachSamples(null, null, audioEl, iframeEl);
}

// Synthetic speech-like level pattern for visual testing -- no audio,
// no Kokoro model load. Independent of attach()/attachSamples()/current.
export function testTalk(iframeEl, durationMs) {
  durationMs = durationMs || 6000;
  const win = iframeEl && iframeEl.contentWindow;
  if (!win) return;

  const start = performance.now();
  let smoothed = 0;
  let pauseUntil = 0;
  let nextPauseAt = start + 700 + Math.random() * 700;

  send(win, 'talk-start', 0);

  const timer = setInterval(() => {
    const now = performance.now();
    const elapsed = now - start;
    if (elapsed >= durationMs) {
      clearInterval(timer);
      send(win, 'talk-stop', 0);
      return;
    }

    let raw;
    if (now < pauseUntil) {
      raw = 0;
    } else if (now >= nextPauseAt) {
      pauseUntil = now + 120 + Math.random() * 220;
      nextPauseAt = pauseUntil + 650 + Math.random() * 900;
      raw = 0;
    } else {
      raw = 0.35 + 0.45 * Math.abs(Math.sin(elapsed * 0.006)) + Math.random() * 0.2;
      raw = Math.max(0, Math.min(1, raw));
    }

    smoothed += (raw - smoothed) * SMOOTHING;
    send(win, 'talk-level', smoothed);
  }, UPDATE_INTERVAL_MS);
}
