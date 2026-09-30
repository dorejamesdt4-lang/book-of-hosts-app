// ====================================================================
// VERNACULAR VAULT · PRINT (vault-print.html?module=<id>) — the game in
// person: rules card, flashcards (word on the front; meaning and example
// on the back, laid out so double-sided printing lines them up) and the
// four coloured answer cards. The 18+ version asks for the 18+
// confirmation before anything of it is loaded, and only prints 18+ pools.
// ====================================================================

import { el, loadModuleData } from './common.js';
import { MODULES } from '../engine/minigames.js';
import { ageLockError, entryProblems } from '../engine/modules/vernacular-vault.js';
import { OPTION_COLOURS } from './vault-ui.js';

const ID = new URLSearchParams(location.search).get('module') === 'vernacular-vault-18' ? 'vernacular-vault-18' : 'vernacular-vault';
const mod = MODULES[ID];
const doc = document.getElementById('doc');
const PER_SHEET = 8; // 2 columns x 4 rows

function gate() {
  const box = el('input', { type: 'checkbox' });
  const g = el('div', { class: 'gate' },
    el('div', { style: "font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 5px; color: #D9A441" }, 'ADULT ROOM (TEST ONLY) · 18+'),
    el('label', {}, box, 'I confirm this is for an 18+ audience — show the adult cards'),
    el('a', { href: 'games.html', style: 'color: #D9A441' }, '‹ Back to the Games'));
  doc.appendChild(g);
  return new Promise((resolve) => box.addEventListener('change', () => { if (box.checked) { g.remove(); resolve(); } }));
}

if (mod.ageRating === '18+') await gate();
const data = (await loadModuleData([ID]))[ID];
const meta = data.meta;
document.title = meta.name + ' · Print — The Living Script v3';
// The age lock, here too: only pools with this game's rating are printed.
const pools = data.pools.filter((p) => !ageLockError(p, mod.ageRating));
const entries = pools.flatMap((p) => p.entries.filter((e) => !entryProblems(e)));

doc.appendChild(el('section', { class: 'sheet' },
  el('div', { class: 'kicker' }, 'THE LIVING SCRIPT · MINI-GAME · ' + meta.ageRating),
  el('h1', {}, meta.name),
  el('p', { class: 'muted' }, meta.pitch),
  el('h2', {}, 'Playing in person'),
  el('ol', {},
    el('li', {}, 'Every guest gets four coloured cards: A red, B blue, C yellow, D green (cut out the last page, one set each).'),
    el('li', {}, 'The host reads a flashcard: the word (then the four meanings to choose from), or a meaning (then four words).'),
    el('li', {}, 'On "Show!", everyone holds up one card at the same time.'),
    el('li', {}, 'The host turns the flashcard over to reveal the true meaning and the example.'),
    el('li', {}, 'A right answer scores 100. The first right card up earns a speed bonus (1.5× or 2×, if you use it).'),
    el('li', {}, 'The host keeps score on paper. After 5, 10 or 15 questions, the highest score wins; a tie goes to the most speed bonuses, then it\'s shared.')),
  el('h2', {}, 'The four options'),
  el('p', {}, 'For "word to meaning", read the true meaning with three made-up ones from the host sheet below, in any order. For "meaning to word", read the true word with three other words from the pack.'),
  mod.ageRating === '18+' ? el('p', { class: 'muted' }, 'Forfeits are optional and off by default. Anyone can pass, with no penalty.') : null,
  el('h2', {}, 'Host sheet'),
  el('ul', {}, entries.map((e) => el('li', {}, el('strong', {}, e.word + ': '), [e.realMeaning, ...e.fakes].join(' · ')))),
  el('p', { class: 'muted' }, 'The first meaning after each word is the true one.')));

// Flashcards: a sheet of fronts, then its backs with each row mirrored, so
// the card in column 1 backs onto column 2 when printed double-sided.
for (let i = 0; i < entries.length; i += PER_SHEET) {
  const chunk = entries.slice(i, i + PER_SHEET);
  const fronts = el('div', { class: 'cards' }, chunk.map((e) => el('div', { class: 'card' }, el('div', { class: 'tiny' }, meta.name.toUpperCase()), el('div', { class: 'word' }, e.word))));
  const backsOrder = [];
  for (let r = 0; r < chunk.length; r += 2) { backsOrder.push(chunk[r + 1] || null, chunk[r]); }
  const backs = el('div', { class: 'cards' }, backsOrder.map((e) => el('div', { class: 'card' }, e ? [el('div', { class: 'meaning' }, e.realMeaning), el('div', { class: 'example' }, '“' + e.example + '”'), el('div', { class: 'tiny' }, e.word.toUpperCase())] : null)));
  doc.appendChild(el('section', { class: 'sheet' }, el('div', { class: 'kicker' }, 'FLASHCARDS · FRONTS · SHEET ' + (i / PER_SHEET + 1)), fronts));
  doc.appendChild(el('section', { class: 'sheet' }, el('div', { class: 'kicker' }, 'FLASHCARDS · BACKS · SHEET ' + (i / PER_SHEET + 1)), backs));
}

doc.appendChild(el('section', { class: 'sheet' },
  el('div', { class: 'kicker' }, 'ANSWER CARDS · ONE SET PER GUEST'),
  el('div', { class: 'answers' }, ['A', 'B', 'C', 'D'].map((l, i) => el('div', { class: 'answer', style: 'background: ' + OPTION_COLOURS[i] }, l)))));
