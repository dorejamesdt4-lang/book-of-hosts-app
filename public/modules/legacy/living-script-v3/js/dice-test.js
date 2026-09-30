// ====================================================================
// DICE TEST (dice.html) — The Gambler's Gambit on its own, with the
// sample game's cast as players. Same engine module and table as in
// the show; nothing else is needed to try it.
// ====================================================================

import { loadAll, onClicker, playerName } from './common.js';
import { castInSeatOrder, titleOf } from '../engine/script.js';
import * as gambit from '../engine/modules/gamblers-gambit.js';
import { createDiceView } from './dice-view.js';
import { sfxEnabled, setSfxEnabled, unlockSfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const { game } = await loadAll();
const label = (seat) => titleOf(game, seat) + (playerName(seat) ? ' · ' + playerName(seat) : '');

let instance = null;
let view = null;

function newGame() {
  const players = castInSeatOrder(game).map((c) => ({ seat: c.character, title: c.title }));
  instance = gambit.create({ players, options: { rounds: Number($('rounds').value) } });
  instance.start();
  view = createDiceView($('table'), { titleOf: label, size: 'tv' });
  draw();
}

function draw() {
  const st = instance.state;
  view.render(st);
  $('btnRoll').disabled = st.done;
  $('btnRoll').textContent = st.done ? 'GAME OVER' : 'ROLL FOR ' + titleOf(game, st.shooter).toUpperCase() + ' ›';
  $('result').textContent = st.done
    ? 'Winner' + (st.result.winners.length > 1 ? 's: ' : ': ') + st.result.winners.map(label).join(' and ') + ' with ' + st.result.scores[st.result.winners[0]] + ' crowns.'
    : '';
}

function roll() {
  unlockSfx();
  if (!instance || instance.done) return;
  instance.act({ type: 'roll', seat: instance.state.shooter });
  draw();
}

$('btnRoll').addEventListener('click', roll);
$('btnRestart').addEventListener('click', newGame);
function showSfx() { $('btnSfx').textContent = 'SOUND: ' + (sfxEnabled() ? 'ON' : 'OFF'); $('btnSfx').setAttribute('aria-pressed', sfxEnabled() ? 'true' : 'false'); }
$('btnSfx').addEventListener('click', () => { setSfxEnabled(!sfxEnabled()); unlockSfx(); showSfx(); });
showSfx();
onClicker({ next: roll, back: () => {} });
newGame();
