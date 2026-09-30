// ====================================================================
// TWENTY-ONE & TROUBLE · SCREENS — everything the pages draw for the
// module (rules: ../engine/modules/twenty-one-trouble.js):
//   createView(container, { titleOf, size })  the Stage (TV) / panel
//   phonePrompt(state, seat, T)               the Hand's "what to do now"
//   phoneView(state, seat, ui)                the Hand: cards, TWIST, STICK
//   hostPanel(state, ui)                      the Host Console's controls
//   hostPrompt(state, T)                      the NEXT STEP banner
//
// Not on the mockups: built from the Storybook parts — the dice game's
// teal leather table with its gold rule, vellum cards with navy ink, the
// Lobby's seat cards for each guest's table. Cards "flip" in flat 2D.
// ====================================================================

import { el } from './common.js';

export const id = 'twenty-one-trouble';

const SUIT = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const SUIT_NAME = { spades: 'spades', hearts: 'hearts', diamonds: 'diamonds', clubs: 'clubs' };
const RANK_NAME = { A: 'ace', J: 'jack', Q: 'queen', K: 'king' };
const RED = (suit) => suit === 'hearts' || suit === 'diamonds';
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const secs = (t) => (t ? Math.ceil(t.left / 1000) : null);

function cardLabel(c) {
  return c.hidden ? 'A card, face down' : (RANK_NAME[c.rank] || c.rank) + ' of ' + SUIT_NAME[c.suit];
}

// One card: vellum face or the teal back. `flip` plays the 2D flip.
export function cardEl(c, w, flip) {
  const h = Math.round(w * 1.42);
  const base = 'position: relative; width: ' + w + 'px; height: ' + h + 'px; flex-shrink: 0; box-sizing: border-box; border-radius: ' + Math.round(w * 0.1) + 'px; box-shadow: 0 6px 14px rgba(0,0,0,0.4);';
  const node = c.hidden
    ? el('div', { role: 'img', 'aria-label': cardLabel(c), style: base + ' background: repeating-linear-gradient(45deg, #132A2A 0 6px, #102424 6px 12px); border: 2px solid #B8923E; box-shadow: inset 0 0 0 4px #102424, inset 0 0 0 5px #B8923E, 0 6px 14px rgba(0,0,0,0.4)' })
    : el('div', { role: 'img', 'aria-label': cardLabel(c), style: base + ' background: #EDE6D6; border: 2px solid #B8923E; color: ' + (RED(c.suit) ? '#9E3B3B' : '#0F1E28') + "; font-family: 'Cinzel', serif; font-weight: 700" },
      el('div', { 'aria-hidden': 'true', style: 'position: absolute; top: ' + Math.round(w * 0.06) + 'px; left: ' + Math.round(w * 0.1) + 'px; font-size: ' + Math.round(w * 0.26) + 'px; line-height: 1' }, c.rank),
      el('div', { 'aria-hidden': 'true', style: 'position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: ' + Math.round(w * 0.5) + 'px' }, SUIT[c.suit]));
  if (flip && !reduceMotion()) node.classList.add('ls-flip');
  return node;
}

function cardKey(c, i) { return i + ':' + (c.hidden ? 'x' : c.rank + c.suit); }

const STATUS = {
  waiting: () => 'Waiting',
  turn: () => 'Choosing…',
  stuck: (p) => 'Sticks on ' + p.total,
  bust: (p) => 'Bust on ' + p.total,
  natural: () => 'Twenty-one!'
};

/* -------------------- the Stage -------------------- */
export function createView(container, { titleOf, size = 'panel' }) {
  const tv = size === 'tv';
  const kCard = tv ? 96 : 56;
  const gCard = tv ? 50 : 34;
  const keeperCards = el('div', { style: 'display: flex; gap: ' + (tv ? 14 : 8) + 'px; justify-content: center; min-height: ' + Math.round(kCard * 1.42) + 'px' });
  const keeperTotal = el('div', { style: "font-family: 'Silkscreen', monospace; font-size: " + (tv ? 14 : 11) + 'px; letter-spacing: 1px; color: #D9A441; border: 1px solid #6B5320; border-radius: 999px; padding: 6px 12px' });
  const banner = el('div', { role: 'status', 'aria-live': 'polite', style: "align-self: stretch; text-align: center; font-family: 'Cinzel', serif; font-weight: 700; font-size: " + (tv ? 26 : 16) + 'px; letter-spacing: 2px; color: #0F1E28; background: #D9A441; border-radius: 8px; padding: ' + (tv ? '10px 16px' : '6px 10px') });
  const notice = el('div', { style: 'font-size: ' + (tv ? 18 : 13) + 'px; font-style: italic; color: #A9C9C4; text-align: center; min-height: 1.2em' });
  const board = el('div', { style: 'position: relative; display: flex; flex-direction: column; align-items: center; gap: ' + (tv ? 16 : 10) + 'px; padding: ' + (tv ? '26px 30px' : '16px 14px') + '; background: #132A2A; border: 1px solid #2A4A4A; border-radius: 16px; box-shadow: inset 0 0 0 5px #102424, inset 0 0 0 6px #B8923E, inset 0 0 60px rgba(0,0,0,0.45)' },
    el('div', { style: "font-family: 'Cinzel', serif; font-size: " + (tv ? 14 : 11) + 'px; letter-spacing: 5px; color: #5AA8A0' }, 'THE VAULT KEEPER'),
    keeperCards, keeperTotal, banner, notice);
  const tables = el('div', { style: 'display: grid; grid-template-columns: repeat(' + (tv ? 4 : 2) + ', minmax(0, 1fr)); gap: ' + (tv ? 12 : 8) + 'px' });
  container.innerHTML = '';
  container.appendChild(el('div', { style: 'display: flex; flex-direction: column; gap: ' + (tv ? 18 : 10) + 'px' }, board, tables));

  let shownKeys = new Set(); // cards already drawn: only new ones flip
  let lastRound = null;

  return {
    render(st) {
      if (!st) return;
      if (st.round !== lastRound) { shownKeys = new Set(); lastRound = st.round; }
      const seen = new Set();
      const draw = (holder, list, width, prefix) => {
        holder.innerHTML = '';
        list.forEach((c, i) => {
          const key = prefix + cardKey(c, i);
          seen.add(key);
          holder.appendChild(cardEl(c, width, !shownKeys.has(key)));
        });
      };
      draw(keeperCards, st.keeper.cards, kCard, 'k');
      keeperTotal.textContent = !st.keeper.cards.length ? 'NO CARDS YET' : st.keeper.revealed
        ? (st.keeper.bust ? 'BUST ON ' + st.keeper.total : st.keeper.natural ? 'TWENTY-ONE ON THE DEAL' : 'THE KEEPER HAS ' + st.keeper.total)
        : 'SHOWING ' + st.keeper.total;
      const t = secs(st.timer);
      banner.textContent = st.done ? 'THE VAULT IS CLOSED'
        : st.phase === 'setup' ? 'THE TABLE IS SET'
        : st.phase === 'play' && st.active ? 'ACTIVE FOCUS · ' + titleOf(st.active).toUpperCase() + (t !== null ? ' · ' + t : '')
        : st.phase === 'keeper' || st.phase === 'keeper-play' ? 'ACTIVE FOCUS · THE VAULT KEEPER'
        : 'THE ROUND IS DONE';
      notice.textContent = st.notice || (st.phase === 'result' ? 'Round ' + st.round + ' is settled.' : '');
      tables.innerHTML = '';
      st.players.forEach((p) => {
        const on = p.seat === st.active;
        const hand = el('div', { style: 'display: flex; gap: 0; min-height: ' + Math.round(gCard * 1.42) + 'px' });
        p.cards.forEach((c, i) => {
          const key = p.seat + cardKey(c, i);
          seen.add(key);
          const node = cardEl(c, gCard, !shownKeys.has(key));
          if (i) node.style.marginLeft = '-' + Math.round(gCard * 0.35) + 'px';
          hand.appendChild(node);
        });
        const res = p.result === 'win' ? 'WINS' : p.result === 'lose' ? (p.status === 'bust' ? 'TROUBLE' : 'LOSES') : '';
        tables.appendChild(el('div', { style: 'display: flex; flex-direction: column; gap: 6px; padding: ' + (tv ? '12px 14px' : '8px 10px') + '; background: #0F1E28; border: ' + (on || p.result === 'win' ? '2px solid #5AA8A0' : '1px solid #2A4A4A') + '; border-radius: 12px; opacity: ' + (p.status === 'bust' ? '0.7' : '1') },
          el('div', { style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: " + (tv ? 17 : 13) + 'px; color: #D9A441' }, titleOf(p.seat)),
          hand,
          el('div', { style: 'display: flex; justify-content: space-between; gap: 6px; align-items: baseline' },
            el('div', { style: 'font-size: ' + (tv ? 15 : 12) + 'px; font-style: italic; color: #8FA5A3' }, p.cards.length ? (STATUS[p.status] || STATUS.waiting)(p) + (p.status === 'waiting' || p.status === 'turn' ? ' · ' + p.total : '') + (p.five ? ' · 5 cards' : '') + (p.away ? ' · away' : '') : 'At the table'),
            res ? el('div', { style: "font-family: 'Silkscreen', monospace; font-size: " + (tv ? 12 : 10) + 'px; color: ' + (p.result === 'win' ? '#5AA8A0' : '#D9A441') }, res) : null)));
      });
      shownKeys = seen;
    }
  };
}

/* -------------------- the Player's Hand -------------------- */
function statusLine(st, seat) {
  const me = st.players.find((p) => p.seat === seat);
  if (me && me.status === 'bust') return 'Bust! Better luck next tale.';
  if (st.phase === 'play' && st.active === seat) return 'Your turn to choose!';
  return 'Waiting for the Keeper…';
}

export function phonePrompt(st, seat, T) {
  if (st.done) return { act: false, text: 'The vault is closed. Watch the Stage.' };
  if (st.phase === 'play' && st.active === seat) return { act: true, key: 't21:' + st.round + ':' + st.seq, text: 'Your turn to choose! Twist or Stick.' };
  const me = st.players.find((p) => p.seat === seat);
  if (me && me.status === 'bust') return { act: false, text: 'Bust! Better luck next tale.' };
  if (st.phase === 'play' && st.active) return { act: false, text: 'Waiting: ' + T(st.active) + ' is choosing.' };
  return { act: false, text: 'Waiting for the Keeper…' };
}

// ui: { el, heading, parchment, tag, prose, cardTitle, bigButton, send(action), locked }
export function phoneView(st, seat, ui) {
  const me = st.players.find((p) => p.seat === seat);
  const mine = st.phase === 'play' && st.active === seat && !st.done;
  const ready = mine && !ui.locked;
  const hand = el('div', { style: 'position: relative; display: flex; gap: 6px; flex-wrap: wrap; padding: 0 12px' });
  (me ? me.cards : []).forEach((c) => hand.appendChild(cardEl(c, 52, false)));
  const keeper = el('div', { style: 'position: relative; display: flex; gap: 6px; padding: 0 12px' });
  st.keeper.cards.forEach((c) => keeper.appendChild(cardEl(c, 34, false)));
  const twist = ui.bigButton('TWIST', ready, () => ui.send({ type: 'twist', seq: st.seq }));
  const stick = ui.bigButton('STICK', ready, () => ui.send({ type: 'stick', seq: st.seq }));
  twist.style.height = stick.style.height = '72px';
  twist.style.fontSize = stick.style.fontSize = '20px';
  return [
    ui.heading('Twenty-One & Trouble', me && me.cards.length ? 'Your total: ' + me.total : ''),
    el('div', { role: 'status', style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: 17px; color: " + (mine ? '#D9A441' : '#A9C9C4') }, statusLine(st, seat)),
    ui.parchment(
      ui.tag('YOUR CARDS' + (me && me.five ? ' · FIVE CARDS' : '')),
      me && me.cards.length ? hand : ui.prose('Your cards arrive when the host deals.'),
      me && me.cards.length ? ui.cardTitle('Total: ' + me.total) : null,
      me && me.result ? ui.prose(me.result === 'win' ? 'You plundered the vault this round!' : 'The Keeper takes this round.', 'font-style: italic; color: #3B4B57') : null),
    st.keeper.cards.length ? ui.parchment(ui.tag('THE VAULT KEEPER · ' + (st.keeper.revealed ? st.keeper.total : 'SHOWING ' + st.keeper.total)), keeper) : null,
    el('div', { style: 'display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px' }, twist, stick),
    el('div', { style: 'font-size: 14px; font-style: italic; color: #A9C9C4' }, 'The Stage deals for everyone, so the cards are the same on every screen. No betting: just the thrill of twenty-one.')
  ].filter(Boolean);
}

/* -------------------- the Host Console -------------------- */
export function hostPrompt(st) {
  if (st.done) return 'The vault is closed. Press NEXT to carry on with the tale.';
  if (st.phase === 'setup') return "Gather your travellers. When everyone's in, press Deal.";
  if (st.phase === 'play') {
    // Just dealt (nobody has twisted or stuck yet): watch the Keeper.
    const actors = st.players.filter((p) => p.status !== 'natural');
    const fresh = actors.length && actors[0].seat === st.active && actors.every((p) => p.cards.length === 2 && (p.status === 'waiting' || p.status === 'turn'));
    return fresh ? "Watch the Keeper's cards: a twenty-one on the deal takes the round." : 'Guide the active player: Twist or Stick.';
  }
  if (st.phase === 'keeper' || st.phase === 'keeper-play') return 'Press Reveal Keeper and let the Keeper play out their hand.';
  return 'Announce who plundered the vault and who found trouble.';
}

export const PRIMARY_LABEL = { deal: 'DEAL ›', reveal: 'REVEAL KEEPER ›', 'next-round': 'NEXT ROUND ›' };
export function primaryLabel(st) { return PRIMARY_LABEL[st.primary] || 'NEXT ›'; }

// ui: { K, H, P, button(label, onClick, { on, disabled, strong }), pills(label, options, value, onPick), host(cmd, extra), titleOf }
export function hostPanel(st, ui) {
  const out = [ui.K('TWENTY-ONE & TROUBLE · ROUND ' + (st.round || 0)), ui.H(hostTitle(st, ui.titleOf))];
  if (st.phase === 'setup' && !st.done) {
    out.push(ui.pills('TURN TIMER', [['on', 'ON · 15 S'], ['off', 'OFF']], st.settings.timer ? 'on' : 'off', (v) => ui.host('settings', { settings: { timer: v === 'on' } })));
    out.push(ui.pills('DECKS', [['1', '1 DECK'], ['2', '2 DECKS']], String(st.settings.decks), (v) => ui.host('settings', { settings: { decks: Number(v) } })));
    out.push(ui.P('Two decks suit five or more players.', 'font-size: 14px; font-style: italic; color: #3B4B57'));
  }
  if (st.phase === 'play' && st.active) {
    const p = st.players.find((x) => x.seat === st.active);
    out.push(ui.P(ui.titleOf(p.seat) + ' has ' + p.total + ' on ' + p.cards.length + ' cards' + (st.timer ? ' · ' + secs(st.timer) + ' s left' : '') + '.'));
  }
  if (st.keeper.revealed) out.push(ui.P('The Keeper: ' + (st.keeper.bust ? 'bust on ' + st.keeper.total : st.keeper.total) + '.'));
  if (st.phase === 'result' || st.done) {
    const won = st.players.filter((p) => p.result === 'win').map((p) => ui.titleOf(p.seat));
    out.push(ui.P(won.length ? 'Plundered the vault: ' + won.join(', ') + '.' : 'The Keeper wins this round.'));
  }
  if (!st.done) {
    out.push(ui.row(
      ui.button('DEAL', () => ui.host('deal'), { disabled: st.phase !== 'setup', strong: st.primary === 'deal' }),
      ui.button('FORCE STICK', () => ui.host('force-stick'), { disabled: !(st.phase === 'play' && st.active) }),
      ui.button('REVEAL KEEPER', () => ui.host('reveal'), { disabled: st.phase !== 'keeper', strong: st.primary === 'reveal' }),
      ui.button('NEXT ROUND', () => ui.host('next-round'), { disabled: st.phase !== 'result', strong: st.primary === 'next-round' }),
      ui.button('END GAME', () => ui.host('end'), {})));
  }
  return out;
}

function hostTitle(st, titleOf) {
  if (st.done) return 'The vault is closed';
  if (st.phase === 'setup') return 'Gather the travellers';
  if (st.phase === 'play') return st.active ? titleOf(st.active) + ': Twist or Stick?' : 'Dealing…';
  if (st.phase === 'keeper') return "The Keeper's turn";
  if (st.phase === 'keeper-play') return 'The Keeper plays…';
  return 'The round is settled';
}
