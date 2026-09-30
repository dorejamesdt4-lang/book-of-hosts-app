// ====================================================================
// ENGINE · SCRIPT CHECK — run before the Lobby lets a game begin.
// Returns [{ ok, label, detail }]; the first four labels are the
// approved Lobby mockup's.
// ====================================================================

import { SUPPORTED_SCHEMAS, MUSIC_MOODS, roman, titleOf } from './script.js';

export function scriptCheck({ game, minigames, modules }) {
  const results = [];
  const beats = game.beats || [];
  const castSlugs = game.cast.map((c) => c.character);

  if (!SUPPORTED_SCHEMAS.includes(game.schema_version)) {
    results.push({ ok: false, label: 'Master script format is supported', detail: 'Found version ' + game.schema_version + '; this build reads ' + SUPPORTED_SCHEMAS.join(' and ') + '.' });
  }

  const missing = [];
  game.acts.forEach((act) => {
    castSlugs.forEach((slug) => {
      const has = beats.some((b) => b.act === act.id && b.type === 'character_turn' && b.character === slug && b.lines && b.lines.length);
      if (!has) missing.push(titleOf(game, slug) + ' (Act ' + roman(act.number) + ')');
    });
  });
  const noReveal = beats.filter((b) => b.type === 'character_turn' && !(b.lines || []).some((l) => l.tone === 'reveal'));
  results.push({
    ok: !missing.length && !noReveal.length,
    label: 'Every character has lines in every act',
    detail: [missing.length ? 'No lines for ' + missing.join(', ') + '.' : '', noReveal.length ? 'No Reveal line in ' + noReveal.map((b) => b.id).join(', ') + '.' : ''].filter(Boolean).join(' ')
  });

  const finales = beats.filter((b) => b.type === 'finale');
  const culpritOk = castSlugs.includes(game.game.culprit);
  const cluesOk = beats.some((b) => b.type === 'clue_drop');
  const finaleOk = finales.length === 1 && beats[beats.length - 1].type === 'finale';
  results.push({
    ok: culpritOk && cluesOk && finaleOk,
    label: 'Culprit, clues and final reveal are in place',
    detail: [culpritOk ? '' : 'The culprit is not in the cast.', cluesOk ? '' : 'There are no clues.', finaleOk ? '' : 'There must be exactly one finale, as the last beat.'].filter(Boolean).join(' ')
  });

  const cards = new Map(minigames.map((m) => [m.id, m]));
  const games = beats.filter((b) => b.type === 'mini_game');
  const unknown = games.filter((b) => !cards.has(b.card)).map((b) => b.card);
  const noModule = games.map((b) => cards.get(b.card)).filter((c) => c && c.online_module && !(modules && modules[c.online_module])).map((c) => c.name);
  results.push({
    ok: !unknown.length && !noModule.length,
    label: 'Mini-games found in the library',
    detail: [unknown.length ? 'Not in the library: ' + unknown.join(', ') + '.' : '', noModule.length ? 'Online module missing for ' + noModule.join(', ') + '.' : ''].filter(Boolean).join(' ')
  });

  const used = games.map((b) => cards.get(b.card)).filter(Boolean);
  const wrongRating = used.filter((m) => m.rating !== game.game.rating).map((m) => m.name);
  const badMusic = beats.filter((b) => b.type === 'music' && !b.stop && !MUSIC_MOODS.includes(b.mood)).map((b) => b.id);
  results.push({ ok: !wrongRating.length, label: "Content matches the room's rating", detail: wrongRating.length ? 'Rated differently: ' + wrongRating.join(', ') + '.' : '' });
  if (beats.some((b) => b.type === 'music')) {
    results.push({ ok: !badMusic.length, label: 'Music cues use known moods', detail: badMusic.length ? 'Unknown mood in ' + badMusic.join(', ') + '.' : '' });
  }

  return results;
}
