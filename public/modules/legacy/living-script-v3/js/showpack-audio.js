// ====================================================================
// SHOW PACK AUDIO — fetches every line's finished audio file before the
// show (at most 2 downloads at once, for a low-spec host PC) and holds
// each one in memory as a Blob with an object URL, so playback is
// instant. Nothing here voices anything: a line with no file simply
// has no clip, and the show falls back to its caption.
//
//   const audio = createPackAudio();
//   const report = await audio.preload(lines, base, (done, total) => ...);
//     -> { missing: [lineId], failed: [lineId], cancelled }
//   audio.bank          // for createSpeaker(): get({ lineId }) -> { audio, sampleRate } | null
//   audio.prime(lineId) // decode ahead (the next line)
//   audio.release()     // revoke every object URL (show over / host left)
// ====================================================================

export const MAX_DOWNLOADS = 2;
const DECODED_KEEP = 3; // decoded clips kept (current, next, last for Repeat)

export function createPackAudio({ context = () => null } = {}) {
  const files = new Map();   // lineId -> { blob, url }
  const decoded = new Map(); // lineId -> Promise<{ audio, sampleRate } | null>
  let abort = null;

  async function fetchOne(line, base, signal) {
    if (!line.audio) return 'missing';
    try {
      const res = await fetch(base + line.audio, { signal });
      if (res.status === 404) return 'missing';
      if (!res.ok) return 'failed';
      const blob = await res.blob();
      if (!blob.size) return 'failed';
      files.set(line.id, { blob, url: URL.createObjectURL(blob) });
      return 'ok';
    } catch (err) {
      if (signal.aborted) return 'cancelled';
      return 'failed';
    }
  }

  async function decode(lineId) {
    const file = files.get(lineId);
    const ctx = context();
    if (!file || !ctx) return null;
    try {
      const bytes = await (await fetch(file.url)).arrayBuffer();
      const buffer = await ctx.decodeAudioData(bytes);
      // Mixed down to one channel: the talking mouth follows it.
      let audio = buffer.getChannelData(0);
      if (buffer.numberOfChannels > 1) {
        audio = new Float32Array(buffer.length);
        for (let c = 0; c < buffer.numberOfChannels; c++) {
          const ch = buffer.getChannelData(c);
          for (let i = 0; i < ch.length; i++) audio[i] += ch[i] / buffer.numberOfChannels;
        }
      }
      return { audio, sampleRate: buffer.sampleRate };
    } catch (err) {
      console.warn('Show Pack audio could not be decoded for line ' + lineId + '; showing its caption instead.', err);
      return null;
    }
  }

  function clip(lineId) {
    if (!files.has(lineId) || !context()) return Promise.resolve(null);
    if (!decoded.has(lineId)) {
      decoded.set(lineId, decode(lineId));
      while (decoded.size > DECODED_KEEP) decoded.delete(decoded.keys().next().value);
    }
    return decoded.get(lineId);
  }

  return {
    has: (lineId) => files.has(lineId),
    get size() { return files.size; },

    preload(lines, base, onProgress) {
      abort = new AbortController();
      const signal = abort.signal;
      const queue = lines.slice();
      const missing = [];
      const failed = [];
      let done = 0;
      onProgress && onProgress(done, lines.length);
      async function worker() {
        while (queue.length && !signal.aborted) {
          const line = queue.shift();
          const r = await fetchOne(line, base, signal);
          if (r === 'cancelled') return;
          if (r === 'missing') missing.push(line.id);
          if (r === 'failed') failed.push(line.id);
          done += 1;
          onProgress && onProgress(done, lines.length);
        }
      }
      const workers = Array.from({ length: Math.min(MAX_DOWNLOADS, lines.length) }, worker);
      return Promise.all(workers).then(() => ({ missing, failed, cancelled: signal.aborted }));
    },

    cancel() { if (abort) abort.abort(); },

    // Stands in for the voice bank in createSpeaker(): it never voices
    // anything, it only hands over a preloaded clip.
    bank: {
      get: (item) => clip(item.lineId),
      generate: () => Promise.resolve(null)
    },

    prime(lineId) { if (lineId && files.has(lineId)) clip(lineId); },

    release() {
      if (abort) abort.abort();
      files.forEach((f) => URL.revokeObjectURL(f.url));
      files.clear();
      decoded.clear();
    }
  };
}
