// ====================================================================
// GOBLET GLANCE / STREET SHUFFLE 18+ · SCREENS — one set of screens for
// both skins (rules: ../engine/modules/goblet-glance.js):
//   velvet (12+) golden goblets and a glowing orb on a velvet board
//   pub    (18+) plastic cups and a foam ball on a pub table
//   createView / phonePrompt / phoneView / hostPanel / hostPrompt / primaryLabel
// Flat 2D: each cup is an inline SVG moved with CSS transforms (the Web
// Animations API, no libraries). The Stage plays exactly the module's
// swap sequence; the phones never animate it. No flashing: the reveal has
// a handful of sparkles that rise and fade once.
// ====================================================================

import { el } from './common.js';
import { DROP_LOWER_MS, orderAfter } from '../engine/modules/goblet-glance.js';

export const ids = ['goblet-glance', 'goblet-glance-18'];
const DIFF = { easy: 'EASY', medium: 'MEDIUM', hard: 'HARD' };
const RIGHT = '#2E7D4F';

const SKINS = {
  velvet: { board: '#4A1631', boardEdge: '#2B0C1C', felt: 'radial-gradient(ellipse at 50% 60%, #6A2146 0%, #4A1631 60%, #34101F 100%)', frame: '#1A0A12', ink: '#F3E6C8', muted: '#D2B98A', accent: '#E3B341', label: '#F3E6C8', labelBg: '#2B0C1C', font: "'Cinzel', serif", body: "'Cardo', Georgia, serif", title: 'GOBLET GLANCE', ball: 'orb', cup: 'goblet' },
  pub: { board: '#6B4423', boardEdge: '#3E2612', felt: 'repeating-linear-gradient(90deg, #6B4423 0 64px, #62401F 64px 66px, #704826 66px 130px)', frame: '#2A1A0E', ink: '#F4EBDD', muted: '#D8C4A6', accent: '#F2B134', label: '#2A1A0E', labelBg: '#F2B134', font: "'Cardo', Georgia, serif", body: "'Cardo', Georgia, serif", title: 'STREET SHUFFLE 18+', ball: 'foam', cup: 'plastic' }
};

// An upside-down goblet: foot at the top, stem, bowl opening downwards.
const GOBLET = '<svg viewBox="0 0 100 120" width="100%" height="100%" aria-hidden="true" style="display: block; overflow: visible">'
  + '<ellipse cx="50" cy="8" rx="30" ry="7" fill="#B8862A"/><ellipse cx="50" cy="6" rx="26" ry="4" fill="#F1CD6A"/>'
  + '<rect x="44" y="10" width="12" height="30" rx="4" fill="#C9962F"/><rect x="47" y="10" width="3" height="30" fill="#F4D77E"/>'
  + '<ellipse cx="50" cy="42" rx="12" ry="5" fill="#B8862A"/>'
  + '<path d="M38 44 Q10 60 12 112 L88 112 Q90 60 62 44 Z" fill="#D9A441"/>'
  + '<path d="M40 48 Q22 62 22 108 L32 108 Q32 66 46 50 Z" fill="#F4D77E" opacity="0.8"/>'
  + '<rect x="8" y="108" width="84" height="9" rx="4" fill="#A8761F"/><rect x="8" y="108" width="84" height="3" rx="1.5" fill="#F1CD6A"/>'
  + '<circle cx="50" cy="80" r="6" fill="#8E2A4E"/><circle cx="48" cy="78" r="2" fill="#E07AA0"/></svg>';
// An upside-down red plastic party cup: narrow base at the top, rim at the bottom.
const PLASTIC = '<svg viewBox="0 0 100 120" width="100%" height="100%" aria-hidden="true" style="display: block; overflow: visible">'
  + '<path d="M28 6 L72 6 L90 110 L10 110 Z" fill="#C8322F"/>'
  + '<path d="M32 6 L42 6 L30 110 L18 110 Z" fill="#E4605A" opacity="0.8"/>'
  + '<rect x="26" y="3" width="48" height="6" rx="3" fill="#A82623"/>'
  + '<path d="M13 92 L87 92" stroke="#A82623" stroke-width="2"/><path d="M15 80 L85 80" stroke="#A82623" stroke-width="2"/>'
  + '<rect x="7" y="108" width="86" height="8" rx="4" fill="#F4F1EC"/><rect x="7" y="108" width="86" height="3" rx="1.5" fill="#FFFFFF"/></svg>';

let styled = false;
function addStyles() {
  if (styled) return;
  styled = true;
  document.head.appendChild(el('style', {}, '@keyframes gg-spark { 0% { opacity: 0; transform: translate(0, 0) scale(0.6); } 25% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--dx), -60px) scale(1); } }'
    + ' .gg-spark { position: absolute; bottom: 30%; left: 50%; width: 10px; height: 10px; margin-left: -5px; pointer-events: none; opacity: 0; animation: gg-spark 1.3s ease-out 1 forwards; }'
    + ' .gg-spark::before { content: "✦"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; }'));
}

function ballNode(sk, size) {
  const style = sk.ball === 'orb'
    ? 'background: radial-gradient(circle at 38% 35%, #FFFFFF 0%, #BDF3FF 25%, #4FB8D8 70%, #22708A 100%); box-shadow: 0 0 ' + Math.round(size * 0.6) + 'px ' + Math.round(size * 0.2) + 'px rgba(140, 225, 255, 0.55)'
    : 'background: radial-gradient(circle at 38% 35%, #FFF6C8 0%, #FFD23F 45%, #E59A12 100%); box-shadow: 0 3px 0 rgba(0,0,0,0.25)';
  return el('div', { 'aria-hidden': 'true', style: 'position: absolute; left: 50%; bottom: 6px; width: ' + size + 'px; height: ' + size + 'px; margin-left: -' + size / 2 + 'px; border-radius: 50%; ' + style });
}

/* -------------------- the Stage -------------------- */
export function createView(container, { titleOf, size = 'panel' }) {
  addStyles();
  const tv = size === 'tv';
  const H = tv ? 300 : 170;   // the board's cup row height
  const cupW = tv ? 150 : 84;
  const ballPx = tv ? 46 : 26;
  let sk = SKINS.velvet;

  const head = el('div');
  const labels = el('div', { style: 'position: relative; display: grid; height: ' + (tv ? 56 : 36) + 'px' });
  const row = el('div', { style: 'position: relative; height: ' + H + 'px' });
  const board = el('div', { style: 'position: relative; box-sizing: border-box; border-radius: 12px; padding: ' + (tv ? '18px 24px 26px' : '10px 10px 16px') }, labels, row);
  const foot = el('div');
  const frame = el('div', { style: 'box-sizing: border-box; border-radius: 14px; padding: ' + (tv ? 20 : 12) + 'px; display: flex; flex-direction: column; gap: ' + (tv ? 16 : 10) + 'px' }, head, board, foot);
  container.innerHTML = '';
  container.appendChild(frame);

  // The cups, kept between renders so a swap can animate.
  let key = null;           // which round (or lobby layout) the cups are for
  let cups = [];            // [{ slot, arc, body, ball }] by cup (its start position)
  let posOf = [];           // cup -> position now
  let played = 0;           // swaps shown so far
  let timers = [];
  let lifted = null;        // the cup lifted for the reveal
  let shuffling = false;    // this round's shuffle has been set going

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  const slotX = (pos) => 'translateX(' + pos * 100 + '%)';

  function build(n, ballCup) {
    clearTimers();
    row.innerHTML = '';
    cups = [];
    posOf = [];
    played = 0;
    lifted = null;
    shuffling = false;
    for (let c = 0; c < n; c++) {
      const body = el('div', { style: 'position: relative; width: 100%; height: 100%; transition: transform 500ms ease-in-out' });
      body.innerHTML = sk.cup === 'goblet' ? GOBLET : PLASTIC;
      const ball = c === ballCup ? ballNode(sk, ballPx) : null;
      const arc = el('div', { style: 'position: absolute; left: 50%; bottom: 0; width: ' + cupW + 'px; max-width: 86%; aspect-ratio: 100 / 120; transform: translateX(-50%)' }, ball, body);
      const slot = el('div', { style: 'position: absolute; left: 0; bottom: 0; height: 100%; width: ' + 100 / n + '%; transform: ' + slotX(c) });
      slot.appendChild(arc);
      row.appendChild(slot);
      cups.push({ slot, arc, body, ball });
      posOf.push(c);
    }
    labels.style.gridTemplateColumns = 'repeat(' + n + ', minmax(0, 1fr))';
  }

  function raise(c, on, instant) {
    const b = cups[c].body;
    if (instant) b.style.transition = 'none';
    b.style.transform = on ? 'translateY(-58%)' : 'none';
    if (instant) { void b.offsetWidth; b.style.transition = 'transform 500ms ease-in-out'; }
  }

  // One swap, animated: both cups slide across; one rises a little and
  // shrinks (behind), the other dips and grows (in front): a flat weave.
  function swap([a, b], ms, animate) {
    const ca = posOf.indexOf(a);
    const cb = posOf.indexOf(b);
    posOf[ca] = b;
    posOf[cb] = a;
    [[ca, a, b, -1], [cb, b, a, 1]].forEach(([c, from, to, dir]) => {
      const { slot, arc } = cups[c];
      slot.style.transform = slotX(to);
      slot.style.zIndex = dir > 0 ? '2' : '1';
      if (!animate || !slot.animate) return;
      slot.animate([{ transform: slotX(from) }, { transform: slotX(to) }], { duration: ms * 0.92, easing: 'ease-in-out' });
      arc.animate([
        { transform: 'translateX(-50%) translateY(0) scale(1)' },
        { transform: 'translateX(-50%) translateY(' + (dir > 0 ? 6 : -16) + 'px) scale(' + (dir > 0 ? 1.06 : 0.92) + ')' },
        { transform: 'translateX(-50%) translateY(0) scale(1)' }
      ], { duration: ms * 0.92, easing: 'ease-in-out' });
    });
  }

  function jumpTo(r, step) {
    while (played < step) { swap(r.swaps[played], r.swapMs, false); played += 1; }
  }

  // Plays the round's own sequence from where the module is now (a Stage
  // that opens mid-shuffle catches up without animating the missed swaps).
  function playShuffle(r, elapsed) {
    clearTimers();
    const already = Math.min(r.swaps.length, Math.floor(elapsed / r.swapMs));
    jumpTo(r, already);
    for (let k = already; k < r.swaps.length; k++) {
      timers.push(setTimeout(() => { if (played === k) { swap(r.swaps[k], r.swapMs, true); played += 1; } }, k * r.swapMs - elapsed));
    }
  }

  function sparkle(c) {
    const colours = sk.ball === 'orb' ? ['#FFF3B0', '#BDF3FF', '#E3B341'] : ['#FFD23F', '#FFFFFF', '#F2B134'];
    [-38, -18, 0, 20, 40].forEach((dx, i) => {
      const s = el('span', { class: 'gg-spark', 'aria-hidden': 'true', style: '--dx: ' + dx + 'px; color: ' + colours[i % 3] + '; animation-delay: ' + i * 90 + 'ms' });
      cups[c].arc.appendChild(s);
      setTimeout(() => s.remove(), 1900);
    });
  }

  function leaderboard(st) {
    return el('div', { style: 'display: flex; flex-direction: column; gap: ' + (tv ? 8 : 5) + 'px; padding: ' + (tv ? '18px 24px' : '12px 14px') + '; border-radius: 12px; background: rgba(0,0,0,0.3)' },
      el('div', { style: 'font-family: ' + sk.font + '; font-size: ' + (tv ? 14 : 11) + 'px; letter-spacing: 4px; color: ' + sk.accent }, st.phase === 'final' || st.done ? 'FINAL STANDINGS' : 'THE STANDINGS'),
      st.standings.slice(0, 16).map((p) => el('div', { style: 'display: flex; align-items: baseline; gap: 10px; font-family: ' + sk.body + '; font-size: ' + (tv ? 22 : 15) + 'px; color: ' + sk.ink },
        el('span', { style: 'min-width: 1.6em; font-family: ' + sk.font + '; font-weight: 700; color: ' + sk.accent }, String(p.rank)),
        el('span', { style: 'flex-grow: 1' }, titleOf(p.seat) + (p.rank === 1 && p.score > 0 && (st.phase === 'final' || st.done) ? ' 👑' : '')),
        el('span', { style: 'font-family: ' + sk.font + '; font-weight: 700' }, String(p.score)))));
  }

  const K = (t) => el('div', { style: 'font-family: ' + sk.font + '; font-size: ' + (tv ? 14 : 11) + 'px; letter-spacing: 4px; color: ' + sk.accent }, t);
  const P = (t, extra) => el('div', { style: 'font-family: ' + sk.body + '; font-size: ' + (tv ? 24 : 15) + 'px; line-height: 1.4; color: ' + sk.ink + ';' + (extra || '') }, t);

  return {
    render(st) {
      if (!st) return;
      const nextSk = SKINS[st.skin] || SKINS.velvet;
      if (nextSk !== sk) { sk = nextSk; key = null; }
      frame.style.background = sk.frame;
      board.style.background = sk.felt;
      board.style.boxShadow = 'inset 0 0 0 4px ' + sk.boardEdge + ', inset 0 18px 40px rgba(0,0,0,0.35)';
      const r = st.round;
      const inRound = r && st.phase !== 'lobby';

      // The cups: rebuilt for a new round (or a new cup count in the lobby).
      const k = inRound ? 'r' + r.number : 'lobby' + st.settings.cups;
      if (k !== key) {
        key = k;
        build(inRound ? r.cups : st.settings.cups, inRound ? r.ballStart : -1);
        if (inRound && st.phase === 'drop' && st.elapsed < DROP_LOWER_MS) { raise(r.ballStart, true, true); timers.push(setTimeout(() => raise(r.ballStart, false), DROP_LOWER_MS - st.elapsed)); }
      }
      if (inRound) {
        if (st.phase === 'shuffle' && !shuffling) { shuffling = true; playShuffle(r, st.elapsed); }
        if (st.phase !== 'drop' && st.phase !== 'shuffle' && played < r.swaps.length) { clearTimers(); jumpTo(r, r.swaps.length); }
        // The reveal: lift the cup the ball went under. The module worked
        // out the same answer from the same swaps; say so if they ever differ.
        if (r.answer !== null && lifted === null) {
          lifted = r.ballStart;
          const pos = orderAfter(r.cups, r.swaps).indexOf(r.ballStart);
          if (pos !== r.answer) console.warn('[goblet] the Stage and the module disagree on the answer', { stage: pos + 1, module: r.answer + 1 });
          raise(lifted, true, st.elapsed > 1500);
          if (st.elapsed < 1500) sparkle(lifted);
        }
      }

      // The number labels, by position (cup 1 is on the left).
      labels.innerHTML = '';
      const showLabels = inRound && (st.phase === 'pick' || st.phase === 'reveal' || st.phase === 'final');
      const n = inRound ? r.cups : st.settings.cups;
      for (let p = 0; p < n; p++) {
        const good = st.reveal && r && p === r.answer;
        labels.appendChild(el('div', { style: 'display: flex; justify-content: center; align-items: center; gap: 8px' }, showLabels ? [
          el('span', { style: 'min-width: ' + (tv ? 46 : 28) + 'px; height: ' + (tv ? 46 : 28) + 'px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: ' + sk.font + '; font-weight: 700; font-size: ' + (tv ? 26 : 16) + 'px; background: ' + (good ? RIGHT : sk.labelBg) + '; color: ' + (good ? '#FFFFFF' : sk.label) + '; border: 2px solid ' + (good ? '#FFFFFF' : sk.accent) }, String(p + 1)),
          st.reveal ? el('span', { title: 'Picked by', style: 'font-family: ' + sk.body + '; font-size: ' + (tv ? 18 : 12) + 'px; color: ' + sk.muted }, st.reveal.counts[p] + (st.reveal.counts[p] === 1 ? ' pick' : ' picks')) : null
        ] : null));
      }

      // Above: the title and what's happening.
      head.innerHTML = '';
      const status = st.phase === 'lobby' ? (st.errors.length ? st.errors.join(' ') : 'Gather round the table…')
        : st.phase === 'drop' ? (sk.ball === 'orb' ? 'Watch the orb…' : 'Watch the ball…')
        : st.phase === 'shuffle' ? 'Keep your eyes on it…'
        : st.phase === 'pick' ? 'Pick a cup number on your phone!'
        : st.reveal ? (st.reveal.everyone ? 'Everyone found it!' : st.reveal.correctSeats.length + ' of ' + st.players.length + ' found it: cup ' + (st.reveal.answer + 1) + '.')
        : '';
      head.appendChild(el('div', { style: 'display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap' },
        K(sk.title + (inRound ? ' · ROUND ' + r.number + ' OF ' + st.rounds : '')),
        K((DIFF[inRound ? r.difficulty : st.settings.difficulty] || '') + ' · ' + n + ' CUPS')));
      head.appendChild(P(status, 'font-weight: 700'));

      // Below: the countdown bar, then the standings when asked for.
      foot.innerHTML = '';
      if (st.phase === 'pick' && st.timer) {
        const share = st.timer.left / st.timer.total;
        foot.appendChild(el('div', { style: 'display: flex; align-items: center; gap: 14px' },
          el('div', { role: 'timer', 'aria-label': Math.ceil(st.timer.left / 1000) + ' seconds left', style: 'flex-grow: 1; height: ' + (tv ? 14 : 8) + 'px; border-radius: 999px; background: rgba(255,255,255,0.15); overflow: hidden' },
            el('div', { style: 'height: 100%; width: ' + share * 100 + '%; background: ' + sk.accent + '; transition: width 250ms linear' })),
          P(Math.ceil(st.timer.left / 1000) + ' s · ' + st.answered.length + ' of ' + st.players.filter((p) => !p.away).length + ' locked in', 'white-space: nowrap; font-size: ' + (tv ? 20 : 13) + 'px; color: ' + sk.muted)));
      }
      board.hidden = !!(st.showStandings || st.done);
      if (st.showStandings || st.done) foot.appendChild(leaderboard(st));
    }
  };
}

/* -------------------- the Player's Hand -------------------- */
function myResult(st, seat) {
  const r = st.round;
  if (!r || r.answer === null) return null;
  const mine = st.answers[seat];
  if (mine === undefined) return 'No answer this time. It was cup ' + (r.answer + 1) + '.';
  if (mine === r.answer) return 'Correct! +100';
  return 'Not this time: it was cup ' + (r.answer + 1) + '.';
}

export function phonePrompt(st, seat) {
  if (st.done) return { act: false, text: 'The game is over. Watch the screen.' };
  if (st.forfeits[seat]) return { act: true, key: 'gg-forfeit:' + (st.round ? st.round.number : 0), text: 'A forfeit! Do it, or tap PASS.' };
  if (st.phase === 'pick' && !st.answered.includes(seat)) return { act: true, key: 'gg:' + st.round.number, text: 'Pick a cup!' };
  if (st.phase === 'pick') return { act: false, text: 'Locked in.' };
  return { act: false, text: 'Watch the screen…' };
}

// ui: { el, heading, parchment, tag, prose, cardTitle, bigButton, send(action), locked }
export function phoneView(st, seat, ui) {
  const r = st.round;
  const me = st.players.find((p) => p.seat === seat);
  const open = st.phase === 'pick' && me && !me.away && !st.answered.includes(seat);
  const ready = open && !ui.locked;
  const out = [ui.heading(st.skin === 'pub' ? 'Street Shuffle 18+' : 'Goblet Glance', me ? me.score + ' points' : '')];
  out.push(el('div', { role: 'status', style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: 20px; color: " + (open ? '#D9A441' : '#A9C9C4') }, phonePrompt(st, seat).text));
  if (st.phase === 'pick' && st.timer) {
    out.push(el('div', { role: 'timer', 'aria-label': Math.ceil(st.timer.left / 1000) + ' seconds left', style: 'height: 10px; border-radius: 999px; background: #2A4A4A; overflow: hidden' },
      el('div', { style: 'height: 100%; width: ' + (st.timer.left / st.timer.total) * 100 + '%; background: #D9A441; transition: width 250ms linear' })));
  }
  const n = r && st.phase !== 'lobby' ? r.cups : st.settings.cups;
  const picked = st.phase === 'pick' ? undefined : st.answers[seat];
  const grid = el('div', { style: 'display: grid; grid-template-columns: repeat(' + (n > 3 ? 3 : n) + ', minmax(0, 1fr)); gap: 10px' });
  for (let p = 0; p < n; p++) {
    const good = r && r.answer !== null && p === r.answer;
    const b = el('button', { type: 'button', class: 'pbtn', disabled: !ready, 'aria-label': 'Cup ' + (p + 1),
      style: "min-height: 88px; border-radius: 12px; border: 3px solid " + (good ? '#FFFFFF' : 'transparent') + '; background: ' + (good ? RIGHT : ready ? '#D9A441' : '#3A4A52') + '; color: ' + (ready || good ? '#0F1E28' : '#8FA5A3') + "; font-family: 'Cinzel', serif; font-weight: 700; font-size: 40px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px" },
      String(p + 1), picked === p ? el('span', { style: "font-family: 'Cardo', Georgia, serif; font-size: 13px; font-weight: 400" }, 'your pick') : null);
    b.addEventListener('click', () => { if (ready) ui.send({ type: 'answer', choice: p, seq: st.seq }); });
    grid.appendChild(b);
  }
  out.push(grid);
  const res = myResult(st, seat);
  if (res) out.push(ui.parchment(ui.cardTitle(res)));
  else if (st.phase !== 'pick') out.push(ui.parchment(ui.prose(st.phase === 'lobby' ? 'The first round starts when the host is ready. Watch the screen, not your phone!' : 'Watch the screen: the buttons open when the cups stop.')));
  // An 18+ forfeit: always optional.
  if (st.forfeits[seat]) {
    const pass = ui.bigButton('PASS', true, () => ui.send({ type: 'pass-forfeit' }));
    out.push(ui.parchment(ui.tag('YOUR FORFEIT · ENTIRELY OPTIONAL'), ui.prose(st.forfeits[seat]), ui.prose('Not feeling it? Tap Pass. No penalty, no questions asked.', 'font-size: 14px; font-style: italic; color: #3B4B57')), pass);
  }
  return out;
}

/* -------------------- the Host Console -------------------- */
export function hostPrompt(st) {
  if (st.phase === 'lobby') return 'Choose the number of cups and the difficulty to suit the room.';
  if (st.showStandings || st.done) return 'Read out the standings and crown the sharpest eyes.';
  if (st.phase === 'drop') return 'Get everyone watching the screen as the orb is hidden.';
  if (st.phase === 'shuffle') return 'Keep quiet while the cups weave their pattern.';
  if (st.phase === 'pick') return 'Tell everyone to lock in a cup number on their phone.';
  return 'Lift the cup, cheer the winners, and hand out any forfeits.';
}

export function primaryLabel(st) {
  return st.primary === 'standings' ? 'SHOW STANDINGS ›' : st.primary === 'reveal' ? 'REVEAL ›' : 'START ROUND ›';
}

// ui: { K, H, P, button, confirmButton, pills, row, host(cmd, extra), titleOf }
export function hostPanel(st, ui) {
  const r = st.round;
  const out = [ui.K((st.skin === 'pub' ? 'STREET SHUFFLE 18+' : 'GOBLET GLANCE') + (r ? ' · ROUND ' + r.number + ' OF ' + st.rounds : ''))];
  out.push(ui.H(st.phase === 'lobby' ? 'Set the table' : st.phase === 'drop' ? 'The ball goes under…' : st.phase === 'shuffle' ? 'Shuffling' : st.phase === 'pick' ? 'Picking' : st.phase === 'final' ? 'The final round is done' : 'Cup ' + (r.answer + 1) + ' had it'));
  if (st.errors.length) out.push(ui.P('Refused: ' + st.errors.join(' '), 'font-size: 14px; color: #9E3B3B'));
  const between = st.phase === 'lobby' || st.phase === 'reveal';
  if (between && !st.done) {
    out.push(ui.pills('CUPS', [['3', '3'], ['4', '4'], ['5', '5']], String(st.settings.cups), (v) => ui.host('settings', { settings: { cups: Number(v) } })));
    out.push(ui.pills('DIFFICULTY', [['easy', 'EASY'], ['medium', 'MEDIUM'], ['hard', 'HARD']], st.settings.difficulty, (v) => ui.host('settings', { settings: { difficulty: v } })));
  }
  if (st.phase === 'lobby' && !st.done) {
    out.push(ui.pills('ROUNDS', [['3', '3'], ['5', '5'], ['10', '10']], String(st.settings.rounds), (v) => ui.host('settings', { settings: { rounds: Number(v) } })));
    if (st.forfeitsAvailable) out.push(ui.pills('FORFEITS', [['off', 'OFF'], ['on', 'ON']], st.settings.forfeits ? 'on' : 'off', (v) => ui.host('settings', { settings: { forfeits: v === 'on' } })));
  }
  if (st.phase === 'pick') out.push(ui.P(st.answered.length + ' of ' + st.players.filter((p) => !p.away).length + ' locked in' + (st.timer ? ' · ' + Math.ceil(st.timer.left / 1000) + ' s left' : '') + '.'));
  if (st.reveal && (st.phase === 'reveal' || st.phase === 'final')) {
    out.push(ui.P('Correct: ' + (st.reveal.correctSeats.length ? st.reveal.correctSeats.map(ui.titleOf).join(', ') : 'nobody') + '.'));
    const f = Object.keys(st.forfeits);
    if (f.length) out.push(ui.P('Forfeits handed out (optional): ' + f.map(ui.titleOf).join(', ') + '.', 'font-size: 14px; font-style: italic; color: #3B4B57'));
  }
  if (!st.done) {
    out.push(ui.row(
      ui.button('START ROUND', () => ui.host('start-round'), { disabled: !between, strong: st.primary === 'start-round' }),
      ui.button('REVEAL', () => ui.host('reveal'), { disabled: st.phase !== 'pick', strong: st.primary === 'reveal' }),
      ui.button(st.showStandings ? 'HIDE STANDINGS' : 'SHOW STANDINGS', () => ui.host('standings'), { disabled: !(between || st.phase === 'final'), strong: st.primary === 'standings' }),
      ui.button('END GAME', () => ui.host('end'), {})));
  }
  return out;
}
