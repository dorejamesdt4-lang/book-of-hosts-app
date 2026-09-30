// lib/forge-assembler.js
//
// The Forge's cast assembler -- pure procedural JS, no LLM calls, no
// external API. Given the full list of stored archetype variants
// (fetched by forge.html from /api/archetype-list, the KV-backed
// template bank) and a guest count, this randomly assigns each guest
// an archetype and a variant, fills the {other_character}/{victim}
// slot placeholders, and picks exactly one culprit -- preferring a
// guilty-flavored variant for that guest's archetype when one exists.
//
// No acts, clues, or pacing logic here -- just the flat character
// list. That's a later phase, per the brief.

var PLACEHOLDER_NAMES = [
  'Alex', 'Jordan', 'Sam', 'Riley', 'Morgan', 'Casey',
  'Taylor', 'Jamie', 'Drew', 'Reese', 'Quinn', 'Avery',
];

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

function fillSlots(text, otherName) {
  if (!text) return text;
  return text
    .replace(/\{victim\}/g, 'the victim')
    .replace(/\{other_character\}/g, otherName || 'another guest');
}

// variants: the flat array from GET /api/archetype-list (each item has
// at least { archetype, persona_flavor_text, personality_traits,
// secret_template, is_guilty }). archetypeLabels: { slug: label }.
export function assembleCast(variants, guestCount, archetypeLabels) {
  var byArchetype = {};
  (variants || []).forEach(function (v) {
    if (!byArchetype[v.archetype]) byArchetype[v.archetype] = [];
    byArchetype[v.archetype].push(v);
  });

  var availableArchetypes = Object.keys(byArchetype);
  if (!availableArchetypes.length) {
    return { characters: [], error: 'No archetype variants are stored yet -- add some in the Archetype Forge below.' };
  }

  var names = shuffle(PLACEHOLDER_NAMES).slice(0, guestCount);

  // 1. Assign an archetype per guest -- shuffled batches, so duplicates
  // only happen once every distinct archetype has been used at least
  // once in the current batch.
  var archetypePool = [];
  var assignments = [];
  for (var i = 0; i < guestCount; i++) {
    if (archetypePool.length === 0) archetypePool = shuffle(availableArchetypes);
    assignments.push({
      index: i,
      name: names[i] || ('Guest ' + (i + 1)),
      archetype: archetypePool.pop(),
    });
  }

  // 2. Pick exactly one culprit.
  var culpritIndex = Math.floor(Math.random() * guestCount);

  // 3. Pick a variant per guest. The culprit prefers a guilty-flavored
  // variant for their archetype when one exists; everyone else avoids
  // guilty-flavored variants when a non-guilty option exists, so the
  // "guilty" flavor stays a meaningful signal reserved for the culprit.
  assignments.forEach(function (a) {
    var pool = byArchetype[a.archetype];
    if (a.index === culpritIndex) {
      var guiltyPool = pool.filter(function (v) { return v.is_guilty; });
      a.variant = pickRandom(guiltyPool.length ? guiltyPool : pool);
    } else {
      var nonGuiltyPool = pool.filter(function (v) { return !v.is_guilty; });
      a.variant = pickRandom(nonGuiltyPool.length ? nonGuiltyPool : pool);
    }
  });

  // 4. Fill slots -- {other_character} references a different,
  // already-assigned guest in the same cast.
  var characters = assignments.map(function (a) {
    var others = assignments.filter(function (o) { return o.index !== a.index; });
    var otherName = others.length ? pickRandom(others).name : 'another guest';

    return {
      guest_index: a.index,
      name: a.name,
      archetype: a.archetype,
      archetype_label: (archetypeLabels && archetypeLabels[a.archetype]) || a.archetype,
      persona_flavor_text: fillSlots(a.variant.persona_flavor_text, otherName),
      personality_traits: fillSlots(a.variant.personality_traits, otherName),
      secret: fillSlots(a.variant.secret_template, otherName),
      is_culprit: a.index === culpritIndex,
    };
  });

  return { characters: characters, error: null };
}
