// ====================================================================
// MINI-GAME MODULE · GOBLET GLANCE (12+) — and the shared engine for
// Street Shuffle 18+ (goblet-glance-18.js is this same code with its own
// id, age rating, lines and skin; nothing is copied).
//
// Cup and ball for 1–16 guests, all picking at once on their phones:
//   Drop:    the ball goes under one cup, in plain view.
//   Shuffle: the cups swap places (Easy 5 swaps, Medium 10, Hard 18).
//   Pick:    number labels appear (cups are numbered by their final
//            position, left to right); 10 s to tap a cup number.
//   Reveal:  the ball's cup lifts. Every right pick scores 100. No speed
//            bonus: this game is about accuracy. No answer is wrong.
// Final standings: points; a tie is shared (joint winners).
//
// THE HONEST SHUFFLE (hard rule): each round's whole swap sequence is
// made once, at the start of the round, from a random seed. The ball's
// final position is worked out from that same sequence, the Stage plays
// exactly that sequence, and the reveal uses exactly that result. There
// is no re-roll and no "cheat" logic anywhere. The seed and sequence are
// logged with console.debug so fairness can be checked.
//
// AGE LOCK (hard rule): 18+ forfeits (always optional, with a Pass) exist
// only in the 18+ module, and only from an 18+ forfeits file.
//
// A self-paced module (see ../../MINIGAME-MODULES.md). Guests act with
// { type: 'answer', seat, choice: 0..cups-1 (cup number - 1), seq } and
// { type: 'pass-forfeit', seat }; the host with { type: 'host', cmd:
// 'start-round' | 'reveal' | 'standings' | 'end' | 'settings', settings }.
// ====================================================================

import { ageLockError } from './vernacular-vault.js';

export const MAX_PLAYERS = 16;
export const POINTS = 100;
export const CUPS = [3, 4, 5];
export const ROUNDS = [3, 5, 10];
export const DIFFICULTIES = {
  easy: { swaps: 5, swapMs: 700 },
  medium: { swaps: 10, swapMs: 450 },
  hard: { swaps: 18, swapMs: 250 }
};
export const DROP_MS = 2800;        // the ball is shown, then its cup comes down
export const DROP_LOWER_MS = 1400;  // when, in the drop, the cup comes down
export const SETTLE_MS = 400;       // after the last swap, before the labels
export const PICK_MS = 10000;
export const AUTO_HOST_MS = 2500;
export const AUTO_REVEAL_MS = 5000; // no host: how long the reveal stays up
export const AUTO_PLAY_MS = 1500;

// Each skin's narrator line ids.
export const LINES_12 = { drop: 'CUP-01', shuffle: 'CUP-02', stop: 'CUP-03', correct: 'CUP-04', wrong: 'CUP-05', timeout: 'CUP-06', everyone: 'CUP-07', hard: 'CUP-08' };
export const LINES_18 = { drop: 'CUP18-01', shuffle: 'CUP18-02', stop: 'CUP18-03', correct: 'CUP18-04', wrong: 'CUP18-05', timeout: 'CUP18-06', forfeit: 'CUP18-07', hard: 'CUP18-08' };

// A small seeded generator (mulberry32), so a seed always gives the same
// sequence: anyone can re-run it from the logged seed.
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The whole round from one seed: where the ball starts (a position, which
// is also its cup's number before the shuffle) and the list of position
// pairs to swap. The same pair never comes twice in a row (it would undo
// itself).
export function makeShuffle(seed, cups, swapCount) {
  const r = seededRandom(seed);
  const ballStart = Math.floor(r() * cups);
  const swaps = [];
  let last = '';
  while (swaps.length < swapCount) {
    const a = Math.floor(r() * cups);
    const b = (a + 1 + Math.floor(r() * (cups - 1))) % cups;
    const pair = a < b ? [a, b] : [b, a];
    const key = pair.join('-');
    if (key === last) continue;
    last = key;
    swaps.push(pair);
  }
  return { ballStart, swaps };
}

// Plays a swap sequence: order[position] = cup (cups named by where they
// started). Returns the order after the first `upTo` swaps.
export function orderAfter(cups, swaps, upTo = swaps.length) {
  const order = Array.from({ length: cups }, (_, i) => i);
  swaps.slice(0, upTo).forEach(([a, b]) => { [order[a], order[b]] = [order[b], order[a]]; });
  return order;
}

// Where the ball ends up: a position, 0-based (the cup number is this + 1).
export function finalPosition(cups, ballStart, swaps) {
  return orderAfter(cups, swaps).indexOf(ballStart);
}

// makeModule({ id, name, ageRating, lineIds, forfeitsAllowed, skin }) -> a module
export function makeModule(cfg) {
  const { id, name, ageRating, lineIds, forfeitsAllowed = false, skin } = cfg;

  function create({ players, options = {}, rng = Math.random }) {
    const lines = options.lines || {};
    const errors = [];
    let forfeitList = [];
    // options.forfeitsFile: the shared forfeits file (18+ module only).
    if (forfeitsAllowed && options.forfeitsFile) {
      const err = ageLockError(options.forfeitsFile, '18+', 'forfeit list');
      if (err) errors.push('Forfeits: ' + err); else forfeitList = (options.forfeitsFile.forfeits || []).filter((f) => typeof f === 'string' && f.trim());
    }
    const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);
    const settings = {
      cups: pick(Number(options.cups), CUPS, 3),
      difficulty: pick(options.difficulty, Object.keys(DIFFICULTIES), 'medium'),
      rounds: pick(Number(options.rounds), ROUNDS, 5),
      forfeits: forfeitsAllowed && forfeitList.length ? options.forfeits === true : false // off by default
    };
    const autoHost = !!options.autoHost;
    const autoPlay = !!options.autoPlay;
    const table = players.slice(0, MAX_PLAYERS).map((p) => ({ seat: p.seat, title: p.title, score: 0, correct: 0, away: false }));

    let phase = 'lobby';    // lobby | drop | shuffle | pick | reveal | final
    let done = false;
    let seq = 0;
    let number = 0;         // rounds played
    let round = null;       // { number, seed, cups, difficulty, swapMs, ballStart, swaps, answer (0-based position) }
    let answers = {};       // seat -> position picked (0-based)
    let elapsed = 0;        // in the current phase
    let reveal = null;      // { answer, counts, correctSeats, noAnswer, everyone }
    let forfeits = {};      // seat -> text
    let showStandings = false;
    let lastLine = '';
    let idle = 0;

    function narrate(events, key) {
      const lineId = lineIds[key];
      if (!lineId) return;
      lastLine = lines[lineId] || '';
      events.push({ type: 'narrate', id: lineId, text: lastLine });
    }
    const present = () => table.filter((p) => !p.away);
    const shuffleMs = () => (round ? round.swaps.length * round.swapMs + SETTLE_MS : 0);

    // A new round: the seed, the swaps and the answer, all at once.
    function startRound(events) {
      const diff = DIFFICULTIES[settings.difficulty];
      const seed = Math.floor(rng() * 4294967296) >>> 0;
      const { ballStart, swaps } = makeShuffle(seed, settings.cups, diff.swaps);
      number += 1;
      round = { number, seed, cups: settings.cups, difficulty: settings.difficulty, swapMs: diff.swapMs, ballStart, swaps, answer: finalPosition(settings.cups, ballStart, swaps) };
      // Debug only: the fairness check. Re-run makeShuffle(seed, cups, swaps) to confirm.
      console.debug('[' + id + '] round ' + number + ': seed ' + seed + ', ' + round.cups + ' cups, ball starts under cup ' + (ballStart + 1) + ', swaps ' + JSON.stringify(swaps.map(([a, b]) => [a + 1, b + 1])) + ', ends under cup ' + (round.answer + 1));
      answers = {};
      forfeits = {};
      reveal = null;
      showStandings = false;
      elapsed = 0;
      idle = 0;
      phase = 'drop';
      narrate(events, 'drop');
      seq += 1;
      events.push({ type: 'round', number });
    }

    function closePick(events) {
      const counts = Array.from({ length: round.cups }, () => 0);
      Object.values(answers).forEach((pos) => { counts[pos] += 1; });
      const correctSeats = table.filter((p) => answers[p.seat] === round.answer).map((p) => p.seat);
      const noAnswer = table.filter((p) => answers[p.seat] === undefined).map((p) => p.seat);
      correctSeats.forEach((seat) => { const p = table.find((x) => x.seat === seat); p.score += POINTS; p.correct += 1; });
      const here = present();
      const everyone = here.length > 0 && here.every((p) => correctSeats.includes(p.seat));
      if (noAnswer.some((seat) => !table.find((x) => x.seat === seat).away)) narrate(events, 'timeout');
      if (everyone && lineIds.everyone) narrate(events, 'everyone');
      else narrate(events, correctSeats.length ? 'correct' : 'wrong');
      // 18+ forfeits: every guest here who picked wrong or ran out of time.
      if (settings.forfeits && forfeitList.length) {
        here.forEach((p) => { if (answers[p.seat] !== round.answer) forfeits[p.seat] = forfeitList[Math.floor(rng() * forfeitList.length)]; });
        if (Object.keys(forfeits).length) narrate(events, 'forfeit');
      }
      reveal = { answer: round.answer, counts, correctSeats, noAnswer, everyone };
      phase = 'reveal';
      elapsed = 0;
      idle = 0;
      seq += 1;
      if (number >= settings.rounds) finish(events);
    }

    function standings() {
      const sorted = table.slice().sort((a, b) => b.score - a.score);
      let rank = 0;
      return sorted.map((p, i) => {
        if (i === 0 || p.score !== sorted[i - 1].score) rank = i + 1;
        return { seat: p.seat, title: p.title, score: p.score, correct: p.correct, rank };
      });
    }

    // After the last round: its reveal stays up; Show Standings (the host's
    // main command now) brings the leaderboard.
    function finish() {
      phase = 'final';
      showStandings = false;
      seq += 1;
    }

    function endGame(events) {
      if (done) return;
      done = true;
      seq += 1;
      events.push({ type: 'end', result: result() });
    }

    function result() {
      const top = standings().filter((x) => x.rank === 1 && x.score > 0).map((x) => x.seat);
      return { winners: top, scores: Object.fromEntries(table.map((p) => [p.seat, p.score])) };
    }

    function primary() {
      if (done || phase === 'drop' || phase === 'shuffle') return null;
      if (phase === 'pick') return 'reveal';
      if (phase === 'final') return showStandings ? null : 'standings';
      return 'start-round';
    }

    function host(events, action) {
      const cmd = action.cmd;
      if (cmd === 'end') { endGame(events); return; }
      // Cups and difficulty can change between rounds; rounds and forfeits before the first.
      if (cmd === 'settings' && (phase === 'lobby' || phase === 'reveal') && action.settings) {
        const s = action.settings;
        if (s.cups !== undefined) settings.cups = pick(Number(s.cups), CUPS, settings.cups);
        if (s.difficulty !== undefined) settings.difficulty = pick(s.difficulty, Object.keys(DIFFICULTIES), settings.difficulty);
        if (phase === 'lobby') {
          if (s.rounds !== undefined) settings.rounds = pick(Number(s.rounds), ROUNDS, settings.rounds);
          if (s.forfeits !== undefined && forfeitsAllowed && forfeitList.length) settings.forfeits = s.forfeits === true;
        }
        seq += 1;
        events.push({ type: 'settings' });
        return;
      }
      if (cmd === 'standings' && (phase === 'lobby' || phase === 'reveal' || phase === 'final')) { showStandings = !showStandings; seq += 1; events.push({ type: 'standings' }); return; }
      // Reveal: the host locks everyone in early.
      if (cmd === 'reveal' && phase === 'pick') { closePick(events); return; }
      if (cmd === 'start-round' && (phase === 'lobby' || phase === 'reveal')) startRound(events);
    }

    function answer(events, p, pos) {
      answers[p.seat] = pos;
      seq += 1;
      events.push({ type: 'answered', seat: p.seat });
      // Everyone here has picked: reveal now.
      if (present().every((x) => answers[x.seat] !== undefined)) closePick(events);
    }

    return {
      id,
      selfPaced: true,
      get done() { return done; },

      start() { return [{ type: 'start' }]; },

      act(action) {
        const events = [];
        if (done || !action) return events;
        if (action.type === 'host') { host(events, action); return events; }
        const p = table.find((x) => x.seat === action.seat);
        if (!p) return events;
        // Gone: they keep their score; picks they miss are "No answer". Nobody waits for them.
        if (action.type === 'disconnect') { p.away = true; seq += 1; events.push({ type: 'presence' }); if (phase === 'pick' && present().length && present().every((x) => answers[x.seat] !== undefined)) closePick(events); return events; }
        if (action.type === 'reconnect') { p.away = false; seq += 1; events.push({ type: 'presence' }); return events; }
        if (action.type === 'pass-forfeit') { if (forfeits[p.seat]) { delete forfeits[p.seat]; seq += 1; events.push({ type: 'forfeit-passed', seat: p.seat }); } return events; }
        if (action.type !== 'answer' || phase !== 'pick' || p.away || answers[p.seat] !== undefined) return events;
        if (action.seq !== undefined && action.seq !== seq) return events;
        const pos = Number(action.choice);
        if (!(Number.isInteger(pos) && pos >= 0 && pos < round.cups)) return events;
        answer(events, p, pos);
        return events;
      },

      tick(ms) {
        const events = [];
        if (done) return events;
        if (phase === 'drop') {
          elapsed += ms;
          if (elapsed >= DROP_MS) {
            phase = 'shuffle';
            elapsed = 0;
            narrate(events, round.difficulty === 'hard' ? 'hard' : 'shuffle');
            seq += 1;
          }
          return events;
        }
        if (phase === 'shuffle') {
          elapsed += ms;
          if (elapsed >= shuffleMs()) {
            phase = 'pick';
            elapsed = 0;
            narrate(events, 'stop');
            seq += 1;
            events.push({ type: 'pick' });
          }
          return events;
        }
        if (phase === 'pick') {
          const before = Math.ceil((PICK_MS - elapsed) / 1000);
          elapsed += ms;
          // Time's up: anyone left is "No answer" (wrong).
          if (elapsed >= PICK_MS) { closePick(events); return events; }
          if (Math.ceil((PICK_MS - elapsed) / 1000) !== before) events.push({ type: 'timer' });
          if (autoPlay && elapsed >= AUTO_PLAY_MS) present().forEach((p) => { if (answers[p.seat] === undefined && phase === 'pick') answer(events, p, Math.floor(rng() * round.cups)); });
          return events;
        }
        if (phase === 'reveal' || phase === 'final') elapsed += ms;
        idle += ms;
        if (autoHost) {
          if (phase === 'lobby' && idle >= AUTO_HOST_MS) { idle = 0; startRound(events); }
          else if (phase === 'reveal' && idle >= AUTO_REVEAL_MS) { idle = 0; startRound(events); }
          else if (phase === 'final' && idle >= AUTO_REVEAL_MS) { idle = 0; if (!showStandings) { showStandings = true; seq += 1; events.push({ type: 'standings' }); } else endGame(events); }
        }
        return events;
      },

      // The answer is only sent once the picks are closed. The swaps are
      // sent from the start of the shuffle (the Stage plays them); phones
      // never animate them.
      get state() {
        const closed = phase === 'reveal' || phase === 'final';
        const showSwaps = phase === 'shuffle' || phase === 'pick' || closed;
        return {
          id,
          skin,
          ageRating,
          phase,
          done,
          seq,
          settings: { ...settings },
          forfeitsAvailable: forfeitsAllowed && forfeitList.length > 0,
          errors: errors.slice(),
          primary: primary(),
          number,
          rounds: settings.rounds,
          elapsed,
          round: round ? { number: round.number, cups: round.cups, difficulty: round.difficulty, swapMs: round.swapMs, ballStart: round.ballStart, swaps: showSwaps ? round.swaps.map((s) => s.slice()) : [], answer: closed ? round.answer : null } : null,
          timer: phase === 'pick' ? { left: Math.max(0, PICK_MS - elapsed), total: PICK_MS } : null,
          answered: Object.keys(answers),
          answers: closed ? { ...answers } : {},
          reveal: reveal ? { ...reveal, counts: reveal.counts.slice() } : null,
          forfeits: { ...forfeits },
          showStandings,
          standings: standings(),
          players: table.map((p) => ({ seat: p.seat, title: p.title, score: p.score, correct: p.correct, away: p.away })),
          line: lastLine,
          result: done ? result() : null
        };
      },

      end() { endGame([]); return result(); }
    };
  }

  return { id, name, ageRating, selfPaced: true, forfeitsAllowed, create };
}

const mod = makeModule({ id: 'goblet-glance', name: 'Goblet Glance', ageRating: '12+', lineIds: LINES_12, forfeitsAllowed: false, skin: 'velvet' });
export const id = mod.id;
export const name = mod.name;
export const ageRating = mod.ageRating;
export const selfPaced = true;
export const create = mod.create;
