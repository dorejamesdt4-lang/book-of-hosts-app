// ====================================================================
// ENGINE · DICE RULES — the standard rules of craps, written fresh
// (the rules are public domain; no code, images or styles are taken
// from any other dice game).
//
//   Come-out roll: 7 or 11 wins ("a natural"); 2, 3 or 12 loses
//   ("craps"); any other total becomes the point.
//   Point rolls: roll the point again before a 7 to win; a 7 first
//   loses ("seven-out"); anything else, roll again.
//
// The host's Stage is the only thing that rolls, so every screen sees
// the same result.
// ====================================================================

export function rollDice(rng = Math.random) {
  return [1 + Math.floor(rng() * 6), 1 + Math.floor(rng() * 6)];
}

// 'natural' | 'craps' | 'point'
export function comeOut(total) {
  if (total === 7 || total === 11) return 'natural';
  if (total === 2 || total === 3 || total === 12) return 'craps';
  return 'point';
}

// 'hit' | 'seven-out' | 'again'
export function pointRoll(total, point) {
  if (total === point) return 'hit';
  if (total === 7) return 'seven-out';
  return 'again';
}
