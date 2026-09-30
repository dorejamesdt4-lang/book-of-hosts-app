// ====================================================================
// TTS CLIENT -- the page's single entry point for speech. Starts the
// Kokoro engine in a module Web Worker (tts-worker.js); if the worker
// can't start (no module-worker support, script blocked, or it never
// reports in), falls back to running the same engine on the main
// thread. Callers see the same API either way:
//
//   const tts = createTtsClient();
//   await tts.load(percent => ..., { prefer });     // model download
//   tts.prefetchVoices(['bm_fable', ...]);          // start voice downloads
//   const job = tts.speak({ sentences, speed, onChunk, onDone, onError });
//   tts.cancel();                                   // stops the active job
//   tts.mode                                        // 'worker' | 'main-thread'
// ====================================================================

const WORKER_BOOT_TIMEOUT_MS = 8000;

function startWorkerBackend() {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./tts-worker.js', import.meta.url), { type: 'module' });
    } catch (err) {
      reject(err);
      return;
    }
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('worker did not boot in time'));
    }, WORKER_BOOT_TIMEOUT_MS);
    const onBootError = (e) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error('worker failed to start: ' + ((e && e.message) || 'script error')));
    };
    worker.addEventListener('error', onBootError);
    worker.addEventListener('message', function onFirst(e) {
      if (!e.data || e.data.type !== 'booted') return;
      clearTimeout(timer);
      worker.removeEventListener('error', onBootError);
      worker.removeEventListener('message', onFirst);
      resolve({
        mode: 'worker',
        dispose: () => worker.terminate(),
        post: (msg) => worker.postMessage(msg),
        listen: (fn) => {
          worker.addEventListener('message', (ev) => fn(ev.data));
          // A crash after boot (e.g. out of memory) surfaces as a job error.
          worker.addEventListener('error', (ev) => fn({ type: 'worker-crash', message: (ev && ev.message) || 'worker error' }));
        }
      });
    });
  });
}

async function startMainThreadBackend() {
  const { createEngineHost } = await import('./kokoro-engine.js');
  const listeners = [];
  // Async delivery, so ordering matches the worker path.
  const handle = createEngineHost((msg) => queueMicrotask(() => listeners.forEach((fn) => fn(msg))));
  return {
    mode: 'main-thread',
    dispose: () => { listeners.length = 0; },
    // Cancel applies at once so it lands before the engine's next
    // sentence; everything else is async, matching the worker path.
    post: (msg) => (msg.type === 'cancel' ? handle(msg) : setTimeout(() => handle(msg), 0)),
    listen: (fn) => listeners.push(fn)
  };
}

export function createTtsClient() {
  let backend = null;
  let backendPromise = null;
  let nextJobId = 1;
  let activeJob = null; // { id, onChunk, onDone, onError }
  let loadWaiters = null; // { resolve, reject, onProgress } while a load is in flight
  let ready = false;

  function onMessage(msg) {
    if (!msg) return;
    switch (msg.type) {
      case 'timing':
        if (client.onTiming) client.onTiming(msg);
        break;
      case 'upgrade-progress':
        if (client.onUpgradeProgress) client.onUpgradeProgress(msg.percent);
        break;
      case 'device':
        client.device = msg.device;
        if (client.onDevice) client.onDevice(msg);
        break;
      case 'progress':
        if (loadWaiters && loadWaiters.onProgress) loadWaiters.onProgress(msg.percent);
        break;
      case 'ready':
        ready = true;
        client.device = msg.device || null;
        if (client.onTiming) client.onTiming({ event: 'model', device: msg.device, dtype: msg.dtype, ms: msg.ms });
        if (loadWaiters) { loadWaiters.resolve(); loadWaiters = null; }
        break;
      case 'load-error':
        if (loadWaiters) { loadWaiters.reject(new Error(msg.message)); loadWaiters = null; }
        if (activeJob) { const j = activeJob; activeJob = null; j.onError(new Error(msg.message)); }
        break;
      case 'chunk':
        if (activeJob && msg.jobId === activeJob.id) activeJob.onChunk(msg);
        break;
      case 'done':
        if (activeJob && msg.jobId === activeJob.id) { const j = activeJob; activeJob = null; j.onDone(); }
        break;
      case 'job-error':
        if (activeJob && msg.jobId === activeJob.id) { const j = activeJob; activeJob = null; j.onError(new Error(msg.message)); }
        break;
      case 'worker-crash': {
        const err = new Error(msg.message);
        if (loadWaiters) { loadWaiters.reject(err); loadWaiters = null; }
        if (activeJob) { const j = activeJob; activeJob = null; j.onError(err); }
        break;
      }
    }
  }

  function getBackend() {
    if (backend) return Promise.resolve(backend);
    if (!backendPromise) {
      backendPromise = startWorkerBackend()
        .catch((err) => {
          console.warn('TTS worker unavailable, running Kokoro on the main thread instead:', err);
          return startMainThreadBackend();
        })
        .then((b) => {
          backend = b;
          client.mode = b.mode;
          b.listen(onMessage);
          return b;
        });
    }
    return backendPromise;
  }

  const client = {
    mode: null,
    device: null,   // 'webgpu' | 'wasm' once loaded
    onTiming: null,          // (msg) => void -- engine timing events
    onUpgradeProgress: null, // (percent) => void -- background WebGPU download
    onDevice: null,          // (msg) => void -- device switched / settled
    get ready() { return ready; },

    load(onProgress, { prefer = 'auto' } = {}) {
      if (ready) return Promise.resolve();
      if (loadWaiters) {
        loadWaiters.onProgress = onProgress || loadWaiters.onProgress;
        return loadWaiters.promise;
      }
      let resolve, reject;
      const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
      loadWaiters = { resolve, reject, onProgress, promise };
      getBackend()
        .then((b) => b.post({ type: 'load', prefer }))
        .catch((err) => { if (loadWaiters) { loadWaiters.reject(err); loadWaiters = null; } });
      return promise;
    },

    prefetchVoices(voices) {
      const list = Array.from(new Set(voices.filter(Boolean)));
      if (!list.length) return;
      getBackend().then((b) => b.post({ type: 'prefetch-voices', voices: list })).catch(() => {});
    },

    speak({ sentences, speed, onChunk, onDone, onError }) {
      client.cancel();
      const id = nextJobId++;
      activeJob = { id, onChunk, onDone, onError };
      getBackend()
        .then((b) => {
          if (!activeJob || activeJob.id !== id) return;
          b.post({ type: 'speak', jobId: id, speed, sentences: sentences.map((s) => ({ text: s.text, voice: s.voice })) });
        })
        .catch((err) => {
          if (activeJob && activeJob.id === id) { activeJob = null; onError(err); }
        });
      return id;
    },

    dispose() {
      client.cancel();
      if (loadWaiters) { loadWaiters.reject(new Error('Voice preparation stopped.')); loadWaiters = null; }
      ready = false;
      if (backend) backend.dispose();
      else if (backendPromise) backendPromise.then(b => b.dispose()).catch(() => {});
    },

    cancel() {
      if (!activeJob) return;
      const id = activeJob.id;
      activeJob = null;
      if (backend) backend.post({ type: 'cancel', jobId: id });
    }
  };

  return client;
}
