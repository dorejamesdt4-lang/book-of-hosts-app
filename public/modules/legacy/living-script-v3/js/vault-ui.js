// ====================================================================
// VERNACULAR VAULT / SLANG-O-METER 18+ · SCREENS — one set of screens
// for both skins (rules: ../engine/modules/vernacular-vault.js):
//   storybook  (12+) an open book: parchment pages, gold rule, navy ink
//   chalkboard (18+) a pub-quiz chalkboard in a wooden frame
//   createView / phonePrompt / phoneView / hostPanel / hostPrompt / primaryLabel
// Flat 2D: a circular countdown, plain bars for the answer chart.
// ====================================================================

import { el } from './common.js';

export const ids = ['vernacular-vault', 'vernacular-vault-18'];
const LETTERS = ['A', 'B', 'C', 'D'];
// The four answer colours, as on the printed cards: red, blue, yellow, green.
export const OPTION_COLOURS = ['#9E3B3B', '#2E5E8E', '#C99A2E', '#2E7D4F'];
const CORRECT = '#2E7D4F';
const KIND = { slang: 'SLANG → MEANING', meaning: 'MEANING → SLANG' };

const SKINS = {
  storybook: { frame: '#132A2A', rule: '#B8923E', page: '#EDE6D6', ink: '#1B2A36', head: '#0F1E28', muted: '#3B4B57', accent: '#8A6420', font: "'Cinzel', serif", body: "'Cardo', Georgia, serif", grey: '#CDBF9F', title: 'THE VERNACULAR VAULT' },
  chalkboard: { frame: '#6B4A2B', rule: '#8C6A45', page: '#243029', ink: '#EDEDE6', head: '#F4F1E4', muted: '#B9C2B8', accent: '#E9C46A', font: "'Cardo', Georgia, serif", body: "'Cardo', Georgia, serif", grey: '#4A5A50', title: 'SLANG-O-METER 18+' }
};

const secs = (t) => (t ? Math.ceil(t.left / 1000) : null);

function ring(timer, size, sk) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const share = timer && timer.total ? timer.left / timer.total : 0;
  const box = el('div', { role: 'timer', 'aria-label': timer ? secs(timer) + ' seconds left' : 'Time is up', style: 'position: relative; width: ' + size + 'px; height: ' + size + 'px; flex-shrink: 0' });
  box.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + sk.grey + '" stroke-width="6"></circle><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + sk.accent + '" stroke-width="6" stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - share) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"></circle></svg>';
  box.appendChild(el('div', { style: 'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: ' + sk.font + '; font-weight: 700; font-size: ' + Math.round(size * 0.34) + 'px; color: ' + sk.head }, timer ? String(secs(timer)) : '0'));
  return box;
}

function badge(i, size, dim) {
  return el('span', { 'aria-hidden': 'true', style: "flex-shrink: 0; width: " + size + 'px; height: ' + size + 'px; border-radius: 8px; background: ' + (dim ? '#8FA5A3' : OPTION_COLOURS[i]) + "; color: #FFFFFF; font-family: 'Cinzel', serif; font-weight: 700; font-size: " + Math.round(size * 0.55) + 'px; display: flex; align-items: center; justify-content: center' }, LETTERS[i]);
}

/* -------------------- the Stage -------------------- */
export function createView(container, { titleOf, size = 'panel' }) {
  const tv = size === 'tv';
  let sk = SKINS.storybook;
  const left = el('div');
  const right = el('div');
  const frame = el('div', { style: 'box-sizing: border-box; border-radius: 14px; padding: ' + (tv ? 16 : 10) + 'px' },
    el('div', { style: 'display: grid; grid-template-columns: ' + (tv ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)') + '; gap: ' + (tv ? 3 : 8) + 'px' }, left, right));
  container.innerHTML = '';
  container.appendChild(frame);

  function page(node) {
    node.setAttribute('style', 'position: relative; box-sizing: border-box; min-height: ' + (tv ? 560 : 0) + 'px; padding: ' + (tv ? '34px 36px' : '18px 16px') + '; background: ' + sk.page + '; color: ' + sk.ink + '; border-radius: 6px; display: flex; flex-direction: column; gap: ' + (tv ? 16 : 10) + 'px;' + (sk === SKINS.storybook ? ' box-shadow: inset 0 0 70px rgba(160,120,60,0.2);' : ''));
    node.innerHTML = '';
    node.appendChild(el('div', { style: 'position: absolute; inset: ' + (tv ? 12 : 8) + 'px; border: 1px solid ' + sk.rule + '; border-radius: 4px; pointer-events: none; opacity: 0.8' }));
  }
  const K = (t) => el('div', { style: 'position: relative; font-family: ' + sk.font + '; font-size: ' + (tv ? 13 : 11) + 'px; letter-spacing: 4px; color: ' + sk.accent }, t);
  const P = (t, extra) => el('div', { style: 'position: relative; font-family: ' + sk.body + '; font-size: ' + (tv ? 22 : 15) + 'px; line-height: 1.45; color: ' + sk.ink + ';' + (extra || '') }, t);

  function leaderboard(st) {
    return el('div', { style: 'position: relative; display: flex; flex-direction: column; gap: ' + (tv ? 8 : 5) + 'px' },
      st.standings.slice(0, tv ? 10 : 8).map((p) => el('div', { style: 'display: flex; align-items: baseline; gap: 10px; font-family: ' + sk.body + '; font-size: ' + (tv ? 22 : 15) + 'px; color: ' + sk.ink },
        el('span', { style: 'min-width: 1.6em; font-family: ' + sk.font + '; font-weight: 700; color: ' + sk.accent }, String(p.rank)),
        el('span', { style: 'flex-grow: 1' }, titleOf(p.seat) + (p.rank === 1 && p.score > 0 && (st.phase === 'final' || st.done) ? ' 👑' : '')),
        p.bonuses ? el('span', { title: 'Speed bonuses', style: 'font-size: 0.8em; color: ' + sk.muted }, '⚡×' + p.bonuses) : null,
        el('span', { style: 'font-family: ' + sk.font + '; font-weight: 700' }, String(p.score)))));
  }

  return {
    render(st) {
      if (!st) return;
      sk = SKINS[st.skin] || SKINS.storybook;
      frame.style.background = sk.frame;
      frame.style.boxShadow = sk === SKINS.storybook ? 'inset 0 0 0 5px #102424, inset 0 0 0 6px #B8923E, 0 20px 40px rgba(0,0,0,0.45)' : 'inset 0 0 0 3px #4E3520, 0 20px 40px rgba(0,0,0,0.45)';
      page(left);
      page(right);
      const q = st.question;
      // Left page: the question (or the lobby), the countdown.
      left.appendChild(K(sk.title + (q ? ' · QUESTION ' + q.number + ' OF ' + st.length : '')));
      if (st.errors.length && !st.pools.length) {
        left.appendChild(P('This game can\'t start: ' + st.errors.join(' '), 'color: #9E3B3B'));
      } else if (!q) {
        left.appendChild(P(st.phase === 'lobby' ? 'Gather your wordsmiths…' : '', 'font-style: italic'));
        left.appendChild(P((st.poolName ? st.poolName + ' · ' : '') + st.length + ' questions · ' + st.settings.timeLimit + ' s each', 'color: ' + sk.muted));
      } else {
        left.appendChild(K(KIND[q.kind]));
        left.appendChild(el('div', { style: 'position: relative; font-family: ' + (q.kind === 'slang' ? sk.font : sk.body) + '; font-weight: 700; font-size: ' + (tv ? (q.kind === 'slang' ? 64 : 34) : (q.kind === 'slang' ? 34 : 19)) + 'px; line-height: 1.2; color: ' + sk.head }, q.prompt));
        left.appendChild(el('div', { style: 'position: relative; margin-top: auto; display: flex; align-items: center; gap: 16px' },
          st.phase === 'question' ? ring(st.timer, tv ? 110 : 64, sk) : null,
          P(st.phase === 'question' ? st.answered.length + ' of ' + st.players.filter((p) => !p.away).length + ' have answered' : st.reveal ? st.reveal.correctSeats.length + ' of ' + st.players.length + ' got it right' : '', 'font-style: italic; color: ' + sk.muted)));
      }
      // Right page: the options, the reveal, or the standings.
      if (st.showStandings || (st.done && !q)) {
        right.appendChild(K(st.phase === 'final' || st.done ? 'FINAL STANDINGS' : 'THE STANDINGS'));
        right.appendChild(leaderboard(st));
      } else if (q) {
        const rev = st.phase !== 'question' && st.reveal;
        const total = rev ? rev.counts.reduce((a, b) => a + b, 0) : 0;
        right.appendChild(K(rev ? 'THE ANSWER' : 'PICK ONE, ON YOUR PHONE'));
        q.options.forEach((text, i) => {
          const good = rev && i === q.correct;
          const row = el('div', { style: 'position: relative; display: flex; flex-direction: column; gap: 4px; padding: ' + (tv ? '10px 12px' : '7px 9px') + '; border-radius: 10px; background: ' + (good ? CORRECT : rev ? 'transparent' : 'transparent') + '; border: 2px solid ' + (good ? CORRECT : rev ? sk.grey : OPTION_COLOURS[i]) + '; opacity: ' + (rev && !good ? '0.6' : '1') },
            el('div', { style: 'display: flex; align-items: center; gap: 12px' },
              badge(i, tv ? 38 : 26, rev && !good),
              el('span', { style: 'flex-grow: 1; font-family: ' + sk.body + '; font-size: ' + (tv ? 21 : 14) + 'px; line-height: 1.3; color: ' + (good ? '#FFFFFF' : sk.ink) }, text),
              rev ? el('span', { style: 'font-family: ' + sk.font + '; font-weight: 700; font-size: ' + (tv ? 20 : 14) + 'px; color: ' + (good ? '#FFFFFF' : sk.muted) }, String(rev.counts[i])) : null));
          if (rev) row.appendChild(el('div', { 'aria-hidden': 'true', style: 'height: 6px; border-radius: 999px; background: ' + (good ? 'rgba(255,255,255,0.3)' : sk.grey) + '; overflow: hidden' },
            el('div', { style: 'height: 100%; width: ' + (total ? (rev.counts[i] / total) * 100 : 0) + '%; background: ' + (good ? '#FFFFFF' : OPTION_COLOURS[i]) })));
          right.appendChild(row);
        });
        if (rev) {
          if (rev.fastest) right.appendChild(P('⚡ Fastest: ' + titleOf(rev.fastest) + (st.settings.speedBonus !== 'off' ? ' (×' + st.settings.speedBonus + ')' : ''), 'font-weight: 700'));
          if (q.example) right.appendChild(P('“' + q.example + '”', 'font-style: italic; color: ' + sk.muted));
        }
      } else {
        right.appendChild(K('THE STANDINGS'));
        right.appendChild(leaderboard(st));
      }
      if (st.notice) right.appendChild(P(st.notice, 'font-size: 0.8em; font-style: italic; color: ' + sk.muted));
    }
  };
}

/* -------------------- the Player's Hand -------------------- */
function myResult(st, seat) {
  const q = st.question;
  if (!q || st.phase === 'question' || q.correct === null) return null;
  const mine = st.answers[seat];
  if (mine === undefined) return 'No answer this time.';
  if (mine === q.correct) return st.reveal && st.reveal.fastest === seat && st.settings.speedBonus !== 'off' ? '⚡ Correct, and the fastest!' : 'Correct!';
  return 'Not this time: it was ' + LETTERS[q.correct] + '.';
}

export function phonePrompt(st, seat) {
  if (st.done) return { act: false, text: 'The vault is sealed. Watch the Stage.' };
  const me = st.players.find((p) => p.seat === seat);
  if (st.forfeits[seat]) return { act: true, key: 'vv-forfeit:' + (st.question ? st.question.number : 0), text: 'A forfeit! Do it, or tap PASS.' };
  if (st.phase === 'question' && me && !me.waiting && !st.answered.includes(seat)) return { act: true, key: 'vv:' + st.question.number, text: 'Pick your answer!' };
  if (st.phase === 'question' && me && me.waiting) return { act: false, text: 'Welcome back: you rejoin at the next question.' };
  if (st.phase === 'question') return { act: false, text: 'Answer locked in. Watch the Stage.' };
  return { act: false, text: 'Watch the Stage.' };
}

// ui: { el, heading, parchment, tag, prose, cardTitle, bigButton, send(action), locked }
export function phoneView(st, seat, ui) {
  const q = st.question;
  const me = st.players.find((p) => p.seat === seat);
  const open = st.phase === 'question' && me && !me.away && !me.waiting && !st.answered.includes(seat);
  const ready = open && !ui.locked;
  const out = [ui.heading(st.skin === 'chalkboard' ? 'Slang-O-Meter 18+' : 'Vernacular Vault', me ? me.score + ' points' : '')];
  out.push(el('div', { role: 'status', style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: 17px; color: " + (open ? '#D9A441' : '#A9C9C4') }, phonePrompt(st, seat).text));
  if (q) {
    out.push(ui.parchment(ui.tag('QUESTION ' + q.number + ' OF ' + st.length + ' · ' + KIND[q.kind]), ui.cardTitle(q.prompt)));
    q.options.forEach((text, i) => {
      const picked = st.phase === 'question' ? null : st.answers[seat];
      const good = q.correct !== null && i === q.correct;
      const b = el('button', { type: 'button', class: 'pbtn', disabled: !ready, 'aria-label': LETTERS[i] + ': ' + text,
        style: 'min-height: 64px; width: 100%; box-sizing: border-box; display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; border: 3px solid ' + (good ? '#FFFFFF' : 'transparent') + '; background: ' + OPTION_COLOURS[i] + '; color: #FFFFFF; text-align: left; cursor: pointer; opacity: ' + (q.correct !== null && !good ? '0.55' : '1') },
        el('span', { style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: 24px; min-width: 1.2em" }, LETTERS[i]),
        el('span', { style: "font-family: 'Cardo', Georgia, serif; font-size: 16px; line-height: 1.3" }, text + (picked === i ? '  · your answer' : '')));
      b.addEventListener('click', () => { if (ready) ui.send({ type: 'answer', choice: i, seq: st.seq }); });
      out.push(b);
    });
    const res = myResult(st, seat);
    if (res) out.push(ui.parchment(ui.cardTitle(res), q.example ? ui.prose('“' + q.example + '”', 'font-style: italic; color: #3B4B57') : null));
  } else {
    out.push(ui.parchment(ui.prose(st.phase === 'lobby' ? 'The first question appears when the host is ready.' : 'Watch the Stage.')));
  }
  // An 18+ forfeit: always optional.
  if (st.forfeits[seat]) {
    const pass = ui.bigButton('PASS', true, () => ui.send({ type: 'pass-forfeit' }));
    out.push(ui.parchment(ui.tag('YOUR FORFEIT · ENTIRELY OPTIONAL'), ui.prose(st.forfeits[seat]), ui.prose('Not feeling it? Tap Pass. No penalty, no questions asked.', 'font-size: 14px; font-style: italic; color: #3B4B57')), pass);
  }
  return out;
}

/* -------------------- the Host Console -------------------- */
export function hostPrompt(st) {
  if (st.phase === 'lobby') return "Gather your wordsmiths. When everyone's in, press Next Question.";
  if (st.showStandings || st.done) return 'Crown your vernacular champion.';
  if (st.phase === 'question') return st.reading ? 'Read the word or meaning out clearly to the room.' : "Hurry them along — the timer's running!";
  return 'Announce the true meaning, and enjoy the daft wrong guesses.';
}

export function primaryLabel(st) {
  return st.primary === 'standings' ? 'SHOW STANDINGS ›' : 'NEXT QUESTION ›';
}

// ui: { K, H, P, button, confirmButton, pills, row, host(cmd, extra), titleOf }
export function hostPanel(st, ui) {
  const out = [ui.K((st.skin === 'chalkboard' ? 'SLANG-O-METER 18+' : 'VERNACULAR VAULT') + (st.question ? ' · QUESTION ' + st.question.number + ' OF ' + st.length : ''))];
  out.push(ui.H(st.phase === 'lobby' ? 'Set up the vault' : st.phase === 'question' ? st.question.prompt : st.phase === 'final' ? 'The final question is done' : 'The answer is out'));
  if (st.errors.length) out.push(ui.P('Refused: ' + st.errors.join(' '), 'font-size: 14px; color: #9E3B3B'));
  if (st.phase === 'lobby' && !st.done) {
    out.push(ui.pills('SPEED BONUS', [['off', 'OFF'], ['1.5', '1.5×'], ['2', '2×']], String(st.settings.speedBonus), (v) => ui.host('settings', { settings: { speedBonus: v === 'off' ? 'off' : Number(v) } })));
    out.push(ui.pills('TIME', [['10', '10 S'], ['15', '15 S'], ['20', '20 S'], ['30', '30 S']], String(st.settings.timeLimit), (v) => ui.host('settings', { settings: { timeLimit: Number(v) } })));
    out.push(ui.pills('LENGTH', [['5', '5'], ['10', '10'], ['15', '15']], String(st.settings.length), (v) => ui.host('settings', { settings: { length: Number(v) } })));
    if (st.forfeitsAvailable) out.push(ui.pills('FORFEITS', [['off', 'OFF'], ['on', 'ON']], st.settings.forfeits ? 'on' : 'off', (v) => ui.host('settings', { settings: { forfeits: v === 'on' } })));
    if (st.pools.length > 1) out.push(ui.pills('WORD POOL', st.pools.map((p) => [p.id, p.name.toUpperCase()]), st.settings.pool, (v) => ui.host('settings', { settings: { pool: v } })));
    else out.push(ui.P('Word pool: ' + (st.poolName || 'none'), 'font-size: 14px; font-style: italic; color: #3B4B57'));
  }
  if (!st.done && st.phase !== 'question') {
    out.push(ui.pills('ROUND TYPE', [['slang', 'SLANG → MEANING'], ['meaning', 'MEANING → SLANG'], ['mixed', 'MIXED']], st.settings.roundType, (v) => ui.host('round-type', { value: v })));
  }
  if (st.phase === 'question') out.push(ui.P(st.answered.length + ' of ' + st.players.filter((p) => !p.away).length + ' have answered' + (st.timer ? ' · ' + secs(st.timer) + ' s left' : '') + '.'));
  if (st.reveal && st.phase !== 'question') {
    out.push(ui.P('Correct: ' + (st.reveal.correctSeats.length ? st.reveal.correctSeats.map(ui.titleOf).join(', ') : 'nobody') + (st.reveal.fastest ? ' · ⚡ ' + ui.titleOf(st.reveal.fastest) : '') + '.'));
    const f = Object.keys(st.forfeits);
    if (f.length) out.push(ui.P('Forfeits handed out (optional): ' + f.map(ui.titleOf).join(', ') + '.', 'font-size: 14px; font-style: italic; color: #3B4B57'));
  }
  if (!st.done) {
    out.push(ui.row(
      ui.button('NEXT QUESTION', () => ui.host('next-question'), { disabled: !(st.phase === 'lobby' || st.phase === 'reveal') || !st.pools.length, strong: st.primary === 'next-question' }),
      ui.button(st.showStandings ? 'HIDE STANDINGS' : 'SHOW STANDINGS', () => ui.host('standings'), { disabled: st.phase === 'question', strong: st.primary === 'standings' }),
      ui.button('END GAME', () => ui.host('end'), {})));
  }
  return out;
}
