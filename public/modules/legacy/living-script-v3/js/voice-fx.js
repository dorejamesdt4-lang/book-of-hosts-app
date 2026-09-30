// ====================================================================
// VOICE FX — the theme pack's sound, applied in the browser with Web
// Audio to every spoken line. Kept deliberately subtle: the words must
// always stay clear. The talking mouth is driven from the dry speech
// (see speech.js), so echo tails and wobble never move the mouth.
//
//   const fx = createFx(ctx, 'hall-echo');
//   source.connect(fx.input); fx.output.connect(ctx.destination);
//   fx.dispose();
//
// Presets:
//   none            straight through
//   hall-echo       Victorian: warm, a short stone-hall reverb
//   synthetic-edge  Cyberpunk: light metallic ring + comb shimmer
//   radio-tape      80s/90s: band-limited radio tone, soft tape
//                   saturation and a slow tape wobble
// ====================================================================

export const FX_PRESETS = ['none', 'hall-echo', 'synthetic-edge', 'radio-tape'];

function hallImpulse(ctx, seconds, decay) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = ir.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return ir;
}

function softClipCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  const norm = Math.tanh(amount);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(amount * x) / norm;
  }
  return curve;
}

function filter(ctx, type, frequency, gain, q) {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  if (gain !== undefined) f.gain.value = gain;
  if (q !== undefined) f.Q.value = q;
  return f;
}

function gainNode(ctx, value) {
  const g = ctx.createGain();
  g.gain.value = value;
  return g;
}

export function createFx(ctx, preset) {
  const input = gainNode(ctx, 1);
  const mix = gainNode(ctx, 1);
  // A gentle limiter so an FX path can never make a line clip.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 4;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.15;
  mix.connect(limiter);
  const oscillators = [];

  switch (preset) {
    case 'hall-echo': {
      const warm = filter(ctx, 'lowshelf', 220, 2);
      const dry = gainNode(ctx, 1);
      input.connect(warm).connect(dry).connect(mix);
      const pre = ctx.createDelay(0.1);
      pre.delayTime.value = 0.025;
      const verb = ctx.createConvolver();
      verb.buffer = hallImpulse(ctx, 1.6, 3.2);
      const darken = filter(ctx, 'lowpass', 3500);
      const wet = gainNode(ctx, 0.22);
      input.connect(pre).connect(verb).connect(darken).connect(wet).connect(mix);
      break;
    }
    case 'synthetic-edge': {
      const air = filter(ctx, 'highshelf', 4500, 3);
      const dry = gainNode(ctx, 0.85);
      input.connect(air).connect(dry).connect(mix);
      // Ring modulation: the voice multiplied by a low sine, mixed in lightly.
      const ring = gainNode(ctx, 0);
      const carrier = ctx.createOscillator();
      carrier.frequency.value = 55;
      carrier.connect(ring.gain);
      carrier.start();
      oscillators.push(carrier);
      const ringWet = gainNode(ctx, 0.22);
      input.connect(ring).connect(ringWet).connect(mix);
      // A short feedback comb for a faint metallic shimmer.
      const comb = ctx.createDelay(0.05);
      comb.delayTime.value = 0.007;
      const feedback = gainNode(ctx, 0.35);
      const combWet = gainNode(ctx, 0.18);
      input.connect(comb);
      comb.connect(feedback).connect(comb);
      comb.connect(combWet).connect(mix);
      break;
    }
    case 'radio-tape': {
      const low = filter(ctx, 'highpass', 280, undefined, 0.7);
      const high = filter(ctx, 'lowpass', 4200, undefined, 0.7);
      const presence = filter(ctx, 'peaking', 1600, 3, 1);
      const tape = ctx.createWaveShaper();
      tape.curve = softClipCurve(1.6);
      tape.oversample = '2x';
      // Slow wow: a tiny delay whose time drifts with a 0.7 Hz wave.
      const wow = ctx.createDelay(0.05);
      wow.delayTime.value = 0.004;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.7;
      const depth = gainNode(ctx, 0.0006);
      lfo.connect(depth).connect(wow.delayTime);
      lfo.start();
      oscillators.push(lfo);
      const level = gainNode(ctx, 0.9);
      input.connect(low).connect(high).connect(presence).connect(tape).connect(wow).connect(level).connect(mix);
      break;
    }
    default:
      input.connect(mix);
  }

  return {
    input,
    output: limiter,
    dispose() {
      oscillators.forEach((o) => { try { o.stop(); } catch (e) { /* already stopped */ } });
      try { input.disconnect(); limiter.disconnect(); } catch (e) { /* already gone */ }
    }
  };
}
