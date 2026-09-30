// ====================================================================
// TTS WORKER (module worker) -- runs Kokoro loading and generation off
// the main thread so the page's UI and character sprites never freeze.
// All the logic lives in kokoro-engine.js; this file only wires the
// engine's message protocol to the worker's postMessage.
// ====================================================================

import { createEngineHost } from './kokoro-engine.js';

const handle = createEngineHost((msg, transfer) => self.postMessage(msg, transfer || []));
self.addEventListener('message', (event) => handle(event.data));

// Lets the page know the module evaluated -- if this never arrives, the
// page falls back to running the engine on the main thread.
self.postMessage({ type: 'booted' });
