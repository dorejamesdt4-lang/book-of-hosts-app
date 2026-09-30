// ====================================================================
// KOKORO ENGINE -- model loading, voice prefetch and sentence-by-
// sentence generation. DOM-free: runs unchanged inside tts-worker.js
// (the normal path) or on the main thread (fallback when a module
// worker can't start), via the same createEngineHost() protocol.
//
// Device: starts on q8 + wasm (smallest download, ~92 MB). If the first
// sentence generates slower than real time and the browser has a WebGPU
// adapter, the fp32 WebGPU model (~326 MB) is loaded in the background
// and swapped in between sentences -- but only kept if it measures
// faster. { prefer: 'webgpu' } on load (remembered by the page from a
// previous visit) goes straight to WebGPU, falling back to q8 + wasm.
//
// Messages in:
//   { type: 'load', prefer: 'auto' | 'wasm' | 'webgpu' }
//   { type: 'prefetch-voices', voices: [id, ...] }
//   { type: 'speak', jobId, speed, sentences: [{ text, voice }] }
//   { type: 'cancel', jobId }
// Messages out:
//   { type: 'progress', percent }            model download progress
//   { type: 'ready', device, dtype, ms }     model loaded
//   { type: 'load-error', message }
//   { type: 'chunk', jobId, index, audio, sampleRate, genMs, device }
//   { type: 'done', jobId }
//   { type: 'job-error', jobId, message }
//   { type: 'upgrade-progress', percent }    background WebGPU download
//   { type: 'device', device, dtype, reason, rtf }  device switched / settled
//   { type: 'timing', event: 'voice', voice, ms, bytes, source, reason }
// ====================================================================

// Version pinned (not @latest) so the browser's HTTP cache stays valid
// between visits.
const KOKORO_ESM_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm';
const KOKORO_MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

const WASM = { device: 'wasm', dtype: 'q8' };
const WEBGPU = { device: 'webgpu', dtype: 'fp32' };

export async function loadKokoroModel(onProgress, { device, dtype } = WASM) {
  // Combine per-file progress into one overall percentage: sum of bytes
  // loaded across every file seen so far / sum of their totals. Files
  // are discovered one after another (tiny config JSONs finish before
  // the model has even reported its size), so the figure is held back
  // until a real download is under way, only ever moves forward, and
  // stops at 99% until the model is actually ready.
  const MIN_BYTES_BEFORE_REPORTING = 1024 * 1024;
  const files = new Map();
  let shown = 0;
  const report = () => {
    let loaded = 0;
    let total = 0;
    files.forEach((f) => { loaded += f.loaded; total += f.total; });
    if (total < MIN_BYTES_BEFORE_REPORTING) return;
    const pct = Math.min(99, (loaded / total) * 100);
    if (pct > shown) {
      shown = pct;
      if (onProgress) onProgress(pct);
    }
  };

  const { KokoroTTS } = await import(KOKORO_ESM_URL);
  const model = await KokoroTTS.from_pretrained(KOKORO_MODEL_ID, {
    dtype,
    device,
    progress_callback: (info) => {
      if (!info || !info.file) return;
      if (info.status === 'progress' && info.total) {
        files.set(info.file, { loaded: info.loaded || 0, total: info.total });
        report();
      } else if (info.status === 'done' && files.has(info.file)) {
        const f = files.get(info.file);
        f.loaded = f.total;
        report();
      }
    }
  });
  if (onProgress) onProgress(100);
  return model;
}

async function webgpuAvailable() {
  try {
    const gpu = typeof navigator !== 'undefined' && navigator.gpu;
    return !!(gpu && await gpu.requestAdapter());
  } catch (e) {
    return false;
  }
}

// ---- Voice files ----------------------------------------------------
// kokoro-js downloads a voice's style file (voices/<id>.bin, ~510 KB)
// the first time generate() uses that voice, via fetch() -- checking
// its own "kokoro-voices" Cache Storage first. It has no public API to
// load one early, so the engine routes those fetches through
// loadVoice(): every download is timed, voices can be prefetched ahead
// of time, and a voice fetched earlier is served from memory.
const VOICE_URL_RE = /\/voices\/([a-z]{2}_[a-z]+)\.bin(?:[?#]|$)/;
const voiceBuffers = new Map(); // voice id -> Promise<ArrayBuffer>
let onVoiceTiming = null;
let realFetch = null;

function voiceUrl(id) {
  return 'https://huggingface.co/' + KOKORO_MODEL_ID + '/resolve/main/voices/' + id + '.bin';
}

function loadVoice(id, reason) {
  if (voiceBuffers.has(id)) return voiceBuffers.get(id);
  const started = performance.now();
  const promise = (async () => {
    let source = 'network';
    let buf = null;
    try {
      const cache = await caches.open('kokoro-voices');
      const hit = await cache.match(voiceUrl(id));
      if (hit) { buf = await hit.arrayBuffer(); source = 'cache'; }
    } catch (e) {
      // Cache Storage unavailable -- fall through to the network
    }
    if (!buf) {
      const res = await realFetch(voiceUrl(id));
      if (!res.ok) throw new Error('voice ' + id + ' download failed: ' + res.status);
      buf = await res.arrayBuffer();
    }
    if (onVoiceTiming) onVoiceTiming({ voice: id, ms: Math.round(performance.now() - started), bytes: buf.byteLength, source, reason });
    return buf;
  })();
  promise.catch(() => voiceBuffers.delete(id)); // allow a retry
  voiceBuffers.set(id, promise);
  return promise;
}

function installVoiceFetchHook() {
  if (realFetch) return;
  realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    const m = url.match(VOICE_URL_RE);
    if (!m) return realFetch(input, init);
    return loadVoice(m[1], 'on-demand').then((buf) => new Response(buf.slice(0), {
      headers: { 'Content-Type': 'application/octet-stream' }
    }));
  };
}

// post(message, transferList?) delivers a message to the page.
export function createEngineHost(post) {
  installVoiceFetchHook();
  onVoiceTiming = (t) => post({ type: 'timing', event: 'voice', ...t });

  let model = null;         // the model generating right now
  let modelKind = WASM;     // which one it is
  let wasmModel = null;     // kept until WebGPU proves faster
  let loading = null;
  let prefer = 'auto';
  let upgrade = null;       // background WebGPU load: null | 'loading' | 'trial' | 'done'
  let wasmRtf = null;       // real-time factor measured on wasm
  let activeJobId = null;

  // One generate() at a time: a cancelled job's in-flight sentence must
  // finish before the next job's first sentence starts on the same
  // ONNX session.
  let generating = Promise.resolve();
  function generateExclusive(tts, text, opts) {
    const run = generating.then(() => tts.generate(text, opts));
    generating = run.catch(() => {});
    return run;
  }

  function ensureModel() {
    if (model) return Promise.resolve(model);
    if (!loading) {
      const started = performance.now();
      const onProgress = (percent) => post({ type: 'progress', percent });
      loading = (async () => {
        if ((prefer === 'webgpu') && await webgpuAvailable()) {
          try {
            const m = await loadKokoroModel(onProgress, WEBGPU);
            upgrade = 'done';
            return [m, WEBGPU];
          } catch (err) {
            console.warn('WebGPU model failed to load, using q8 + wasm instead:', err);
          }
        }
        const m = await loadKokoroModel(onProgress, WASM);
        wasmModel = m;
        return [m, WASM];
      })()
        .then(([m, kind]) => {
          model = m;
          modelKind = kind;
          post({ type: 'ready', ...kind, ms: Math.round(performance.now() - started) });
          return m;
        })
        .catch((err) => {
          post({ type: 'load-error', message: String((err && err.message) || err) });
          throw err;
        })
        .finally(() => { loading = null; });
    }
    return loading;
  }

  // Generation slower than real time on wasm: fetch the WebGPU model in
  // the background (the current job keeps going on wasm meanwhile).
  async function maybeStartUpgrade(rtf) {
    if (upgrade || prefer === 'wasm' || modelKind.device !== 'wasm' || rtf <= 1) return;
    upgrade = 'loading';
    wasmRtf = rtf;
    if (!await webgpuAvailable()) {
      upgrade = 'done';
      post({ type: 'device', ...WASM, reason: 'no-webgpu', rtf });
      return;
    }
    try {
      const gpuModel = await loadKokoroModel((percent) => post({ type: 'upgrade-progress', percent }), WEBGPU);
      // Warm up (first WebGPU run compiles shaders) so the trial below
      // measures steady-state speed.
      await generateExclusive(gpuModel, 'Ready.', { voice: 'af_heart', speed: 1 });
      model = gpuModel;
      modelKind = WEBGPU;
      upgrade = 'trial';
    } catch (err) {
      console.warn('WebGPU upgrade failed, staying on q8 + wasm:', err);
      upgrade = 'done';
      post({ type: 'device', ...WASM, reason: 'webgpu-failed', rtf });
    }
  }

  // First sentence generated on WebGPU after an upgrade: keep it only if
  // it beat wasm.
  function settleTrial(rtf) {
    if (upgrade !== 'trial') return;
    upgrade = 'done';
    if (rtf < wasmRtf) {
      wasmModel = null; // let the wasm session be collected
      post({ type: 'device', ...WEBGPU, reason: 'faster', rtf, previousRtf: wasmRtf });
    } else {
      model = wasmModel;
      modelKind = WASM;
      post({ type: 'device', ...WASM, reason: 'webgpu-slower', rtf: wasmRtf, webgpuRtf: rtf });
    }
  }

  async function speak({ jobId, speed, sentences }) {
    activeJobId = jobId;
    // Every voice in the script starts downloading now, in parallel.
    sentences.forEach((s) => loadVoice(s.voice, 'prefetch').catch(() => {}));
    try {
      await ensureModel();
      // Generate continuously, as far ahead of playback as the machine
      // allows -- never waiting for a sentence to finish playing.
      for (let index = 0; index < sentences.length; index++) {
        // Cancellation takes effect between sentences: a sentence already
        // generating finishes, then is discarded.
        if (activeJobId !== jobId) return;
        const { text, voice } = sentences[index];
        await loadVoice(voice, 'prefetch').catch(() => {}); // usually already there
        const kind = modelKind;
        const started = performance.now();
        const result = await generateExclusive(model, text, { voice, speed });
        const genMs = Math.round(performance.now() - started);
        const audioSeconds = result.audio.length / result.sampling_rate;
        const rtf = audioSeconds ? genMs / 1000 / audioSeconds : 0;
        if (kind.device === 'webgpu') settleTrial(rtf);
        else maybeStartUpgrade(rtf);
        if (activeJobId !== jobId) return;
        // Own copy so the whole buffer can be transferred, not cloned.
        const audio = new Float32Array(result.audio);
        post({ type: 'chunk', jobId, index, audio, sampleRate: result.sampling_rate, genMs, device: kind.device }, [audio.buffer]);
        // Give the event loop a turn between sentences. In the worker this
        // lets a 'cancel' message in; on the main-thread fallback it lets
        // clicks (STOP), rendering and the playback loop run.
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (activeJobId === jobId) post({ type: 'done', jobId });
    } catch (err) {
      if (activeJobId === jobId) post({ type: 'job-error', jobId, message: String((err && err.message) || err) });
    } finally {
      if (activeJobId === jobId) activeJobId = null;
    }
  }

  return function handle(msg) {
    if (!msg) return;
    if (msg.type === 'load') {
      if (msg.prefer) prefer = msg.prefer;
      ensureModel().catch(() => { /* reported via load-error */ });
    } else if (msg.type === 'prefetch-voices') {
      (msg.voices || []).forEach((v) => loadVoice(v, 'prefetch').catch(() => {}));
    } else if (msg.type === 'speak') {
      speak(msg);
    } else if (msg.type === 'cancel' && activeJobId === msg.jobId) {
      activeJobId = null;
    }
  };
}
