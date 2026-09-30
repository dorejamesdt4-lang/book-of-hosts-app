// ====================================================================
// GOBLET GLANCE · PRINT (goblet-print.html?module=<id>) — the game in
// person: the rules card, a scorekeeper's grid and, for Street Shuffle
// 18+ only, the forfeit sheet from shared/forfeits-18.json. The 18+
// version asks for the 18+ confirmation before anything of it is loaded.
// In person it's plastic cups only (no glasses) and a small foam ball or
// a bottle top; the host shuffles by hand.
// ====================================================================

import { el, loadModuleData } from './common.js';
import { MODULES } from '../engine/minigames.js';
import { ageLockError } from '../engine/modules/vernacular-vault.js';

const ID = new URLSearchParams(location.search).get('module') === 'goblet-glance-18' ? 'goblet-glance-18' : 'goblet-glance';
const mod = MODULES[ID];
const doc = document.getElementById('doc');
const ROWS = 16;
const ROUNDS = 10;

function gate() {
  const box = el('input', { type: 'checkbox' });
  const g = el('div', { class: 'gate' },
    el('div', { style: "font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 5px; color: #D9A441" }, 'ADULT ROOM (TEST ONLY) · 18+'),
    el('label', {}, box, 'I confirm this is for an 18+ audience — show the adult sheets'),
    el('a', { href: 'games.html', style: 'color: #D9A441' }, '‹ Back to the Games'));
  doc.appendChild(g);
  return new Promise((resolve) => box.addEventListener('change', () => { if (box.checked) { g.remove(); resolve(); } }));
}

const adult = mod.ageRating === '18+';
if (adult) await gate();
const data = (await loadModuleData([ID]))[ID];
const meta = data.meta;
document.title = meta.name + ' · Print — The Living Script v3';

doc.appendChild(el('section', { class: 'sheet' },
  el('div', { class: 'kicker' }, 'THE LIVING SCRIPT · MINI-GAME · ' + meta.ageRating),
  el('h1', {}, meta.name),
  el('p', { class: 'muted' }, meta.pitch),
  el('h2', {}, 'You need'),
  el('ul', {},
    el('li', {}, '3, 4 or 5 plastic cups, all the same (plastic only: no glasses).'),
    el('li', {}, 'A small foam ball or a bottle top.'),
    el('li', {}, 'A table everyone can see, and this sheet for the score.')),
  el('h2', {}, 'How to play'),
  el('ol', {},
    el('li', {}, 'Drop: the host shows everyone the ball, then puts a cup over it.'),
    el('li', {}, 'Shuffle: the host slides the cups around by hand, swapping two at a time. Easy is about 5 slow swaps; Medium about 10; Hard about 18, as fast as the host can manage. Keep the cups on the table: no lifting.'),
    el('li', {}, 'Stop: the cups are numbered 1, 2, 3… from the guests\' left. On "Show!", everyone holds up fingers for a cup number, or writes it down.'),
    el('li', {}, 'Reveal: the host lifts the cup. Everyone who picked it scores 100 points (a tick on the grid). No answer counts as wrong.'),
    el('li', {}, 'Play 3, 5 or 10 rounds. The highest score wins; a tie is shared, so there can be joint winners.')),
  el('p', { class: 'muted' }, 'Points only: no betting, no money, no prizes that cost anything.'),
  adult ? el('p', { class: 'muted' }, 'Forfeits are optional and off by default. Anyone can pass, with no penalty.') : null));

// The scorekeeper's grid: a tick for each right cup, 100 points each.
const head = el('tr', {}, el('th', { class: 'name' }, 'GUEST'), Array.from({ length: ROUNDS }, (_, i) => el('th', {}, 'R' + (i + 1))), el('th', { class: 'total' }, 'TOTAL'));
const rows = Array.from({ length: ROWS }, () => el('tr', {}, el('td'), Array.from({ length: ROUNDS }, () => el('td')), el('td')));
doc.appendChild(el('section', { class: 'sheet' },
  el('div', { class: 'kicker' }, 'SCOREKEEPER\'S GRID · ' + meta.name.toUpperCase()),
  el('p', { class: 'muted' }, 'A tick for each right cup; each tick is 100 points. Leave a box empty for a wrong cup or no answer.'),
  el('div', { class: 'grid-wrap' }, el('table', { class: 'score' }, el('thead', {}, head), el('tbody', {}, rows)))));

// The forfeit sheet: 18+ only, and only from an 18+ forfeits file (the age lock).
if (adult) {
  const file = data.forfeitsFile;
  const err = ageLockError(file, '18+', 'forfeit list');
  const list = err ? [] : (file.forfeits || []).filter((f) => typeof f === 'string' && f.trim());
  doc.appendChild(el('section', { class: 'sheet' },
    el('div', { class: 'kicker' }, 'FORFEIT SHEET · 18+'),
    el('h1', {}, 'All forfeits are optional — anyone can pass.'),
    el('p', { class: 'muted' }, 'A guest who picks the wrong cup (or doesn\'t answer) may take a forfeit, if you\'re playing with them: roll a die, point, or pick one at random. Passing is always fine.'),
    err ? el('p', {}, 'The forfeit list can\'t be printed: ' + err) : el('ol', { class: 'forfeits' }, list.map((f) => el('li', {}, f)))));
}
