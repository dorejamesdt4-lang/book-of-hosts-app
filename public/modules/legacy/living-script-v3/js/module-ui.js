// ====================================================================
// MINI-GAME SCREENS — which page code draws which self-paced module, and
// the small kit the Host Console (and the test pages) build their
// controls from: the Lobby's pills, the console's buttons, the
// parchment card's headings.
//
//   uiFor(moduleState) -> the module's screens (see twentyone-ui.js), or null
//   hostKit({ host, titleOf }) -> { K, H, P, button, confirmButton, pills, row, host, titleOf }
// ====================================================================

import { el } from './common.js';
import * as twentyOne from './twentyone-ui.js';
import * as lanterns from './lanterns-ui.js';
import * as vault from './vault-ui.js';
import * as goblet from './goblet-ui.js';

// Vernacular Vault and Slang-O-Meter 18+ share one set of screens (two skins);
// so do Goblet Glance and Street Shuffle 18+.
export const MODULE_UI = { [twentyOne.id]: twentyOne, [lanterns.id]: lanterns, ...Object.fromEntries(vault.ids.map((id) => [id, vault])), ...Object.fromEntries(goblet.ids.map((id) => [id, goblet])) };

export function uiFor(moduleState) {
  return moduleState && MODULE_UI[moduleState.id] ? MODULE_UI[moduleState.id] : null;
}

const BTN = "height: 44px; padding: 0 14px; border-radius: 6px; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 1px; cursor: pointer;";

export function hostKit({ host, titleOf }) {
  const K = (t) => el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 3px; color: #8A6420" }, t);
  const H = (t) => el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-weight: 700; font-size: 22px; line-height: 1.2; color: #0F1E28" }, t);
  const P = (t, extra) => el('div', { style: 'position: relative; font-size: 17px; line-height: 1.45; color: #1B2A36;' + (extra || '') }, t);
  function button(label, onClick, { disabled = false, strong = false } = {}) {
    const b = el('button', { type: 'button', class: 'pbtn', disabled, style: BTN + ' border: 1px solid ' + (strong ? '#8A6420' : '#CDBF9F') + '; background: ' + (strong ? '#D9A441' : 'transparent') + '; color: #0F1E28;' + (strong ? ' font-weight: 700;' : '') }, label);
    b.addEventListener('click', onClick);
    return b;
  }
  // Asks first: the first press arms it, the second (within 4 s) does it.
  // Kept here, not on the button, because the console redraws often.
  const armedUntil = {};
  function confirmButton(label, confirmLabel, onClick, opts = {}) {
    const armed = () => (armedUntil[label] || 0) > Date.now();
    const paint = (b, on) => { b.textContent = on ? confirmLabel : label; b.style.background = on ? '#9E3B3B' : 'transparent'; b.style.color = on ? '#EDE6D6' : '#0F1E28'; };
    const b = button(label, () => {
      if (armed()) { armedUntil[label] = 0; paint(b, false); onClick(); return; }
      armedUntil[label] = Date.now() + 4000;
      paint(b, true);
      setTimeout(() => { if (!armed()) paint(b, false); }, 4100);
    }, opts);
    if (armed() && !opts.disabled) paint(b, true);
    return b;
  }
  function pills(label, options, value, onPick) {
    return el('div', { role: 'group', 'aria-label': label, style: 'position: relative; display: flex; align-items: center; gap: 8px; flex-wrap: wrap' },
      el('span', { style: "min-width: 96px; font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 2px; color: #2E6E69" }, label),
      options.map(([v, text]) => {
        const on = v === value;
        const b = el('button', { type: 'button', class: 'pbtn', 'aria-pressed': on ? 'true' : 'false', style: "min-height: 36px; padding: 0 12px; border: 1px solid #8A6420; border-radius: 999px; background: " + (on ? '#D9A441' : 'transparent') + "; color: #0F1E28; font-family: 'Cinzel', serif; font-size: 11px; letter-spacing: 1px; cursor: pointer" }, text);
        b.addEventListener('click', () => onPick(v));
        return b;
      }));
  }
  const row = (...buttons) => el('div', { style: 'position: relative; display: flex; gap: 8px; flex-wrap: wrap' }, buttons.filter(Boolean));
  return { K, H, P, button, confirmButton, pills, row, host, titleOf };
}
