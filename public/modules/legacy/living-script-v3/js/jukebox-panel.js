// ====================================================================
// JUKEBOX PANEL — now playing, pause, skip, volume and "play something
// now". Used on the online Stage's Host Console and on the theatre Host
// Console (which drives the TV window's music over the channel).
//
// Not on the mockups: built in the Host Console bar's own style (navy
// panel, gold rule, the console's outline buttons).
// ====================================================================

import { el } from './common.js';
import { MUSIC_MOODS } from '../engine/jukebox.js';
import { sfxEnabled, setSfxEnabled, unlockSfx } from './sfx.js';

const BTN = "height: 44px; padding: 0 16px; border: 1px solid #2A4A4A; border-radius: 6px; background: transparent; color: #EDE6D6; font-family: 'Cinzel', serif; font-size: 13px; letter-spacing: 1px; cursor: pointer";

export function createJukeboxPanel(container, { onPause, onSkip, onVolume, onPlayNow }) {
  const now = el('div', { style: 'font-size: 16px; color: #EDE6D6' });
  const detail = el('div', { style: 'font-size: 14px; font-style: italic; color: #8FA5A3' });
  const pause = el('button', { type: 'button', class: 'pbtn', style: BTN }, 'PAUSE');
  const skip = el('button', { type: 'button', class: 'pbtn', style: BTN }, 'SKIP');
  const volume = el('input', { type: 'range', min: '0', max: '1', step: '0.05', 'aria-label': 'Music volume', style: 'width: 140px; height: 44px; accent-color: #D9A441' });
  const mood = el('select', { 'aria-label': 'Mood', style: "height: 44px; border: 1px solid #2A4A4A; border-radius: 8px; background: #0B1620; color: #EDE6D6; font-family: 'Cardo', serif; font-size: 15px; padding: 0 8px" },
    MUSIC_MOODS.map((m) => el('option', { value: m }, m.charAt(0).toUpperCase() + m.slice(1))));
  const playNow = el('button', { type: 'button', class: 'pbtn', style: BTN.replace('border: 1px solid #2A4A4A', 'border: 1px solid #D9A441').replace('color: #EDE6D6', 'color: #D9A441') }, 'PLAY SOMETHING NOW');
  // Sound effects (the dice rattle, phone chimes): one setting for every
  // window in this browser.
  const sfx = el('button', { type: 'button', class: 'pbtn', 'aria-pressed': 'true', style: BTN });
  const showSfx = () => { const on = sfxEnabled(); sfx.textContent = 'SOUND EFFECTS: ' + (on ? 'ON' : 'OFF'); sfx.setAttribute('aria-pressed', on ? 'true' : 'false'); };
  sfx.addEventListener('click', () => { setSfxEnabled(!sfxEnabled()); unlockSfx(); showSfx(); });
  showSfx();

  pause.addEventListener('click', () => onPause());
  skip.addEventListener('click', () => onSkip());
  volume.addEventListener('input', () => onVolume(Number(volume.value)));
  playNow.addEventListener('click', () => onPlayNow(mood.value));

  container.innerHTML = '';
  container.appendChild(el('div', { style: 'display: flex; flex-direction: column; gap: 10px' },
    el('div', { style: "font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 3px; color: #D9A441" }, 'JUKEBOX'),
    now, detail,
    el('div', { style: 'display: flex; gap: 10px; align-items: center; flex-wrap: wrap' }, pause, skip, el('span', { style: 'font-size: 14px; color: #8FA5A3' }, 'Volume'), volume),
    el('div', { style: 'display: flex; gap: 10px; align-items: center; flex-wrap: wrap' }, mood, playNow),
    el('div', { style: 'display: flex; gap: 10px; align-items: center; flex-wrap: wrap' }, sfx)));

  return {
    render(st) {
      if (!st) return;
      if (st.track) {
        now.textContent = 'Now playing: ' + st.track.title;
        detail.textContent = (st.mood ? st.mood.charAt(0).toUpperCase() + st.mood.slice(1) : '') + (st.paused ? ' · paused' : '');
      } else {
        now.textContent = 'Nothing playing';
        detail.textContent = st.missing && st.mood ? 'No tracks for "' + st.mood + '" in this theme yet. See jukebox/README.md.' : 'Music cues in the script start tracks automatically.';
      }
      pause.textContent = st.paused ? 'PLAY' : 'PAUSE';
      pause.disabled = !st.track;
      skip.disabled = !st.mood;
      if (document.activeElement !== volume) volume.value = String(st.volume);
    }
  };
}
