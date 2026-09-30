// lib/character-assigner.js
//
// Pure, DOM-free logic for the Narrator Engine's player-to-character
// assignment system: given a list of players (each with an optional
// stated gender), assigns each one a character archetype (no
// duplicates until the roster is exhausted, same shuffle-and-cycle
// pattern as lib/forge-assembler.js's archetype assignment) and picks
// the closest-matching Kokoro voice for them.
//
// "Closest-matching by gender" here means: a handful of archetypes are
// strongly gender-coded (King/Knight read male, Queen reads female) --
// those pick a voice matching the CHARACTER's coding regardless of who
// plays them, since re-voicing "the King" as female-coded would read
// as a different character. Archetypes the brief calls out as not
// strongly gendered (Oracle, Storyteller, Wizard) -- along with the
// rest of the roster -- fall back to the PLAYER's own stated gender,
// and only fall back further to a random pick when neither the
// character nor the player specifies one.
//
// The voice pool is deliberately restricted to the American + British
// English voices (the same ones the rest of the Narrator UI treats as
// primary) rather than all 54 -- assigning, say, a Mandarin or Hindi
// voice to "the Tavern Keeper" would satisfy "matching gender" but not
// the actual intent of casting a party-game narrator voice.

export const CHARACTER_ARCHETYPES = [
  { slug: 'jester', label: 'Jester', genderLean: null, avatarKind: 'jester' },
  { slug: 'queen', label: 'Queen', genderLean: 'female', avatarKind: 'queen' },
  { slug: 'knight', label: 'Knight', genderLean: 'male', avatarKind: 'knight' },
  { slug: 'king', label: 'King', genderLean: 'male', avatarKind: 'king' },
  { slug: 'dungeon_master', label: 'Dungeon Master', genderLean: null, avatarKind: 'dungeon_master' },
  { slug: 'tavern_keeper', label: 'Tavern Keeper', genderLean: null, avatarKind: 'tavern_keeper' },
  { slug: 'storyteller', label: 'Storyteller', genderLean: null, avatarKind: 'storyteller' },
  { slug: 'wizard', label: 'Wizard', genderLean: null, avatarKind: 'wizard' },
  { slug: 'detective', label: 'Detective', genderLean: null, avatarKind: 'detective' },
  { slug: 'oracle', label: 'Oracle', genderLean: null, avatarKind: 'oracle' },
];

const FEMALE_ENGLISH_VOICES = ['af_heart', 'af_alloy', 'af_aoede', 'af_bella', 'af_jessica', 'af_kore', 'af_nicole', 'af_nova', 'af_river', 'af_sarah', 'af_sky', 'bf_alice', 'bf_emma', 'bf_isabella', 'bf_lily'];
const MALE_ENGLISH_VOICES = ['am_adam', 'am_echo', 'am_eric', 'am_fenrir', 'am_liam', 'am_michael', 'am_onyx', 'am_puck', 'am_santa', 'bm_daniel', 'bm_fable', 'bm_george', 'bm_lewis'];
const ALL_ENGLISH_VOICES = FEMALE_ENGLISH_VOICES.concat(MALE_ENGLISH_VOICES);

function shuffle(arr) {
  var copy = arr.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function normalizeGender(g) {
  if (g === 'male' || g === 'female') return g;
  return null;
}

function pickVoiceFor(archetype, playerGender) {
  var effectiveGender = archetype.genderLean || normalizeGender(playerGender);
  if (effectiveGender === 'female') return pickRandom(FEMALE_ENGLISH_VOICES);
  if (effectiveGender === 'male') return pickRandom(MALE_ENGLISH_VOICES);
  return pickRandom(ALL_ENGLISH_VOICES);
}

// players: [{ gender: 'male' | 'female' | '' }, ...]. Returns an array
// of { player_index, gender, character_slug, character_label,
// avatar_kind, kokoro_voice_id }, one entry per player, in the same
// order players were given.
export function assignCharacters(players) {
  var archetypePool = [];
  return (players || []).map(function (player, index) {
    if (archetypePool.length === 0) archetypePool = shuffle(CHARACTER_ARCHETYPES);
    var archetype = archetypePool.pop();
    return {
      player_index: index,
      gender: normalizeGender(player && player.gender) || '',
      character_slug: archetype.slug,
      character_label: archetype.label,
      avatar_kind: archetype.avatarKind,
      kokoro_voice_id: pickVoiceFor(archetype, player && player.gender),
    };
  });
}
