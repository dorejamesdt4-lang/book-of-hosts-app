// ====================================================================
// ENGINE · THEME PACKS AND VOICES — which voice speaks what, and every
// line the show needs voiced in advance. Pure: the page passes in the
// saved choices (`prefs`) instead of the engine reading storage.
//
//   prefs = {
//     recast(packId, seat)  -> voice id the host chose in the Lobby, or null
//     wardrobeVoice(seat)   -> voice id the guest chose in the Wardrobe, or null
//   }
// ====================================================================

import { castInSeatOrder, narratorTexts, setLine } from './script.js';

export function packById(packs, id) {
  return packs.find((p) => p.id === id) || packs[0];
}

// Pre-selected voices: each seat, in seat order, gets the first voice in
// the pack's pool matching its voice_hint that isn't taken yet.
export function suggestedVoices(game, pack) {
  const taken = new Set();
  const out = {};
  castInSeatOrder(game).forEach((c) => {
    const pool = pack.voice_pool;
    const pick = pool.find((v) => v.gender === c.voice_hint && !taken.has(v.id)) ||
      pool.find((v) => !taken.has(v.id)) || pool[0];
    taken.add(pick.id);
    out[c.character] = pick.id;
  });
  return out;
}

// Host re-cast beats the guest's own pick (game theme only), which
// beats the suggestion.
export function voiceFor(game, pack, seat, prefs) {
  const pool = new Set(pack.voice_pool.map((v) => v.id));
  const recast = prefs && prefs.recast(pack.id, seat);
  if (recast && pool.has(recast)) return recast;
  if (pack.id === game.game.theme) {
    const own = prefs && prefs.wardrobeVoice(seat);
    if (own && pool.has(own)) return own;
  }
  return suggestedVoices(game, pack)[seat];
}

export function voiceLabel(pack, id) {
  const v = pack.voice_pool.find((x) => x.id === id);
  return v ? v.label : id;
}

// Pitch is applied at playback (a rate change), so lines are generated
// at pace / rate to keep the pace right.
export function pitchRate(semitones) {
  return Math.pow(2, (semitones || 0) / 12);
}

export function narratorVoice(pack) {
  const rate = pitchRate(pack.narrator.pitch);
  return { voice: pack.narrator.voice, speed: pack.narrator.pace / rate, rate };
}

export function characterVoice(game, pack, seat, prefs) {
  return { voice: voiceFor(game, pack, seat, prefs), speed: 1, rate: 1 };
}

// Everything to voice before the show.
//   online:  every narrator line + every suggested line in its
//            character's voice
//   theatre: narrator lines (unless the host reads them) + each turn's
//            set line in the narrator's voice, for the Stand-in button
export function speechItems(game, pack, prefs, { mode = 'online', narration = 'voice' } = {}) {
  const n = narratorVoice(pack);
  const items = [];
  if (mode !== 'theatre' || narration === 'voice') {
    narratorTexts(game).forEach((text) => items.push({ text, voice: n.voice, speed: n.speed }));
  }
  game.beats.forEach((b) => {
    if (b.type !== 'character_turn') return;
    if (mode === 'theatre') {
      const line = setLine(b);
      if (line) items.push({ text: line.text, voice: n.voice, speed: n.speed });
    } else {
      const c = characterVoice(game, pack, b.character, prefs);
      b.lines.forEach((l) => items.push({ text: l.text, voice: c.voice, speed: c.speed }));
    }
  });
  return items;
}

export function itemKey(item) {
  return item.voice + '|' + Number(item.speed).toFixed(3) + '|' + item.text;
}
