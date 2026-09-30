// ====================================================================
// MOUTH CALIBRATION MODE -- only loaded when the page URL has
// ?calibrate=1 (see the bottom of narrator.js). Builds its own panel,
// so nothing of it exists in normal use.
//
// Shows the selected character large under a faint 64x64 grid. Click
// the sprite to place the mouth centre; arrow keys nudge 1 sprite
// pixel; + / - change width; [ / ] change height. The character keeps
// talking (a synthetic level loop) so the fit can be judged live.
// COPY CONFIG copies the whole character registry (../characters.json)
// with the current mouth positions, ready to paste over that file.
// Positions changed here are kept in memory only until then.
// ====================================================================

import { getMouth, setMouth, registryJSON } from './character-registry.js';
import { sendMouthPosition } from './speaker-stage.js';

const GRID = 64;
const NATIVE_FRAME_PX = 384; // every character build's own canvas CSS size
const TALK_TICK_MS = 33;
// Loops through closed / half-open / fully-open so every mouth stage shows.
const TALK_PATTERN = [
  { level: 0.35, ms: 350 },
  { level: 0.9, ms: 450 },
  { level: 0.35, ms: 250 },
  { level: 0, ms: 300 }
];

export function startCalibration({ onMouthChange, getSelectedCharacter }) {
  let character = null;

  /* ---------- markup ---------- */
  const panel = document.createElement('section');
  panel.className = 'mouth-cal';
  panel.setAttribute('aria-label', 'Mouth calibration');
  panel.innerHTML = `
    <h2 class="mouth-cal-title">MOUTH CALIBRATION — <span id="mouthCalName">…</span></h2>
    <div class="mouth-cal-layout">
      <div class="mouth-cal-stage" id="mouthCalStage">
        <iframe class="mouth-cal-frame" id="mouthCalFrame" title="Character (calibration)" sandbox="allow-scripts" tabindex="-1"></iframe>
        <div class="mouth-cal-grid" id="mouthCalGrid" aria-hidden="true">
          <div class="mouth-cal-box" id="mouthCalBox"></div>
        </div>
      </div>
      <div class="mouth-cal-side">
        <dl class="mouth-cal-readout">
          <div><dt>X</dt><dd id="mouthCalX">0</dd></div>
          <div><dt>Y</dt><dd id="mouthCalY">0</dd></div>
          <div><dt>WIDTH</dt><dd id="mouthCalW">0</dd></div>
          <div><dt>HEIGHT</dt><dd id="mouthCalH">0</dd></div>
        </dl>
        <ul class="mouth-cal-help">
          <li>CLICK sprite — place mouth centre</li>
          <li>ARROWS — nudge 1 sprite px</li>
          <li>+ / − — width</li>
          <li>[ / ] — height</li>
          <li>Pick another character in the cast to calibrate them next</li>
        </ul>
        <button type="button" class="mouth-cal-copy" id="mouthCalCopy">COPY CONFIG</button>
        <p class="mouth-cal-msg" id="mouthCalMsg" role="status" aria-live="polite"></p>
        <textarea class="mouth-cal-output" id="mouthCalOutput" readonly hidden aria-label="characters.json with mouth positions"></textarea>
      </div>
    </div>`;
  // Outside the page layout, so it is never caught up in the scaled
  // desktop board and its click-to-grid maths stays 1:1.
  document.body.appendChild(panel);

  const $ = (id) => panel.querySelector('#' + id);
  const stage = $('mouthCalStage');
  const frame = $('mouthCalFrame');
  const grid = $('mouthCalGrid');
  const box = $('mouthCalBox');
  const msg = $('mouthCalMsg');
  const output = $('mouthCalOutput');

  /* ---------- sprite scaling (same approach as the main stage) ---------- */
  function updateScale() {
    const size = stage.getBoundingClientRect().width;
    frame.style.transform = 'scale(' + size / NATIVE_FRAME_PX + ')';
  }
  new ResizeObserver(updateScale).observe(stage);

  /* ---------- current position ---------- */
  function current() {
    return { ...getMouth(character.id) };
  }

  function render() {
    const p = current();
    $('mouthCalX').textContent = p.x;
    $('mouthCalY').textContent = p.y;
    $('mouthCalW').textContent = p.width;
    $('mouthCalH').textContent = p.height;
    // Percent of the 64-px grid, so it lines up at any rendered size.
    box.style.left = (p.x / GRID) * 100 + '%';
    box.style.top = (p.y / GRID) * 100 + '%';
    box.style.width = (p.width / GRID) * 100 + '%';
    box.style.height = (p.height / GRID) * 100 + '%';
  }

  function apply(next) {
    const width = Math.max(1, Math.min(GRID, next.width));
    const height = Math.max(1, Math.min(GRID, next.height));
    setMouth(character.id, {
      x: Math.max(0, Math.min(GRID - width, next.x)),
      y: Math.max(0, Math.min(GRID - height, next.y)),
      width,
      height
    });
    sendMouthPosition(frame, character.id);
    if (onMouthChange) onMouthChange(character.id);
    render();
  }

  /* ---------- keep the calibration sprite talking ---------- */
  let step = 0;
  let stepEndsAt = 0;
  function sendTalk(type, level) {
    if (!frame.contentWindow) return;
    frame.contentWindow.postMessage({ source: 'dore-narrator-talk', type, level }, '*');
  }

  /* ---------- character switching ---------- */
  function showCharacter(next) {
    if (!next || !next.path) return;
    character = next;
    $('mouthCalName').textContent = character.name.toUpperCase();
    frame.src = '../' + character.path;
    render();
  }
  frame.addEventListener('load', () => {
    if (!character) return;
    sendMouthPosition(frame, character.id);
    sendTalk('talk-start', TALK_PATTERN[step].level);
  });
  window.addEventListener('forge:character-selected', (e) => showCharacter(e.detail));
  showCharacter(getSelectedCharacter());

  /* ---------- click to place centre ---------- */
  grid.addEventListener('click', (e) => {
    if (!character) return;
    const rect = grid.getBoundingClientRect();
    const cx = Math.floor(((e.clientX - rect.left) / rect.width) * GRID);
    const cy = Math.floor(((e.clientY - rect.top) / rect.height) * GRID);
    const p = current();
    apply({ ...p, x: cx - Math.floor(p.width / 2), y: cy - Math.floor(p.height / 2) });
  });

  /* ---------- keyboard ---------- */
  const KEYS = {
    ArrowLeft: (p) => ({ ...p, x: p.x - 1 }),
    ArrowRight: (p) => ({ ...p, x: p.x + 1 }),
    ArrowUp: (p) => ({ ...p, y: p.y - 1 }),
    ArrowDown: (p) => ({ ...p, y: p.y + 1 }),
    '+': (p) => ({ ...p, width: p.width + 1 }),
    '=': (p) => ({ ...p, width: p.width + 1 }),
    '-': (p) => ({ ...p, width: p.width - 1 }),
    '_': (p) => ({ ...p, width: p.width - 1 }),
    ']': (p) => ({ ...p, height: p.height + 1 }),
    '[': (p) => ({ ...p, height: p.height - 1 })
  };
  document.addEventListener('keydown', (e) => {
    if (!character || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const change = KEYS[e.key];
    if (!change) return;
    e.preventDefault();
    apply(change(current()));
  });

  /* keep it talking: loop through the pattern */
  setInterval(() => {
    const now = performance.now();
    if (now >= stepEndsAt) {
      step = (step + 1) % TALK_PATTERN.length;
      stepEndsAt = now + TALK_PATTERN[step].ms;
    }
    sendTalk('talk-level', TALK_PATTERN[step].level);
  }, TALK_TICK_MS);

  /* ---------- COPY CONFIG ---------- */
  $('mouthCalCopy').addEventListener('click', async () => {
    const text = registryJSON();
    try {
      await navigator.clipboard.writeText(text);
      output.hidden = true;
      msg.textContent = 'COPIED — PASTE OVER characters.json';
    } catch (err) {
      // Clipboard API blocked (e.g. file:// or no permission): show it to copy by hand.
      output.value = text;
      output.hidden = false;
      output.select();
      msg.textContent = 'CLIPBOARD BLOCKED — COPY THE TEXT BELOW';
    }
  });

  msg.textContent = 'CHANGES ARE KEPT UNTIL YOU RELOAD — COPY CONFIG TO SAVE';
}
