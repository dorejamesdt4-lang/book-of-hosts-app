// ====================================================================
// THE HOST CONSOLE, theatre (console.html) — presenter view on the
// laptop. It holds no game state of its own: the Stage window runs the
// show and broadcasts its state; the console shows the full script,
// what's now and next, notes, and sends commands back (Next, Back,
// Stand-in, jukebox...). A presentation clicker works here too.
// console.html?pack=<id> follows a Show Pack (the Stage says which).
// ====================================================================

import { loadAll, pack as packFor, el, openChannel, pill, lsGet, keys, onClicker, playerName, packParam, loadShowpack } from './common.js';
import { screenTextOf, playedByText } from '../engine/showpack.js';
import { uiFor, hostKit } from './module-ui.js';
import { titleOf, setLine, envelopeFor, envelopes } from '../engine/script.js';
import { createJukeboxPanel } from './jukebox-panel.js';

const $ = (id) => document.getElementById(id);
const data = await loadAll();
const sp = packParam() ? await loadShowpack(packParam(), data.minigames) : null;
const game = sp ? sp.game : data.game;
const pack = packFor(data, game.game.theme);
const packCast = sp ? lsGet(keys.packCast(sp.entry.id), { guests: [] }) : null;
// The guest's name: a Show Pack's casting, or the name on their Hand.
const guestOf = (seat) => (sp ? playedByText(packCast, seat) : playerName(seat));
const lineText = (b) => screenTextOf({ text: b.text, screenText: b.screen_text }, sp.manifest, packCast);
const speakerOf = (b) => (b.speaker === 'narrator' ? pack.narrator.name : titleOf(game, b.speaker));
const STALE_MS = 7000;

let st = null;
let lastHeard = 0;
const channel = openChannel((msg) => {
  if (msg.type === 'state') { st = msg; lastHeard = Date.now(); render(); }
  if (msg.type === 'jukebox') jukebox.render(msg.state);
});
const cmd = (name, extra) => channel.post({ type: 'cmd', cmd: name, ...(extra || {}) });
// The newer mini-games' controls (Deal, Reveal Keeper, Approve Hint...).
const kit = hostKit({ host: (c, extra) => cmd('module-host', { action: { cmd: c, ...(extra || {}) } }), titleOf: (seat) => titleOf(game, seat) });

$('gameTitle').textContent = game.game.title + ' · ' + pack.name;

/* -------------------- the full script -------------------- */
const TYPE_LABEL = { narration: 'NARRATION', character_turn: 'LINE', private_reveal: 'ENVELOPE', clue_drop: 'CLUE', mini_game: 'MINI-GAME', vote: 'VOTE', finale: 'FINALE', music: 'MUSIC', line: 'VOICED LINE', pause: 'PAUSE' };

function summary(b) {
  switch (b.type) {
    case 'narration': return b.text;
    case 'character_turn': return titleOf(game, b.character) + ': ' + setLine(b).text;
    case 'private_reveal': { const e = envelopeFor(game, b.id, 'secret'); return 'Envelope ' + (e ? e.number : '') + ' → ' + titleOf(game, b.character) + '. ' + b.announce; }
    case 'clue_drop': return (b.clue.title ? b.clue.title + '. ' : '') + b.clue.text;
    case 'mini_game': { const c = data.minigames.find((m) => m.id === b.card); return (c ? c.name : b.card) + (b.narration ? '. ' + b.narration : ''); }
    case 'vote': return b.question;
    case 'finale': return b.narration[0];
    case 'music':
      if (b.stop) return 'Music stops';
      if (!b.mood) return '♪ ' + (b.track || 'Music') + ' (plays by itself if the Jukebox has it)';
      return '♪ ' + b.mood.charAt(0).toUpperCase() + b.mood.slice(1) + ' music (plays by itself)';
    case 'line': return speakerOf(b) + ': ' + lineText(b);
    case 'pause': return b.prompt;
    default: return '';
  }
}

// The script list is for reading only: in theatre nothing can be skipped,
// so beats aren't clickable. Next moves one beat at a time; Back goes back.
const rows = game.beats.map((b, i) => {
  const row = el('div', { class: 'cx-row', 'aria-label': 'Beat ' + (i + 1) + ': ' + TYPE_LABEL[b.type] },
    el('div', { class: 'cx-num' }, 'BEAT ' + (i + 1)),
    el('div', { style: 'display: flex; flex-direction: column; gap: 3px' },
      el('div', { class: 'cx-kind' }, TYPE_LABEL[b.type] || b.type.toUpperCase()),
      el('div', {}, summary(b)),
      b.host_note ? el('div', { class: 'cx-note' }, 'Note: ' + b.host_note) : null));
  $('script').appendChild(row);
  return row;
});

/* -------------------- now / next -------------------- */
const K = (t) => el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 3px; color: #8A6420" }, t);
const H = (t) => el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-weight: 700; font-size: 22px; line-height: 1.2; color: #0F1E28" }, t);
const P = (t, extra) => el('div', { style: 'position: relative; font-size: 17px; line-height: 1.45; color: #1B2A36;' + (extra || '') }, t);

function nowCard() {
  const box = $('now');
  box.innerHTML = '';
  box.appendChild(el('div', { style: 'position: absolute; inset: 10px; border: 1px solid #B8923E; border-radius: 4px; pointer-events: none' }));
  if (!st || st.phase === 'cover') {
    box.append(K('NOW'), H('Ready to begin'), P(sp ? 'When the Stage window (on the TV) says the show is ready, click Start show on it, or press Next here or on your clicker.' : 'Click Begin on the Stage window (on the TV), or press Next here or on your clicker.'));
    return;
  }
  if (st.phase === 'ended') {
    box.append(K('CURTAIN'), H('The tale is told'), P('Download the Tale for the keepsake.'));
    return;
  }
  const b = game.beats[st.index];
  const n = 'BEAT ' + (st.index + 1) + ' · ' + (TYPE_LABEL[b.type] || '');
  switch (b.type) {
    case 'narration':
      box.append(K(n), H(st.narration === 'text' ? 'Read aloud' : 'The narrator speaks'), P(b.text));
      break;
    case 'character_turn': {
      const picked = st.selected ? st.selected[b.character] : undefined;
      const set = setLine(b);
      box.append(K(n), H(titleOf(game, b.character) + (guestOf(b.character) ? ' · ' + guestOf(b.character) : '')), P(b.prompt, 'font-style: italic; color: #3B4B57'),
        ...b.lines.map((l, i) => P(l.tone.toUpperCase() + (l === set ? ' · SET LINE' : '') + (picked === i ? ' · TAPPED ON THEIR PHONE' : '') + ': ' + l.text, picked === i ? 'font-weight: 700' : '')),
        P('Stand-in reads ' + (picked !== undefined ? 'the line they tapped.' : 'the set line.'), 'font-size: 14px; font-style: italic; color: #3B4B57'));
      break;
    }
    case 'private_reveal': {
      const e = envelopeFor(game, b.id, 'secret');
      box.append(K(n), H('Envelope ' + (e ? e.number : '') + ' → ' + titleOf(game, b.character)), P(b.announce));
      break;
    }
    case 'clue_drop':
      box.append(...[K(n), b.clue.title ? H(b.clue.title) : null, P(b.clue.text), b.narration ? P(b.narration, 'font-style: italic; color: #3B4B57') : null].filter(Boolean));
      break;
    case 'line': {
      const who = b.speaker === 'narrator' ? '' : guestOf(b.speaker);
      box.append(K(n), H(speakerOf(b) + (who ? ' · ' + who : '')), P(lineText(b)), P('Plays by itself, then the show carries on.', 'font-size: 14px; font-style: italic; color: #3B4B57'));
      break;
    }
    case 'pause':
      box.append(K(n), H('A pause'), P(b.prompt), P('Press Next when the room is ready.', 'font-size: 14px; font-style: italic; color: #3B4B57'));
      break;
    case 'mini_game': {
      const c = data.minigames.find((m) => m.id === b.card);
      if (st.game && uiFor(st.game.module)) {
        box.append(...uiFor(st.game.module).hostPanel(st.game.module, kit).filter(Boolean));
        if (st.game.module.done) box.append(P(b.return_when_done ? 'The show carries on in a moment.' : 'Press Next to carry on.'));
        break;
      }
      box.append(K(n), H(c ? c.name : b.card));
      if (st.game && st.game.module) {
        const m = st.game.module;
        if (m.done) {
          const e = envelopeFor(game, b.id, 'prize');
          box.append(P('The dice are still. Winner: ' + m.result.winners.map((s) => titleOf(game, s)).join(' and ') + '.'));
          if (e) box.append(P('Hand them the prize envelope ' + e.number + '. Press Next to carry on.'));
          else if (b.return_when_done) box.append(P('The show carries on in a moment.'));
        } else {
          box.append(P('Now rolling: ' + titleOf(game, m.shooter) + '. Press Next (or the clicker) to roll for them.'), P(m.line || '', 'font-style: italic; color: #3B4B57'));
        }
      } else {
        const t = st.game && st.game.countdown;
        box.append(P(t ? 'Time left: ' + Math.floor(Math.ceil(t.left / 1000) / 60) + ':' + String(Math.ceil(t.left / 1000) % 60).padStart(2, '0') : ''), P('Press Next when the game is done.'));
      }
      break;
    }
    case 'vote': {
      box.append(K(n), H(b.question));
      const v = st.vote;
      const counts = {};
      if (v) Object.values(v.votes).forEach((slug) => { counts[slug] = (counts[slug] || 0) + 1; });
      b.options.forEach((slug) => {
        const minus = el('button', { type: 'button', class: 'cx-btn', style: 'color: #0F1E28; border-color: #CDBF9F; height: 36px', 'aria-label': 'One fewer vote for ' + titleOf(game, slug) }, '−');
        const plus = el('button', { type: 'button', class: 'cx-btn', style: 'color: #0F1E28; border-color: #CDBF9F; height: 36px', 'aria-label': 'One more vote for ' + titleOf(game, slug) }, '+');
        minus.addEventListener('click', () => cmd('hostvote', { choice: slug, delta: -1 }));
        plus.addEventListener('click', () => cmd('hostvote', { choice: slug, delta: 1 }));
        minus.disabled = plus.disabled = !(v && v.open);
        box.appendChild(el('div', { style: 'position: relative; display: flex; align-items: center; gap: 10px' },
          el('span', { style: 'flex-grow: 1; font-size: 17px' }, titleOf(game, slug)), minus,
          el('span', { style: "min-width: 28px; text-align: center; font-family: 'Cinzel', serif; font-weight: 700" }, String(counts[slug] || 0)), plus));
      });
      box.append(P(v && v.open ? 'Count a show of hands (phones vote too). Press Next to close the vote.' : 'The vote is closed. Press Next for the reveal.', 'font-size: 14px; font-style: italic; color: #3B4B57'));
      break;
    }
    case 'finale':
      box.append(K(n), H('The reveal'), ...b.narration.map((t) => P(t)));
      break;
    default:
      box.append(K(n));
  }
  if (b.host_note) box.appendChild(P('Note: ' + b.host_note, 'font-size: 14px; font-style: italic; color: #8A6420'));
}

function upNext() {
  const box = $('upNext');
  box.innerHTML = '';
  const from = st && st.phase !== 'cover' ? st.index + 1 : 0;
  game.beats.slice(from, from + 3).forEach((b, i) => {
    box.appendChild(el('div', {}, el('span', { style: "font-family: 'Silkscreen', monospace; font-size: 10px; color: #D9A441" }, 'BEAT ' + (from + i + 1) + ' '), summary(b)));
  });
  if (!box.children.length) box.appendChild(el('div', {}, 'Nothing more. That was the last beat.'));
}

function narrationToggle() {
  const box = $('narration');
  box.innerHTML = '';
  const value = st ? st.narration : lsGet(keys.narration, 'voice');
  box.append(
    pill('NARRATOR VOICE', value === 'voice', () => cmd('narration', { value: 'voice' })),
    pill("I'LL READ IT", value === 'text', () => cmd('narration', { value: 'text' })));
}

/* -------------------- NEXT STEP: one plain instruction at a time -------------------- */
const T = (seat) => titleOf(game, seat).toUpperCase();

function nextStep() {
  if (!st) return 'Open the Stage window, then click BEGIN on it.';
  if (st.phase === 'cover') return sp ? 'When the Stage says the show is ready, click START SHOW on it, or press NEXT.' : 'Click BEGIN on the Stage window (on the TV), or press NEXT.';
  if (st.phase === 'ended') return 'The tale is told. Press DOWNLOAD THE TALE for the keepsake.';
  if (st.paused) return 'Paused. Press RESUME to carry on.';
  const b = game.beats[st.index];
  const voice = st.narration !== 'text';
  switch (b.type) {
    case 'narration':
      return voice ? 'The narrator is speaking. Press NEXT when they finish.' : 'Read the narration below aloud, then press NEXT.';
    case 'character_turn':
      return T(b.character) + ' is reading their line. Press NEXT when they finish.';
    case 'private_reveal': {
      const e = envelopeFor(game, b.id, 'secret');
      return 'Ask ' + T(b.character) + ' to open envelope ' + (e ? e.number : '') + ', then press NEXT.';
    }
    case 'clue_drop':
      return voice ? 'A clue is on the screen. Press NEXT when the room has read it.' : 'Read out the clue on the screen, then press NEXT.';
    case 'mini_game': {
      const m = st.game && st.game.module;
      if (uiFor(m)) return uiFor(m).hostPrompt(m);
      if (m && !m.done) return 'Dice game: press ROLL THE DICE for ' + T(m.shooter) + '.';
      if (m && m.done) {
        const e = envelopeFor(game, b.id, 'prize');
        const who = m.result.winners.map(T).join(' and ');
        if (!e && b.return_when_done) return who + ' won. The show carries on by itself.';
        return e ? 'Give ' + who + ' prize envelope ' + e.number + ', then press NEXT.' : who + ' won. Press NEXT.';
      }
      const c = data.minigames.find((x) => x.id === b.card);
      return 'Play ' + (c ? c.name.toUpperCase() : 'the mini-game') + ' now (the rules are on the screen). Press NEXT when it is done.';
    }
    case 'vote':
      return st.vote && st.vote.open ? 'Count the hands for each suspect, then press NEXT to close the vote.' : 'The vote is in. Press NEXT for the reveal.';
    case 'finale':
      return voice ? 'The reveal: let the narrator finish.' : 'Read the reveal below aloud.';
    case 'line':
      return st.index >= game.beats.length - 1 ? 'The last line is playing. Press NEXT to bring down the curtain.' : 'The line is playing. The show carries on by itself.';
    case 'pause':
      return 'A pause: let the room talk. Press NEXT when they are ready.';
    default:
      return 'Press NEXT.';
  }
}

function render() {
  $('nextStepText').textContent = nextStep();
  const connected = st && Date.now() - lastHeard < STALE_MS;
  $('link').textContent = connected ? 'STAGE CONNECTED' : 'WAITING FOR THE STAGE';
  $('link').style.color = connected ? '#5AA8A0' : '#8FA5A3';
  rows.forEach((row, i) => {
    const now = st && st.phase === 'running' && i === st.index;
    row.classList.toggle('is-now', now);
    row.classList.toggle('is-done', !!st && st.phase !== 'cover' && i < st.index);
    if (now) row.setAttribute('aria-current', 'step'); else row.removeAttribute('aria-current');
  });
  const current = rows[st ? st.index : -1];
  if (current) current.scrollIntoView({ block: 'nearest' });
  const b = st && st.index >= 0 ? game.beats[st.index] : null;
  $('btnStandIn').disabled = !(b && b.type === 'character_turn' && st.phase === 'running');
  $('btnPause').textContent = st && st.paused ? 'RESUME' : 'PAUSE';
  const mod = st && st.game && st.game.module;
  $('btnNext').textContent = uiFor(mod) && !mod.done ? (mod.primary ? uiFor(mod).primaryLabel(mod) : 'NEXT ›') : mod && !mod.done ? 'ROLL THE DICE ›' : st && st.vote && st.vote.open ? 'CLOSE THE VOTE ›' : st && st.phase === 'cover' ? 'BEGIN ›' : 'NEXT ›';
  nowCard();
  upNext();
  narrationToggle();
}

/* -------------------- controls -------------------- */
$('btnNext').addEventListener('click', () => cmd('next'));
$('btnBack').addEventListener('click', () => cmd('back'));
$('btnStandIn').addEventListener('click', () => cmd('standin'));
$('btnRepeat').addEventListener('click', () => cmd('repeat'));
$('btnPause').addEventListener('click', () => cmd('pause'));
$('btnOpenStage').addEventListener('click', () => window.open('theatre-stage.html' + (sp ? '?pack=' + encodeURIComponent(sp.entry.id) : ''), 'ls3-stage'));
// A Show Pack is voiced by its own files: no narration choice to make.
if (sp) $('narration').parentElement.hidden = true;
// The printed theatre scripts are for master scripts, not Show Packs.
$('btnScripts').hidden = !!sp;
$('btnScripts').addEventListener('click', () => window.open('print.html?mode=theatre', '_blank', 'noopener'));
$('btnTale').addEventListener('click', () => window.open('print.html?mode=keepsake', '_blank', 'noopener'));
onClicker({ next: () => cmd('next'), back: () => cmd('back') });

const jukebox = createJukeboxPanel($('jukebox'), {
  onPause: () => cmd('jb-pause'),
  onSkip: () => cmd('jb-skip'),
  onVolume: (v) => cmd('jb-volume', { value: v }),
  onPlayNow: (m) => cmd('jb-playnow', { mood: m })
});
jukebox.render({ mood: null, track: null, paused: false, volume: lsGet(keys.volume, 0.7), missing: false });

channel.post({ type: 'console-hello' });
setInterval(() => { channel.post({ type: 'console-hello' }); render(); }, 3000);
render();
// Envelopes for this game, for reference in the console's title.
$('gameTitle').title = envelopes(game).map((e) => 'Envelope ' + e.number + ': ' + e.title).join(' · ');
