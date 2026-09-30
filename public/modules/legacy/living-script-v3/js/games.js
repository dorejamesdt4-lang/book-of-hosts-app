// ====================================================================
// THE GAMES (games.html) — every mini-game module, from
// catalogue/modules.json and each module's <id>/meta.json. 12+ games
// are in the main list; 18+ games are only in the Adult room, and only
// added to the page once the 18+ box is ticked (never stored: it asks
// again on every visit). The Jester's Catalogue lists approved Jester
// variants (live from /api/games/catalogue, or the saved files in
// catalogue/approved/); 18+ variants only in the Adult room too.
// ====================================================================

import { el, loadApprovedVariants } from './common.js';

const $ = (id) => document.getElementById(id);

async function json(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(url + ': ' + res.status);
  return res.json();
}

export async function loadModuleMetas() {
  const index = await json('catalogue/modules.json');
  const metas = await Promise.all((index.modules || []).map((id) => json(id + '/meta.json').catch((err) => { console.warn('No meta.json for ' + id, err); return null; })));
  return metas.filter(Boolean);
}

export const isAdult = (m) => m && m.ageRating === '18+';

function players(p) {
  return p ? (p.min === p.max ? p.min : p.min + '–' + p.max) + ' PLAYERS' : '';
}

export function gameCard(m, extra = {}) {
  return el('article', { class: 'gm-card' },
    el('h3', {}, extra.title || m.name),
    el('div', { class: 'gm-pitch' }, extra.pitch || m.pitch || ''),
    el('div', { class: 'gm-tags' },
      el('span', { class: 'gm-tag' + (isAdult(m) ? ' adult' : '') }, m.ageRating),
      m.players ? el('span', { class: 'gm-tag' }, players(m.players)) : null,
      m.type ? el('span', { class: 'gm-tag' }, m.type.toUpperCase()) : null,
      extra.tag ? el('span', { class: 'gm-tag' }, extra.tag) : null),
    el('div', { class: 'gm-actions' },
      (extra.href || m.testPage) ? el('a', { class: 'gm-btn main', href: extra.href || m.testPage }, extra.play || 'PLAY (TEST) ›') : null,
      m.rulesCard && !extra.noRules ? el('a', { class: 'gm-btn', href: m.rulesCard, target: '_blank', rel: 'noopener' }, 'RULES CARD ↗') : null,
      m.printPage && !extra.noRules ? el('a', { class: 'gm-btn', href: m.printPage, target: '_blank', rel: 'noopener' }, 'PRINT FOR IN PERSON ↗') : null));
}

const metas = await loadModuleMetas();
const main = metas.filter((m) => !isAdult(m));
main.forEach((m) => $('mainList').appendChild(gameCard(m)));
if (!main.length) $('mainList').appendChild(el('p', { class: 'gm-empty' }, 'No games found.'));

// The Adult room: nothing 18+ is on the page until the box is ticked.
const adult = metas.filter(isAdult);
let adultVariants = []; // filled in once the catalogue has loaded
$('adultConfirm').checked = false;
function drawAdultRoom() {
  const on = $('adultConfirm').checked;
  const box = $('adultList');
  box.innerHTML = '';
  box.hidden = !on;
  if (!on) return;
  adult.forEach((m) => box.appendChild(gameCard(m)));
  if (!adult.length) box.appendChild(el('p', { class: 'gm-empty' }, 'No adult games yet.'));
  adultVariants.forEach((v) => box.appendChild(variantCard(v)));
}
$('adultConfirm').addEventListener('change', drawAdultRoom);

/* -------------------- the Jester's Catalogue -------------------- */
const byId = Object.fromEntries(metas.map((m) => [m.id, m]));
function variantCard(v) {
  const base = byId[v.baseModule];
  if (!base) return el('span');
  const href = base.testPage ? base.testPage + (base.testPage.includes('?') ? '&' : '?') + 'variant=' + encodeURIComponent(v.id) : null;
  return gameCard({ ...base, ageRating: v.ageRating, players: v.players || base.players }, { title: v.name, pitch: v.pitch, href, tag: 'JESTER · ' + base.name.toUpperCase(), noRules: true });
}
const { variants, source } = await loadApprovedVariants();
const familyVariants = variants.filter((v) => !isAdult(v) && byId[v.baseModule] && !isAdult(byId[v.baseModule]));
adultVariants = variants.filter((v) => isAdult(v) && byId[v.baseModule]);
if ($('adultConfirm').checked) drawAdultRoom();
$('catalogueSection').hidden = false;
$('catalogueNote').textContent = (familyVariants.length
  ? 'New versions of the games, invented by the Seumas Jester and checked by hand before they appear here.'
  : 'No Jester variants have been approved yet. New versions of the games appear here once they have been checked by hand.')
  + (source === 'files' ? ' (Showing the saved copies.)' : '');
familyVariants.forEach((v) => $('catalogueList').appendChild(variantCard(v)));
// Arrived from the tab bar's JESTER'S CATALOGUE: go there now it's shown.
if (location.hash === '#catalogueSection') $('catalogueSection').scrollIntoView();
