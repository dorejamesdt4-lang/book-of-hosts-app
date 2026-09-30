// ====================================================================
// RULES CARD (rules-card.html?module=<id>) — a printable card for each
// newer mini-game, A6 by default or A5, in the Storybook print style.
// ====================================================================

import { el } from './common.js';

const CARDS = {
  'twenty-one-trouble': {
    title: 'Twenty-One & Trouble',
    pitch: 'Step forth, bold travellers, and match thy wits against the Great Vault Keeper in a perilous race to the grand sum of twenty-one, lest trouble find thee first!',
    pills: '1–8 GUESTS · ABOUT 10 MINUTES · NO BETTING',
    sections: [
      ['The cards', 'ul', ['Aces count 1 or 11, whichever is best without going over 21.', 'Picture cards count 10; number cards their face value.', 'One deck, or two for five or more players.']],
      ['A round', 'ol', [
        'Two cards each. The Vault Keeper shows one card and hides the other.',
        'The Keeper is checked first: twenty-one on two cards takes the round, and every guest loses.',
        'A guest with twenty-one on two cards wins at once and sits out the rest of the round.',
        'In turn, each guest chooses TWIST (take a card) or STICK (stop). Over 21 is bust: out of the round.',
        'Then the Keeper reveals the hidden card and must twist on 16 or less. A Keeper bust means every guest still standing wins.',
        'Otherwise, the higher total wins.'
      ]],
      ['Draws', 'ul', ['Five cards beat fewer cards on the same total.', 'Every other draw goes to the Keeper, even five cards against five.']],
      ['At the table', 'ul', ['The turn timer (15 seconds, if the host turns it on) sticks for a guest who runs out of time.', 'A guest whose phone disconnects sticks for the rest of the round.', 'When the deck runs out, the discards are shuffled back in.']]
    ],
    foot: 'Played for fun and glory only: no wagers, no currency, no scoreboard.'
  },
  'lexical-lanterns': {
    title: 'Lexical Lanterns',
    pitch: 'Welcome, scribe spirits! A sacred scroll lies shrouded in darkness, and only your letter-craft can light the lanterns and reveal the hidden phrase!',
    pills: '1–16 GUESTS · ONE TEAM · ABOUT 10 MINUTES',
    sections: [
      ['How to play', 'ol', [
        'A hidden phrase appears as blank slots on the scroll. Spaces and punctuation show by themselves.',
        'In turn, each guest picks one letter.',
        'A right letter lights every matching slot.',
        'A wrong letter puts out one lantern, and joins the used letters. No letter can be picked twice.',
        'Light the whole phrase to win. If every lantern goes out, the forest keeps its secret.'
      ]],
      ['The Pixie Whisper', 'ul', ['One hint per phrase. Any guest may ask; the host approves it.', 'It costs one lantern, and can’t be used on the last lantern.']],
      ['Arcade mode', 'ul', ['Solve as many phrases as you can before the Sundial runs out (2, 3 or 5 minutes).', 'The lanterns come back with each new phrase.']],
      ['At the table', 'ul', ['20 seconds a turn: time’s up, and the most common unused letter is picked for you.', 'A guest whose phone disconnects leaves the turn order at the end of the turn; the scroll keeps its progress.', 'Lanterns: 4, 6 or 8 (the host chooses).']]
    ],
    foot: 'Word pools: UK Landmarks, Classic Fairy Tales, Family Feasts, or a Show Pack’s own.'
  }
};

const id = new URLSearchParams(location.search).get('module');
const card = CARDS[id] || CARDS['twenty-one-trouble'];
document.title = card.title + ' · Rules Card — The Living Script v3';
const box = document.getElementById('card');
box.append(
  el('div', { class: 'kicker' }, 'THE LIVING SCRIPT · MINI-GAME'),
  el('h1', {}, card.title),
  el('p', { class: 'pitch' }, card.pitch),
  el('div', { class: 'pills' }, card.pills),
  el('div', { class: 'rule' }),
  ...card.sections.flatMap(([heading, kind, items]) => [el('h2', {}, heading), el(kind, {}, items.map((t) => el('li', {}, t)))]),
  el('div', { class: 'foot' }, card.foot));

function setSize(size) {
  box.className = 'card ' + size;
  document.getElementById('pageSize').textContent = '@page { size: ' + size.toUpperCase() + '; margin: ' + (size === 'a6' ? 7 : 10) + 'mm; }';
  document.getElementById('btnA6').setAttribute('aria-pressed', size === 'a6' ? 'true' : 'false');
  document.getElementById('btnA5').setAttribute('aria-pressed', size === 'a5' ? 'true' : 'false');
}
document.getElementById('btnA6').addEventListener('click', () => setSize('a6'));
document.getElementById('btnA5').addEventListener('click', () => setSize('a5'));
