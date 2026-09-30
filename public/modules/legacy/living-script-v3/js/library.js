// ====================================================================
// THE SHOW PACK LIBRARY (host) — lists the pre-voiced Show Packs
// (showpacks/library.json), and takes the host through:
//   1. Cast:    each guest's real name, and the character they play
//               (checked against the pack's guest range)
//   2. Preload: on the Stage (theatre-stage.html?pack=<id>), which must
//               hold the audio in its own memory
//   3. Start:   Theatre Mode runs the pack
// The casting is saved (ls3.showpack.cast.<id>) for the Stage and the
// Host Console. Real names only ever appear on screen, never in audio.
// ====================================================================

import { loadAll, loadShowpackLibrary, loadShowpack, registryEntry, lsGet, lsSet, keys, el, fitBoard } from './common.js';
import { checkCast, playedByText } from '../engine/showpack.js';

const $ = (id) => document.getElementById(id);
fitBoard($('board'));

const PASS_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink: 0"><circle cx="12" cy="12" r="10" fill="none" stroke="#5AA8A0" stroke-width="2"></circle><path d="M7 12.5 L10.5 16 L17 9" fill="none" stroke="#5AA8A0" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';
const FAIL_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink: 0"><circle cx="12" cy="12" r="10" fill="none" stroke="#9E3B3B" stroke-width="2"></circle><path d="M8.5 8.5 L15.5 15.5 M15.5 8.5 L8.5 15.5" fill="none" stroke="#9E3B3B" stroke-width="2.2" stroke-linecap="round"></path></svg>';
const FIELD = "height: 40px; border: 1px solid #2A4A4A; border-radius: 8px; background: #0B1620; color: #EDE6D6; font-family: 'Cardo', serif; font-size: 15px; padding: 0 10px";
const TAG = "font-family: 'Silkscreen', monospace; font-size: 10px; letter-spacing: 1px; color: #A9C9C4; border: 1px solid #2A4A4A; border-radius: 999px; padding: 6px 10px";

const data = await loadAll();
const library = await loadShowpackLibrary();
let current = null; // { entry, manifest, game, problems }
let cast = { guests: [] };
let loadRun = 0;

const themeName = (id) => { const t = data.themes.find((p) => p.id === id); return t ? t.name : id || ''; };
const guestsText = (g) => (g ? (g.min === g.max ? g.min : g.min + '–' + g.max) + ' guests' : '');

/* -------------------- the packs -------------------- */
const cards = new Map();
function renderList() {
  const box = $('packList');
  box.innerHTML = '';
  if (!library.length) {
    box.appendChild(el('div', { style: 'padding: 20px 24px; background: #0F1E28; border: 1px solid #2A4A4A; border-radius: 12px; font-size: 16px; color: #A9C9C4' },
      'No Show Packs yet. See showpacks/SHOWPACK-README.md to add one.'));
    return;
  }
  library.forEach((p) => {
    const card = el('button', { type: 'button', class: 'seat pbtn', 'aria-pressed': 'false', style: 'display: flex; flex-direction: column; align-items: flex-start; gap: 8px; width: 100%; text-align: left; padding: 16px 18px; background: #0F1E28; border: 1px solid #2A4A4A; border-radius: 12px; color: #EDE6D6; font-family: Cardo, Georgia, serif; cursor: pointer' },
      el('div', { style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: 18px; color: #D9A441" }, p.title || p.id),
      el('div', { style: 'font-style: italic; font-size: 15px; color: #A9C9C4' }, themeName(p.theme)),
      el('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap' },
        p.ageRating ? el('span', { style: TAG }, p.ageRating.toUpperCase()) : null,
        p.guests ? el('span', { style: TAG }, guestsText(p.guests).toUpperCase()) : null));
    card.addEventListener('click', () => choose(p.id));
    box.appendChild(card);
    cards.set(p.id, card);
  });
}

function markChosen(id) {
  cards.forEach((card, key) => {
    const on = key === id;
    card.setAttribute('aria-pressed', on ? 'true' : 'false');
    card.style.borderColor = on ? '#D9A441' : '#2A4A4A';
  });
}

async function choose(id) {
  const run = ++loadRun;
  markChosen(id);
  current = null;
  $('btnPrepare').disabled = true;
  $('packTitle').textContent = 'Opening the pack…';
  $('packSub').textContent = '';
  $('packWarn').hidden = true;
  $('characters').innerHTML = '';
  $('guestRows').innerHTML = '';
  $('castCheck').innerHTML = '';
  try {
    const loaded = await loadShowpack(id, data.minigames);
    if (run !== loadRun) return;
    current = loaded;
  } catch (err) {
    console.error('Could not open the Show Pack', err);
    if (run !== loadRun) return;
    $('packTitle').textContent = 'This pack could not be opened.';
    $('packSub').textContent = 'Check its manifest.json, then reload the Library.';
    return;
  }
  const m = current.manifest;
  $('packTitle').textContent = m.title || m.id;
  const acts = (m.acts || []).length;
  const lines = current.game.beats.filter((b) => b.type === 'line').length;
  $('packSub').textContent = [themeName(current.entry.theme), m.ageRating, acts + (acts === 1 ? ' act' : ' acts'), lines + (lines === 1 ? ' voiced line' : ' voiced lines')].filter(Boolean).join(' · ');
  if (current.problems.length) {
    $('packWarn').hidden = false;
    $('packWarn').textContent = 'Name rule warning: the spoken text of ' + current.problems.join(', ') + " contains {guest:…}. The narrator must never speak a guest's real name. Put names in screenText only, and re-voice these lines.";
  }
  $('guestRange').textContent = guestsText(m.guests);
  const saved = lsGet(keys.packCast(id), null);
  cast = saved && Array.isArray(saved.guests) ? saved : { guests: (m.characters || []).map((c) => ({ name: '', character: c.id })) };
  renderCast();
}

/* -------------------- step 1: the cast -------------------- */
function renderCharacters() {
  const box = $('characters');
  box.innerHTML = '';
  (current.manifest.characters || []).forEach((c) => {
    const sprite = c.sprite ? registryEntry(data, c.sprite) : null;
    // No sprite in the repo: a plain placeholder in the same frame.
    const thumb = sprite && sprite.thumbnail
      ? el('img', { class: 'ls-thumb', src: '../' + sprite.thumbnail, alt: '', style: 'width: 48px; height: 48px; flex-shrink: 0' })
      : el('div', { style: 'width: 48px; height: 48px' });
    const who = playedByText(cast, c.id);
    box.appendChild(el('div', { style: 'display: flex; align-items: center; gap: 12px; padding: 10px 12px; border: 1px solid #CDBF9F; border-radius: 8px' },
      el('div', { style: 'width: 60px; height: 66px; flex-shrink: 0; box-sizing: border-box; border-radius: 30px 30px 6px 6px; background: #0B1620; border: 1.5px solid #B8923E; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 5px; overflow: hidden' }, thumb),
      el('div', { style: 'display: flex; flex-direction: column; gap: 2px; min-width: 0' },
        el('div', { style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: 16px; color: #0F1E28" }, c.name),
        el('div', { style: 'font-size: 14px; font-style: italic; color: #3B4B57' }, c.role || ''),
        el('div', { style: "font-family: 'Silkscreen', monospace; font-size: 10px; color: " + (who ? '#2E6E69' : '#8A6420') }, who ? 'PLAYED BY ' + who.toUpperCase() : 'NOT CAST YET'),
        // Their phone, for the mini-games (TWIST / STICK, the letter keyboard).
        el('a', { href: 'hand.html?pack=' + encodeURIComponent(current.entry.id) + '&seat=' + encodeURIComponent(c.id), target: '_blank', rel: 'noopener', 'aria-label': 'Open ' + c.name + "'s Player's Hand", style: 'font-size: 14px; font-style: italic; color: #8A6420' }, 'Open Hand ↗'))));
  });
}

function save() {
  if (current) lsSet(keys.packCast(current.entry.id), cast);
}

function renderRows() {
  const box = $('guestRows');
  box.innerHTML = '';
  cast.guests.forEach((g, i) => {
    const name = el('input', { type: 'text', value: g.name || '', maxlength: '40', placeholder: 'Guest ' + (i + 1) + "'s name", 'aria-label': 'Guest ' + (i + 1) + "'s name", autocomplete: 'off', style: FIELD + '; flex-grow: 1; min-width: 0' });
    name.addEventListener('input', () => { g.name = name.value; save(); refresh(); });
    const who = el('select', { 'aria-label': 'Character for guest ' + (i + 1), style: FIELD + '; width: 240px; flex-shrink: 0' },
      el('option', { value: '' }, 'Choose a character…'),
      (current.manifest.characters || []).map((c) => el('option', { value: c.id }, c.name)));
    who.value = g.character || '';
    who.addEventListener('change', () => { g.character = who.value; save(); refresh(); });
    const remove = el('button', { type: 'button', class: 'pbtn', 'aria-label': 'Remove guest ' + (i + 1), style: "height: 40px; padding: 0 12px; border: 1px solid #2A4A4A; border-radius: 6px; background: transparent; color: #A9C9C4; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 1px; cursor: pointer; flex-shrink: 0" }, 'REMOVE');
    remove.addEventListener('click', () => { cast.guests.splice(i, 1); save(); renderCast(); });
    box.appendChild(el('div', { style: 'display: flex; align-items: center; gap: 10px' }, name, who, remove));
  });
}

function refresh() {
  renderCharacters();
  const result = checkCast(current.manifest, cast);
  const box = $('castCheck');
  box.innerHTML = '';
  const row = (ok, text) => {
    const r = el('div', { style: 'display: flex; gap: 10px; align-items: flex-start' });
    r.insertAdjacentHTML('afterbegin', ok ? PASS_ICON : FAIL_ICON);
    r.appendChild(el('div', {}, text));
    box.appendChild(r);
  };
  if (result.ok) row(true, 'The cast is ready.');
  result.errors.forEach((e) => row(false, e));
  result.notes.forEach((n) => box.appendChild(el('div', { style: 'font-size: 14px; font-style: italic; color: #8FA5A3' }, n)));
  const max = (current.manifest.guests && current.manifest.guests.max) || Infinity;
  $('btnAddGuest').disabled = cast.guests.length >= max;
  $('btnPrepare').disabled = !result.ok;
}

function renderCast() {
  renderRows();
  refresh();
}

$('btnAddGuest').addEventListener('click', () => {
  if (!current) return;
  const taken = new Set(cast.guests.map((g) => g.character));
  const free = (current.manifest.characters || []).find((c) => !taken.has(c.id));
  cast.guests.push({ name: '', character: free ? free.id : '' });
  save();
  renderCast();
  const inputs = $('guestRows').querySelectorAll('input');
  if (inputs.length) inputs[inputs.length - 1].focus();
});

/* -------------------- steps 2 and 3: on the Stage -------------------- */
$('btnPrepare').addEventListener('click', () => {
  if (!current || !checkCast(current.manifest, cast).ok) return;
  cast.guests = cast.guests.map((g) => ({ name: String(g.name).trim(), character: g.character }));
  save();
  const q = '?pack=' + encodeURIComponent(current.entry.id);
  // As in the Lobby: the Host Console in its own window (for the laptop);
  // this tab becomes the Stage (drag it to the TV).
  window.open('console.html' + q, 'ls3-console', 'popup,width=1280,height=860');
  location.href = 'theatre-stage.html' + q;
});

renderList();
if (library.length) choose(library[0].id);
