// ====================================================================
// MINI-GAME MODULE · SLANG-O-METER 18+ — Vernacular Vault's engine with
// its own id, 18+ age lock, narrator lines, chalkboard skin and optional
// forfeits (off by default, always with a Pass). Adult room only.
// ====================================================================

import { makeModule, LINES_18 } from './vernacular-vault.js';

const mod = makeModule({ id: 'vernacular-vault-18', name: 'Slang-O-Meter 18+', ageRating: '18+', lineIds: LINES_18, forfeitsAllowed: true, skin: 'chalkboard' });
export const id = mod.id;
export const name = mod.name;
export const ageRating = mod.ageRating;
export const selfPaced = true;
export const create = mod.create;
