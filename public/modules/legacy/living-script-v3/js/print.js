// ====================================================================
// PRINT VIEW — every printable document comes from the SAME master
// script, so every way of playing matches.
//   print.html?mode=script    the read-aloud script (PDF mode), with
//                             beat numbers
//   print.html?mode=theatre   theatre scripts: one part per player (their
//                             lines, with beat numbers and cues), the
//                             host's prompt book, and the numbered
//                             "For Your Eyes Only" envelopes the TV calls up
//   print.html?mode=keepsake  "The Tale of Your Night", as it was played
// Browser Print → Save as PDF makes the file.
// ====================================================================

import { loadAll, pack as packFor, playerName, lsGet, keys, el } from './common.js';
import { titleOf, roman, castInSeatOrder, setLine, envelopes, envelopeFor } from '../engine/script.js';

const $ = (id) => document.getElementById(id);
const doc = $('doc');
const params = new URLSearchParams(location.search);
const mode = ['keepsake', 'theatre'].includes(params.get('mode')) ? params.get('mode') : 'script';
$('btnPrint').addEventListener('click', () => window.print());

const data = await loadAll();
const { game } = data;
const pack = packFor(data, game.game.theme);
const TONES = { deflect: 'DEFLECT', accuse: 'ACCUSE', reveal: 'REVEAL', jest: 'JEST' };
const num = (b) => game.beats.indexOf(b) + 1;

const add = (...nodes) => nodes.forEach((n) => n && doc.appendChild(n));
const section = (cls, ...children) => el('section', { class: cls }, ...children);
const cardFor = (b) => data.minigames.find((m) => m.id === b.card) || null;
const narratorName = pack.narrator.name.replace(/^The /, 'the ');


function cover(kicker, note) {
  return el('div', { class: 'cover' },
    el('div', { class: 'kicker' }, kicker),
    el('h1', {}, game.game.title),
    game.game.tagline ? el('p', { class: 'muted' }, game.game.tagline) : null,
    el('div', { class: 'rule' }),
    el('p', {}, game.game.date + ' · ' + game.game.time + ' · ' + pack.name),
    el('p', { class: 'muted' }, note));
}

function castTable() {
  return section('section',
    el('h2', {}, 'The Cast'),
    el('table', {},
      el('thead', {}, el('tr', {}, el('th', {}, 'PART'), el('th', {}, 'WHO THEY ARE'), el('th', {}, 'PLAYED BY'))),
      el('tbody', {}, castInSeatOrder(game).map((c) => el('tr', {},
        el('td', {}, el('h3', {}, c.title)),
        el('td', {}, c.role),
        el('td', {}, playerName(c.character) || '______________'))))));
}

const who = (t, character) => el('div', { class: 'who' + (character ? ' character' : '') }, t);
const beatNo = (b) => el('span', { class: 'pills' }, 'BEAT ' + num(b) + ' · ');
function narratorLine(b, text, label) {
  return el('div', { class: 'beat' }, el('div', { class: 'who' }, beatNo(b), label || 'NARRATOR'), el('p', {}, text));
}

function miniGameBox(b) {
  const card = cardFor(b);
  if (!card) return null;
  const prize = envelopeFor(game, b.id, 'prize');
  return el('div', { class: 'box' },
    el('div', { class: 'who character' }, 'MINI-GAME'),
    el('h3', {}, card.name),
    el('div', { class: 'pills' }, ['PLAYERS ' + card.players, 'PROPS: ' + card.props.toUpperCase(), card.time.toUpperCase(), card.online_friendly ? 'ONLINE-FRIENDLY' : 'IN PERSON'].join(' · ')),
    el('ol', { class: 'rules' }, card.rules.slice(0, 5).map((r) => el('li', {}, r))),
    card.online_module ? el('p', { class: 'muted note' }, 'On the Narrator, the Stage rolls the dice and keeps the score; in theatre, each press of Next rolls for the shooter.') : null,
    prize ? el('p', { class: 'muted note' }, 'The winner receives envelope ' + prize.number + ' (' + prize.title + ').') : null);
}

/* -------------------- the read-aloud script -------------------- */
function renderScript() {
  document.title = game.game.title + ' — Read-Aloud Script';
  add(cover('THE BOOK OF HOSTS · READ-ALOUD SCRIPT', 'Generated from Master Script v' + game.schema_version + ', the same file the Narrator plays.'));
  add(castTable());
  add(section('section',
    el('h2', {}, 'How to Play from This Script'),
    el('p', {}, 'One person reads the NARRATOR parts, as ' + narratorName + ': ' + pack.narrator.persona),
    el('p', { style: 'margin-top: 8px' }, 'At each turn, the player picks one of their lines (or says their own). If they can’t choose, they read the REVEAL line. When the script says so, hand over the numbered envelope; the envelopes are at the back. The vote never changes the ending. Beat numbers match the screen and the phones.')));
  game.acts.forEach((act) => add(section('section act',
    el('h2', {}, 'Act ' + roman(act.number) + ' · ' + act.title),
    game.beats.filter((b) => b.act === act.id).map(scriptBeat))));
  add(solution());
  envelopePages();
}

function scriptBeat(b) {
  switch (b.type) {
    case 'narration': return narratorLine(b, b.text);
    case 'music': return el('div', { class: 'beat' }, el('div', { class: 'who' }, beatNo(b), 'MUSIC'), el('p', { class: 'muted' }, b.stop ? 'The music fades.' : '♪ ' + b.mood.charAt(0).toUpperCase() + b.mood.slice(1) + ' music.'));
    case 'character_turn':
      return el('div', { class: 'beat' },
        who([beatNo(b), titleOf(game, b.character).toUpperCase() + ' — YOUR TURN'], true),
        el('p', { class: 'muted' }, b.prompt),
        el('ul', { class: 'lines' }, b.lines.map((l) => el('li', {}, el('span', { class: 'tone' }, TONES[l.tone] || l.tone.toUpperCase()), l.text))),
        el('p', { class: 'muted note' }, 'If the player stays quiet, the narrator may say: “' + b.nudge + '”'));
    case 'private_reveal': {
      const e = envelopeFor(game, b.id, 'secret');
      return el('div', { class: 'beat' }, who([beatNo(b), 'NARRATOR']), el('p', {}, b.announce), el('p', { class: 'muted note' }, 'Hand envelope ' + (e ? e.number : '') + ' to ' + titleOf(game, b.character) + ' now.'));
    }
    case 'clue_drop':
      return el('div', { class: 'beat' }, el('div', { class: 'box' }, who([beatNo(b), 'CLUE · ' + b.clue.title.toUpperCase()], true), el('p', {}, b.clue.text)), narratorLine(b, b.narration));
    case 'mini_game': return el('div', { class: 'beat' }, narratorLine(b, b.narration), miniGameBox(b));
    case 'vote':
      return el('div', { class: 'beat' }, narratorLine(b, b.narration),
        el('div', { class: 'box' }, who('THE VOTE', true), el('h3', {}, b.question), el('ul', { class: 'lines' }, b.options.map((slug) => el('li', {}, '☐  ' + titleOf(game, slug))))));
    case 'finale':
      return el('div', { class: 'beat' },
        who([beatNo(b), 'NARRATOR — READ THE ONE THAT FITS THE VOTE']),
        el('p', {}, 'If the room named ' + titleOf(game, game.game.culprit) + ': “' + b.reactions.correct + '”'),
        el('p', {}, 'If not: “' + b.reactions.mistaken + '”'),
        ...b.narration.map((t) => el('p', {}, t)),
        el('p', {}, b.closing));
    default: return null;
  }
}

function solution() {
  return section('section act',
    el('h2', {}, 'For the Host Only: The Solution'),
    el('p', {}, 'The culprit is ' + titleOf(game, game.game.culprit) + '.'),
    el('p', { style: 'margin-top: 8px' }, game.game.solution));
}

function envelopePages() {
  envelopes(game).forEach((e) => add(el('section', { class: 'sealed' },
    el('div', { class: 'kicker' }, 'ENVELOPE ' + e.number + ' · FOR YOUR EYES ONLY'),
    el('h2', { style: 'border: 0; padding: 0; margin: 0' }, e.kind === 'prize' ? e.title + ' (prize for the mini-game winner)' : 'For ' + titleOf(game, e.character) + ' only'),
    el('p', {}, e.text),
    el('p', { class: 'muted note' }, e.kind === 'prize'
      ? 'Keep this one with the host. The screen calls it up for whoever wins the dice.'
      : 'Cut along the dashed line, fold, and write "' + e.number + '" on the outside. The screen calls it up: "' + titleOf(game, e.character) + ', open envelope ' + e.number + '."'))));
}

/* -------------------- theatre scripts -------------------- */
function renderTheatre() {
  document.title = game.game.title + ' — Theatre Scripts';
  add(cover('THE BOOK OF HOSTS · THEATRE SCRIPTS', 'Theatre Mode: read your own lines aloud. The big screen shows the beat number and calls your name.'));
  add(castTable());
  add(section('section',
    el('h2', {}, 'How the Theatre Works'),
    el('p', {}, 'The screen is the stage and prompter. When it says "' + titleOf(game, game.cast[0].character) + ', your line", that player reads their line aloud. Each part below shows one set line per turn, with its beat number, and the line just before it as your cue.'),
    el('p', { style: 'margin-top: 8px' }, 'Rather not read? Ask the host for a stand-in: the narrator’s voice will read your line for you. When the screen calls up an envelope, open that envelope and keep it to yourself.')));

  // One part per player: their own lines only.
  castInSeatOrder(game).forEach((c) => {
    const turns = game.beats.filter((b) => b.type === 'character_turn' && b.character === c.character);
    const mine = envelopes(game).filter((e) => e.character === c.character);
    add(section('section act',
      el('div', { class: 'kicker' }, 'THE PART OF'),
      el('h2', {}, c.title + (playerName(c.character) ? ' · ' + playerName(c.character) : '')),
      el('p', { class: 'muted' }, c.role),
      el('p', { style: 'margin: 6px 0 14px' }, c.bio),
      el('div', { class: 'box', style: 'margin-bottom: 18px' }, el('div', { class: 'who character' }, 'YOUR AIM · KEEP THIS TO YOURSELF'), el('p', {}, c.objective)),
      turns.map((b) => {
        const cue = cueBefore(b);
        return el('div', { class: 'beat' },
          who(['BEAT ' + num(b) + ' · ACT ' + roman(game.acts.find((a) => a.id === b.act).number)], true),
          cue ? el('p', { class: 'muted note' }, 'Your cue: “' + cue + '”') : null,
          el('p', { class: 'muted' }, b.prompt),
          el('ul', { class: 'lines' }, el('li', {}, el('span', { class: 'tone' }, 'YOUR LINE'), setLine(b).text)));
      }),
      mine.length ? el('p', { class: 'muted note' }, 'Envelopes for you: ' + mine.map((e) => e.number).join(', ') + '. Open each one only when the screen calls it up.') : null));
  });

  // The host's prompt book: every beat, numbered, with notes.
  add(section('section act',
    el('h2', {}, "The Host's Prompt Book"),
    el('p', { class: 'muted' }, 'Every beat in order. Press Next (or the clicker) to move on; music cues play by themselves.'),
    game.beats.map((b) => {
      const line = scriptBeat(b);
      if (b.host_note && line) line.appendChild(el('p', { class: 'muted note' }, 'Note: ' + b.host_note));
      return line;
    })));
  add(solution());
  envelopePages();
}

// The last spoken line before this turn: the reader's cue.
function cueBefore(b) {
  for (let i = game.beats.indexOf(b) - 1; i >= 0; i--) {
    const p = game.beats[i];
    if (p.type === 'narration') return p.text.split(/(?<=[.!?])\s+/).slice(-1)[0];
    if (p.type === 'character_turn') return setLine(p).text;
    if (p.type === 'clue_drop') return p.narration.split(/(?<=[.!?])\s+/).slice(-1)[0];
    if (p.type === 'private_reveal') return p.announce.split(/(?<=[.!?])\s+/).slice(-1)[0];
  }
  return null;
}

/* -------------------- the keepsake -------------------- */
function renderKeepsake() {
  const tale = lsGet(keys.tale, null);
  document.title = 'The Tale of Your Night — ' + ((tale && tale.title) || game.game.title);
  if (!tale || !tale.entries || !tale.entries.length) {
    $('toolbarNote').textContent = 'Nothing to print yet.';
    add(el('div', { class: 'empty' },
      el('div', { class: 'kicker' }, 'THE TALE OF YOUR NIGHT'),
      el('h1', {}, 'No tale yet'),
      el('p', { class: 'muted' }, 'Play the game on the Stage on this computer, then choose Download the Tale at the curtain.')));
    return;
  }
  const played = new Date(tale.date);
  add(el('div', { class: 'cover' },
    el('div', { class: 'kicker' }, 'THE TALE OF YOUR NIGHT'),
    el('h1', {}, tale.title),
    el('div', { class: 'rule' }),
    el('p', {}, 'Played ' + (isNaN(played) ? '' : played.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) + ' · ' + tale.theme),
    el('p', { class: 'muted' }, 'Told by ' + tale.narrator + (tale.mode === 'rehearse' ? ' · a rehearsal' : tale.mode === 'theatre' ? ' · in the theatre' : '') + (tale.finished ? '' : ' · the tale was not finished'))));
  add(section('section',
    el('h2', {}, 'The Cast'),
    el('table', {}, el('tbody', {}, tale.cast.map((c) => el('tr', {},
      el('td', {}, el('h3', {}, c.title)), el('td', {}, c.role), el('td', {}, c.player ? 'played by ' + c.player : '')))))));
  add(section('section',
    el('h2', {}, 'As It Was Told'),
    tale.entries.map((t) => (t.kind === 'clue' || t.kind === 'note')
      ? el('div', { class: 'beat' }, el('div', { class: 'box' }, el('div', { class: 'who character' }, t.who), el('p', {}, t.text)))
      : el('div', { class: 'beat' }, el('div', { class: 'who' + (t.who === 'NARRATOR' ? '' : ' character') }, t.who), el('p', {}, t.text)))));
  // A Show Pack has no culprit and no vote: no verdict.
  if (!tale.culprit) return;
  add(section('section',
    el('h2', {}, 'The Verdict'),
    tale.result
      ? el('p', {}, 'The company voted: ' + Object.entries(tale.result.tally).map(([w, n]) => w + ' ' + n).join(', ') + '. ' + (tale.result.correct ? 'They were right.' : 'They were mistaken.'))
      : el('p', { class: 'muted' }, 'No vote was taken.'),
    el('p', { style: 'margin-top: 8px' }, 'The culprit was ' + tale.culprit + '. ' + tale.solution)));
}

// Build the page once every helper above is defined.
if (mode === 'script') renderScript();
else if (mode === 'theatre') renderTheatre();
else renderKeepsake();
