// lib/console-slideshow.js
//
// Reusable "Console Slideshow" component: a CRT/console-style screen
// frame (scanlines, vignette, an accent-colored terminal border
// matching the site's dark synthwave panel style) that shows one
// simple cutout/puppet character, animated in a limited-frame
// cutout-puppet style -- a pop-in entrance, a continuous subtle idle
// bob, and a 2-frame mouth-flap that only runs while "talking".
//
// Talking state is driven by whatever the caller attaches:
//   - attachAudio(audioEl)       a real HTMLAudioElement -- listens
//                                 for play/pause/ended.
//   - attachUtterance(utterance) a SpeechSynthesisUtterance -- listens
//                                 for start/end/error. Lets a page with
//                                 no recorded audio yet (e.g. Ruby, which
//                                 has no TTS pipeline of its own) still
//                                 drive a real, audible narration via
//                                 the browser's built-in Web Speech API
//                                 -- no new dependency, real audio.
//   - talkForDuration(ms)        a plain timed fallback if neither of
//                                 the above applies.
// This is intentionally light on lip-sync: the mouth-flap is a fixed-
// rate loop toggled on/off by these events, a "talking-head illusion"
// rather than true amplitude-driven animation, per the brief.
//
// Self-contained: injects its own <style> once per page (so dropping
// this one script in is enough, no separate CSS file to remember to
// link) and has no external dependencies.

var STYLE_ID = 'cslide-styles';
var NS = 'http://www.w3.org/2000/svg';

function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  var style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = [
    '.cslide-stage { max-width: 220px; margin: 0 auto; }',
    '.cslide-screen {',
    '  position: relative;',
    '  background: #050505;',
    '  border: 2px solid var(--cslide-accent, #2ee6ff);',
    '  border-radius: 10px;',
    '  aspect-ratio: 4 / 3;',
    '  overflow: hidden;',
    '  box-shadow: 0 0 20px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.85);',
    '}',
    '.cslide-vignette {',
    '  position: absolute; inset: 0;',
    '  background: radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.78) 100%);',
    '  pointer-events: none; z-index: 3;',
    '}',
    '.cslide-scanlines {',
    '  position: absolute; inset: 0;',
    '  background: repeating-linear-gradient(0deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 1px, transparent 1px, transparent 3px);',
    '  pointer-events: none; z-index: 4; mix-blend-mode: overlay;',
    '}',
    '.cslide-glow {',
    '  position: absolute; inset: 0;',
    '  box-shadow: inset 0 0 24px var(--cslide-accent, #2ee6ff);',
    '  opacity: 0.25; pointer-events: none; z-index: 2;',
    '}',
    '.cslide-puppet-wrap {',
    '  position: absolute; inset: 0;',
    '  display: flex; align-items: flex-end; justify-content: center;',
    '  padding-bottom: 6%; z-index: 1;',
    '}',
    '.cslide-puppet { width: 55%; height: auto; animation: cslideIdleBob 2.4s ease-in-out infinite; }',
    '.cslide-puppet-wrap.cslide-pop-in .cslide-puppet { animation: cslidePopIn 0.5s ease-out, cslideIdleBob 2.4s ease-in-out infinite 0.5s; }',
    '@keyframes cslidePopIn {',
    '  0%   { transform: scale(0.3) translateY(30px); opacity: 0; }',
    '  65%  { transform: scale(1.08) translateY(-4px); opacity: 1; }',
    '  100% { transform: scale(1) translateY(0); opacity: 1; }',
    '}',
    '@keyframes cslideIdleBob {',
    '  0%, 100% { transform: translateY(0); }',
    '  50%      { transform: translateY(-2%); }',
    '}',
    '.cslide-mouth { transform-box: fill-box; transform-origin: 50% 50%; }',
    '.cslide-talking .cslide-mouth {',
    '  animation: cslideMouthFlap 0.22s steps(1, end) infinite;',
    '}',
    '@keyframes cslideMouthFlap {',
    '  0%, 49%  { transform: scaleY(0.4); }',
    '  50%, 99% { transform: scaleY(1.7); }',
    '  100%     { transform: scaleY(0.4); }',
    '}',
    '.cslide-caption {',
    '  position: absolute; left: 0; right: 0; bottom: 4px;',
    '  text-align: center; font-family: "Courier New", monospace; font-size: 0.6rem;',
    '  color: var(--cslide-accent, #2ee6ff); text-shadow: 0 0 4px currentColor;',
    '  letter-spacing: 1px; z-index: 5; pointer-events: none;',
    '}',
    '.cslide-status {',
    '  position: absolute; top: 4px; right: 6px;',
    '  font-family: "Courier New", monospace; font-size: 0.55rem;',
    '  color: var(--cslide-accent, #2ee6ff); opacity: 0.7; z-index: 5;',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

// Every puppet is one shared blocky bust shape (head + shoulders + a
// mouth rect the .cslide-mouth CSS animates), topped with a per-kind
// hat/hood and occasionally a small held prop. Kept deliberately
// simple -- a silhouette/placeholder, not detailed illustration,
// matching the existing Jester/fortune-teller/Forge blocky-shape
// convention. All coordinates stay within the 0-60 x 0-70 viewBox
// (nothing negative) so nothing gets clipped.
function buildPuppetMarkup(kind) {
  var bodyColor = '#0a0a0a';
  var A = 'var(--cslide-accent, #2ee6ff)';
  var mouth = '<rect class="cslide-mouth" x="26" y="34" width="8" height="2" rx="1" fill="' + A + '" />';
  var eyes = '<circle cx="25" cy="27" r="1.6" fill="' + A + '" />' +
             '<circle cx="35" cy="27" r="1.6" fill="' + A + '" />';
  var shoulders = '<path d="M10 68 Q10 46 30 46 Q50 46 50 68 Z" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />';
  var head = '<circle cx="30" cy="28" r="15" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />';

  var hat = '';
  var prop = '';

  if (kind === 'mystery-narrator') {
    hat = '<ellipse cx="30" cy="18" rx="19" ry="4" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />' +
          '<rect x="18" y="4" width="24" height="15" rx="7" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />';
  } else if (kind === 'jester') {
    hat = '<path d="M17 15 Q20 4 23 15 M27 15 Q30 2 33 15 M37 15 Q40 4 43 15" stroke="' + A + '" stroke-width="2" fill="none" />' +
          '<circle cx="20" cy="5" r="2" fill="' + A + '" /><circle cx="30" cy="3" r="2" fill="' + A + '" /><circle cx="40" cy="5" r="2" fill="' + A + '" />';
  } else if (kind === 'queen') {
    hat = '<path d="M17 14 L20 6 L24 12 L30 4 L36 12 L40 6 L43 14 Z" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />' +
          '<circle cx="30" cy="9" r="1.8" fill="' + A + '" />';
  } else if (kind === 'king') {
    hat = '<path d="M18 14 L18 5 L24 11 L30 2 L36 11 L42 5 L42 14 Z" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />';
  } else if (kind === 'dungeon_master') {
    hat = '<path d="M15 18 Q30 2 45 18 Z" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />';
  } else if (kind === 'tavern_keeper') {
    hat = '<ellipse cx="30" cy="15" rx="14" ry="3" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />' +
          '<rect x="22" y="9" width="16" height="7" rx="2" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />';
    prop = '<rect x="46" y="52" width="6" height="8" fill="none" stroke="' + A + '" stroke-width="1.2" />' +
           '<path d="M52 54 q4 0 4 3 t-4 3" fill="none" stroke="' + A + '" stroke-width="1.2" />';
  } else if (kind === 'storyteller') {
    prop = '<path d="M42 56 L50 54 L58 56 L58 64 L50 62 L42 64 Z" fill="none" stroke="' + A + '" stroke-width="1.2" />' +
           '<line x1="50" y1="54" x2="50" y2="62" stroke="' + A + '" stroke-width="1" />';
  } else if (kind === 'wizard') {
    hat = '<path d="M20 15 L30 2 L40 15 Z" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />' +
          '<circle cx="30" cy="2" r="1.5" fill="' + A + '" />';
    prop = '<line x1="8" y1="70" x2="8" y2="40" stroke="' + A + '" stroke-width="1.5" />' +
           '<circle cx="8" cy="38" r="2.5" fill="none" stroke="' + A + '" stroke-width="1.2" />';
  } else if (kind === 'detective') {
    hat = '<ellipse cx="30" cy="14" rx="13" ry="5" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />' +
          '<rect x="16" y="10" width="6" height="8" rx="2" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />' +
          '<rect x="38" y="10" width="6" height="8" rx="2" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />';
    prop = '<circle cx="48" cy="56" r="4" fill="none" stroke="' + A + '" stroke-width="1.3" />' +
           '<line x1="51" y1="59" x2="55" y2="63" stroke="' + A + '" stroke-width="1.3" />';
  } else if (kind === 'oracle') {
    hat = '<path d="M15 18 Q30 2 45 18 L42 20 Q30 6 18 20 Z" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1" />';
    prop = '<circle cx="48" cy="58" r="5" fill="' + A + '" opacity="0.35" /><circle cx="48" cy="58" r="2.5" fill="' + A + '" />';
  } else if (kind === 'knight') {
    hat = '<rect x="18" y="13" width="24" height="20" rx="4" fill="' + bodyColor + '" stroke="' + A + '" stroke-width="1.2" />' +
          '<rect x="24" y="24" width="12" height="3" fill="' + A + '" />';
    prop = '<line x1="50" y1="45" x2="50" y2="65" stroke="' + A + '" stroke-width="1.5" />' +
           '<line x1="46" y1="49" x2="54" y2="49" stroke="' + A + '" stroke-width="1.5" />';
  }

  return shoulders + head + hat + prop + eyes + mouth;
}

// Renders one puppet as a standalone, static (non-animated, no CRT
// frame) SVG markup string -- for lightweight uses like a grid of
// small avatar icons, where a full createConsoleSlideshow() stage per
// item would be overkill. Insert the result via innerHTML on a
// container; accentColor defaults to the same cyan the CRT stage uses.
export function renderPuppetIcon(kind, accentColor) {
  return '<svg viewBox="0 0 60 70" xmlns="' + NS + '" style="--cslide-accent:' + (accentColor || '#2ee6ff') + '">' +
    buildPuppetMarkup(kind) +
    '</svg>';
}

// container: an element already in the DOM. options.accentColor sets
// the initial border/glow/caption color (a CSS hex/rgb string).
// options.maxWidth overrides the default 220px stage size (a plain CSS
// size string, e.g. '480px') for callers that want a larger display,
// e.g. a dedicated big-screen page -- an inline style, so it doesn't
// affect any other stage on the page.
// Returns a controller: { setPuppet, attachAudio, attachUtterance,
// talkForDuration, setAccent, stage }.
export function createConsoleSlideshow(container, options) {
  options = options || {};
  injectStylesOnce();

  var stage = document.createElement('div');
  stage.className = 'cslide-stage';
  stage.style.setProperty('--cslide-accent', options.accentColor || '#2ee6ff');
  if (options.maxWidth) stage.style.maxWidth = options.maxWidth;
  stage.innerHTML =
    '<div class="cslide-screen">' +
      '<div class="cslide-puppet-wrap"><svg class="cslide-puppet" viewBox="0 0 60 70" xmlns="' + NS + '"></svg></div>' +
      '<div class="cslide-glow"></div>' +
      '<div class="cslide-vignette"></div>' +
      '<div class="cslide-scanlines"></div>' +
      '<div class="cslide-status"></div>' +
      '<div class="cslide-caption"></div>' +
    '</div>';
  container.appendChild(stage);

  var svg = stage.querySelector('.cslide-puppet');
  var puppetWrap = stage.querySelector('.cslide-puppet-wrap');
  var caption = stage.querySelector('.cslide-caption');
  var statusEl = stage.querySelector('.cslide-status');

  var boundAudioEl = null;
  var boundUtteranceCleanup = null;
  var pendingTimeout = null;

  function onTalkStart() {
    stage.classList.add('cslide-talking');
    statusEl.textContent = 'REC';
  }
  function onTalkStop() {
    stage.classList.remove('cslide-talking');
    statusEl.textContent = '';
  }

  function clearBindings() {
    if (boundAudioEl) {
      boundAudioEl.removeEventListener('play', onTalkStart);
      boundAudioEl.removeEventListener('pause', onTalkStop);
      boundAudioEl.removeEventListener('ended', onTalkStop);
      boundAudioEl = null;
    }
    if (boundUtteranceCleanup) {
      boundUtteranceCleanup();
      boundUtteranceCleanup = null;
    }
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
    onTalkStop();
  }

  function setPuppet(kind, puppetOptions) {
    puppetOptions = puppetOptions || {};
    svg.innerHTML = buildPuppetMarkup(kind);
    if (puppetOptions.accentColor) stage.style.setProperty('--cslide-accent', puppetOptions.accentColor);
    caption.textContent = puppetOptions.label || '';

    puppetWrap.classList.remove('cslide-pop-in');
    void puppetWrap.offsetWidth; // force reflow so re-adding the class restarts the entrance animation
    puppetWrap.classList.add('cslide-pop-in');
  }

  function setAccent(color) {
    stage.style.setProperty('--cslide-accent', color);
  }

  // Wires an <audio>/<video>-like element's play/pause/ended events to
  // the talking state. Safe to call again later with a different
  // element (e.g. a shared, reused <audio> whose .src keeps changing).
  function attachAudio(audioEl) {
    clearBindings();
    boundAudioEl = audioEl;
    audioEl.addEventListener('play', onTalkStart);
    audioEl.addEventListener('pause', onTalkStop);
    audioEl.addEventListener('ended', onTalkStop);
  }

  // Wires a SpeechSynthesisUtterance's start/end/error events to the
  // talking state -- real, audible narration via the browser's own
  // Web Speech API, for pages with no recorded/synthesized audio file
  // of their own to attach via attachAudio(). Sets both
  // addEventListener AND the onstart/onend/onerror properties: the
  // Web Speech API's addEventListener support has been inconsistent
  // across browsers (some engines only reliably fire the on* property
  // handlers for utterance events), so both are wired for safety --
  // onTalkStart/onTalkStop are idempotent, so no harm if both fire.
  function attachUtterance(utterance) {
    clearBindings();
    utterance.addEventListener('start', onTalkStart);
    utterance.addEventListener('end', onTalkStop);
    utterance.addEventListener('error', onTalkStop);
    utterance.onstart = onTalkStart;
    utterance.onend = onTalkStop;
    utterance.onerror = onTalkStop;
    boundUtteranceCleanup = function () {
      utterance.removeEventListener('start', onTalkStart);
      utterance.removeEventListener('end', onTalkStop);
      utterance.removeEventListener('error', onTalkStop);
      utterance.onstart = null;
      utterance.onend = null;
      utterance.onerror = null;
    };
  }

  // Fallback for when there's genuinely no audio/utterance to attach
  // to yet -- just runs the talking animation for a fixed duration.
  function talkForDuration(ms) {
    clearBindings();
    onTalkStart();
    pendingTimeout = setTimeout(onTalkStop, ms);
  }

  return {
    stage: stage,
    setPuppet: setPuppet,
    setAccent: setAccent,
    attachAudio: attachAudio,
    attachUtterance: attachUtterance,
    talkForDuration: talkForDuration,
  };
}
