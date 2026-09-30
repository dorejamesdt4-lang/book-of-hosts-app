// ====================================================================
// SPEAKER STAGE -- the character sprites on the Narrator's stage.
//
// The "primary" frame (#stageFrame) always shows the selected
// hero; calibration mode works on it. For multi-voice scripts, other
// speakers get their own iframes stacked in the same spot, so switching
// speaker is an instant show/hide rather than a reload. Only characters
// that actually speak are loaded, at most MAX_LOADED frames at once
// (the primary counts as one). A longer cast is loaded just ahead of
// when each character speaks, reusing the least-recently-used frame
// that isn't needed soon.
//
// Each frame is told its character's mouth position (from the
// registry) whenever it loads.
// ====================================================================

import { getCharacter, getMouth } from './character-registry.js';

const NATIVE_FRAME_PX = 384; // every character build's own canvas CSS size
export const MAX_LOADED = 6;

// Tells a character iframe where to draw its mouth. Uses the message
// tag the character kit already accepts from talk-bridge.js.
export function sendMouthPosition(iframeEl, characterId) {
  if (!iframeEl || !iframeEl.contentWindow) return;
  const pos = getMouth(characterId);
  try {
    iframeEl.contentWindow.postMessage({
      source: 'dore-narrator-talk',
      type: 'mouth-position',
      x: pos.x,
      y: pos.y,
      width: pos.width,
      height: pos.height
    }, '*');
  } catch (e) {
    // iframe torn down mid-flight -- nothing to do
  }
}

function sendTalk(iframeEl, type, level) {
  if (!iframeEl || !iframeEl.contentWindow) return;
  try {
    iframeEl.contentWindow.postMessage({ source: 'dore-narrator-talk', type, level }, '*');
  } catch (e) {
    // iframe torn down mid-flight -- nothing to do
  }
}

export function createSpeakerStage({ stageEl, primaryFrame }) {
  let primaryId = null;
  const pool = []; // { frame, id, lastUsed } -- extra speakers
  let visibleId = null;
  let talkingFrame = null;
  let scale = 1;
  let useCounter = 0;
  // frame -> true once its current src has finished loading
  const loaded = new WeakMap();
  const loadWaiters = new WeakMap(); // frame -> [resolve]

  function markLoading(frame) {
    loaded.set(frame, false);
  }
  function markLoaded(frame) {
    loaded.set(frame, true);
    (loadWaiters.get(frame) || []).forEach((fn) => fn());
    loadWaiters.delete(frame);
  }
  function whenLoaded(frame) {
    if (loaded.get(frame)) return Promise.resolve();
    return new Promise((resolve) => {
      const list = loadWaiters.get(frame) || [];
      list.push(resolve);
      loadWaiters.set(frame, list);
    });
  }

  function allFrames() {
    return [primaryFrame, ...pool.map((e) => e.frame)];
  }

  function frameFor(id) {
    if (id === primaryId) return primaryFrame;
    const entry = pool.find((e) => e.id === id);
    return entry ? entry.frame : null;
  }

  function touch(id) {
    const entry = pool.find((e) => e.id === id);
    if (entry) entry.lastUsed = ++useCounter;
  }

  primaryFrame.addEventListener('load', () => {
    if (!primaryFrame.getAttribute('src')) return;
    markLoaded(primaryFrame);
    if (primaryId) sendMouthPosition(primaryFrame, primaryId);
  });

  function createFrame() {
    const frame = document.createElement('iframe');
    frame.className = primaryFrame.className + ' is-offstage';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('tabindex', '-1');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.transform = 'scale(' + scale + ')';
    const entry = { frame, id: null, lastUsed: 0 };
    frame.addEventListener('load', () => {
      if (!frame.getAttribute('src')) return;
      markLoaded(frame);
      if (entry.id) sendMouthPosition(frame, entry.id);
    });
    stageEl.appendChild(frame);
    pool.push(entry);
    return entry;
  }

  function loadInto(entry, id) {
    const character = getCharacter(id);
    if (!character) return;
    if (talkingFrame === entry.frame) talkingFrame = null;
    entry.id = id;
    entry.lastUsed = ++useCounter;
    entry.frame.title = character.name;
    markLoading(entry.frame);
    entry.frame.src = '../' + character.path;
  }

  // Makes sure every id in `ids` has a loaded frame, without evicting
  // anything in `keep` (or on stage). Stops quietly at the cap.
  function ensureLoaded(ids, keep) {
    const protectedIds = new Set([...(keep || ids), visibleId, primaryId]);
    ids.forEach((id) => {
      if (!id || frameFor(id) || !getCharacter(id)) return;
      if (pool.length < MAX_LOADED - 1) {
        loadInto(createFrame(), id);
        return;
      }
      const victim = pool
        .filter((e) => !protectedIds.has(e.id))
        .sort((a, b) => a.lastUsed - b.lastUsed)[0];
      if (victim) loadInto(victim, id);
    });
  }

  // Returns { frame, preloaded, loaded: Promise } -- preloaded is true
  // when the sprite was already fully loaded, i.e. the swap is instant.
  function show(id) {
    let frame = frameFor(id);
    if (!frame) {
      // Not preloaded (cast larger than the cap and no look-ahead hit):
      // load it now, evicting whatever isn't on stage.
      ensureLoaded([id], [id]);
      frame = frameFor(id) || primaryFrame;
    }
    touch(id);
    visibleId = frame === primaryFrame ? primaryId : id;
    allFrames().forEach((f) => {
      const onStage = f === frame;
      f.classList.toggle('is-offstage', !onStage);
      if (f !== primaryFrame) f.setAttribute('aria-hidden', onStage ? 'false' : 'true');
    });
    return { frame, preloaded: !!loaded.get(frame), loaded: whenLoaded(frame) };
  }

  return {
    get primaryId() { return primaryId; },
    get visibleId() { return visibleId; },

    // Selected hero changed: the primary frame shows them.
    setPrimary(character) {
      if (!character) return;
      primaryId = character.id;
      primaryFrame.title = character.name;
      markLoading(primaryFrame);
      primaryFrame.src = '../' + character.path;
      // Drop a pooled duplicate of the same character, if any.
      const dup = pool.find((e) => e.id === primaryId);
      if (dup) { dup.id = null; dup.frame.removeAttribute('src'); }
      show(primaryId);
    },

    // Before a take: load the first speakers of the script (in order of
    // first appearance) up to the cap.
    prepare(speakersInOrder) {
      const first = speakersInOrder.filter((id) => id !== primaryId).slice(0, MAX_LOADED - 1);
      ensureLoaded(first, first);
    },

    // During a take: load whoever speaks in the next couple of
    // sentences so the swap is instant when they start.
    lookAhead(sentences, fromIndex, count = 3) {
      const ids = [];
      for (let i = fromIndex; i < Math.min(sentences.length, fromIndex + count); i++) {
        if (!ids.includes(sentences[i].speakerId)) ids.push(sentences[i].speakerId);
      }
      ensureLoaded(ids, ids);
    },

    show,

    // Talking-mouth messages go to whichever frame is on stage.
    talk(id, level) {
      const frame = frameFor(id);
      if (!frame) return;
      if (talkingFrame !== frame) {
        if (talkingFrame) sendTalk(talkingFrame, 'talk-stop', 0);
        talkingFrame = frame;
        sendTalk(frame, 'talk-start', level);
      } else {
        sendTalk(frame, 'talk-level', level);
      }
    },

    silence() {
      if (talkingFrame) sendTalk(talkingFrame, 'talk-stop', 0);
      talkingFrame = null;
    },

    // Calibration changed a character's mouth: update every frame showing them.
    refreshMouth(id) {
      if (id === primaryId) sendMouthPosition(primaryFrame, id);
      pool.forEach((e) => { if (e.id === id) sendMouthPosition(e.frame, id); });
    },

    // Keeps each 384px-native frame fitted to the stage via transform
    // only, so no character's framing gets asymmetrically cropped. Uses
    // the layout size, not getBoundingClientRect(), so a page that is
    // itself scaled down doesn't scale the sprite twice.
    updateScale() {
      if (!stageEl.clientWidth || !stageEl.clientHeight) return;
      scale = Math.min(stageEl.clientWidth, stageEl.clientHeight) / NATIVE_FRAME_PX;
      allFrames().forEach((f) => { f.style.transform = 'scale(' + scale + ')'; });
    },

    loadedCount() {
      return 1 + pool.filter((e) => e.id).length;
    }
  };
}
