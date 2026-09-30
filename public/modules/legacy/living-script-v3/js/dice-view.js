// ====================================================================
// DICE VIEW — draws The Gambler's Gambit from the module's state: the
// table, two dice, the point, the commentary, and everyone's crowns.
// Page code only; the rules live in ../engine/.
//
// Not on the mockups: built from the Storybook parts — the teal leather
// board with its gold rule (the Stage's book), vellum dice with navy
// pips, the scoreboard in the Lobby's seat-card style.
//
//   const view = createDiceView(container, { titleOf, size: 'panel' | 'tv' });
//   view.render(moduleState)
// ====================================================================

import { el } from './common.js';
import { rattle } from './sfx.js';

// 0 = blank (before the first roll).
const PIPS = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const ROLL_MS = 1000;          // about a second of rattling before they land
const SHAKE_PX = 4;            // gentle; no flashing
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function die(size) {
  const face = el('div', { class: 'ls-die', style: 'width: ' + size + 'px; height: ' + size + 'px; box-sizing: border-box; padding: ' + Math.round(size * 0.14) + 'px; background: #EDE6D6; border: 2px solid #B8923E; border-radius: ' + Math.round(size * 0.16) + 'px; box-shadow: inset 0 0 18px rgba(160,120,60,0.35), 0 10px 20px rgba(0,0,0,0.45); display: grid; grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr); gap: 2px' });
  for (let i = 0; i < 9; i++) face.appendChild(el('span', { style: 'border-radius: 50%; background: transparent; margin: 12%' }));
  return face;
}

function showFace(face, n) {
  const on = PIPS[n] || [];
  [...face.children].forEach((pip, i) => { pip.style.background = on.includes(i) ? '#0F1E28' : 'transparent'; });
  face.setAttribute('aria-label', n ? 'Die showing ' + n : 'Die not yet rolled');
}

export function createDiceView(container, { titleOf, size = 'panel', sound = true }) {
  const tv = size === 'tv';
  const dieSize = tv ? 150 : 84;
  const d1 = die(dieSize);
  const d2 = die(dieSize);
  const point = el('div', { style: "font-family: 'Silkscreen', monospace; font-size: " + (tv ? 14 : 11) + 'px; letter-spacing: 1px; color: #D9A441; border: 1px solid #6B5320; border-radius: 999px; padding: 6px 12px' });
  const line = el('div', { role: 'status', 'aria-live': 'polite', style: 'font-style: italic; font-size: ' + (tv ? 30 : 19) + 'px; line-height: 1.4; color: #EDE6D6; text-align: center; min-height: 1.4em' });
  const forfeit = el('div', { style: 'font-size: ' + (tv ? 22 : 15) + 'px; line-height: 1.4; color: #D9A441; text-align: center; min-height: 1.4em' });
  const board = el('div', { style: 'position: relative; display: flex; flex-direction: column; align-items: center; gap: ' + (tv ? 22 : 12) + 'px; padding: ' + (tv ? '34px 30px' : '18px 16px') + '; background: #132A2A; border: 1px solid #2A4A4A; border-radius: 16px; box-shadow: inset 0 0 0 5px #102424, inset 0 0 0 6px #B8923E, inset 0 0 60px rgba(0,0,0,0.45)' },
    el('div', { style: "font-family: 'Cinzel', serif; font-size: " + (tv ? 14 : 11) + 'px; letter-spacing: 5px; color: #5AA8A0' }, "THE GAMBLER'S GAMBIT"),
    el('div', { style: 'display: flex; gap: ' + (tv ? 40 : 20) + 'px' }, d1, d2),
    point, line, forfeit);
  const scores = el('div', { style: 'display: grid; grid-template-columns: repeat(' + (tv ? 4 : 2) + ', minmax(0, 1fr)); gap: ' + (tv ? 14 : 8) + 'px' });
  container.innerHTML = '';
  container.appendChild(el('div', { style: 'display: flex; flex-direction: column; gap: ' + (tv ? 22 : 12) + 'px' }, board, scores));
  showFace(d1, 0);
  showFace(d2, 0);

  let lastRoll = null;
  let spin = null;

  return {
    render(st) {
      if (!st) return;
      // A new roll: tumble the dice briefly, then land on the result.
      if (st.lastRoll && st.lastRoll !== lastRoll && JSON.stringify(st.lastRoll) !== JSON.stringify(lastRoll)) {
        lastRoll = st.lastRoll;
        clearInterval(spin);
        const land = () => {
          d1.style.transform = d2.style.transform = '';
          showFace(d1, st.lastRoll.dice[0]);
          showFace(d2, st.lastRoll.dice[1]);
        };
        if (sound) rattle(ROLL_MS);
        if (reduceMotion()) { land(); return; }
        const started = Date.now();
        // Faces change about 8 times a second: a tumble, not a flash.
        spin = setInterval(() => {
          if (Date.now() - started >= ROLL_MS) { clearInterval(spin); land(); return; }
          showFace(d1, 1 + Math.floor(Math.random() * 6));
          showFace(d2, 1 + Math.floor(Math.random() * 6));
          const jiggle = () => 'translate(' + (Math.random() * 2 - 1) * SHAKE_PX + 'px, ' + (Math.random() * 2 - 1) * SHAKE_PX + 'px) rotate(' + (Math.random() * 16 - 8) + 'deg)';
          d1.style.transform = jiggle();
          d2.style.transform = jiggle();
        }, 125);
      }
      if (!st.lastRoll && !lastRoll) { showFace(d1, 0); showFace(d2, 0); }
      point.textContent = st.done ? 'THE DICE ARE STILL' : st.point ? 'THE POINT IS ' + st.point : 'COME-OUT ROLL';
      line.textContent = st.line || '';
      forfeit.textContent = st.forfeit ? 'Forfeit: ' + st.forfeit.text : '';
      scores.innerHTML = '';
      const winners = st.result ? st.result.winners : [];
      st.players.forEach((p) => {
        const on = p.seat === st.shooter;
        const won = winners.includes(p.seat);
        scores.appendChild(el('div', { style: 'display: flex; flex-direction: column; gap: 2px; padding: ' + (tv ? '12px 16px' : '8px 12px') + '; background: #0F1E28; border: ' + (on || won ? '2px solid #5AA8A0' : '1px solid #2A4A4A') + '; border-radius: 12px' },
          el('div', { style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: " + (tv ? 18 : 13) + 'px; color: #D9A441' }, titleOf(p.seat)),
          el('div', { style: "font-family: 'Silkscreen', monospace; font-size: " + (tv ? 13 : 10) + 'px; color: ' + (won ? '#5AA8A0' : '#EDE6D6') }, p.crowns + ' CROWNS' + (won ? ' · WINNER' : '')),
          el('div', { style: 'font-size: ' + (tv ? 15 : 12) + 'px; font-style: italic; color: #8FA5A3' }, on ? 'is rolling' : p.skipNext ? 'sits out next round' : p.roundsLeft + (p.roundsLeft === 1 ? ' round left' : ' rounds left'))));
      });
    }
  };
}
