// ====================================================================
// MINI-GAME MODULE · STREET SHUFFLE 18+ — Goblet Glance's engine with its
// own id, 18+ age lock, narrator lines, pub-table skin and optional
// forfeits (off by default, always with a Pass). Adult room only.
// ====================================================================

import { makeModule, LINES_18 } from './goblet-glance.js';

const mod = makeModule({ id: 'goblet-glance-18', name: 'Street Shuffle 18+', ageRating: '18+', lineIds: LINES_18, forfeitsAllowed: true, skin: 'pub' });
export const id = mod.id;
export const name = mod.name;
export const ageRating = mod.ageRating;
export const selfPaced = true;
export const create = mod.create;
