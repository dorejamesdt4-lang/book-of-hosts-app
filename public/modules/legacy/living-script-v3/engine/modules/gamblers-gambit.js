// ====================================================================
// MINI-GAME MODULE · THE GAMBLER'S GAMBIT (family version)
// A street-dice game in the Storybook style, played for gold crowns —
// never money, nothing to buy, no prizes of value.
//
// Everyone starts with 10 crowns. Players shoot in seat order, 3 rounds
// each (the host can change this). A round is a come-out roll and, if a
// point is set, point rolls until it's decided:
//   natural (7/11) or hitting the point   +3 crowns
//   craps (2/3/12)                        -2 crowns
//   seven-out                             -2 crowns and a party forfeit
// Forfeits ("pass the parcel"): skip your next round, do an impression,
// or pay a compliment in character. Crowns never go below 0. The
// richest player wins; a tie shares the win.
//
// The adult variant (The Wanker's Street Craps) is adult-room only and
// is not built.
// ====================================================================

import { rollDice, comeOut, pointRoll } from '../dice.js';

export const id = 'gamblers-gambit';
export const name = "The Gambler's Gambit";
export const START_CROWNS = 10;
export const WIN_CROWNS = 3;
export const LOSE_CROWNS = 2;
export const DEFAULT_ROUNDS = 3;

const FORFEITS = [
  { id: 'skip', text: 'skips their next round' },
  { id: 'impression', text: 'does their best impression of another character' },
  { id: 'compliment', text: 'pays another player a compliment, in character' }
];

// Commentary, in character and family-clean. {name} is the shooter.
const LINES = {
  shooter: ['{name} steps up to the table.', 'The dice pass to {name}.', 'All eyes on {name}.'],
  natural: ['A natural! Fortune smiles on {name}.', 'Seven heaven! {name} wins the round.', 'Eleven! {name} could not have planned it better.'],
  craps: ['Craps! The dice are unkind to {name}.', 'Oh dear. {name} rolls craps.', 'The table groans. Craps for {name}.'],
  point: ['The point is {point}. Roll it again before a seven, {name}.', '{point} it is. Can {name} find it again?'],
  again: ['Not yet. Roll again, {name}.', 'Close, but the point waits. Again, {name}.', 'The dice keep their secret. Once more, {name}.'],
  hit: ['{name} hits the point! Well rolled.', 'There it is! {name} finds the {point}.', 'Bravo! The point comes home for {name}.'],
  sevenOut: ['Seven out! Bad luck, {name}.', 'The seven arrives first. {name} is out.', 'Seven! The round slips away from {name}.'],
  skipped: ['{name} sits this round out, as the forfeit demands.'],
  end: ['The dice are still. Let us count the crowns.']
};

function say(kind, vars, rng) {
  const list = LINES[kind];
  const line = list[Math.floor(rng() * list.length)];
  return line.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
}

// create({ players: [{ seat, title }], options: { rounds }, rng })
export function create({ players, options = {}, rng = Math.random }) {
  const rounds = Math.max(1, Math.min(10, Number(options.rounds) || DEFAULT_ROUNDS));
  const table = players.map((p) => ({ seat: p.seat, title: p.title, crowns: START_CROWNS, roundsLeft: rounds, skipNext: false }));
  let turn = -1;        // index into table of the current shooter
  let point = null;
  let done = false;
  let lastRoll = null;  // { dice, total }
  let lastLine = '';
  let forfeit = null;   // { seat, text } from the latest seven-out

  const shooter = () => (turn >= 0 ? table[turn] : null);

  function advance(events) {
    point = null;
    for (let tries = 0; tries < table.length * 2; tries++) {
      if (table.every((p) => p.roundsLeft <= 0)) break;
      turn = (turn + 1) % table.length;
      const p = table[turn];
      if (p.roundsLeft <= 0) continue;
      if (p.skipNext) {
        p.skipNext = false;
        p.roundsLeft -= 1;
        events.push({ type: 'skipped', seat: p.seat, line: say('skipped', { name: p.title }, rng) });
        continue;
      }
      lastLine = say('shooter', { name: p.title }, rng);
      events.push({ type: 'shooter', seat: p.seat, line: lastLine });
      return;
    }
    done = true;
    lastLine = say('end', {}, rng);
    events.push({ type: 'end', line: lastLine, result: result() });
  }

  function result() {
    const best = Math.max(...table.map((p) => p.crowns));
    return {
      winners: table.filter((p) => p.crowns === best).map((p) => p.seat),
      scores: Object.fromEntries(table.map((p) => [p.seat, p.crowns]))
    };
  }

  function settle(p, delta) {
    p.crowns = Math.max(0, p.crowns + delta);
  }

  return {
    id,
    get done() { return done; },

    start() {
      const events = [{ type: 'start', rounds }];
      advance(events);
      return events;
    },

    // act({ type: 'roll', seat }) — only the current shooter may roll.
    act(action) {
      if (done || !action || action.type !== 'roll') return [];
      const p = shooter();
      if (!p || (action.seat && action.seat !== p.seat)) return [];
      const dice = rollDice(rng);
      const total = dice[0] + dice[1];
      lastRoll = { dice, total };
      forfeit = null;
      const events = [];
      const vars = { name: p.title, point: point || total };
      let outcome;
      if (point === null) {
        outcome = comeOut(total);
        if (outcome === 'natural') settle(p, WIN_CROWNS);
        if (outcome === 'craps') settle(p, -LOSE_CROWNS);
        if (outcome === 'point') point = total;
      } else {
        outcome = pointRoll(total, point);
        if (outcome === 'hit') settle(p, WIN_CROWNS);
        if (outcome === 'seven-out') {
          settle(p, -LOSE_CROWNS);
          const f = FORFEITS[Math.floor(rng() * FORFEITS.length)];
          if (f.id === 'skip') p.skipNext = true;
          forfeit = { seat: p.seat, text: p.title + ' ' + f.text + '.' };
        }
      }
      const key = { natural: 'natural', craps: 'craps', point: 'point', again: 'again', hit: 'hit', 'seven-out': 'sevenOut' }[outcome];
      lastLine = say(key, { ...vars, point: point || total }, rng);
      events.push({ type: 'roll', seat: p.seat, dice, total, outcome, point, crowns: p.crowns, line: lastLine });
      if (forfeit) events.push({ type: 'forfeit', seat: p.seat, line: forfeit.text });
      if (outcome !== 'point' && outcome !== 'again') {
        p.roundsLeft -= 1;
        advance(events);
      }
      return events;
    },

    // What every screen draws.
    get state() {
      const p = shooter();
      return {
        id,
        rounds,
        done,
        shooter: done || !p ? null : p.seat,
        point,
        lastRoll,
        line: lastLine,
        forfeit,
        players: table.map((x) => ({ seat: x.seat, title: x.title, crowns: x.crowns, roundsLeft: x.roundsLeft, skipNext: x.skipNext })),
        result: done ? result() : null
      };
    },

    end() {
      done = true;
      return result();
    }
  };
}
