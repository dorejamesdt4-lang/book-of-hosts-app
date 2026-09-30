// ====================================================================
// THE WARDROBE (wardrobe.html?seat=<slug>) — Stage 1: the guest picks
// their look from the existing talking sprites that suit tonight's
// theme (characters.json "themes" tags), and their voice from the
// theme's voice pool, with a sample they can hear. Saved in this
// browser for Phase 1; the Stage and the Hand use it.
//
// The registry has no palette swaps and no part art exists yet, so the
// mockup's Headwear, Coat colour and Accessories rows are not shown.
// ====================================================================

import { loadAll, pack as packFor, seatParam, spriteFor, playerName, lsGet, lsSet, keys, el } from './common.js';
import { castEntry } from '../engine/script.js';
import { suggestedVoices } from '../engine/themes.js';
import { createVoiceBank } from './voice-bank.js';
import { createSpeech } from './speech.js';
import { loadRegistry, getCharacter } from '../../narrator/character-registry.js';
import { createSpeakerStage } from '../../narrator/speaker-stage.js';

const $ = (id) => document.getElementById(id);
const data = await loadAll();
await loadRegistry();
const { game } = data;
const seat = seatParam(game);
const part = castEntry(game, seat);
const pack = packFor(data, game.game.theme);
const SAMPLE_TEXT = 'Good evening. This is how I will sound tonight.';

$('back').href = 'invite.html?seat=' + encodeURIComponent(seat);
const name = playerName(seat);
$('asLine').textContent = (name || 'You') + ' as ' + part.title;

/* -------------------- look -------------------- */
const looks = data.characters.filter((c) => c.path && (c.themes || []).some((t) => pack.sprite_tags.includes(t)));
const saved = lsGet(keys.wardrobe(seat), null) || {};
let sprite = spriteFor(data, seat);
if (!looks.some((c) => c.slug === sprite) && looks.length) sprite = looks.find((c) => c.slug === seat) ? seat : looks[0].slug;

const box = $('spriteBox');
const stage = createSpeakerStage({ stageEl: box, primaryFrame: $('spriteFrame') });
if (window.ResizeObserver) new ResizeObserver(() => stage.updateScale()).observe(box);

function renderLooks() {
  $('looks').innerHTML = '';
  if (!looks.length) {
    $('lookNote').textContent = 'No characters suit this theme yet.';
    return;
  }
  looks.forEach((c) => {
    const on = c.slug === sprite;
    const b = el('button', {
      type: 'button', class: 'pbtn', 'aria-pressed': on ? 'true' : 'false',
      style: "min-height: 44px; padding: 0 14px; border: 1px solid #D9A441; border-radius: 999px; background: " + (on ? '#D9A441' : 'transparent') + '; color: ' + (on ? '#0F1E28' : '#EDE6D6') + "; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 1px; cursor: pointer"
    }, c.name);
    b.addEventListener('click', () => { sprite = c.slug; showSprite(); renderLooks(); });
    $('looks').appendChild(b);
  });
}

function showSprite() {
  const c = getCharacter(sprite);
  if (c) stage.setPrimary(c);
  stage.updateScale();
}

/* -------------------- voice -------------------- */
const suggestion = suggestedVoices(game, pack)[seat];
pack.voice_pool.forEach((v) => {
  $('w-voice').appendChild(el('option', { value: v.id }, v.label + (v.id === suggestion ? ' (suggested)' : '')));
});
$('w-voice').value = saved.voice && pack.voice_pool.some((v) => v.id === saved.voice) ? saved.voice : suggestion;
const blurb = "Voices on offer suit tonight's theme. Tonight's sound: " + pack.sound_blurb;
$('voiceNote').textContent = blurb;

const bank = createVoiceBank();
const speech = createSpeech();
speech.setPreset(pack.voice_fx);
let sampling = false;

$('btnSample').addEventListener('click', async () => {
  if (sampling) return;
  sampling = true;
  speech.unlock();
  $('btnSample').setAttribute('aria-busy', 'true');
  $('voiceNote').textContent = 'Warming up the voice…';
  try {
    const clip = await bank.generate({ text: SAMPLE_TEXT, voice: $('w-voice').value, speed: 1 });
    $('voiceNote').textContent = blurb;
    let smoothed = 0;
    const t = setInterval(() => { smoothed += (speech.level() - smoothed) * 0.4; stage.talk(sprite, smoothed); }, 33);
    await speech.play({ audio: clip.audio, sampleRate: clip.sampleRate, rate: 1 });
    clearInterval(t);
    stage.silence();
  } catch (err) {
    console.error('Voice sample failed', err);
    $('voiceNote').textContent = 'The sample could not be played. Check your connection and try again.';
  } finally {
    sampling = false;
    $('btnSample').removeAttribute('aria-busy');
  }
});

/* -------------------- save -------------------- */
$('btnSave').addEventListener('click', () => {
  const ok = lsSet(keys.wardrobe(seat), { sprite, voice: $('w-voice').value, updatedAt: new Date().toISOString() });
  $('btnSave').textContent = ok ? 'SAVED' : 'COULD NOT SAVE';
  setTimeout(() => { $('btnSave').textContent = 'SAVE MY CHARACTER'; }, 1800);
});

renderLooks();
showSprite();
