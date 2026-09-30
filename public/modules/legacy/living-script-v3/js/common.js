// ====================================================================
// THE LIVING SCRIPT v3 — page helpers shared by every screen: loading
// the data, browser storage, the cross-tab link, and a few DOM helpers.
// Game logic lives in ../engine/ (plain modules, no page code).
//
// v3 keeps its own storage keys ("ls3.") and its own BroadcastChannel,
// so v2 (../living-script/) and v3 tabs never interfere.
// ====================================================================

import { packById } from '../engine/themes.js';
import { packToGame, nameRuleProblems } from '../engine/showpack.js';

export const GAME_URL = 'sample-game.json';
export const THEMES_URL = 'themes.json';
export const MINIGAMES_URL = 'minigames.json';
export const JUKEBOX_URL = 'jukebox/tracks.json';
export const CHARACTERS_URL = '../characters.json';
export const CHANNEL_NAME = 'living-script-v3';
export const SHOWPACK_LIBRARY_URL = 'showpacks/library.json';

/* -------------------- loading -------------------- */
async function loadJSON(url, fallback) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(url + ': ' + res.status);
    return await res.json();
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export async function loadAll() {
  const [game, themes, minigames, characters, jukebox] = await Promise.all([
    loadJSON(GAME_URL), loadJSON(THEMES_URL), loadJSON(MINIGAMES_URL), loadJSON(CHARACTERS_URL),
    loadJSON(JUKEBOX_URL, { tracks: [] })
  ]);
  return { game, themes: themes.packs || [], minigames: minigames.cards || [], characters: characters.characters || [], jukebox };
}

/* -------------------- mini-game module data -------------------- */
// Every module is listed in catalogue/modules.json and has <id>/meta.json:
// its fixed narrator lines ("lines": "lines.json", { lines: [{ id, text, audio }] })
// and its word pools ("pools": ["pools/x.json"]), relative to <id>/.
// The shared 18+ forfeits (shared/forfeits-18.json) are only ever handed
// to an 18+ module.
export const MODULE_INDEX_URL = 'catalogue/modules.json';
export const FORFEITS_18_URL = 'shared/forfeits-18.json';

const poolId = (file) => String(file).split('/').pop().replace(/\.json$/i, '');

export async function loadPool(url, id) {
  const data = await loadJSON(url);
  return { id: id || poolId(url), name: (data && (data.name || data.title)) || id || poolId(url), ageRating: data && data.ageRating ? data.ageRating : null, entries: Array.isArray(data) ? data : (data.entries || []) };
}

// { [moduleId]: { meta, lines, texts, pools, forfeitsFile } } for the given
// module ids (all of them if none are given): a page loads only the games
// it can run, so a family page never fetches an 18+ pool.
export async function loadModuleData(only = null) {
  const index = await loadJSON(MODULE_INDEX_URL, { modules: [] });
  const ids = (index.modules || []).filter((id) => !only || only.includes(id));
  const out = {};
  await Promise.all(ids.map(async (id) => {
    const meta = await loadJSON(id + '/meta.json', null);
    if (!meta) return;
    const file = meta.lines ? await loadJSON(id + '/' + meta.lines, { lines: [] }) : { lines: [] };
    const lines = Array.isArray(file.lines) ? file.lines : [];
    const pools = (await Promise.all((meta.pools || []).map((p) => loadPool(id + '/' + p, poolId(p)).catch((err) => { console.warn('Word pool not found: ' + id + '/' + p, err); return null; })))).filter(Boolean);
    const forfeitsFile = meta.ageRating === '18+' ? await loadJSON(FORFEITS_18_URL, null) : null;
    out[id] = { meta, lines, texts: Object.fromEntries(lines.map((l) => [l.id, l.text])), pools, forfeitsFile };
  }));
  return out;
}

// A self-paced module's options from the page: its narrator lines, its
// word pools (a Show Pack step's own pool, if it names one, is then the
// only choice) and, for 18+ modules, the forfeits file. Modules check the
// age rating of everything they're given.
export function moduleOptionsFor(moduleData, packPools = {}) {
  return (beat, id) => {
    const d = moduleData[id];
    if (!d) return {};
    const own = beat && beat.pool ? packPools[beat.id] : null;
    const base = { lines: d.texts, forfeitsFile: d.forfeitsFile || null };
    if (own) return { ...base, pools: [own], pool: own.id };
    // A Jester variant: only its own pools.
    if (beat && Array.isArray(beat.variant_pools) && beat.variant_pools.length) return { ...base, pools: d.pools.filter((p) => beat.variant_pools.includes(p.id)) };
    return { ...base, pools: d.pools };
  };
}

/* -------------------- Jester variants -------------------- */
// An approved Jester variant: from the public endpoint, or (offline, or
// before GAMES_DB exists) from the files catalogue-pull.js saved in
// catalogue/approved/. Only ever approved ones.
export const CATALOGUE_API = '/api/games/';

export async function loadVariant(id) {
  if (!/^v-[a-z0-9-]{4,40}$/.test(String(id))) return null;
  const fromApi = await loadJSON(CATALOGUE_API + 'variant/' + id, null);
  const v = fromApi && fromApi.variant ? fromApi.variant : await loadJSON('catalogue/approved/' + id + '.json', null);
  return v && v.status === 'approved' ? v : null;
}

export async function loadApprovedVariants() {
  const fromApi = await loadJSON(CATALOGUE_API + 'catalogue', null);
  if (fromApi && Array.isArray(fromApi.variants)) return { variants: fromApi.variants, source: 'live' };
  const local = await loadJSON('catalogue/approved/index.json', { variants: [] });
  return { variants: (local.variants || []).filter((v) => v.status === 'approved'), source: 'files' };
}

// Turns a variant into a mini-game beat's module, card and settings; its
// pools become the only ones offered.
export function applyVariant(beat, v, minigames) {
  const card = (minigames || []).find((m) => m.online_module === v.baseModule);
  beat.module = v.baseModule;
  beat.card = card ? card.id : v.baseModule;
  beat.options = { ...(v.settings || {}), forfeits: v.forfeits === true, ...(v.pools && v.pools[0] ? { pool: v.pools[0] } : {}) };
  beat.variant_pools = (v.pools || []).slice();
  beat.variant_name = v.name;
  beat.variant_theme = v.theme;
  return beat;
}

// The self-paced modules a game uses (so a page loads only those).
export function modulesUsed(game, minigames) {
  const ids = new Set();
  (game.beats || []).forEach((b) => {
    if (b.type !== 'mini_game') return;
    if (b.module) ids.add(b.module);
    const card = (minigames || []).find((m) => m.id === b.card);
    if (card && card.online_module) ids.add(card.online_module);
  });
  return [...ids];
}

/* -------------------- Show Packs -------------------- */
export function loadShowpackLibrary() {
  return loadJSON(SHOWPACK_LIBRARY_URL, { packs: [] }).then((lib) => (Array.isArray(lib.packs) ? lib.packs : []));
}

// The pack a page was opened for (?pack=<id>), or null.
export function packParam() {
  return new URLSearchParams(location.search).get('pack');
}

// Loads a pack's manifest, runs the name rule check (warning in the
// console) and turns it into a game for the show engine.
// Returns { entry, manifest, game, problems } or throws.
export async function loadShowpack(id, minigames) {
  const entry = (await loadShowpackLibrary()).find((p) => p.id === id);
  if (!entry) throw new Error('Show Pack not in the library: ' + id);
  const base = entry.path.endsWith('/') ? entry.path : entry.path + '/';
  const manifest = await loadJSON(base + 'manifest.json');
  const problems = nameRuleProblems(manifest);
  if (problems.length) console.warn('Show Pack "' + id + '" breaks the name rule: these steps have {guest:…} in their spoken text:', problems.join(', '));
  const game = packToGame(manifest, { theme: entry.theme, minigames });
  // Jester variants: loaded once here, so every screen agrees. An 18+
  // variant only ever runs in an 18+ pack (the age lock); one that can't
  // be used becomes a pause with a note for the host.
  await Promise.all(game.beats.filter((b) => b.type === 'mini_game' && b.variant).map(async (b) => {
    const v = await loadVariant(b.variant);
    const adultOnly = v && v.ageRating === '18+' && manifest.ageRating !== '18+';
    if (v && !adultOnly) { applyVariant(b, v, minigames); return; }
    console.warn('Show Pack "' + id + '": variant ' + b.variant + (adultOnly ? ' is 18+, and this pack is not.' : ' was not found (or is not approved).'));
    b.type = 'pause';
    b.prompt = adultOnly ? "The Jester's game here is 18+, so it's skipped in this pack." : "The Jester's game here couldn't be found, so carry on without it.";
  }));
  return { entry: { ...entry, path: base }, manifest, game, problems };
}

export function pack(data, id) {
  return packById(data.themes, id);
}

export function registryEntry(data, slug) {
  return data.characters.find((c) => c.slug === slug) || null;
}

/* -------------------- storage -------------------- */
export function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}

export function lsSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

export const keys = {
  card: (seat) => 'ls3.card.' + seat,
  wardrobe: (seat) => 'ls3.wardrobe.' + seat,
  recast: (theme, seat) => 'ls3.recast.' + theme + '.' + seat,
  rehearseTheme: 'ls3.rehearseTheme',
  playMode: 'ls3.playMode',
  narration: 'ls3.theatreNarration',
  volume: 'ls3.musicVolume',
  tale: 'ls3.tale',
  packCast: (id) => 'ls3.showpack.cast.' + id
};

// The saved choices the engine's casting functions need.
export const prefs = {
  recast: (packId, seat) => lsGet(keys.recast(packId, seat), null),
  wardrobeVoice: (seat) => (lsGet(keys.wardrobe(seat), null) || {}).voice || null
};

/* -------------------- the cross-tab link -------------------- */
export function openChannel(onMessage) {
  let channel = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    if (onMessage) channel.addEventListener('message', (e) => onMessage(e.data || {}));
  } catch (e) {
    console.warn('BroadcastChannel unavailable; windows cannot talk to each other.', e);
  }
  return {
    post(msg) {
      if (!channel) return;
      try { channel.postMessage(msg); } catch (e) { /* closed */ }
    }
  };
}

export const HELLO_EVERY_MS = 2000;
export const HELLO_STALE_MS = 5000;

// Remembers which Hands said hello recently.
export function createPresence() {
  const seen = new Map();
  return {
    hello(seat) { const fresh = !this.open(seat); seen.set(seat, Date.now()); return fresh; },
    bye(seat) { seen.delete(seat); },
    open(seat) { const t = seen.get(seat); return !!t && Date.now() - t < HELLO_STALE_MS; }
  };
}

/* -------------------- casting (with storage) -------------------- */
export function spriteFor(data, seat) {
  const pick = lsGet(keys.wardrobe(seat), null);
  if (pick && pick.sprite) {
    const entry = registryEntry(data, pick.sprite);
    if (entry && entry.path) return pick.sprite;
  }
  return seat;
}

export function playerName(seat) {
  const card = lsGet(keys.card(seat), null);
  return card && card.name ? String(card.name).trim() : '';
}

export function seatParam(game) {
  const seat = new URLSearchParams(location.search).get('seat');
  return game.cast.some((c) => c.character === seat) ? seat : game.cast[0].character;
}

/* -------------------- DOM helpers -------------------- */
export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (v === null || v === undefined || v === false) return;
    if (k === 'style') node.setAttribute('style', v);
    else if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  });
  children.flat().forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  });
  return node;
}

// Board screens are drawn at 1440x1080; scale to fit the window.
// A page with the tab bar (js/tabbar.js) gets the room below it.
export function fitBoard(board, width = 1440, height = 1080) {
  function fit() {
    const bar = document.querySelector('.ls-tabbar');
    const top = bar ? bar.offsetHeight : 0;
    const scale = Math.min(window.innerWidth / width, (window.innerHeight - top) / height);
    board.style.transform = 'scale(' + scale + ')';
    board.style.left = Math.max(0, (window.innerWidth - width * scale) / 2) + 'px';
    board.style.top = top + Math.max(0, (window.innerHeight - top - height * scale) / 2) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();
}

// The pill button the mockups use for options (Wardrobe hats, moods).
export function pill(label, on, onClick, extra) {
  const b = el('button', {
    type: 'button', class: 'pbtn', 'aria-pressed': on ? 'true' : 'false',
    style: "min-height: 44px; padding: 0 14px; border: 1px solid #D9A441; border-radius: 999px; background: " + (on ? '#D9A441' : 'transparent') + '; color: ' + (on ? '#0F1E28' : '#EDE6D6') + "; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 1px; cursor: pointer;" + (extra || '')
  }, label);
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

// "Write my own": a small, simple family-clean filter. It catches the
// obvious words, not every trick; the host can always mute a player.
const BLOCKED = ['damn', 'hell', 'shit', 'fuck', 'bitch', 'bastard', 'crap', 'piss', 'arse', 'ass', 'dick', 'cock', 'wank', 'twat', 'bollocks', 'bloody', 'slut', 'whore', 'cunt', 'prick', 'sex', 'kill yourself', 'idiot', 'stupid', 'hate you'];
export function familyClean(text) {
  const t = ' ' + String(text).toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ') + ' ';
  return !BLOCKED.some((w) => t.includes(' ' + w + ' ') || t.includes(' ' + w + 's '));
}
export const OWN_LINE_MAX = 160;

// Keyboard and presentation clickers: most clickers send PageDown /
// PageUp (some send arrows or Space).
export function onClicker({ next, back }) {
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (['PageDown', 'ArrowRight', 'ArrowDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
    if (['PageUp', 'ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); back(); }
  });
}
