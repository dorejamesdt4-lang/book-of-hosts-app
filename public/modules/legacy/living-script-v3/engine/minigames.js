// ====================================================================
// ENGINE · MINI-GAME MODULES — the registry of online mini-game modules.
// A library card's `online_module` names one of these. See
// ../MINIGAME-MODULES.md for the interface every module follows.
// ====================================================================

import * as gamblersGambit from './modules/gamblers-gambit.js';
import * as twentyOneTrouble from './modules/twenty-one-trouble.js';
import * as lexicalLanterns from './modules/lexical-lanterns.js';
import * as vernacularVault from './modules/vernacular-vault.js';
import * as vernacularVault18 from './modules/vernacular-vault-18.js';
import * as gobletGlance from './modules/goblet-glance.js';
import * as gobletGlance18 from './modules/goblet-glance-18.js';

export const MODULES = {
  [gamblersGambit.id]: gamblersGambit,
  [twentyOneTrouble.id]: twentyOneTrouble,
  [lexicalLanterns.id]: lexicalLanterns,
  [vernacularVault.id]: vernacularVault,
  [vernacularVault18.id]: vernacularVault18,
  [gobletGlance.id]: gobletGlance,
  [gobletGlance18.id]: gobletGlance18
};

export function moduleForCard(card) {
  return card && card.online_module ? MODULES[card.online_module] || null : null;
}
