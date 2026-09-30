// lib/catalogue-rules.js
//
// The Jester catalogue's shared rules: the variant format, the automatic
// checks, and the no-AI draft generator. One file, used everywhere, so
// the checks are the same wherever they run:
//   - jester.html (generates drafts, previews the checks)
//   - functions/api/admin/* (re-runs every check before anything is saved)
//   - admin/jester-review.html (validates edits before saving)
// Plain ES module: no DOM, no network, no dependencies.
//
// A variant is a Jester-made version of a mini-game module: its settings,
// word pools and theme, with an original name and pitch. See
// docs/JESTER-PIPELINE-README.md.
//
// ctx (what the checks need):
//   metas:  { [moduleId]: meta.json }
//   pools:  { [poolId]: { ageRating, module } }       (from each meta's pools)
//   banned: shared/banned-words.json (moderation only; never shown anywhere)
//   isDuplicate: true if another variant already has this fingerprint

export const STATUSES = ['draft', 'approved', 'rejected'];
export const THEMES = ['storybook', 'victorian', 'cyberpunk', 'retro-80s-90s'];
export const SOURCE = 'seumas-jester';
export const MAX_DRAFTS = 20;
export const REQUIRED = ['id', 'baseModule', 'name', 'pitch', 'ageRating', 'players', 'settings', 'pools', 'forfeits', 'theme', 'status', 'source', 'createdAt', 'checks', 'review'];

// A pool's id is its file name ("pools/uk-slang-12.json" -> "uk-slang-12").
export const poolIdOf = (file) => String(file).split('/').pop().replace(/\.json$/i, '');

/* -------------------- banned words (moderation only) -------------------- */
const SWAPS = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };

export function normalise(text) {
  return ' ' + String(text || '').toLowerCase()
    .replace(/[013457@$]/g, (c) => SWAPS[c])
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() + ' ';
}

export function bannedList(banned) {
  const groups = (banned && banned.groups) || {};
  return Object.values(groups).flat().map((w) => normalise(w).trim()).filter(Boolean);
}

// Whole words and whole phrases only, so ordinary words that merely
// contain a banned one are never caught. Returns how many matched
// (never the words themselves, so they're not echoed anywhere).
export function bannedHits(text, banned) {
  const t = normalise(text);
  return bannedList(banned).filter((w) => t.includes(' ' + w + ' ')).length;
}

/* -------------------- helpers -------------------- */
export function stringsIn(value, skip = []) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap((v) => stringsIn(v, skip));
  if (value && typeof value === 'object') return Object.entries(value).filter(([k]) => !skip.includes(k)).flatMap(([, v]) => stringsIn(v, skip));
  return [];
}

const NAME_TOKEN = /\{\s*(guest|name|player|real)[^}]*\}/i;

// Same module, settings and pools = a duplicate.
export function fingerprint(v) {
  const settings = Object.keys(v.settings || {}).sort().map((k) => k + '=' + JSON.stringify(v.settings[k])).join('&');
  const pools = (v.pools || []).slice().sort().join(',');
  return (v.baseModule || '') + '|' + settings + '|' + pools;
}

export async function fingerprintHash(v) {
  const bytes = new TextEncoder().encode(fingerprint(v));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// The pools the checks know about, from every module's meta.json.
export function poolRegistry(metas, poolFiles = {}) {
  const out = {};
  Object.values(metas).forEach((m) => (m.pools || []).forEach((file) => {
    const id = poolIdOf(file);
    const f = poolFiles[id];
    out[id] = { id, module: m.id, ageRating: f && f.ageRating ? f.ageRating : null, name: f ? f.name || f.title || id : id, sample: f && Array.isArray(f.entries) ? f.entries.slice(0, 3) : [] };
  }));
  return out;
}

// Loads the catalogue the checks need from the site's own files.
// base: the living-script-v3/ folder URL; getJSON(url) -> Promise<object>.
export async function loadCatalogue(base, getJSON) {
  const index = await getJSON(base + 'catalogue/modules.json');
  const metas = {};
  await Promise.all((index.modules || []).map(async (id) => { metas[id] = await getJSON(base + id + '/meta.json'); }));
  const poolFiles = {};
  await Promise.all(Object.values(metas).flatMap((m) => (m.pools || []).map(async (f) => { poolFiles[poolIdOf(f)] = await getJSON(base + m.id + '/' + f).catch(() => null); })));
  const banned = await getJSON(base + 'shared/banned-words.json');
  return { metas, pools: poolRegistry(metas, poolFiles), poolFiles, banned, isDuplicate: false };
}

/* -------------------- the checks -------------------- */
// Returns { passed, notes: [..], reason } — notes log every check.
export function checkVariant(v, ctx) {
  const notes = [];
  let reason = null;
  const fail = (check, msg) => { notes.push('FAIL · ' + check + ': ' + msg); if (!reason) reason = check + ': ' + msg; };
  const pass = (check, msg) => notes.push('PASS · ' + check + (msg ? ': ' + msg : ''));

  // 4a. Required fields (first, so the others can rely on them).
  if (!v || typeof v !== 'object' || Array.isArray(v)) { fail('Required fields', 'not a variant object'); return { passed: false, notes, reason }; }
  const missing = REQUIRED.filter((k) => v[k] === undefined || (v[k] === null && k !== 'review'));
  if (missing.length) fail('Required fields', 'missing ' + missing.join(', '));
  else pass('Required fields');

  const meta = ctx.metas[v.baseModule];

  // 1. Banned words, in every text field (the words themselves are never echoed).
  const hits = bannedHits(stringsIn(v, ['id', 'createdAt', 'checks']).join(' \n '), ctx.banned);
  if (hits) fail('Banned words', hits + ' banned word' + (hits > 1 ? 's' : '') + ' found');
  else pass('Banned words', 'none found');

  // 2. The name rule: no guest-name tokens in any spoken or narrator text.
  const tokens = stringsIn(v, ['checks']).filter((s) => NAME_TOKEN.test(s));
  if (tokens.length) fail('Name rule', 'guest-name tokens such as {guest:…} are not allowed');
  else pass('Name rule', 'no guest-name tokens');

  // 3. The age lock.
  const age = [];
  if (!meta) age.push('unknown base module "' + v.baseModule + '"');
  else {
    if (v.ageRating !== meta.ageRating) age.push('rated ' + v.ageRating + ' but ' + meta.name + ' is ' + meta.ageRating);
    (v.pools || []).forEach((id) => {
      const p = ctx.pools[id];
      if (!p) age.push('unknown pool "' + id + '"');
      else if (p.module !== v.baseModule) age.push('pool "' + id + '" belongs to another game');
      else if (p.ageRating !== meta.ageRating) age.push('pool "' + id + '" is rated ' + (p.ageRating || 'nothing'));
    });
    if (v.forfeits === true && !(meta.ageRating === '18+' && meta.settings && Array.isArray(meta.settings.forfeits) && meta.settings.forfeits.includes(true))) age.push('forfeits are only for 18+ games that have them');
  }
  if (v.ageRating === '12+' && v.forfeits) age.push('a 12+ variant can never use forfeits');
  if (!['12+', '18+'].includes(v.ageRating)) age.push('ageRating must be "12+" or "18+"');
  if (age.length) fail('Age lock', age.join('; '));
  else pass('Age lock', v.ageRating);

  // 4b. Settings in range, players within the module's, pools and theme.
  const range = [];
  if (meta) {
    const allowed = meta.settings || {};
    Object.keys(v.settings || {}).forEach((k) => {
      if (k === 'forfeits') { if (v.settings.forfeits !== v.forfeits) range.push('settings.forfeits must match forfeits'); return; }
      if (!allowed[k]) range.push('"' + k + '" is not a setting of ' + meta.name);
      else if (!allowed[k].some((a) => a === v.settings[k])) range.push(k + ' = ' + JSON.stringify(v.settings[k]) + ' is out of range (' + allowed[k].map((a) => JSON.stringify(a)).join(', ') + ')');
    });
    Object.keys(allowed).filter((k) => k !== 'forfeits').forEach((k) => { if (!v.settings || v.settings[k] === undefined) range.push('missing setting ' + k); });
    const pl = v.players || {};
    if (!(Number.isInteger(pl.min) && Number.isInteger(pl.max) && pl.min >= meta.players.min && pl.max <= meta.players.max && pl.min <= pl.max)) range.push('players must be within ' + meta.players.min + '–' + meta.players.max);
    if ((meta.pools || []).length && !(Array.isArray(v.pools) && v.pools.length)) range.push('needs at least one pool');
    if (!(meta.pools || []).length && (v.pools || []).length) range.push(meta.name + ' has no word pools');
  }
  if (typeof v.forfeits !== 'boolean') range.push('forfeits must be true or false');
  if (!THEMES.includes(v.theme)) range.push('theme must be one of ' + THEMES.join(', '));
  if (!STATUSES.includes(v.status)) range.push('status must be draft, approved or rejected');
  if (typeof v.name !== 'string' || v.name.trim().length < 3 || v.name.length > 60) range.push('name must be 3–60 characters');
  if (typeof v.pitch !== 'string' || v.pitch.trim().length < 10 || v.pitch.length > 220) range.push('pitch must be 10–220 characters');
  if (typeof v.id !== 'string' || !/^v-[a-z0-9-]{4,40}$/.test(v.id)) range.push('id must look like v-abc123');
  if (isNaN(Date.parse(v.createdAt))) range.push('createdAt must be an ISO date');
  if (range.length) fail('Settings and fields', range.join('; '));
  else pass('Settings and fields', 'all in range');

  // 5. Duplicates.
  if (ctx.isDuplicate) fail('Duplicate', 'another variant already has this module, settings and pools');
  else pass('Duplicate', 'none');

  return { passed: !reason, notes, reason };
}

/* -------------------- the no-AI generator -------------------- */
const pick = (list, rng) => list[Math.floor(rng() * list.length)];

export function newId(rng = Math.random) {
  let s = '';
  for (let i = 0; i < 8; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rng() * 36)];
  return 'v-' + s;
}

// Original word lists, per game, for names and one-line pitches.
const WORDS = {
  'gamblers-gambit': {
    name: [['Crown', 'Lantern-Lit', 'Midnight', 'Gilded', 'Tavern', 'Copper'], ['Gambit', 'Dice', 'Throw', 'Table', 'Crowns']],
    pitch: (s) => (s.rounds === 1 ? 'One round each' : s.rounds + ' rounds each') + ' at the lamplit table: roll a natural, find the point, and hold on to your crowns.'
  },
  'twenty-one-trouble': {
    name: [['The Keeper\'s', 'Vault-Door', 'Midnight', 'Gilded', 'Copper-Clasp', 'Lanternside'], ['Twenty-One', 'Card Table', 'Challenge', 'Reckoning', 'Showdown']],
    pitch: (s) => (s.decks === 2 ? 'Two decks' : 'One deck') + ', ' + (s.timer ? 'a 15-second turn timer' : 'no turn timer') + ', and one watchful Vault Keeper. Twist, stick, and out-wit the vault. No betting of any kind.'
  },
  'lexical-lanterns': {
    name: [['Moonlit', 'Flickering', 'Hidden', 'Whispering', 'Starlit', 'Golden'], ['Lanterns', 'Scroll', 'Lamplight', 'Wicks', 'Glow']],
    pitch: (s, pool) => s.lanterns + ' lanterns and ' + (s.mode === 'arcade' ? 'arcade rules: a ' + s.sundial + '-minute sundial to light as much of ' + pool + ' as you can.' : 'classic rules: light up ' + pool + ', one letter at a time.')
  },
  'vernacular-vault': {
    name: [['The Speedy', 'The Grand', 'The Riddling', 'The Twisty', 'The Wordsmith\'s', 'The Midnight'], ['Word Vault', 'Slang Scroll', 'Lexicon', 'Dialect Duel', 'Phrasebook']],
    pitch: (s, pool) => s.length + ' questions of ' + pool + ', ' + ({ slang: 'word to meaning', meaning: 'meaning to word', mixed: 'mixed up both ways' })[s.roundType] + ', ' + s.timeLimit + ' seconds each' + (s.speedBonus === 'off' ? ', no speed bonus.' : ', and a ' + s.speedBonus + '× bonus for the fastest.')
  },
  'vernacular-vault-18': {
    name: [['Slang-O-Meter:'], ['Last Orders', 'Lock-In', 'Chalkboard Chaos', 'Closing Time', 'The Snug', 'Pub Quiz Carnage']],
    pitch: (s, pool, forfeits) => s.length + ' rounds of ' + pool + ' on the chalkboard, ' + s.timeLimit + ' seconds a go' + (forfeits ? ', with optional forfeits (always a Pass).' : ', no forfeits.')
  }
};

// Generates one draft: a base module, legal settings, a compatible pool,
// a theme, and an original name and pitch. ageRating: '12+', '18+' or 'any'.
export function generateVariant(ctx, { rng = Math.random, ageRating = '12+', now = new Date() } = {}) {
  const modules = Object.values(ctx.metas).filter((m) => (ageRating === 'any' || m.ageRating === ageRating) && WORDS[m.id]);
  if (!modules.length) return null;
  const meta = pick(modules, rng);
  const settings = {};
  Object.entries(meta.settings || {}).forEach(([k, list]) => { if (k !== 'forfeits') settings[k] = pick(list, rng); });
  const pools = (meta.pools || []).map(poolIdOf).filter((id) => ctx.pools[id] && ctx.pools[id].ageRating === meta.ageRating);
  const poolId = pools.length ? pick(pools, rng) : null;
  const forfeits = meta.ageRating === '18+' && meta.settings && Array.isArray(meta.settings.forfeits) ? rng() < 0.5 : false;
  const w = WORDS[meta.id];
  const poolName = poolId ? (ctx.pools[poolId].name || poolId) : '';
  return {
    id: newId(rng),
    baseModule: meta.id,
    name: pick(w.name[0], rng) + ' ' + pick(w.name[1], rng),
    pitch: w.pitch(settings, poolName, forfeits),
    ageRating: meta.ageRating,
    players: { min: meta.players.min, max: meta.players.max },
    settings,
    pools: poolId ? [poolId] : [],
    forfeits,
    theme: pick(THEMES, rng),
    status: 'draft',
    source: SOURCE,
    createdAt: now.toISOString(),
    checks: { passed: false, notes: [] },
    review: { by: null, at: null, reason: null }
  };
}

// Stamps the checks onto a variant: a failed draft becomes rejected, with the reason.
export function applyChecks(v, result) {
  const out = { ...v, checks: { passed: result.passed, notes: result.notes } };
  if (!result.passed && out.status === 'draft') {
    out.status = 'rejected';
    out.review = { by: 'automatic checks', at: new Date().toISOString(), reason: result.reason };
  }
  return out;
}
