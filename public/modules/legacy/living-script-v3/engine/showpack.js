// ====================================================================
// ENGINE · SHOW PACKS — a complete, pre-voiced game stored as a folder
// (showpacks/<id>/manifest.json + audio/). Pure: no DOM, no audio, no
// storage. The site never voices a Show Pack; it only plays its files.
//
// A pack is turned into a master-script-shaped game (packToGame) so the
// existing show engine and Theatre Mode run it:
//   line      -> 'line'      (pre-voiced; plays, then carries on by itself)
//   clue      -> 'clue_drop'
//   minigame  -> 'mini_game' (the card whose online_module is the module;
//                optional pool: a word pool file in the pack, options: settings;
//                or variant: an approved Jester variant's id, resolved by the page)
//   music     -> 'music'     (a named Jukebox track)
//   pause     -> 'pause'     (waits for the host's Next)
//
// THE NAME RULE: the narrator never speaks guests' real names. A line's
// `text` is what was voiced, so it must never hold {guest:…} tokens;
// `screenText` may, and only the screen fills in the names.
// ====================================================================

export const STEP_TYPES = ['line', 'clue', 'minigame', 'music', 'pause'];
export const NARRATOR = 'narrator';
export const GUEST_TOKEN = '{guest:';

// Captions-only lines stay up about 0.4 s a word, never under 2 s.
export const MS_PER_WORD = 400;
export const MIN_HOLD_MS = 2000;

export function holdMs(text) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(MIN_HOLD_MS, words * MS_PER_WORD);
}

export function packSteps(manifest) {
  return (manifest.acts || []).flatMap((act) => (act.steps || []).map((step) => ({ ...step, act: act.id })));
}

export function packLines(manifest) {
  return packSteps(manifest).filter((s) => s.type === 'line');
}

// Ids of every step whose `text` holds a {guest:…} token.
export function nameRuleProblems(manifest) {
  return packSteps(manifest).filter((s) => typeof s.text === 'string' && s.text.includes(GUEST_TOKEN)).map((s) => s.id);
}

export function characterOf(manifest, id) {
  return (manifest.characters || []).find((c) => c.id === id) || null;
}

// cast = { guests: [{ name, character }] }. Guests sharing a character
// are named together ("Ann and Bea").
export function guestNames(cast, characterId) {
  return ((cast && cast.guests) || []).filter((g) => g.character === characterId && g.name).map((g) => g.name.trim());
}

export function playedByText(cast, characterId) {
  const names = guestNames(cast, characterId);
  return names.length ? names.join(' and ') : '';
}

// The screen's text: screenText with real names filled in, else text.
// A character nobody plays shows its own name instead.
export function screenTextOf(step, manifest, cast) {
  if (!step.screenText) return step.text || '';
  return step.screenText.replace(/\{guest:([\w-]+)\}/g, (_, id) => {
    const names = playedByText(cast, id);
    if (names) return names;
    const c = characterOf(manifest, id);
    return c ? c.name : id;
  });
}

// Checks the host's casting against the pack's guest range.
// Returns { ok, errors: [], notes: [] }.
export function checkCast(manifest, cast) {
  const guests = (cast && cast.guests) || [];
  const range = manifest.guests || { min: 1, max: guests.length || 1 };
  const errors = [];
  const notes = [];
  if (guests.length < range.min) errors.push('This show needs at least ' + range.min + ' guests.');
  if (guests.length > range.max) errors.push('This show takes at most ' + range.max + ' guests.');
  if (guests.some((g) => !String(g.name || '').trim())) errors.push('Type a name for every guest.');
  if (guests.some((g) => !characterOf(manifest, g.character))) errors.push('Choose a character for every guest.');
  (manifest.characters || []).forEach((c) => {
    if (!guestNames(cast, c.id).length) notes.push('Nobody is playing ' + c.name + ' yet: the screen will show "' + c.name + '" instead of a name.');
  });
  return { ok: !errors.length, errors, notes };
}

// The pack as a master-script-shaped game for the show engine.
export function packToGame(manifest, { theme = null, minigames = [] } = {}) {
  const acts = (manifest.acts || []).map((a, i) => ({ id: a.id, number: i + 1, title: a.title || '' }));
  const cast = (manifest.characters || []).map((c, i) => ({ character: c.id, seat: i + 1, title: c.name, role: c.role || '', sprite: c.sprite || null, voice: c.voice || null }));
  const beats = packSteps(manifest).map((s) => {
    const base = { id: s.id, act: s.act };
    switch (s.type) {
      case 'line':
        return { ...base, type: 'line', speaker: s.speaker || NARRATOR, text: s.text || '', screen_text: s.screenText || null, audio: s.audio || null };
      case 'clue':
        return { ...base, type: 'clue_drop', clue: { id: s.id, title: s.title || '', text: s.text || '' }, narration: '' };
      case 'minigame': {
        if (s.variant) return { ...base, type: 'mini_game', card: null, module: null, variant: String(s.variant), narration: '', return_when_done: true, pool: null, options: {} };
        const card = minigames.find((m) => m.online_module === s.module) || minigames.find((m) => m.id === s.module);
        // pool: a word pool file in the pack (relative to its folder); options: the module's settings.
        return { ...base, type: 'mini_game', card: card ? card.id : s.module, module: s.module, narration: '', return_when_done: true, pool: s.pool || null, options: s.options || {} };
      }
      case 'music':
        return { ...base, type: 'music', mood: null, track: s.track || null };
      case 'pause':
        return { ...base, type: 'pause', prompt: s.prompt || '' };
      default:
        return { ...base, type: 'pause', prompt: '' };
    }
  });
  return {
    schema_version: 2,
    showpack: true,
    game: { id: manifest.id, title: manifest.title || manifest.id, theme, rating: manifest.ageRating || '', culprit: null, solution: '' },
    cast,
    acts,
    beats
  };
}
