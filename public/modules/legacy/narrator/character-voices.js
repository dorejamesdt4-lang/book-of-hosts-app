// ====================================================================
// CHARACTER VOICES -- each character's Kokoro voice: the registry's
// default_voice, overridden by the user's choice from the Character
// voices settings (or the VOICE menu for the selected hero), which is
// saved in localStorage. Storage failures (private mode, blocked site
// data) just mean choices aren't remembered.
// ====================================================================

import { getCharacter, DEFAULT_VOICE } from './character-registry.js';

const STORAGE_KEY = 'narratorForge.characterVoices.v1';

function readSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

let saved = readSaved();

export function getVoice(characterId) {
  if (saved[characterId]) return saved[characterId];
  const c = getCharacter(characterId);
  return c ? c.defaultVoice : DEFAULT_VOICE;
}

export function setVoice(characterId, voiceId) {
  const c = getCharacter(characterId);
  if (c && voiceId === c.defaultVoice) delete saved[characterId];
  else saved[characterId] = voiceId;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch (e) {
    // not persisted -- still applies for this visit
  }
}
