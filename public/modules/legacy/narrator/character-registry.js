// ====================================================================
// CHARACTER REGISTRY -- the single source of truth for every character
// the Forge knows about, read from ../characters.json (the site-wide
// registry). Each entry supplies:
//   slug            id, also the speaker name in scripts ("WIZARD:")
//   name            display name ("Tavern Storyteller:" also matches)
//   path            sprite build, repo-root-relative
//   thumbnail       hero-grid image, repo-root-relative
//   default_voice   Kokoro voice id
//   mouth           { x, y, width, height } fully-open mouth rect in
//                   sprite pixels on the 64x64 grid
//   title, role     cast-card name and subtitle ("The Wandering Oracle",
//                   "Seer of the Veil")
//   voice_profile   { slug, label } written voice profile cast for them;
//                   characters without one are "awaiting a voice"
//   sample_line     example script shown until the user writes their own
// Entries with no path (status "pending") have no animation yet; they
// are listed by getPendingCharacters() and never go on stage.
// Add a character there and it appears in the hero grid, the Character
// voices list and multi-voice scripts with no code changes.
// ====================================================================

export const REGISTRY_URL = '../characters.json';

// Used for any character whose entry has no (valid) mouth rect yet.
export const DEFAULT_MOUTH = { x: 27, y: 26, width: 10, height: 4 };
export const DEFAULT_VOICE = 'bf_emma';

let rawRegistry = null; // parsed file, kept so COPY CONFIG can re-emit it
let characters = [];
let pending = [];
const byId = new Map();
const byName = new Map();

function normaliseName(name) {
  return String(name || '').trim().toLowerCase().replace(/[\s_-]+/g, ' ');
}

function validMouth(m) {
  return m && [m.x, m.y, m.width, m.height].every(Number.isFinite) && m.width >= 1 && m.height >= 1;
}

export async function loadRegistry() {
  const res = await fetch(REGISTRY_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('request failed: ' + res.status);
  rawRegistry = await res.json();
  const entries = Array.isArray(rawRegistry.characters) ? rawRegistry.characters : [];

  characters = [];
  pending = [];
  byId.clear();
  byName.clear();
  entries.forEach((entry) => {
    if (!entry || !entry.slug) return;
    if (!entry.path) {
      pending.push({
        id: entry.slug,
        name: entry.name || entry.slug,
        title: entry.title || entry.name || entry.slug,
        role: entry.role || '',
        pendingLabel: entry.pending_label || ''
      });
      return;
    }
    const profile = entry.voice_profile;
    const character = {
      id: entry.slug,
      name: entry.name || entry.slug,
      title: entry.title || entry.name || entry.slug,
      role: entry.role || '',
      voiceProfile: profile && profile.slug ? { slug: profile.slug, label: profile.label || profile.slug } : null,
      sampleLine: entry.sample_line || '',
      path: entry.path,
      thumbnail: entry.thumbnail || '',
      defaultVoice: entry.default_voice || DEFAULT_VOICE,
      mouth: validMouth(entry.mouth) ? { ...entry.mouth } : { ...DEFAULT_MOUTH },
      entry
    };
    characters.push(character);
    byId.set(character.id, character);
    byName.set(normaliseName(character.id), character);
    byName.set(normaliseName(character.name), character);
  });
  return characters;
}

export function getCharacters() {
  return characters;
}

export function getPendingCharacters() {
  return pending;
}

export function getCharacter(id) {
  return byId.get(id) || null;
}

// Case-insensitive match on id or display name ("storyteller",
// "Tavern Storyteller", "TAVERN  STORYTELLER" all match).
export function findCharacterByName(name) {
  return byName.get(normaliseName(name)) || null;
}

export function getMouth(id) {
  const c = byId.get(id);
  return c ? c.mouth : DEFAULT_MOUTH;
}

// Calibration mode edits positions in memory; COPY CONFIG writes them out.
export function setMouth(id, rect) {
  const c = byId.get(id);
  if (!c) return;
  c.mouth = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  c.entry.mouth = { ...c.mouth };
}

// The whole registry file with current mouth positions, formatted like
// the hand-written original (primitive arrays and mouth rects on one
// line) so it can be pasted straight over ../characters.json.
export function registryJSON() {
  function fmt(value, indent) {
    const pad = '  '.repeat(indent);
    const inner = '  '.repeat(indent + 1);
    if (Array.isArray(value)) {
      if (value.every((v) => v === null || typeof v !== 'object')) {
        return '[' + value.map((v) => JSON.stringify(v)).join(', ') + ']';
      }
      return '[\n' + value.map((v) => inner + fmt(v, indent + 1)).join(',\n') + '\n' + pad + ']';
    }
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.every((k) => typeof value[k] === 'number')) {
        return '{ ' + keys.map((k) => JSON.stringify(k) + ': ' + value[k]).join(', ') + ' }';
      }
      return '{\n' + keys.map((k) => inner + JSON.stringify(k) + ': ' + fmt(value[k], indent + 1)).join(',\n') + '\n' + pad + '}';
    }
    return JSON.stringify(value);
  }
  return fmt(rawRegistry || { characters: [] }, 0) + '\n';
}
