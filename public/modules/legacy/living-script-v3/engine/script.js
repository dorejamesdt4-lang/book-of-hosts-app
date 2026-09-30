// ====================================================================
// ENGINE · MASTER SCRIPT — reading a master script (schema 1 or 2) and
// the small facts every screen asks of it. No DOM, no storage, no audio.
// ====================================================================

export const SUPPORTED_SCHEMAS = [1, 2];
export const PLAY_MODES = ['online', 'theatre', 'pdf'];
export const MUSIC_MOODS = ['mingle', 'tension', 'intermission', 'minigame', 'reveal', 'party'];
export const TONES = ['deflect', 'accuse', 'reveal', 'jest'];

// Schema 1 had one `mode` ("narrator" | "pdf" | "both"); schema 2 lists
// the ways the host may play it.
export function playModes(game) {
  const g = game.game || {};
  if (Array.isArray(g.play_modes) && g.play_modes.length) return g.play_modes.filter((m) => PLAY_MODES.includes(m));
  if (g.mode === 'pdf') return ['pdf'];
  if (g.mode === 'narrator') return ['online', 'pdf'];
  return ['online', 'theatre', 'pdf'];
}

export function castEntry(game, slug) {
  return game.cast.find((c) => c.character === slug) || null;
}

export function castInSeatOrder(game) {
  return [...game.cast].sort((a, b) => a.seat - b.seat);
}

export function titleOf(game, slug) {
  const c = castEntry(game, slug);
  return c ? c.title : slug;
}

export function actOf(game, beat) {
  return game.acts.find((a) => a.id === beat.act) || game.acts[0];
}

// Beat numbers are simply the 1-based position in the script, so the
// TV, the phones and the printed scripts always agree.
export function beatNumber(game, beat) {
  return game.beats.indexOf(beat) + 1;
}

// The one line per turn that the printed script shows and a stand-in
// speaks: the Reveal line (the one the plot needs).
export function setLine(beat) {
  return (beat.lines || []).find((l) => l.tone === 'reveal') || (beat.lines || [])[0] || null;
}

// "For Your Eyes Only" envelopes, numbered in script order. Private
// reveals come first; a mini-game prize (given to whoever wins) gets
// the next number.
export function envelopes(game) {
  const list = [];
  game.beats.forEach((b) => {
    if (b.type === 'private_reveal') list.push({ number: list.length + 1, beatId: b.id, character: b.character, title: b.title, text: b.text, kind: 'secret' });
  });
  game.beats.forEach((b) => {
    if (b.type === 'mini_game' && b.on_result && b.on_result.winner_clue) {
      const clue = b.on_result.winner_clue;
      list.push({ number: list.length + 1, beatId: b.id, character: null, title: clue.title, text: clue.text, kind: 'prize' });
    }
  });
  return list;
}

export function envelopeFor(game, beatId, kind) {
  return envelopes(game).find((e) => e.beatId === beatId && (!kind || e.kind === kind)) || null;
}

export function roman(n) {
  const table = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  table.forEach(([value, glyph]) => { while (n >= value) { out += glyph; n -= value; } });
  return out;
}

// Every narrator line in the script (for voicing in advance).
export function narratorTexts(game) {
  const out = [];
  game.beats.forEach((b) => {
    if (b.type === 'narration') out.push(b.text);
    if (b.type === 'character_turn' && b.nudge) out.push(b.nudge);
    if (b.type === 'private_reveal') out.push(b.announce);
    if (b.type === 'clue_drop') out.push(b.narration);
    if (b.type === 'mini_game') out.push(b.narration);
    if (b.type === 'vote') out.push(b.narration);
    if (b.type === 'finale') out.push(b.reactions.correct, b.reactions.mistaken, ...b.narration, b.closing);
  });
  return out.filter(Boolean);
}

// The minutes on a mini-game card ("5 minutes") for the theatre timer.
export function cardMinutes(card) {
  const m = /(\d+)\s*min/i.exec((card && card.time) || '');
  return m ? Number(m[1]) : 5;
}
