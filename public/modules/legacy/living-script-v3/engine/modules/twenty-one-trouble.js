// ====================================================================
// MINI-GAME MODULE · TWENTY-ONE & TROUBLE (family version)
// 1–8 guests race the Vault Keeper (the Banker, always played by the
// game) to twenty-one. Written fresh from the plain rules below; no
// betting of any kind, no wagers, no currency, and (on purpose) no
// scoreboard.
//
//   1. Two cards each; the Keeper shows one card and hides the other.
//   2. The Keeper with 21 on two cards takes the round: every guest loses.
//   3. A guest with 21 on two cards wins at once and sits out the round.
//   4. In seat order, each guest Twists (takes a card) or Sticks. Over 21
//      is bust: out of the round.
//   5. Reveal Keeper: the Keeper twists while on 16 or less. A Keeper
//      bust means every guest still standing wins.
//   6. Otherwise the higher total wins. On the same total a 5-card hand
//      beats a shorter hand; every other draw goes to the Keeper.
//   7. When the deck runs out, the discards are shuffled back in.
//
// A self-paced module (see ../../MINIGAME-MODULES.md): it keeps its own
// turn timer and paces the Keeper's draws in tick(ms). Guests act with
// { type: 'twist' | 'stick', seat, seq }; the host with
// { type: 'host', cmd: 'deal' | 'force-stick' | 'reveal' | 'next-round' |
// 'end' | 'settings', settings }. Narrator lines are events
// { type: 'narrate', id, text } (texts from ../../twenty-one-trouble/lines.json).
// ====================================================================

import { newDeck, shuffle, handTotal, isNatural, isFiveCard, compare } from '../cards.js';

export const id = 'twenty-one-trouble';
export const name = 'Twenty-One & Trouble';
export const selfPaced = true;
export const MAX_PLAYERS = 8;
export const TURN_MS = 15000;         // the turn timer (host can switch it off)
export const KEEPER_DRAW_MS = 900;    // the Keeper's cards come one at a time
export const AUTO_HOST_MS = 2500;     // no host at the console (online / rehearsal)
export const AUTO_PLAY_MS = 1200;     // rehearsal: the game plays for each guest
export const AUTO_ROUNDS = 3;         // no host: rounds before the game ends itself
export const KEEPER_STANDS_ON = 17;

export const LINE_IDS = {
  start: 'T21-01', keeperNatural: 'T21-02', playerNatural: 'T21-03', twist: 'T21-04', stick: 'T21-05',
  playerBust: 'T21-06', keeperBust: 'T21-07', playerWins: 'T21-08', fiveCardWin: 'T21-09', keeperWins: 'T21-10'
};

// create({ players: [{ seat, title }], options, rng })
//   options: { lines: { id: text }, timer: true, decks: 1 | 2,
//              autoHost: false, autoPlay: false, rounds: AUTO_ROUNDS }
export function create({ players, options = {}, rng = Math.random }) {
  const lines = options.lines || {};
  const settings = {
    timer: options.timer !== false,
    decks: options.decks === 1 || options.decks === 2 ? options.decks : (players.length >= 5 ? 2 : 1)
  };
  const autoHost = !!options.autoHost;
  const autoPlay = !!options.autoPlay;
  const autoRounds = Math.max(1, Number(options.rounds) || AUTO_ROUNDS);
  const table = players.slice(0, MAX_PLAYERS).map((p) => ({ seat: p.seat, title: p.title, cards: [], status: 'waiting', result: null, away: false }));

  let phase = 'setup';   // setup | play | keeper | keeper-play | result
  let round = 0;
  let deck = [];
  let discards = [];
  let keeper = [];
  let revealed = false;
  let active = -1;       // index into table
  let timerLeft = null;
  let seq = 0;
  let done = false;
  let lastLine = '';
  let notice = '';
  let idle = 0;          // ms waiting on the host (autoHost) or the guest (autoPlay)
  let keeperWait = 0;
  let lastWinners = [];
  let started = false;

  function narrate(events, key) {
    const lineId = LINE_IDS[key];
    lastLine = lines[lineId] || '';
    events.push({ type: 'narrate', id: lineId, text: lastLine });
  }

  function freshDeck() {
    deck = shuffle(newDeck(settings.decks), rng);
    discards = [];
  }

  function draw(events) {
    if (!deck.length) {
      deck = shuffle(discards.length ? discards : newDeck(settings.decks), rng);
      discards = [];
      notice = 'The discards are shuffled back into the deck.';
      events.push({ type: 'notice', text: notice });
    }
    return deck.pop();
  }

  function clearTable() {
    table.forEach((p) => { discards.push(...p.cards); p.cards = []; p.status = 'waiting'; p.result = null; });
    discards.push(...keeper);
    keeper = [];
    revealed = false;
    active = -1;
    timerLeft = null;
  }

  function deal(events) {
    if (!started) { started = true; narrate(events, 'start'); }
    clearTable();
    round += 1;
    notice = '';
    for (let n = 0; n < 2; n++) {
      table.forEach((p) => p.cards.push(draw(events)));
      keeper.push(draw(events));
    }
    // The Keeper first: twenty-one on the deal takes the round.
    if (isNatural(keeper)) {
      revealed = true;
      table.forEach((p) => { p.status = 'stuck'; p.result = 'lose'; });
      narrate(events, 'keeperNatural');
      finishRound([]);
      return;
    }
    let naturals = 0;
    table.forEach((p) => { if (isNatural(p.cards)) { p.status = 'natural'; p.result = 'win'; naturals += 1; } });
    if (naturals) narrate(events, 'playerNatural');
    phase = 'play';
    nextTurn(events);
  }

  function nextTurn(events) {
    timerLeft = null;
    idle = 0;
    seq += 1;
    for (let i = active + 1; i < table.length; i++) {
      const p = table[i];
      if (p.status !== 'waiting') continue;
      active = i;
      p.status = 'turn';
      // Disconnected: they stick for the rest of the round.
      if (p.away) { stick(events, p); return; }
      if (settings.timer) timerLeft = TURN_MS;
      return;
    }
    active = -1;
    phase = 'keeper';
  }

  function twist(events, p) {
    narrate(events, 'twist');
    p.cards.push(draw(events));
    if (handTotal(p.cards) > 21) {
      p.status = 'bust';
      p.result = 'lose';
      narrate(events, 'playerBust');
      nextTurn(events);
      return;
    }
    // Still their turn: a fresh timer and a fresh move number.
    seq += 1;
    idle = 0;
    if (settings.timer) timerLeft = TURN_MS;
  }

  function stick(events, p) {
    p.status = 'stuck';
    narrate(events, 'stick');
    nextTurn(events);
  }

  function reveal(events) {
    revealed = true;
    phase = 'keeper-play';
    keeperWait = KEEPER_DRAW_MS;
    seq += 1;
    events.push({ type: 'reveal' });
  }

  // The Keeper twists on 16 or less, one card per KEEPER_DRAW_MS.
  function keeperStep(events) {
    if (handTotal(keeper) < KEEPER_STANDS_ON) {
      keeper.push(draw(events));
      seq += 1;
      events.push({ type: 'keeper-draw' });
      return;
    }
    settle(events);
  }

  function settle(events) {
    const k = handTotal(keeper);
    const standing = table.filter((p) => p.status === 'stuck');
    if (k > 21) {
      standing.forEach((p) => { p.result = 'win'; });
      narrate(events, 'keeperBust');
    } else {
      standing.forEach((p) => { p.result = compare(p.cards, keeper); });
      const winners = standing.filter((p) => p.result === 'win');
      if (winners.some((p) => isFiveCard(p.cards))) narrate(events, 'fiveCardWin');
      else if (winners.length) narrate(events, 'playerWins');
      else narrate(events, 'keeperWins');
    }
    finishRound(table.filter((p) => p.result === 'win').map((p) => p.seat));
  }

  function finishRound(winners) {
    lastWinners = winners;
    phase = 'result';
    active = -1;
    timerLeft = null;
    idle = 0;
    seq += 1;
  }

  function endGame(events) {
    if (done) return;
    done = true;
    timerLeft = null;
    active = -1;
    seq += 1;
    events.push({ type: 'end', result: result() });
  }

  function result() {
    return { winners: lastWinners.slice(), scores: {} };
  }

  function primary() {
    if (done) return null;
    if (phase === 'setup') return 'deal';
    if (phase === 'keeper') return 'reveal';
    if (phase === 'result') return 'next-round';
    return null;
  }

  function host(events, action) {
    const cmd = action.cmd;
    if (cmd === 'end') { endGame(events); return; }
    if (cmd === 'settings' && phase === 'setup' && action.settings) {
      const s = action.settings;
      if (typeof s.timer === 'boolean') settings.timer = s.timer;
      if (s.decks === 1 || s.decks === 2) { settings.decks = s.decks; freshDeck(); }
      seq += 1;
      events.push({ type: 'settings' });
      return;
    }
    if (cmd === 'deal' && phase === 'setup') { deal(events); return; }
    if (cmd === 'next-round' && phase === 'result') { deal(events); return; }
    if (cmd === 'force-stick' && phase === 'play' && active >= 0) { stick(events, table[active]); return; }
    if (cmd === 'reveal' && phase === 'keeper') reveal(events);
  }

  function publicCard(c) { return { rank: c.rank, suit: c.suit }; }

  freshDeck();

  return {
    id,
    selfPaced: true,
    get done() { return done; },

    start() {
      return [{ type: 'start' }];
    },

    act(action) {
      const events = [];
      if (done || !action) return events;
      if (action.type === 'host') { host(events, action); return events; }
      if (action.type === 'disconnect' || action.type === 'reconnect') {
        const p = table.find((x) => x.seat === action.seat);
        if (!p) return events;
        p.away = action.type === 'disconnect';
        if (p.away && phase === 'play' && table[active] === p) stick(events, p);
        else seq += 1;
        events.push({ type: 'presence' });
        return events;
      }
      if (action.type !== 'twist' && action.type !== 'stick') return events;
      // Only the active guest, and only once per move (no double taps).
      const p = table[active];
      if (phase !== 'play' || !p || p.seat !== action.seat) return events;
      if (action.seq !== undefined && action.seq !== seq) return events;
      if (action.type === 'twist') twist(events, p); else stick(events, p);
      return events;
    },

    tick(ms) {
      const events = [];
      if (done) return events;
      if (phase === 'play' && active >= 0 && timerLeft !== null) {
        const before = Math.ceil(timerLeft / 1000);
        timerLeft = Math.max(0, timerLeft - ms);
        if (timerLeft === 0) { stick(events, table[active]); return events; } // time's up: Stick for them
        if (Math.ceil(timerLeft / 1000) !== before) events.push({ type: 'timer' });
      }
      if (phase === 'keeper-play') {
        keeperWait -= ms;
        if (keeperWait <= 0) { keeperWait = KEEPER_DRAW_MS; keeperStep(events); }
        return events;
      }
      idle += ms;
      if (autoPlay && phase === 'play' && active >= 0 && idle >= AUTO_PLAY_MS) {
        const p = table[active];
        if (handTotal(p.cards) < KEEPER_STANDS_ON) twist(events, p); else stick(events, p);
        return events;
      }
      if (autoHost && idle >= AUTO_HOST_MS) {
        idle = 0;
        if (phase === 'result' && round >= autoRounds) { endGame(events); return events; }
        const cmd = primary();
        if (cmd) host(events, { cmd });
      }
      return events;
    },

    // What every screen draws. The Keeper's hidden card stays hidden
    // (and the deck's order is never sent) until it is revealed.
    get state() {
      const keeperCards = keeper.map((c, i) => (i === 1 && !revealed ? { hidden: true } : publicCard(c)));
      const shown = keeper.filter((c, i) => i !== 1 || revealed);
      return {
        id,
        phase,
        round,
        done,
        seq,
        settings: { ...settings },
        primary: primary(),
        active: active >= 0 ? table[active].seat : null,
        timer: timerLeft === null ? null : { left: timerLeft, total: TURN_MS },
        keeper: { cards: keeperCards, total: shown.length ? handTotal(shown) : 0, revealed, bust: revealed && handTotal(keeper) > 21, natural: revealed && isNatural(keeper) },
        players: table.map((p) => ({ seat: p.seat, title: p.title, cards: p.cards.map(publicCard), total: handTotal(p.cards), status: p.status, result: p.result, five: isFiveCard(p.cards), away: p.away })),
        cardsLeft: deck.length,
        line: lastLine,
        notice,
        result: done ? result() : null
      };
    },

    end() {
      const events = [];
      endGame(events);
      return result();
    }
  };
}
