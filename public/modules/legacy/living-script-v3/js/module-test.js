// ====================================================================
// MINI-GAME TEST (twenty-one.html, lanterns.html) — one self-paced
// module on its own, with the sample game's cast as players, like
// dice.html does for The Gambler's Gambit. The same module, Stage view,
// Host Console controls and phone view as in the show; narrator lines
// show as captions (nothing is voiced). <body data-module="<id>">.
// An 18+ module asks for the 18+ confirmation first, before anything of it
// (pools, forfeits) is even loaded; it asks again on every visit.
// ====================================================================

import { loadAll, loadModuleData, moduleOptionsFor, onClicker, playerName, el, loadVariant, applyVariant } from './common.js';
import { castInSeatOrder, titleOf } from '../engine/script.js';
import { MODULES } from '../engine/minigames.js';
import { uiFor, hostKit } from './module-ui.js';

const $ = (id) => document.getElementById(id);
const MOD = document.body.dataset.module;
const TICK_MS = 250;
const mod = MODULES[MOD];
if (mod.ageRating === '18+') await adultGate();
const { game } = await loadAll();
const moduleData = await loadModuleData([MOD]);
// ?variant=<id>: an approved Jester variant of this game (its settings and pools).
const variantId = new URLSearchParams(location.search).get('variant');
const variant = variantId ? await loadVariant(variantId) : null;
if (variantId && (!variant || variant.baseModule !== MOD)) console.warn('Variant ' + variantId + ' is not an approved variant of ' + MOD + '; playing the plain game.');
const useVariant = variant && variant.baseModule === MOD ? variant : null;
const meta = moduleData[MOD] && moduleData[MOD].meta;
if (meta && $('pitch')) $('pitch').textContent = '“' + (useVariant ? useVariant.pitch : meta.pitch) + '”';
if (meta && $('pageTitle')) $('pageTitle').textContent = meta.name.toUpperCase();
if (meta && $('printLink') && meta.printPage) $('printLink').href = meta.printPage;

// The 18+ confirmation, as on the Games page (the site's adult comedy mode tick box).
function adultGate() {
  const main = document.querySelector('main');
  main.hidden = true;
  const box = el('input', { type: 'checkbox', id: 'adultConfirm', style: 'width: 22px; height: 22px; accent-color: #D9A441; flex-shrink: 0' });
  const gate = el('div', { style: 'max-width: 640px; margin: 40px auto; padding: 22px 24px; display: flex; flex-direction: column; gap: 14px; background: #0F1E28; border: 1px dashed #6B5320; border-radius: 12px' },
    el('div', { style: "font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 5px; color: #D9A441" }, 'ADULT ROOM (TEST ONLY) · 18+'),
    el('p', { style: 'margin: 0; font-size: 16px; line-height: 1.45; color: #EDE6D6' }, 'This game is for adult parties only. Cheeky, never cruel: no slurs, nothing explicit, nothing about real people.'),
    el('label', { style: 'display: flex; gap: 10px; align-items: flex-start; font-size: 16px; color: #EDE6D6; cursor: pointer; min-height: 44px' }, box, 'I confirm this is for an 18+ audience — open the adult room'),
    el('a', { href: 'games.html', style: 'font-size: 15px' }, '‹ Back to the Games'));
  main.before(gate);
  return new Promise((resolve) => box.addEventListener('change', () => { if (!box.checked) return; gate.remove(); main.hidden = false; resolve(); }));
}
const label = (seat) => titleOf(game, seat) + (playerName(seat) ? ' · ' + playerName(seat) : '');

let instance = null;
let view = null;
let ui = null;
let phoneSeat = 'active';
let lastSeq = null;

/* -------------------- the phone's building blocks (as on the Hand) -------------------- */
const heading = (title, sub) => el('div', { style: 'display: flex; align-items: baseline; justify-content: space-between; gap: 10px' },
  el('h2', { style: "margin: 0; font-family: 'Cinzel', serif; font-weight: 700; font-size: 20px; letter-spacing: 2px; color: #EDE6D6" }, title),
  sub ? el('div', { style: 'font-style: italic; font-size: 14px; color: #A9C9C4' }, sub) : null);
const parchment = (...children) => el('div', { style: 'position: relative; background: #EDE6D6; border-radius: 6px; box-shadow: inset 0 0 70px rgba(160,120,60,0.2); color: #1B2A36; box-sizing: border-box; padding: 18px 14px; display: flex; flex-direction: column; gap: 10px' },
  el('div', { style: 'position: absolute; inset: 14px; border: 1px solid #B8923E; border-radius: 4px; pointer-events: none' }), ...children);
const tag = (text) => el('div', { style: "position: relative; padding: 0 12px; font-family: 'Silkscreen', monospace; font-size: 10px; letter-spacing: 1px; color: #2E6E69" }, text);
const prose = (text, extra) => el('div', { style: 'position: relative; font-size: 16px; line-height: 1.4; color: #1B2A36; padding: 0 12px;' + (extra || '') }, text);
const cardTitle = (text) => el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-weight: 700; font-size: 17px; color: #0F1E28; padding: 0 12px" }, text);
function bigButton(text, ready, onClick) {
  const b = el('button', { type: 'button', class: 'pbtn', 'aria-disabled': ready ? 'false' : 'true', style: "height: 52px; border: none; border-radius: 8px; background: " + (ready ? '#D9A441' : '#3A4A52') + '; color: ' + (ready ? '#0F1E28' : '#8FA5A3') + "; font-family: 'Cinzel', serif; font-weight: 700; font-size: 15px; letter-spacing: 3px; cursor: pointer" }, text);
  b.addEventListener('click', () => { if (ready) onClick(); });
  return b;
}

/* -------------------- the game -------------------- */
function handle(events) {
  (events || []).forEach((e) => { if (e.type === 'narrate' && e.text) { $('caption').textContent = e.text; $('captionId').textContent = e.id; } });
  draw();
}

function newGame() {
  const players = castInSeatOrder(game).map((c) => ({ seat: c.character, title: c.title }));
  const beat = useVariant ? applyVariant({}, useVariant, []) : null;
  instance = mod.create({ players, options: { ...(beat ? beat.options : {}), ...moduleOptionsFor(moduleData)(beat, MOD) } });
  ui = uiFor(instance.state);
  view = ui.createView($('table'), { titleOf: label, size: 'tv' });
  lastSeq = null;
  $('caption').textContent = '';
  $('captionId').textContent = '';
  handle(instance.start());
}

const kit = hostKit({ host: (cmd, extra) => handle(instance.act({ type: 'host', cmd, ...(extra || {}) })), titleOf: label });

function draw() {
  const st = instance.state;
  view.render(st);
  // The panels are rebuilt only when something happened (not every timer
  // second), so a click is never lost to a redraw.
  if (st.seq === lastSeq) return;
  lastSeq = st.seq;
  $('prompt').textContent = ui.hostPrompt(st);
  const host = $('host');
  host.innerHTML = '';
  host.appendChild(el('div', { style: 'position: absolute; inset: 10px; border: 1px solid #B8923E; border-radius: 4px; pointer-events: none' }));
  ui.hostPanel(st, kit).filter(Boolean).forEach((n) => host.appendChild(n));
  drawPhone();
}

function drawPhone() {
  const st = instance.state;
  const seat = phoneSeat === 'active' ? (st.active || st.players[0].seat) : phoneSeat;
  const box = $('phone');
  box.innerHTML = '';
  ui.phoneView(st, seat, {
    el, heading, parchment, tag, prose, cardTitle, bigButton, locked: false,
    send: (action) => handle(instance.act({ ...action, seat }))
  }).forEach((n) => box.appendChild(n));
  $('phoneWho').textContent = label(seat);
}

function buildPhonePicker() {
  const pick = $('phoneSeat');
  pick.appendChild(el('option', { value: 'active' }, 'Whoever’s turn it is'));
  castInSeatOrder(game).forEach((c) => pick.appendChild(el('option', { value: c.character }, label(c.character))));
  pick.addEventListener('change', () => { phoneSeat = pick.value; drawPhone(); });
}

setInterval(() => { if (instance && !instance.done) handle(instance.tick(TICK_MS)); }, TICK_MS);
$('btnRestart').addEventListener('click', newGame);
// The clicker does the host's main command for the moment, as in the show.
onClicker({ next: () => { const p = instance && instance.state.primary; if (p) handle(instance.act({ type: 'host', cmd: p })); }, back: () => {} });
buildPhonePicker();
newGame();
