// ====================================================================
// VOICE BANK — voices lines in advance with Kokoro (the Narrator's own
// TTS client, running in a Web Worker) and keeps the audio so the show
// never pauses to generate. Lines are stored in IndexedDB, so the voices
// the Lobby prepares are there when the Stage opens in its own tab;
// if IndexedDB is unavailable they're kept in memory and the Stage
// voices anything missing when it needs it.
//
//   const bank = createVoiceBank();
//   await bank.prepare(items, (done, total, modelPercent) => ...);
//   const clip = await bank.get(item) || await bank.generate(item);
//
// An item is { text, voice, speed }; its audio is { audio, sampleRate }.
// ====================================================================

import { createTtsClient } from '../../narrator/tts-client.js';
import { itemKey } from '../engine/themes.js';

const DB_NAME = 'living-script-voices';
const STORE = 'lines';
const DEVICE_KEY = 'narratorForge.device.v1'; // shared with the Narrator

function openDb() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

function idbGet(db, key) {
  if (!db) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

function idbPut(db, key, value) {
  if (!db) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch (e) {
      resolve(false);
    }
  });
}

function devicePreference() {
  const forced = new URLSearchParams(location.search).get('device');
  if (forced === 'wasm' || forced === 'webgpu') return forced;
  try { return localStorage.getItem(DEVICE_KEY) || 'auto'; } catch (e) { return 'auto'; }
}

export function createVoiceBank() {
  const tts = createTtsClient();
  tts.onDevice = (msg) => {
    const remember = msg.reason === 'faster' ? 'webgpu' : (msg.reason === 'webgpu-slower' || msg.reason === 'no-webgpu') ? 'wasm' : null;
    if (remember) { try { localStorage.setItem(DEVICE_KEY, remember); } catch (e) { /* not remembered */ } }
  };
  const memory = new Map();
  const dbReady = openDb();
  let chain = Promise.resolve(); // Kokoro runs one job at a time
  let cancelled = 0;
  let releaseJob = null; // resolves the in-flight Kokoro job if it's cancelled

  function serial(task) {
    const run = chain.then(task, task);
    chain = run.catch(() => {});
    return run;
  }

  async function get(item) {
    const key = itemKey(item);
    if (memory.has(key)) return memory.get(key);
    const stored = await idbGet(await dbReady, key);
    if (stored) memory.set(key, stored);
    return stored;
  }

  async function store(item, clip) {
    const key = itemKey(item);
    memory.set(key, clip);
    await idbPut(await dbReady, key, clip);
  }

  function loadModel(onProgress) {
    return tts.load(onProgress, { prefer: devicePreference() });
  }

  // Voices one group of lines that share a Kokoro speed.
  function speakGroup(group, onLine) {
    return new Promise((resolve, reject) => {
      releaseJob = resolve;
      tts.speak({
        sentences: group.map((it) => ({ text: it.text, voice: it.voice })),
        speed: group[0].speed,
        onChunk: ({ index, audio, sampleRate }) => {
          const clip = { audio, sampleRate };
          store(group[index], clip).then(() => onLine(group[index], clip));
        },
        onDone: () => { releaseJob = null; resolve(); },
        onError: (err) => { releaseJob = null; reject(err); }
      });
    });
  }

  return {
    get ready() { return tts.ready; },
    get,
    loadModel,

    // Counts what's already voiced, then voices the rest. Calls
    // onProgress(done, total, modelPercent|null) as it goes.
    prepare(items, onProgress) {
      const token = cancelled;
      const unique = [];
      const seen = new Set();
      items.forEach((it) => { const k = itemKey(it); if (!seen.has(k)) { seen.add(k); unique.push(it); } });
      return serial(async () => {
        const missing = [];
        for (const it of unique) if (!(await get(it))) missing.push(it);
        let done = unique.length - missing.length;
        onProgress && onProgress(done, unique.length, null);
        if (!missing.length || token !== cancelled) return;
        tts.prefetchVoices(missing.map((it) => it.voice));
        await loadModel((pct) => onProgress && onProgress(done, unique.length, pct));
        const bySpeed = new Map();
        missing.forEach((it) => {
          const k = Number(it.speed).toFixed(3);
          if (!bySpeed.has(k)) bySpeed.set(k, []);
          bySpeed.get(k).push(it);
        });
        for (const group of bySpeed.values()) {
          if (token !== cancelled) return;
          await speakGroup(group, () => { done += 1; onProgress && onProgress(done, unique.length, null); });
        }
      });
    },

    // Voices one line now (typed lines, or anything missing).
    generate(item) {
      return serial(async () => {
        const have = await get(item);
        if (have) return have;
        await loadModel(null);
        let clip = null;
        await speakGroup([item], (_, c) => { clip = c; });
        return clip || get(item);
      });
    },

    cancel() {
      cancelled += 1;
      tts.cancel();
      if (releaseJob) { const r = releaseJob; releaseJob = null; r(); }
    }
  };
}
