// ====================================================================
// THE NARRATOR'S CHAMBER — Mood I · Storybook. No dependency on the
// site's root style.css / script.js. The page owns the UI, audio
// playback and character animation; speech is generated off the main
// thread. Modules:
//   character-registry.js  every character (../characters.json)
//   character-voices.js    per-character voice, saved in localStorage
//   script-parser.js       script -> speaker-tagged sentences
//   tts-client.js          Kokoro in a Web Worker (main-thread fallback)
//   kokoro-engine.js       model load + sentence generation (DOM-free)
//   audio-queue.js         gapless Web Audio playback of streamed chunks
//   speaker-stage.js       stacked character sprites + mouth positions
//   calibrate.js           ?calibrate=1 mouth calibration tool
//   moods/storybook.css    the look (from design/storybook-mood-v1/)
//
// The previous look, "The Narrator's Forge", is retired to
// ../backups/moods-retired/forge/; the whole folder as it was before
// this rebuild is in ../backups/narrator-pre-storybook/.
// ====================================================================

import { loadRegistry, getCharacters, getPendingCharacters, getCharacter, findCharacterByName } from './character-registry.js';
import { getVoice, setVoice } from './character-voices.js';
import { parseScript } from './script-parser.js';
import { createTtsClient } from './tts-client.js';
import { AudioQueue } from './audio-queue.js';
import { createSpeakerStage } from './speaker-stage.js';
import { createTimingLog } from './debug-timing.js';

const timing = createTimingLog();

/* -------------------- Voice table (54 Kokoro voices) -------------------- */
const VOICES = [
  // American English — female
  ['af_heart','AF · Heart (US-F)'], ['af_alloy','AF · Alloy (US-F)'], ['af_aoede','AF · Aoede (US-F)'],
  ['af_bella','AF · Bella (US-F)'], ['af_jessica','AF · Jessica (US-F)'], ['af_kore','AF · Kore (US-F)'],
  ['af_nicole','AF · Nicole (US-F)'], ['af_nova','AF · Nova (US-F)'], ['af_river','AF · River (US-F)'],
  ['af_sarah','AF · Sarah (US-F)'], ['af_sky','AF · Sky (US-F)'],
  // American English — male
  ['am_adam','AM · Adam (US-M)'], ['am_echo','AM · Echo (US-M)'], ['am_eric','AM · Eric (US-M)'],
  ['am_fenrir','AM · Fenrir (US-M)'], ['am_liam','AM · Liam (US-M)'], ['am_michael','AM · Michael (US-M)'],
  ['am_onyx','AM · Onyx (US-M)'], ['am_puck','AM · Puck (US-M)'], ['am_santa','AM · Santa (US-M)'],
  // British English
  ['bf_alice','BF · Alice (UK-F)'], ['bf_emma','BF · Emma (UK-F)'], ['bf_isabella','BF · Isabella (UK-F)'],
  ['bf_lily','BF · Lily (UK-F)'], ['bm_daniel','BM · Daniel (UK-M)'], ['bm_fable','BM · Fable (UK-M)'],
  ['bm_george','BM · George (UK-M)'], ['bm_lewis','BM · Lewis (UK-M)'],
  // Spanish
  ['ef_dora','EF · Dora (ES-F)'], ['em_alex','EM · Alex (ES-M)'], ['em_santa','EM · Santa (ES-M)'],
  // French
  ['ff_siwis','FF · Siwis (FR-F)'],
  // Hindi
  ['hf_alpha','HF · Alpha (HI-F)'], ['hf_beta','HF · Beta (HI-F)'],
  ['hm_omega','HM · Omega (HI-M)'], ['hm_psi','HM · Psi (HI-M)'],
  // Italian
  ['if_sara','IF · Sara (IT-F)'], ['im_nicola','IM · Nicola (IT-M)'],
  // Japanese
  ['jf_alpha','JF · Alpha (JP-F)'], ['jf_gongitsune','JF · Gongitsune (JP-F)'],
  ['jf_nezumi','JF · Nezumi (JP-F)'], ['jf_tebukuro','JF · Tebukuro (JP-F)'], ['jm_kumo','JM · Kumo (JP-M)'],
  // Portuguese (BR)
  ['pf_dora','PF · Dora (PT-F)'], ['pm_alex','PM · Alex (PT-M)'], ['pm_santa','PM · Santa (PT-M)'],
  // Mandarin
  ['zf_xiaobei','ZF · Xiaobei (ZH-F)'], ['zf_xiaoni','ZF · Xiaoni (ZH-F)'],
  ['zf_xiaoxiao','ZF · Xiaoxiao (ZH-F)'], ['zf_xiaoyi','ZF · Xiaoyi (ZH-F)'],
  ['zm_yunjian','ZM · Yunjian (ZH-M)'], ['zm_yunxi','ZM · Yunxi (ZH-M)'],
  ['zm_yunxia','ZM · Yunxia (ZH-M)'], ['zm_yunyang','ZM · Yunyang (ZH-M)']
];

/* -------------------- DOM -------------------- */
const $ = (id) => document.getElementById(id);

const viewport = $('sbViewport');
const board = $('sbBoard');

const stageSprite = $('stageSprite');
const stageFrame = $('stageFrame');
const plateName = $('plateName');
const plateRole = $('plateRole');
const folioLeft = $('folioLeft');
const folioRight = $('folioRight');

const chapterKicker = $('chapterKicker');
const chapterName = $('chapterName');
const dropCap = $('dropCap');
const scriptInput = $('scriptInput');

const voiceSelect = $('voiceSelect');
const paceSlider = $('paceSlider');
const paceValue = $('paceValue');
const pitchSlider = $('pitchSlider');
const pitchValue = $('pitchValue');

const btnSpeak = $('btnSpeak');
const speakLabel = $('speakLabel');
const speakWave = $('speakWave');
const speakTime = $('speakTime');
const timeElapsed = $('timeElapsed');
const timeTotal = $('timeTotal');
const progressFill = $('progressFill');
const scriptWarning = $('scriptWarning');
const btnHush = $('btnHush');
const btnSave = $('btnSave');
const btnNext = $('btnNext');

const voicedHeading = $('voicedHeading');
const voicedGrid = $('voicedGrid');
const awaitingHeading = $('awaitingHeading');
const awaitingGrid = $('awaitingGrid');

/* -------------------- Board fitting --------------------
   The desktop board is designed at 1440px wide. Between the phone
   breakpoint and 1440 it is scaled down as a whole (layout stays at
   1440, a transform shrinks it), so nothing reflows or crops. */
const BOARD_WIDTH = 1440;
const desktopQuery = window.matchMedia('(min-width: 1024px)');

function fitBoard() {
  const width = document.documentElement.clientWidth;
  if (desktopQuery.matches && width < BOARD_WIDTH) {
    const scale = width / BOARD_WIDTH;
    board.style.width = BOARD_WIDTH + 'px';
    board.style.transformOrigin = '0 0';
    board.style.transform = 'scale(' + scale + ')';
    viewport.style.height = (board.offsetHeight * scale) + 'px';
  } else {
    board.style.width = '';
    board.style.transform = '';
    viewport.style.height = '';
  }
}
window.addEventListener('resize', fitBoard);
if (window.ResizeObserver) new ResizeObserver(fitBoard).observe(board);
fitBoard();

/* -------------------- Small helpers -------------------- */
function roman(n) {
  const table = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  table.forEach(([value, glyph]) => { while (n >= value) { out += glyph; n -= value; } });
  return out;
}

const NUMBER_WORDS = ['NONE', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
  'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN', 'TWENTY'];
function numberWord(n) {
  return NUMBER_WORDS[n] || String(n);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/* -------------------- Speak state --------------------
   idle     nothing playing (the label reads "Speak")
   loading  Speak pressed; waiting on the voice model / first sentences
   playing  audio running ("Speaking", pause icon, wave, glowing pulse)
   paused   audio suspended mid-take; Speak resumes it */
let playState = 'idle';

function setSpeakLabel(text) {
  speakLabel.textContent = text;
  btnSpeak.setAttribute('aria-label', text);
}

function setPlayState(state, labelText) {
  playState = state;
  const playing = state === 'playing';
  board.classList.toggle('is-playing', playing);
  speakWave.classList.toggle('on', playing);
  if (labelText) setSpeakLabel(labelText);
  else if (playing) setSpeakLabel('Speaking');
  else if (state !== 'loading') setSpeakLabel('Speak');
}

/* -------------------- Dirty tracking --------------------
   Speak regenerates audio only when the script/voices/pace/pitch/
   character has changed since the last complete take; otherwise it
   replays the existing take. */
let dirty = true;
function markDirty() {
  dirty = true;
  // The time readout describes the take Speak would play; once anything
  // changes, that take is stale, so the readout goes until the next one.
  speakTime.hidden = true;
}

/* -------------------- Time readout ("0:42 / 2:15") -------------------- */
function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}
function showTime(elapsed, total) {
  timeElapsed.textContent = formatTime(elapsed);
  timeTotal.textContent = formatTime(total);
  progressFill.style.width = (total ? Math.min(100, (elapsed / total) * 100) : 0) + '%';
}

/* ====================================================================
   STAGE, SCRIPT PAGE AND THE CAST
   Characters come from the registry (character-registry.js). Those
   with a voice profile are "voiced", the rest "awaiting a voice"; the
   cast reads voiced first, and chapters are numbered in that order.
   Registry entries with no animation yet show as pending cards.
   ==================================================================== */
const stage = createSpeakerStage({ stageEl: stageSprite, primaryFrame: stageFrame });
if (window.ResizeObserver) new ResizeObserver(() => stage.updateScale()).observe(stageSprite);
else window.addEventListener('resize', () => stage.updateScale());

let castOrder = [];
let selectedCharacter = null;

function showSpeaker(character) {
  plateName.textContent = character ? character.title : '';
  plateRole.textContent = character ? character.role : '';
}

function renderChapter() {
  const idx = Math.max(0, castOrder.indexOf(selectedCharacter));
  chapterKicker.textContent = 'CHAPTER ' + roman(idx + 1) + ' · SPOKEN BY';
  chapterName.textContent = selectedCharacter ? selectedCharacter.title : '';
  folioLeft.textContent = '— ' + (2 * idx + 12) + ' —';
  folioRight.textContent = '— ' + (2 * idx + 13) + ' —';
}

function castCard(character, index) {
  const card = el('button', 'sb-card cardbtn');
  card.type = 'button';
  card.dataset.slug = character.id;
  card.setAttribute('aria-label', 'Choose ' + character.title);
  card.setAttribute('aria-pressed', 'false');

  card.appendChild(el('div', 'sb-card-chapter', roman(index + 1)));
  const portrait = el('div', 'sb-card-portrait');
  if (character.thumbnail) {
    const img = el('img', 'sb-card-sprite');
    img.src = '../' + character.thumbnail;
    img.alt = '';
    img.onerror = () => { img.style.visibility = 'hidden'; };
    portrait.appendChild(img);
  }
  card.appendChild(portrait);
  card.appendChild(el('div', 'sb-card-name', character.title));
  card.appendChild(el('div', 'sb-card-role', character.role));
  card.appendChild(el('div', 'sb-card-voice', character.voiceProfile ? character.voiceProfile.label : 'No voice cast yet'));

  card.addEventListener('click', () => {
    stopEverything();
    selectCharacter(character);
  });
  return card;
}

const PENDING_FIGURE = '<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="22" r="11" fill="none" stroke="#3A5656" stroke-width="2"></circle><path d="M12 58 Q14 38 32 38 Q50 38 52 58" fill="none" stroke="#3A5656" stroke-width="2"></path></svg>';

function pendingCard(character) {
  const card = el('div', 'sb-card sb-card--pending');
  card.appendChild(el('div', 'sb-card-chapter', '—'));
  const portrait = el('div', 'sb-card-portrait');
  portrait.innerHTML = PENDING_FIGURE;
  card.appendChild(portrait);
  card.appendChild(el('div', 'sb-card-name', character.title));
  card.appendChild(el('div', 'sb-card-role', character.role));
  card.appendChild(el('div', 'sb-card-voice', character.pendingLabel));
  return card;
}

function renderCast() {
  const characters = getCharacters();
  const pending = getPendingCharacters();
  const voiced = characters.filter((c) => c.voiceProfile);
  const awaiting = characters.filter((c) => !c.voiceProfile);
  castOrder = voiced.concat(awaiting);

  voicedHeading.textContent = 'THE VOICED ' + numberWord(voiced.length);
  voicedGrid.innerHTML = '';
  voiced.forEach((c) => voicedGrid.appendChild(castCard(c, castOrder.indexOf(c))));

  awaitingGrid.innerHTML = '';
  awaiting.forEach((c) => awaitingGrid.appendChild(castCard(c, castOrder.indexOf(c))));
  pending.forEach((c) => awaitingGrid.appendChild(pendingCard(c)));
  awaitingHeading.hidden = !awaiting.length && !pending.length;
}

function selectCharacter(character) {
  if (!character) return;
  selectedCharacter = character;
  stage.setPrimary(character);
  showSpeaker(character);
  voiceSelect.value = getVoice(character.id);
  document.querySelectorAll('.sb-card[data-slug]').forEach((card) => {
    const on = card.dataset.slug === character.id;
    card.classList.toggle('is-selected', on);
    card.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  renderChapter();
  refreshScriptWarning();
  // Until someone writes their own script, the page shows the selected
  // character's example line.
  if (!scriptEdited) setScript(character.sampleLine);
  markDirty();
  prefetchScriptVoices();
  window.dispatchEvent(new CustomEvent('forge:character-selected', { detail: character }));
}

/* -------------------- The script (drop cap + page text) --------------------
   The board sets the first letter in a drop-cap box and the rest as the
   page's paragraph. The script lives in `scriptText`; the drop cap shows
   its first character and the textarea holds everything after it.
   Backspace at the very start removes the drop-cap letter; replacing
   the whole textarea (select all, then type or paste) replaces the
   whole script. */
let scriptText = '';
let scriptEdited = false;
let replaceAll = false;

function firstChar(text) {
  return text ? String.fromCodePoint(text.codePointAt(0)) : '';
}

function autosizeScript() {
  scriptInput.style.height = 'auto';
  scriptInput.style.height = scriptInput.scrollHeight + 'px';
}

function setScript(text) {
  scriptText = text || '';
  const first = firstChar(scriptText);
  dropCap.textContent = first;
  scriptInput.value = scriptText.slice(first.length);
  autosizeScript();
}

let prefetchTimer = null;
function onScriptEdited() {
  scriptEdited = true;
  markDirty();
  clearTimeout(prefetchTimer);
  prefetchTimer = setTimeout(() => {
    refreshScriptWarning();
    prefetchScriptVoices();
  }, 250);
}

scriptInput.addEventListener('beforeinput', () => {
  const len = scriptInput.value.length;
  replaceAll = len > 0 && scriptInput.selectionStart === 0 && scriptInput.selectionEnd === len;
});

scriptInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Backspace' || !dropCap.textContent) return;
  if (scriptInput.selectionStart !== 0 || scriptInput.selectionEnd !== 0) return;
  e.preventDefault();
  setScript(scriptInput.value);
  scriptInput.setSelectionRange(0, 0);
  onScriptEdited();
});

scriptInput.addEventListener('input', () => {
  if (replaceAll || !dropCap.textContent) {
    // Whole script replaced, or typing into an empty script: the first
    // character moves up into the drop cap.
    const caret = scriptInput.selectionStart;
    const full = scriptInput.value;
    setScript(full);
    const moved = full.length - scriptInput.value.length;
    const pos = Math.max(0, caret - moved);
    scriptInput.setSelectionRange(pos, pos);
  } else {
    scriptText = dropCap.textContent + scriptInput.value;
    autosizeScript();
  }
  replaceAll = false;
  onScriptEdited();
});

dropCap.addEventListener('click', () => {
  scriptInput.focus();
  scriptInput.setSelectionRange(0, 0);
});

function parseCurrentScript() {
  return parseScript(scriptText, {
    defaultSpeakerId: selectedCharacter ? selectedCharacter.id : null,
    resolveSpeaker: findCharacterByName
  });
}

// Speaker tags that don't match a character are spoken by the selected
// character instead; say so under the script.
function refreshScriptWarning() {
  if (!selectedCharacter) return;
  const { warnings } = parseCurrentScript();
  if (!warnings.length) {
    scriptWarning.hidden = true;
    scriptWarning.textContent = '';
    return;
  }
  const names = warnings.map((w) => '“' + w.name + '” (line ' + w.line + ')').join(', ');
  scriptWarning.textContent = 'Unknown speaker' + (warnings.length > 1 ? 's ' : ' ') + names +
    ' — spoken by ' + selectedCharacter.title + ' instead.';
  scriptWarning.hidden = false;
}

// Start downloading the voice of every speaker in the script as soon as
// it's typed/pasted, in parallel with the model load.
function prefetchScriptVoices() {
  if (!selectedCharacter) return;
  const { speakers } = parseCurrentScript();
  tts.prefetchVoices([selectedCharacter.id, ...speakers].map(getVoice));
}

/* -------------------- Voice & enchantments -------------------- */
VOICES.forEach(([id, label]) => {
  const opt = document.createElement('option');
  opt.value = id;
  opt.textContent = label;
  voiceSelect.appendChild(opt);
});

// The Cast voice menu is the selected character's Kokoro voice.
voiceSelect.addEventListener('change', () => {
  if (selectedCharacter) setVoice(selectedCharacter.id, voiceSelect.value);
  markDirty();
  prefetchScriptVoices();
});

function showPace() {
  paceValue.textContent = Number(paceSlider.value).toFixed(1) + '×';
}
function showPitch() {
  const v = parseInt(pitchSlider.value, 10);
  pitchValue.textContent = (v > 0 ? '+' : '') + v;
}
paceSlider.addEventListener('input', () => { showPace(); markDirty(); });
pitchSlider.addEventListener('input', () => { showPitch(); markDirty(); });

/* -------------------- Kokoro: loading (in the worker) -------------------- */
const tts = createTtsClient();
tts.onTiming = (msg) => {
  if (msg.event === 'voice') timing.voice(msg);
  else if (msg.event === 'model') timing.model(msg);
};

// Device choice: q8 + wasm by default; the engine moves to fp32 WebGPU
// on its own when wasm is slower than real time and WebGPU measures
// faster. That outcome is remembered here so the next visit starts on
// the right device. ?device=wasm|webgpu overrides it (testing).
const DEVICE_KEY = 'narratorForge.device.v1';
function readDevicePreference() {
  const forced = new URLSearchParams(location.search).get('device');
  if (forced === 'wasm' || forced === 'webgpu') return forced;
  try { return localStorage.getItem(DEVICE_KEY) || 'auto'; } catch (e) { return 'auto'; }
}
// The background WebGPU download carries on silently; narration keeps
// running on wasm meanwhile.
tts.onUpgradeProgress = () => {};
tts.onDevice = (msg) => {
  timing.device(msg);
  const remember = msg.reason === 'faster' ? 'webgpu' : (msg.reason === 'webgpu-slower' || msg.reason === 'no-webgpu') ? 'wasm' : null;
  if (remember && !new URLSearchParams(location.search).get('device')) {
    try { localStorage.setItem(DEVICE_KEY, remember); } catch (e) { /* not remembered */ }
  }
};
let modelLoadPromise = null;

// The model starts downloading as soon as the page has painted; its
// progress only shows once someone has pressed Speak and is waiting.
function showLoadProgress(pct) {
  if (playState === 'loading' && !tts.ready) setSpeakLabel('Loading voice ' + Math.floor(pct) + '%');
}

function ensureModelLoaded() {
  if (tts.ready) return Promise.resolve();
  if (modelLoadPromise) return modelLoadPromise;
  modelLoadPromise = tts.load(showLoadProgress, { prefer: readDevicePreference() })
    .catch((err) => {
      console.error('Kokoro model failed to load', err);
      throw err;
    })
    .finally(() => { modelLoadPromise = null; });
  return modelLoadPromise;
}

/* -------------------- Playback: streaming queue + UI loop --------------------
   Sentences stream in from the worker and are queued back to back;
   a ~30/sec loop follows the playhead to decide which character is on
   stage and drive their talking mouth from the real audio level. */
const UI_TICK_MS = 33;
const METER_SMOOTHING = 0.4;

let playPressedAt = 0;     // performance.now() of the Speak press, for take timing
let lastScheduledMeta = null;
const queue = new AudioQueue({
  onEnded: () => {
    endNarration();
    showTime(queue.totalDuration(), queue.totalDuration());
  },
  onScheduled: (chunk, gapSeconds) => {
    const meta = chunk.meta;
    if (gapSeconds === null) {
      if (playPressedAt) {
        const leadMs = Math.max(0, (chunk.startAt - queue.ctx.currentTime) * 1000);
        timing.take({ firstAudioMs: performance.now() - playPressedAt + leadMs, bufferedSentences: queue.chunks.length });
        playPressedAt = 0;
      }
    } else {
      timing.gap({ index: meta.index, speakerId: meta.speakerId, prevSpeakerId: lastScheduledMeta && lastScheduledMeta.speakerId, gapMs: gapSeconds * 1000 });
    }
    lastScheduledMeta = meta;
  }
});
let take = null;          // { sentences, generating } for the current take
let uiTimer = null;
let meterSmoothed = 0;
let onStageId = null;     // speaker currently shown on stage during a take
let lastSentenceIndex = -1;
let playRequest = 0;      // bumped by every stop, so a queued Speak can tell it was cancelled
let takeCount = 0;
let lastFilename = null;

function startUiLoop() {
  if (uiTimer) return;
  meterSmoothed = 0;
  onStageId = null;
  lastSentenceIndex = -1;
  setPlayState('playing');
  speakTime.hidden = false;
  uiTimer = setInterval(uiTick, UI_TICK_MS);
}

function uiTick() {
  const pos = queue.now();
  if (!pos) return;
  showTime(pos.elapsed, pos.total);
  meterSmoothed += (pos.level - meterSmoothed) * METER_SMOOTHING;

  const chunk = pos.chunk;
  if (!chunk) return; // between chunks (generation catching up)
  const { speakerId, index } = chunk.meta;

  if (index !== lastSentenceIndex) {
    lastSentenceIndex = index;
    // Load whoever speaks in the next couple of sentences ahead of time.
    if (take) stage.lookAhead(take.sentences, index + 1);
  }
  if (speakerId !== onStageId) {
    stage.silence();
    const from = onStageId;
    const swapStarted = performance.now();
    const shown = stage.show(speakerId);
    if (from) {
      if (shown.preloaded) timing.swap({ from, to: speakerId, ms: 0, preloaded: true });
      else shown.loaded.then(() => timing.swap({ from, to: speakerId, ms: performance.now() - swapStarted, preloaded: false }));
    }
    onStageId = speakerId;
    showSpeaker(getCharacter(speakerId));
  }
  stage.talk(speakerId, meterSmoothed);
}

function pause() {
  if (!queue.ctx) return;
  queue.pause();
  if (uiTimer) { clearInterval(uiTimer); uiTimer = null; }
  stage.silence();
  setPlayState('paused');
}

function resume() {
  queue.resume();
  setPlayState('playing');
  if (!uiTimer) uiTimer = setInterval(uiTick, UI_TICK_MS);
}

function endNarration(labelText) {
  if (uiTimer) { clearInterval(uiTimer); uiTimer = null; }
  stage.silence();
  // Back to the selected character once the take is over.
  if (selectedCharacter) {
    stage.show(selectedCharacter.id);
    showSpeaker(selectedCharacter);
  }
  onStageId = null;
  setPlayState('idle', labelText);
}

// HUSH: cancels any generation still running and all queued audio.
function stopEverything() {
  playRequest += 1;
  tts.cancel();
  queue.stop();
  if (take && take.generating) {
    take.generating = false;
    // An incomplete take can't be replayed or saved.
    markDirty();
    btnSave.disabled = true;
  }
  endNarration();
  showTime(0, queue.totalDuration());
}

async function speak() {
  const playClickedAt = performance.now();
  // Must happen inside the click: browsers only allow audio to start
  // from a user gesture.
  queue.unlock();

  if (!dirty && queue.hasCompleteTake) {
    lastScheduledMeta = null;
    queue.replay();
    startUiLoop();
    return;
  }

  if (!selectedCharacter) return;
  const parsed = parseCurrentScript();
  if (!parsed.sentences.length) { setPlayState('idle', 'Add a script first'); return; }
  refreshScriptWarning();

  stopEverything();
  btnSave.disabled = true;
  const request = playRequest;
  setPlayState('loading', tts.ready ? 'Buffering' : 'Loading voice');
  // Voices download in parallel with the model (if it's still loading).
  tts.prefetchVoices(parsed.sentences.map((s) => getVoice(s.speakerId)));

  try {
    // If the model is still downloading, this press is queued: it waits
    // on the in-flight load and continues as soon as the voice is ready.
    await ensureModelLoaded();
  } catch (err) {
    if (request === playRequest) setPlayState('idle', 'Voice failed to load');
    return;
  }
  if (request !== playRequest) return; // HUSH (or another character) while queued

  const userSpeed = parseFloat(paceSlider.value);
  const pitchSemitones = parseFloat(pitchSlider.value);
  // kokoro-js has no pitch option (generate() takes only voice and
  // speed), so pitch is a playback-rate shift: generate slower/faster by
  // 1/r so that playing back at rate r both restores the chosen pace and
  // moves the pitch by pitchSemitones semitones. This also shifts the
  // voice's timbre along with its pitch.
  const r = Math.pow(2, pitchSemitones / 12);
  const kokoroSpeed = userSpeed / r;

  const sentences = parsed.sentences.map((s, index) => ({
    index,
    speakerId: s.speakerId,
    text: s.text,
    voice: getVoice(s.speakerId)
  }));
  const thisTake = { sentences, generating: true };
  take = thisTake;
  playPressedAt = playClickedAt;
  lastScheduledMeta = null;

  // Buffer before the first sound: the first sentence plus the next two,
  // and at least the first sentence of the second speaker, so the start
  // and the first speaker swap are covered. After that, generation keeps
  // running ahead of playback continuously.
  const secondSpeakerAt = sentences.findIndex((s) => s.speakerId !== sentences[0].speakerId);
  const bufferTarget = Math.min(sentences.length, Math.max(3, secondSpeakerAt + 1));
  const releaseIfBuffered = () => {
    if (!queue.held) return;
    if (queue.chunks.length < bufferTarget && thisTake.generating) return;
    queue.release();
    if (queue.playing && !uiTimer && playState === 'loading') startUiLoop();
  };

  stage.prepare(parsed.speakers);
  queue.startTake({ playbackRate: r, hold: true });
  setSpeakLabel('Buffering');
  dirty = false;

  tts.speak({
    sentences,
    speed: kokoroSpeed,
    onChunk: ({ index, audio, sampleRate, genMs }) => {
      if (take !== thisTake) return;
      timing.sentence({ index, speakerId: sentences[index].speakerId, genMs: genMs || 0, audioSeconds: audio.length / sampleRate });
      queue.enqueue({ audio, sampleRate, meta: { index, speakerId: sentences[index].speakerId } });
      if (queue.held) releaseIfBuffered();
      else if (!uiTimer && queue.playing && playState === 'loading') startUiLoop();
    },
    onDone: () => {
      if (take !== thisTake) return;
      thisTake.generating = false;
      takeCount += 1;
      lastFilename = 'narrator-take' + String(takeCount).padStart(2, '0') + '.wav';
      btnSave.disabled = false;
      releaseIfBuffered();
      queue.finishTake();
      if (!queue.totalDuration()) endNarration();
    },
    onError: (err) => {
      if (take !== thisTake) return;
      console.error(err);
      thisTake.generating = false;
      markDirty();
      queue.stop();
      endNarration('Something went wrong');
    }
  });
}

btnSpeak.addEventListener('click', () => {
  if (playState === 'playing') pause();
  else if (playState === 'paused') resume();
  else if (playState === 'idle') speak();
  // 'loading': already on its way
});

btnHush.addEventListener('click', stopEverything);

/* -------------------- WAV encoding (own encoder — no dependency on
   library-specific save()/toBlob() behaviour) -------------------- */
function encodeWav(float32Audio, sampleRate) {
  const numFrames = float32Audio.length;
  const buffer = new ArrayBuffer(44 + numFrames * 2);
  const view = new DataView(buffer);

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numFrames * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, 1, true);          // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numFrames * 2, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, float32Audio[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

// SAVE WAV: the whole take as one file, sounding exactly as it played.
// The samples are stored as generated; the take's playback rate (the
// pitch shift) is written into the file's sample rate, so a player
// reproduces the same pitch and pace.
btnSave.addEventListener('click', () => {
  if (!queue.hasCompleteTake) return;
  const { samples, sampleRate } = queue.getSamples();
  const url = URL.createObjectURL(encodeWav(samples, Math.round(sampleRate * queue.playbackRate)));
  const a = document.createElement('a');
  a.href = url;
  a.download = lastFilename || 'narrator-take.wav';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
});

// TURN THE PAGE / NEXT PAGE: the next character in the cast.
btnNext.addEventListener('click', () => {
  if (!castOrder.length) return;
  stopEverything();
  const idx = castOrder.indexOf(selectedCharacter);
  selectCharacter(castOrder[(idx + 1) % castOrder.length]);
});

// The 80s Party and Arcane Oracle moods are placeholders until their
// own designs exist; their switcher pills are marked unavailable and do
// nothing.
document.querySelectorAll('.sb-mood[aria-disabled="true"]').forEach((btn) => {
  btn.addEventListener('click', (e) => e.preventDefault());
});

/* -------------------- Init -------------------- */
async function loadCharacterRegistry() {
  try {
    await loadRegistry();
    renderCast();
    if (!castOrder.length) return;
    selectCharacter(castOrder[0]);
    stage.updateScale();
  } catch (err) {
    console.error('Could not load character registry', err);
    setPlayState('idle', 'Cast failed to load');
  }
}

showPace();
showPitch();
const registryReady = loadCharacterRegistry();

// Start loading the voice as soon as the page has painted, rather than
// waiting for Speak (two rAFs = after the first frame is on screen).
requestAnimationFrame(() => requestAnimationFrame(() => {
  ensureModelLoaded().catch(() => { /* Speak retries and says so */ });
}));

// Mouth calibration tool -- only loaded with ?calibrate=1 in the URL.
if (new URLSearchParams(location.search).get('calibrate') === '1') {
  Promise.all([import('./calibrate.js'), registryReady])
    .then(([m]) => m.startCalibration({
      onMouthChange: (id) => stage.refreshMouth(id),
      getSelectedCharacter: () => selectedCharacter
    }))
    .catch((err) => console.error('Calibration mode failed to load', err));
}
