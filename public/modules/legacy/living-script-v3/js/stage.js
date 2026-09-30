// ====================================================================
// THE STAGE, online (TV / shared screen, host's computer). The show's
// rules run in ../engine/show.js; this page supplies what the engine
// can't do itself: voices (voice bank + FX), the talking portrait, the
// music, the screen, and the link to the Player's Hands.
//
//   stage.html?mode=live                 Begin the Tale (the game's pack)
//   stage.html?mode=rehearse&theme=<id>  Rehearse: lines, votes and dice
//                                        are picked for everyone
// ====================================================================

import {
  loadAll, pack as packFor, registryEntry, el, fitBoard, openChannel, createPresence,
  spriteFor, playerName, prefs, lsGet, lsSet, keys, familyClean, OWN_LINE_MAX
} from './common.js';
import { createShow } from '../engine/show.js';
import { castEntry, castInSeatOrder, titleOf, actOf, roman } from '../engine/script.js';
import { narratorVoice, characterVoice, speechItems } from '../engine/themes.js';
import { createVoiceBank } from './voice-bank.js';
import { createSpeech } from './speech.js';
import { createSpeaker } from './speaker.js';
import { createMusic } from './music.js';
import { createJukeboxPanel } from './jukebox-panel.js';
import { createDiceView } from './dice-view.js';
import { loadRegistry, getCharacter } from '../../narrator/character-registry.js';
import { createSpeakerStage } from '../../narrator/speaker-stage.js';
import { loadModuleData, moduleOptionsFor, modulesUsed } from './common.js';
import { uiFor } from './module-ui.js';

const $ = (id) => document.getElementById(id);
fitBoard($('board'));

const params = new URLSearchParams(location.search);
const mode = params.get('mode') === 'rehearse' ? 'rehearse' : 'online';
const data = await loadAll();
await loadRegistry();
const { game } = data;
// Mini-games' narrator lines and word pools (online there's no console:
// the newer mini-games play the host's part themselves).
const moduleData = await loadModuleData(modulesUsed(game, data.minigames));
let announced = '';
const pack = packFor(data, mode === 'rehearse' ? (params.get('theme') || game.game.theme) : game.game.theme);
const TICK_MS = 250;
const MOUTH_SMOOTHING = 0.4;

const bank = createVoiceBank();
const speech = createSpeech();
speech.setPreset(pack.voice_fx);
const music = createMusic({ manifest: data.jukebox, theme: pack.music_theme, volume: lsGet(keys.volume, 0.7), onChange: (st) => jukebox.render(st) });
const speaker = createSpeaker({ bank, speech, music });
const narrator = narratorVoice(pack);
const presence = createPresence();

/* -------------------- sprites -------------------- */
const spriteBox = $('spriteBox');
const stage = createSpeakerStage({ stageEl: spriteBox, primaryFrame: $('stageFrame') });
if (window.ResizeObserver) new ResizeObserver(() => stage.updateScale()).observe(spriteBox);
const spriteOf = {};
game.cast.forEach((c) => { spriteOf[c.character] = spriteFor(data, c.character); });
const sprites = [...new Set(Object.values(spriteOf))];
stage.setPrimary(getCharacter(sprites[0]));
stage.prepare(sprites);
stage.updateScale();

/* -------------------- the engine -------------------- */
let st = null;
const channel = openChannel(onMessage);

const show = createShow({
  game, minigames: data.minigames, mode, familyClean, ownLineMax: OWN_LINE_MAX,
  moduleOptions: moduleOptionsFor(moduleData),
  effects: {
    // A mini-game's fixed narrator line: a caption only (never voiced here).
    announce({ text }) { announced = text; },
    speak({ seat, text, onStart }) {
      const v = seat ? characterVoice(game, pack, seat, prefs) : narrator;
      const sprite = seat ? spriteOf[seat] : null;
      let smoothed = 0;
      return speaker.say({
        item: { text, voice: v.voice, speed: v.speed },
        rate: v.rate,
        isPaused: () => st && st.paused,
        onStart: () => { showPlate(seat, sprite); $('pulse').hidden = false; onStart(); },
        onLevel: sprite ? (level) => { smoothed += (level - smoothed) * MOUTH_SMOOTHING; if (level === 0 && smoothed < 0.02) stage.silence(); else stage.talk(sprite, smoothed); } : null
      }).then(() => { $('pulse').hidden = true; stage.silence(); });
    },
    stopSpeech() { speech.stop(); },
    music(cue) { music.cue(cue); },
    changed(state) { st = state; render(); channel.post({ type: 'state', ...state }); saveKeepsake(); },
    isHandOpen: (seat) => presence.open(seat)
  }
});
st = show.state;
setInterval(() => {
  show.tick(TICK_MS);
  // The turn timer counts down between engine events; keep it moving.
  if (st && st.turn) { st = show.state; renderNextBox(); }
}, TICK_MS);

/* -------------------- the page furniture -------------------- */
$('rehearsalBadge').hidden = mode !== 'rehearse';
$('actFirst').textContent = 'ACT ' + roman(game.acts[0].number);
$('actLast').textContent = 'ACT ' + roman(game.acts[game.acts.length - 1].number);
$('coverTitle').textContent = game.game.title;
$('coverSub').textContent = mode === 'rehearse'
  ? 'Rehearsal · ' + pack.name + ' · lines, votes and dice are picked for you'
  : 'Told by ' + pack.narrator.name + ' · ' + pack.name;
$('coverNote').textContent = 'Captions are always on. The Host Console sits at the bottom of the screen.';

function showPlate(seat, sprite) {
  if (!seat) {
    spriteBox.classList.add('is-empty');
    $('plateName').textContent = pack.narrator.name;
    $('plateSub').textContent = 'Your narrator';
    return;
  }
  spriteBox.classList.remove('is-empty');
  stage.show(sprite);
  const c = castEntry(game, seat);
  const who = playerName(seat);
  $('plateName').textContent = c.title;
  $('plateSub').textContent = who ? 'played by ' + who : c.role;
}

function whoLabel(seat) {
  if (!seat) return 'NARRATOR';
  const who = playerName(seat);
  return (titleOf(game, seat) + (who ? ' · ' + who : '')).toUpperCase();
}

/* -------------------- The Tale So Far (captions) -------------------- */
function renderTale() {
  const box = $('tale');
  box.innerHTML = '';
  const tale = st.tale;
  const lastLine = tale.map((t) => t.kind).lastIndexOf('line');
  tale.forEach((t, i) => {
    if (t.kind === 'clue' || t.kind === 'note') {
      box.appendChild(el('div', { style: 'display: flex; flex-direction: column; gap: 3px; padding: 12px 14px; border: 1px dashed #B8923E; border-radius: 8px' },
        el('div', { style: "font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 3px; color: #8A6420" }, (t.kind === 'clue' ? 'CLUE · ' : '') + t.title.toUpperCase()),
        el('div', { style: 'font-size: 19px; line-height: 1.5; color: #1B2A36' }, t.text)));
      return;
    }
    const current = i === lastLine;
    box.appendChild(el('div', { style: 'display: flex; flex-direction: column; gap: 3px; ' + (current ? 'background: rgba(90,168,160,0.14); border-radius: 6px; padding: 10px 12px; margin: 0 -12px;' : '') },
      el('div', { style: "font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 3px; color: " + (current || !t.seat ? '#2E6E69' : '#8A6420') }, whoLabel(t.seat)),
      el('div', { style: 'font-size: 19px; line-height: 1.5; color: #1B2A36' }, t.text)));
  });
  box.scrollTop = box.scrollHeight;
}

/* -------------------- right-page panels -------------------- */
let panelKind = null;
let diceView = null;

function showPanel(kind, label, build) {
  $('rightLabel').textContent = label;
  $('tale').hidden = true;
  const panel = $('panel');
  if (panelKind !== kind) {
    panel.innerHTML = '';
    diceView = null;
    build(panel);
    panelKind = kind;
  }
  panel.hidden = false;
}

function hidePanel() {
  panelKind = null;
  diceView = null;
  $('rightLabel').textContent = 'THE TALE SO FAR';
  $('panel').hidden = true;
  $('tale').hidden = false;
}

const pillTag = (text) => el('div', { style: "font-family: 'Silkscreen', monospace; font-size: 11px; letter-spacing: 1px; color: #2E6E69; border: 1px solid #CDBF9F; border-radius: 999px; padding: 6px 12px" }, text);

function miniGameCard(panel, card) {
  panel.append(
    el('div', { style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: 30px; line-height: 1.15; color: #0F1E28" }, card.name),
    el('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap' },
      pillTag('PLAYERS ' + card.players), pillTag('PROPS: ' + card.props.toUpperCase()), pillTag(card.time.toUpperCase()),
      pillTag(card.online_friendly ? 'ONLINE-FRIENDLY' : 'IN PERSON')),
    el('ol', { style: 'margin: 0; padding-left: 24px; display: flex; flex-direction: column; gap: 6px; font-size: 19px; line-height: 1.45; color: #1B2A36' },
      card.rules.slice(0, 5).map((r) => el('li', {}, r))),
    el('div', { style: 'margin-top: auto; font-size: 16px; font-style: italic; color: #3B4B57' }, 'Play it now. The host moves on with Next Beat when the game is done.'));
}

function votePanel(panel) {
  const v = st.vote;
  const counts = {};
  Object.values(v.votes).forEach((slug) => { counts[slug] = (counts[slug] || 0) + 1; });
  const total = Object.keys(v.votes).length;
  panel.innerHTML = '';
  panel.append(
    el('div', { style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: 30px; line-height: 1.15; color: #0F1E28" }, v.question),
    ...v.options.map((slug) => el('div', { style: 'display: flex; flex-direction: column; gap: 6px' },
      el('div', { style: 'display: flex; justify-content: space-between; font-size: 19px; color: #1B2A36' },
        el('span', {}, titleOf(game, slug)), el('span', { style: "font-family: 'Cinzel', serif; color: #2E6E69" }, String(counts[slug] || 0))),
      el('div', { style: 'height: 8px; border-radius: 999px; background: #D8CBB0; overflow: hidden' },
        el('div', { style: 'height: 100%; background: #2E6E69; width: ' + (total ? ((counts[slug] || 0) / total) * 100 : 0) + '%' })))),
    el('div', { style: 'margin-top: auto; font-size: 16px; font-style: italic; color: #3B4B57' },
      total + ' of ' + game.cast.length + ' have voted' + (v.open ? '' : ' · the vote is closed')));
}

function curtainPanel(panel) {
  const download = el('button', { type: 'button', class: 'pbtn', style: "align-self: flex-start; height: 44px; padding: 0 22px; border: 1px solid #D9A441; border-radius: 6px; background: #D9A441; color: #0F1E28; font-family: 'Cinzel', serif; font-weight: 700; font-size: 13px; letter-spacing: 1px; cursor: pointer" }, 'DOWNLOAD THE TALE');
  download.addEventListener('click', () => window.open('print.html?mode=keepsake', '_blank', 'noopener'));
  panel.append(
    el('div', { style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: 30px; line-height: 1.15; color: #0F1E28" }, 'The Cast'),
    ...castInSeatOrder(game).map((c) => el('div', { style: 'display: flex; justify-content: space-between; gap: 12px; font-size: 19px; color: #1B2A36' },
      el('span', { style: "font-family: 'Cinzel', serif; font-weight: 700" }, c.title),
      el('span', { style: 'font-style: italic; color: #3B4B57' }, playerName(c.character) ? 'played by ' + playerName(c.character) : c.role))),
    el('div', { style: 'font-size: 19px; line-height: 1.5; color: #1B2A36' }, st.result
      ? (st.result.correct ? 'The company named ' + titleOf(game, game.game.culprit) + ', and the company was right.' : 'The company named someone else. It was ' + titleOf(game, game.game.culprit) + '.')
      : 'It was ' + titleOf(game, game.game.culprit) + '.'),
    el('div', { style: 'margin-top: auto; display: flex; flex-direction: column; gap: 8px' },
      download,
      el('div', { style: 'font-size: 16px; font-style: italic; color: #3B4B57' }, 'The whole game as it was played, ready to print or save as a PDF.')));
}

function renderPanels() {
  if (st.phase === 'ended') { showPanel('curtain', 'CURTAIN', curtainPanel); return; }
  if (st.game) {
    const card = data.minigames.find((m) => m.id === st.game.cardId);
    if (st.game.module) {
      const ui = uiFor(st.game.module);
      showPanel('dice:' + st.game.beatId, 'MINI-GAME', (panel) => {
        diceView = ui ? ui.createView(panel, { titleOf: (seat) => titleOf(game, seat), size: 'panel' }) : createDiceView(panel, { titleOf: (seat) => titleOf(game, seat), size: 'panel' });
      });
      diceView.render(st.game.module);
      const at = st.game.module.shooter || st.game.module.active;
      if (at) showPlate(at, spriteOf[at]);
    } else if (card) {
      showPanel('card:' + st.game.beatId, 'MINI-GAME', (panel) => miniGameCard(panel, card));
    }
    return;
  }
  if (st.vote) {
    showPanel('vote', 'THE VOTE', votePanel);
    votePanel($('panel'));
    return;
  }
  hidePanel();
  renderTale();
}

/* -------------------- the NEXT box, header, console -------------------- */
function renderNextBox() {
  const box = $('nextBox');
  if (st.turn && st.turn.left !== null) {
    const who = playerName(st.turn.seat);
    $('nextTitle').textContent = 'NEXT: ' + titleOf(game, st.turn.seat).toUpperCase() + (who ? ' · ' + who.toUpperCase() : '');
    $('nextSub').textContent = st.paused ? 'The tale is paused.' : 'is choosing their words…';
    $('timerText').textContent = String(Math.max(0, Math.ceil(st.turn.left / 1000)));
    $('timerArc').setAttribute('stroke-dashoffset', String(138 * (1 - st.turn.left / st.turn.total)));
    $('timerRing').style.display = '';
    box.hidden = false;
  } else if (st.vote && st.vote.open) {
    $('nextTitle').textContent = 'THE VOTE IS OPEN';
    $('nextSub').textContent = 'Every player votes on their own Hand.';
    $('timerRing').style.display = 'none';
    box.hidden = false;
  } else if (st.game && uiFor(st.game.module) && !st.game.module.done) {
    const m = st.game.module;
    $('nextTitle').textContent = m.active ? 'NOW: ' + whoLabel(m.active) : 'THE NARRATOR';
    $('nextSub').textContent = announced || (m.active ? (presence.open(m.active) && mode !== 'rehearse' ? 'plays from their Hand.' : 'The timer plays for them if they have no Hand open.') : '');
    $('timerRing').style.display = 'none';
    box.hidden = false;
  } else if (st.game && st.game.module && st.game.module.shooter) {
    $('nextTitle').textContent = 'ROLLING: ' + whoLabel(st.game.module.shooter);
    $('nextSub').textContent = presence.open(st.game.module.shooter) && mode !== 'rehearse' ? 'rolls from their Hand.' : 'The Stage rolls for them.';
    $('timerRing').style.display = 'none';
    box.hidden = false;
  } else {
    box.hidden = true;
  }
}

function render() {
  const beat = game.beats[Math.max(0, st.index)];
  const act = actOf(game, beat);
  $('actLabel').textContent = 'Act ' + roman(act.number) + ' · ' + act.title;
  $('beatBadge').textContent = 'BEAT ' + Math.max(1, st.index + 1) + ' OF ' + game.beats.length;
  $('actFill').style.width = (game.beats.length > 1 ? (Math.max(0, st.index) / (game.beats.length - 1)) * 100 : 0) + '%';
  $('btnSkip').disabled = !st.turn;
  $('btnRepeat').disabled = !speaker.canRepeat;
  $('btnNext').disabled = st.phase !== 'running' || st.index >= game.beats.length - 1;
  $('btnPause').textContent = st.paused ? 'RESUME' : 'PAUSE';
  renderPanels();
  renderNextBox();
  if (!$('mutePanel').hidden) renderMuteList();
}

/* -------------------- the Hands -------------------- */
function onMessage(msg) {
  if (msg.type === 'hello' && msg.seat) {
    if (presence.hello(msg.seat) || msg.want === 'state') channel.post({ type: 'state', ...show.state });
    return;
  }
  if (msg.type === 'bye' && msg.seat) { presence.bye(msg.seat); return; }
  if (msg.type === 'pick') show.pick(msg.seat, msg.beatId, msg.line);
  if (msg.type === 'own') show.own(msg.seat, msg.beatId, msg.text);
  if (msg.type === 'vote') show.vote(msg.seat, msg.beatId, msg.choice);
  if (msg.type === 'roll') show.roll(msg.seat);
  if (msg.type === 'module' && msg.seat) show.moduleAct(msg.seat, msg.action);
}

/* -------------------- keepsake -------------------- */
function saveKeepsake() {
  if (!st || st.phase === 'cover') return;
  lsSet(keys.tale, {
    title: game.game.title,
    theme: pack.name,
    narrator: pack.narrator.name,
    mode,
    date: new Date().toISOString(),
    cast: castInSeatOrder(game).map((c) => ({ title: c.title, role: c.role, player: playerName(c.character) })),
    entries: st.tale.map((t) => ({ kind: t.kind, who: t.kind === 'line' ? whoLabel(t.seat) : (t.kind === 'clue' ? 'CLUE · ' : '') + t.title.toUpperCase(), text: t.text })),
    result: st.result ? { correct: st.result.correct, tally: Object.fromEntries(Object.entries(st.result.tally).map(([slug, n]) => [titleOf(game, slug), n])) } : null,
    culprit: titleOf(game, game.game.culprit),
    solution: game.game.solution,
    finished: st.phase === 'ended'
  });
}

/* -------------------- the Host Console -------------------- */
$('btnPause').addEventListener('click', () => {
  const on = !st.paused;
  show.setPaused(on);
  if (on) speech.pause(); else speech.resume();
});
$('btnRepeat').addEventListener('click', () => speaker.repeat());
$('btnSkip').addEventListener('click', () => show.skipTurn());

function togglePanel(btn, panel, onOpen) {
  const open = panel.hidden;
  $('mutePanel').hidden = true;
  $('jukeboxPanel').hidden = true;
  $('btnMute').setAttribute('aria-expanded', 'false');
  $('btnJukebox').setAttribute('aria-expanded', 'false');
  panel.hidden = !open;
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open && onOpen) onOpen();
}
$('btnMute').addEventListener('click', () => togglePanel($('btnMute'), $('mutePanel'), renderMuteList));
$('btnJukebox').addEventListener('click', () => togglePanel($('btnJukebox'), $('jukeboxPanel')));

function renderMuteList() {
  $('muteList').innerHTML = '';
  castInSeatOrder(game).forEach((c) => {
    const on = st.muted.includes(c.character);
    const who = playerName(c.character);
    const b = el('button', {
      type: 'button', class: 'pbtn', 'aria-pressed': on ? 'true' : 'false',
      style: "min-height: 44px; padding: 0 14px; border: 1px solid #D9A441; border-radius: 999px; background: " + (on ? '#D9A441' : 'transparent') + '; color: ' + (on ? '#0F1E28' : '#EDE6D6') + "; font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 1px; cursor: pointer"
    }, c.title + (who ? ' · ' + who : ''));
    b.addEventListener('click', () => show.setMuted(c.character, !on));
    $('muteList').appendChild(b);
  });
}

const jukebox = createJukeboxPanel($('jukeboxPanel'), {
  onPause: () => music.togglePause(),
  onSkip: () => music.skip(),
  onVolume: (v) => { music.setVolume(v); lsSet(keys.volume, v); },
  onPlayNow: (m) => music.playNow(m)
});
jukebox.render(music.state);

$('btnPdf').addEventListener('click', () => {
  if (!st.paused && st.phase === 'running') $('btnPause').click();
  window.open('print.html?mode=script', '_blank', 'noopener');
});
$('btnNext').addEventListener('click', () => show.next());

/* -------------------- start -------------------- */
$('btnStart').addEventListener('click', () => {
  speech.unlock();
  $('cover').hidden = true;
  lsSet(keys.tale, null);
  show.start();
});

// Anything not voiced yet is voiced quietly in the background.
bank.prepare(speechItems(game, pack, prefs, { mode: 'online' }), null).catch((err) => console.error('Background voicing failed', err));
if (mode === 'online') bank.loadModel(null).catch(() => {});

showPlate(null);
render();
channel.post({ type: 'ping' });
setInterval(() => { if (st.phase === 'running') channel.post({ type: 'state', ...show.state }); }, 3000);
