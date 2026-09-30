// ====================================================================
// THE PLAYER'S HAND (hand.html?seat=<slug>) — one player's private
// screen. Phase 1: a browser tab on the host's computer, linked to the
// Stage with a BroadcastChannel (a phone, synced live, from Phase 3).
//
// Online:  your turn (pick a line or write your own), the vote, dice.
// Theatre: the lines to READ ALOUD (tap one so a stand-in can read it
//          for you if you'd rather not), the vote, dice.
// Tabs: Lines, Secrets (private reveals, envelope numbers in theatre),
// Character, Clues.
// Mini-games: dice, Twenty-One & Trouble (TWIST / STICK), Lexical Lanterns
// (an A–Z keyboard). A Show Pack's guests open hand.html?pack=<id>&seat=<id>.
// ====================================================================

import { loadAll, registryEntry, spriteFor, seatParam, el, openChannel, HELLO_EVERY_MS, familyClean, OWN_LINE_MAX, packParam, loadShowpack } from './common.js';
import { uiFor } from './module-ui.js';
import { castEntry, titleOf, setLine, envelopeFor } from '../engine/script.js';
import { chime, unlockSfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const data = await loadAll();
const sp = packParam() ? await loadShowpack(packParam(), data.minigames) : null;
const game = sp ? sp.game : data.game;
const seat = seatParam(game);
const me = castEntry(game, seat);

let state = null;
let deadline = 0;
let tab = 'lines';
let picked = -1;
let writing = false;
let ownText = '';
let ownError = '';
let voted = null;
let seenSecrets = 0;
let lastTurnId = null;

document.title = me.title + " — Player's Hand";
$('meTitle').textContent = me.title;
const sprite = registryEntry(data, sp ? me.sprite : spriteFor(data, seat));
if (sprite && sprite.thumbnail) $('meThumb').src = '../' + sprite.thumbnail;

/* -------------------- the link to the Stage -------------------- */
const channel = openChannel((msg) => {
  if (msg.type === 'ping') hello();
  if (msg.type === 'state') onState(msg);
});
function hello(want) { channel.post({ type: 'hello', seat, want }); }
hello('state');
setInterval(() => hello(), HELLO_EVERY_MS);
window.addEventListener('pagehide', () => channel.post({ type: 'bye', seat }));

const theatre = () => !!state && state.mode === 'theatre';
const myTurn = () => !!(state && state.turn && state.turn.seat === seat);
const timed = () => myTurn() && state.turn.left !== null && state.turn.left !== undefined;
const dice = () => (state && state.game && state.game.module) || null;
// A self-paced mini-game (Twenty-One & Trouble, Lexical Lanterns).
const moduleUi = () => uiFor(dice());

// Input lock: after a tap, no more moves until the Stage has taken it
// (a new move number), so a double tap can't make a double move.
let lockedSeq = null;
let lockedAt = 0;
const LOCK_MS = 3000; // in case the message was lost
function moduleLocked() { const d = dice(); return !!d && lockedSeq === d.seq && Date.now() - lockedAt < LOCK_MS; }
function sendModule(action) {
  const d = dice();
  if (!d || moduleLocked()) return;
  lockedSeq = d.seq;
  lockedAt = Date.now();
  channel.post({ type: 'module', seat, action });
  render();
  setTimeout(() => { if (lockedSeq === d.seq) render(); }, LOCK_MS + 50);
}
const myRoll = () => { const d = dice(); return !!d && !d.done && d.shooter === seat; };

function onState(msg) {
  state = msg;
  if (myTurn()) {
    if (state.turn.beatId !== lastTurnId) {
      lastTurnId = state.turn.beatId;
      picked = state.selected && state.selected[seat] !== undefined ? state.selected[seat] : -1;
      writing = false; ownText = ''; ownError = '';
    }
    if (timed()) deadline = Date.now() + state.turn.left;
  }
  if (!state.vote) voted = null;
  else if (state.vote.votes[seat]) voted = state.vote.votes[seat];
  // The Stage re-sends its state every few seconds; only redraw when
  // something on this screen changed, so typing isn't interrupted.
  const key = viewKey();
  if (key !== lastKey) { lastKey = key; render(); }
}

let lastKey = '';
function viewKey() {
  if (!state) return 'none';
  const v = state.vote;
  const d = dice();
  return [
    state.mode, state.phase, state.paused, state.index,
    state.turn ? state.turn.seat + ':' + state.turn.beatId : '-',
    v ? v.beatId + ':' + v.open + ':' + (v.votes[seat] || '') : '-',
    d ? (uiFor(d) ? d.id + ':' + d.seq + ':' + d.done : d.shooter + ':' + d.done + ':' + JSON.stringify(d.lastRoll) + ':' + d.players.map((p) => p.crowns).join(',')) : '-',
    (state.muted || []).includes(seat), ((state.secrets || {})[seat] || []).length, (state.clues || []).length
  ].join('|');
}

/* -------------------- the timer ring (online turns only) -------------------- */
setInterval(() => {
  $('timer').hidden = !timed();
  if (!timed()) return;
  const left = state.paused ? state.turn.left : Math.max(0, deadline - Date.now());
  const secs = Math.ceil(left / 1000);
  $('timerText').textContent = String(secs);
  $('timerArc').setAttribute('stroke-dashoffset', String(138 * (1 - left / state.turn.total)));
  $('timer').setAttribute('aria-label', secs + ' seconds left');
}, 250);

/* -------------------- building blocks (from the mockup) -------------------- */
function heading(title, sub) {
  return el('div', { style: 'display: flex; align-items: baseline; justify-content: space-between; gap: 10px' },
    el('h1', { style: "margin: 0; font-family: 'Cinzel', serif; font-weight: 700; font-size: 20px; letter-spacing: 2px; color: #EDE6D6" }, title),
    sub ? el('div', { style: 'font-style: italic; font-size: 14px; color: #A9C9C4; text-align: right' }, sub) : null);
}

function parchment(...children) {
  return el('div', { style: 'position: relative; background: #EDE6D6; border-radius: 6px; box-shadow: inset 0 0 70px rgba(160,120,60,0.2); color: #1B2A36; box-sizing: border-box; padding: 18px 14px; display: flex; flex-direction: column; gap: 10px' },
    el('div', { style: 'position: absolute; inset: 14px; border: 1px solid #B8923E; border-radius: 4px; pointer-events: none' }),
    ...children);
}

function tag(text) {
  return el('div', { style: "position: relative; padding: 0 12px; font-family: 'Silkscreen', monospace; font-size: 10px; letter-spacing: 1px; color: #2E6E69" }, text);
}

function prose(text, extra) {
  return el('div', { style: 'position: relative; font-size: 16px; line-height: 1.4; color: #1B2A36; padding: 0 12px;' + (extra || '') }, text);
}

function cardTitle(text) {
  return el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-weight: 700; font-size: 17px; color: #0F1E28; padding: 0 12px" }, text);
}

function choice({ tagText, text, selected, disabled, onPick }) {
  const b = el('button', {
    type: 'button', class: 'choice', 'aria-pressed': selected ? 'true' : 'false', disabled: !!disabled,
    style: "position: relative; width: 100%; box-sizing: border-box; text-align: left; padding: 12px 14px; background: " + (selected ? '#DCEBE6' : '#F6F1E6') + '; border: 2px solid ' + (selected ? '#2E6E69' : '#CDBF9F') + "; border-radius: 10px; display: flex; flex-direction: column; gap: 6px; cursor: pointer; font-family: 'Cardo', Georgia, serif"
  },
  el('div', { style: "font-family: 'Silkscreen', monospace; font-size: 10px; letter-spacing: 1px; color: #2E6E69" }, tagText),
  el('div', { style: 'font-size: 16px; line-height: 1.4; color: #1B2A36' }, text));
  b.addEventListener('click', onPick);
  return b;
}

const PEN = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 L8 19 L19 8 L16 5 L5 16 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"></path></svg>';
const MIC = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"></rect><path d="M5 11 a7 7 0 0 0 14 0 M12 18 V21" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path></svg>';

function smallButton(icon, label, onClick, disabled, note) {
  const b = el('button', { type: 'button', class: 'pbtn', disabled: !!disabled, style: "height: 46px; border: 1px solid #2A4A4A; border-radius: 8px; background: #0F1E28; color: #A9C9C4; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 1px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer" });
  b.insertAdjacentHTML('afterbegin', icon);
  const text = el('span', { style: 'display: flex; flex-direction: column; align-items: flex-start; gap: 1px' }, label);
  if (note) text.appendChild(el('span', { style: "font-family: 'Silkscreen', monospace; font-size: 8px; letter-spacing: 0.5px" }, note));
  b.appendChild(text);
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

function bigButton(label, ready, onClick) {
  const b = el('button', { type: 'button', class: 'pbtn', 'aria-disabled': ready ? 'false' : 'true', style: "height: 52px; border: none; border-radius: 8px; background: " + (ready ? '#D9A441' : '#3A4A52') + '; color: ' + (ready ? '#0F1E28' : '#8FA5A3') + "; font-family: 'Cinzel', serif; font-weight: 700; font-size: 15px; letter-spacing: 3px; cursor: pointer" }, label);
  b.addEventListener('click', () => { if (ready) onClick(); });
  return b;
}

const beatTag = () => (state && state.beat ? 'BEAT ' + state.beat.number + ' · ' : '');
const T = (slug) => titleOf(game, slug).toUpperCase();
const currentBeat = () => (state && state.index >= 0 ? game.beats[state.index] : null);

/* -------------------- "what to do now" -------------------- */
// { act: true } when this player must do something now; otherwise a
// calm "Waiting: ..." so nobody wonders what's happening.
function prompt() {
  if (!state || state.phase === 'cover' || !state.beat) return { act: false, text: 'Waiting for the host to begin the tale.' };
  if (state.phase === 'ended') return { act: false, text: 'The tale is told. Thank you for playing.' };
  const b = currentBeat();
  const d = dice();
  if (state.vote && state.vote.open) {
    return state.vote.votes[seat] ? { act: false, text: 'Waiting: the votes are being counted.' } : { act: true, key: 'vote:' + state.vote.beatId, text: 'Vote now: who did it?' };
  }
  if (d && !d.done && uiFor(d)) return uiFor(d).phonePrompt(d, seat, T);
  if (d && !d.done) {
    if (d.shooter === seat) { const me = d.players.find((p) => p.seat === seat); return { act: true, key: 'roll:' + state.index + ':' + (me ? me.roundsLeft : ''), text: 'Roll the dice!' }; }
    return { act: false, text: 'Waiting: ' + T(d.shooter) + ' is rolling.' };
  }
  if (d && d.done && d.result && d.result.winners.includes(seat) && b && b.on_result && b.on_result.winner_clue) {
    const e = envelopeFor(game, b.id, 'prize');
    return theatre()
      ? { act: true, key: 'prize:' + b.id, text: 'You won! Take prize envelope ' + (e ? e.number : '') + ' from the host (don’t show anyone).' }
      : { act: true, key: 'prize:' + b.id, text: 'You won a secret clue: open SECRETS (don’t show anyone).' };
  }
  if (b && b.type === 'private_reveal' && b.character === seat) {
    const e = envelopeFor(game, b.id, 'secret');
    return theatre()
      ? { act: true, key: 'secret:' + b.id, text: 'Open envelope ' + (e ? e.number : '') + ' now (don’t show anyone).' }
      : { act: true, key: 'secret:' + b.id, text: 'A secret for you: open SECRETS (don’t show anyone).' };
  }
  if (myTurn()) {
    if (theatre()) {
      const n = picked >= 0 ? picked + 1 : state.turn.lines.indexOf(setLine({ lines: state.turn.lines })) + 1;
      return { act: true, key: 'turn:' + state.turn.beatId, text: 'YOUR TURN: read line ' + n + ' aloud.' };
    }
    return { act: true, key: 'turn:' + state.turn.beatId, text: 'YOUR TURN: pick a line, then press SPEAK IT IN CHARACTER.' };
  }
  if (state.turn) return { act: false, text: 'Waiting: ' + T(state.turn.seat) + (theatre() ? ' is speaking.' : ' is choosing their words.') };
  if (b && b.type === 'private_reveal') return { act: false, text: 'Waiting: ' + T(b.character) + ' is reading a secret.' };
  return { act: false, text: 'Waiting: the narrator is speaking.' };
}

let lastPromptKey = null;
function renderPrompt() {
  const p = prompt();
  const box = $('prompt');
  box.textContent = p.text;
  box.classList.toggle('ls-glow', !!p.act);
  box.style.background = p.act ? '#D9A441' : '#0F1E28';
  box.style.color = p.act ? '#0F1E28' : '#A9C9C4';
  box.style.border = p.act ? '1px solid #D9A441' : '1px solid #2A4A4A';
  box.style.fontStyle = p.act ? 'normal' : 'italic';
  box.style.fontFamily = p.act ? "'Cinzel', serif" : "'Cardo', Georgia, serif";
  box.style.fontWeight = p.act ? '700' : '400';
  // A new thing to do: a gentle buzz and a soft chime (once per prompt).
  if (p.act && p.key !== lastPromptKey) {
    try { if (navigator.vibrate) navigator.vibrate([120, 80, 120]); } catch (e) { /* not supported */ }
    chime();
  }
  lastPromptKey = p.act ? p.key : null;
}
// Browsers only allow the chime after a tap on this page.
document.addEventListener('pointerdown', unlockSfx, { passive: true });

/* -------------------- the views -------------------- */
function linesView() {
  if (!state || state.phase === 'cover' || !state.beat) {
    return [heading('The Tale Awaits', 'Keep this tab open'), parchment(tag('WAITING FOR THE HOST'), prose('The host has not begun the tale yet. When it is your turn, your lines will appear here.'))];
  }
  if (state.phase === 'ended') {
    if (!state.culprit) return [heading('The End', 'Thank you for playing'), parchment(tag('THE TALE IS TOLD'), prose('Ask the host for the keepsake: the whole tale, as you played it.'))];
    return [heading('The End', 'Thank you for playing'), parchment(tag('THE CULPRIT'), cardTitle(titleOf(game, state.culprit)), prose('Ask the host for the keepsake: the whole tale, as you played it.'))];
  }
  if (state.vote && state.vote.open) return voteView();
  if (moduleUi()) return moduleUi().phoneView(dice(), seat, { el, heading, parchment, tag, prose, cardTitle, bigButton, send: sendModule, locked: moduleLocked() });
  if (dice() && !dice().done) return diceView();
  if (myTurn()) {
    if (theatre()) return readAloudView();
    return writing ? writeView() : turnView();
  }
  const speaking = state.turn ? titleOf(game, state.turn.seat) : null;
  return [
    heading('The Tale Continues', state.paused ? 'Paused' : ''),
    parchment(
      tag(beatTag() + (speaking ? (theatre() ? 'IN THE SPOTLIGHT' : 'NOW CHOOSING') : 'LISTEN TO THE STAGE')),
      prose(speaking ? speaking + (theatre() ? ' has the spotlight.' : ' is choosing their words.') : 'Watch and listen. When it is your turn, your lines will appear here.'))
  ];
}

function turnView() {
  return [
    heading('Your Turn', 'Pick a line to speak'),
    parchment(...state.turn.lines.map((l, i) => choice({ tagText: 'LINE ' + (i + 1) + ' · ' + l.tone.toUpperCase(), text: l.text, selected: picked === i, onPick: () => { picked = i; render(); } }))),
    el('div', { style: 'display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px' },
      smallButton(PEN, 'WRITE MY OWN', () => { writing = true; render(); }),
      smallButton(MIC, 'SPEAK ALOUD', null, true, 'NEEDS LIVE MEET')),
    bigButton('SPEAK IT IN CHARACTER', picked >= 0, () => channel.post({ type: 'pick', seat, beatId: state.turn.beatId, line: picked }))
  ];
}

// Theatre: read aloud. Tapping a line tells the host which one you'll
// read (and which one the stand-in reads, if you ask for one).
function readAloudView() {
  return [
    heading('Your Line', 'Read one aloud'),
    parchment(
      tag(beatTag() + 'YOU HAVE THE SPOTLIGHT'),
      prose(state.turn.prompt, 'font-style: italic; color: #3B4B57'),
      ...state.turn.lines.map((l, i) => choice({
        tagText: 'LINE ' + (i + 1) + ' · ' + l.tone.toUpperCase() + (l.tone === 'reveal' ? ' · THE LINE IN YOUR SCRIPT' : ''), text: l.text, selected: picked === i,
        onPick: () => { picked = i; channel.post({ type: 'pick', seat, beatId: state.turn.beatId, line: i }); render(); }
      })),
      prose("Rather not read? Tell the host: the narrator's voice can stand in for you.", 'font-size: 14px; color: #3B4B57'))
  ];
}

function writeView() {
  const mutedNow = (state.muted || []).includes(seat);
  const area = el('textarea', { id: 'ownLine', rows: '4', maxlength: String(OWN_LINE_MAX), 'aria-label': 'Your own line', disabled: mutedNow,
    style: "position: relative; box-sizing: border-box; width: 100%; padding: 10px 12px; border: 1px solid #B8923E; border-radius: 6px; background: #F6F1E6; font-family: 'Cardo', serif; font-size: 16px; line-height: 1.4; color: #1B2A36; resize: none" });
  area.value = ownText;
  const count = el('div', { style: "position: relative; display: flex; justify-content: space-between; font-family: 'Silkscreen', monospace; font-size: 10px; color: #2E6E69; padding: 0 2px" },
    el('span', {}, ownError || (mutedNow ? 'THE HOST HAS PAUSED TYPED LINES FOR YOU' : 'KEEP IT FAMILY-FRIENDLY')),
    el('span', {}, ownText.length + ' / ' + OWN_LINE_MAX));
  area.addEventListener('input', () => {
    ownText = area.value.slice(0, OWN_LINE_MAX);
    ownError = '';
    count.lastChild.textContent = ownText.length + ' / ' + OWN_LINE_MAX;
    count.firstChild.textContent = 'KEEP IT FAMILY-FRIENDLY';
    const speak = document.getElementById('speakOwn');
    if (speak) { const ok = !!ownText.trim(); speak.style.background = ok ? '#D9A441' : '#3A4A52'; speak.style.color = ok ? '#0F1E28' : '#8FA5A3'; speak.setAttribute('aria-disabled', ok ? 'false' : 'true'); }
  });
  const speak = bigButton('SPEAK IT IN CHARACTER', !!ownText.trim() && !mutedNow, () => {
    const text = (document.getElementById('ownLine').value || '').trim();
    if (!text || mutedNow) return;
    if (!familyClean(text)) { ownError = "LET'S KEEP IT FAMILY-FRIENDLY"; render(); return; }
    channel.post({ type: 'own', seat, beatId: state.turn.beatId, text });
  });
  speak.id = 'speakOwn';
  setTimeout(() => { const a = document.getElementById('ownLine'); if (a) a.focus(); }, 0);
  return [
    heading('Your Turn', 'Write your own line'),
    parchment(tag('YOUR OWN WORDS'), area, count),
    el('div', { style: 'display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px' },
      smallButton(PEN, 'PICK A LINE', () => { writing = false; render(); }),
      smallButton(MIC, 'SPEAK ALOUD', null, true, 'NEEDS LIVE MEET')),
    speak
  ];
}

function voteView() {
  const v = state.vote;
  const mine = v.votes[seat] || null;
  const pickedVote = mine || voted;
  return [
    heading('Cast Your Vote', mine ? 'Your vote is in' : 'One vote each'),
    parchment(
      el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-weight: 700; font-size: 17px; color: #0F1E28; padding: 0 2px" }, v.question),
      ...v.options.map((slug) => choice({
        tagText: (castEntry(game, slug).role || '').toUpperCase(), text: titleOf(game, slug), selected: pickedVote === slug, disabled: !!mine,
        onPick: () => { voted = slug; render(); }
      }))),
    bigButton('CAST MY VOTE', !mine && !!voted, () => channel.post({ type: 'vote', seat, beatId: v.beatId, choice: voted }))
  ];
}

// The Gambler's Gambit: the Stage rolls; your Hand only asks it to.
function diceView() {
  const d = dice();
  const mine = d.players.find((p) => p.seat === seat);
  const roll = d.lastRoll ? d.lastRoll.dice[0] + ' + ' + d.lastRoll.dice[1] + ' = ' + d.lastRoll.total : '';
  return [
    heading("The Gambler's Gambit", mine ? mine.crowns + ' crowns' : ''),
    parchment(
      tag(beatTag() + (myRoll() ? 'YOUR ROLL' : 'AT THE TABLE: ' + titleOf(game, d.shooter).toUpperCase())),
      d.point ? cardTitle('The point is ' + d.point) : cardTitle('Come-out roll'),
      roll ? prose('Last roll: ' + roll) : null,
      d.line ? prose(d.line, 'font-style: italic; color: #3B4B57') : null,
      d.forfeit ? prose('Forfeit: ' + d.forfeit.text, 'color: #8A6420') : null),
    myRoll() ? bigButton('ROLL THE DICE', true, () => channel.post({ type: 'roll', seat })) : el('div', { style: 'font-size: 14px; font-style: italic; color: #A9C9C4' }, 'Wait for your turn to roll. The Stage rolls for everyone, so the dice are the same on every screen.')
  ];
}

function secretsView() {
  const list = (state && state.secrets && state.secrets[seat]) || [];
  seenSecrets = list.length;
  if (!list.length) return [heading('Secrets', 'For your eyes only'), parchment(tag('NOTHING YET'), prose('If a secret comes your way, it will appear here, and only here.'))];
  return [heading('Secrets', 'For your eyes only'), ...list.map((s) => parchment(tag((theatre() && s.envelope ? 'ENVELOPE ' + s.envelope + ' · ' : '') + s.title.toUpperCase()), prose(s.text)))];
}

function characterView() {
  return [
    heading('Your Character', ''),
    parchment(cardTitle(me.title), prose(me.role, 'font-style: italic; color: #3B4B57'), prose(me.bio)),
    parchment(tag('YOUR AIM · ONLY YOU CAN SEE THIS'), prose(me.objective))
  ];
}

function cluesView() {
  const list = (state && state.clues) || [];
  if (!list.length) return [heading('Clues', 'Shared with everyone'), parchment(tag('NOTHING YET'), prose('Clues revealed on the Stage are collected here.'))];
  return [heading('Clues', 'Shared with everyone'), ...list.map((c) => parchment(tag('CLUE'), cardTitle(c.title), prose(c.text)))];
}

function render() {
  renderPrompt();
  const views = { lines: linesView, secrets: secretsView, character: characterView, clues: cluesView };
  const view = $('view');
  view.innerHTML = '';
  views[tab]().filter(Boolean).forEach((node) => view.appendChild(node));
  document.querySelectorAll('nav [data-tab]').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.style.color = on ? '#D9A441' : '#A9C9C4';
    b.style.fontWeight = on ? '700' : '400';
    b.style.borderTop = on ? '2px solid #D9A441' : '2px solid transparent';
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  const total = ((state && state.secrets && state.secrets[seat]) || []).length;
  const unseen = tab === 'secrets' ? 0 : Math.max(0, total - seenSecrets);
  $('secretBadge').hidden = !unseen;
  $('secretBadge').textContent = String(unseen);
}

document.querySelectorAll('nav [data-tab]').forEach((b) => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
render();
