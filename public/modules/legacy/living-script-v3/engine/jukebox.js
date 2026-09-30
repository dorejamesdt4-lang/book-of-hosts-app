// ====================================================================
// ENGINE · JUKEBOX — which track to play. Pure: the page owns the audio.
//
// RIGHTS: only tracks marked made_on_paid_plan: true are EVER returned.
// Tracks made on Suno's free plan have no commercial-use rights.
//
// tracks.json: { "tracks": [ { "title", "file", "theme", "mood",
//                               "made_on_paid_plan", "created" } ] }
// ====================================================================

import { MUSIC_MOODS } from './script.js';

export { MUSIC_MOODS };

export function playableTracks(manifest) {
  const tracks = (manifest && Array.isArray(manifest.tracks)) ? manifest.tracks : [];
  return tracks.filter((t) => t && t.made_on_paid_plan === true && typeof t.file === 'string' && t.file && MUSIC_MOODS.includes(t.mood));
}

// A track for this theme and mood, avoiding the one just played when
// there's a choice. Tracks tagged theme "any" suit every theme.
export function pickTrack(manifest, { theme, mood, track = null, lastFile = null, rng = Math.random }) {
  const playable = playableTracks(manifest);
  if (track) {
    const named = playable.find((t) => t.file === track || t.title === track);
    if (named) return named;
  }
  const fits = playable.filter((t) => t.mood === mood && (t.theme === theme || t.theme === 'any'));
  if (!fits.length) return null;
  const fresh = fits.length > 1 ? fits.filter((t) => t.file !== lastFile) : fits;
  return fresh[Math.floor(rng() * fresh.length)];
}

export function moodsWithTracks(manifest, theme) {
  const set = new Set(playableTracks(manifest).filter((t) => t.theme === theme || t.theme === 'any').map((t) => t.mood));
  return MUSIC_MOODS.filter((m) => set.has(m));
}
