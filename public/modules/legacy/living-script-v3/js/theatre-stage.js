// ====================================================================
// THEATRE MODE — the TV (theatre-stage.html). People read their own
// lines aloud; the TV is the stage and prompter. The show engine runs
// here in 'theatre' mode (every beat waits for the host's Next); the
// Host Console (console.html, on the laptop) and any Player's Hands
// talk to it over the BroadcastChannel.
//
// Clicker: PageDown / PageUp / arrows / Space work on this window and on
// the Host Console window, whichever has focus.
//
// Show Packs (theatre-stage.html?pack=<id>): a pre-voiced game. The cover
// fetches every audio file first (Start show / Start anyway, captions
// only); lines play their file, or show their caption for a timed pause
// if it's missing. Nothing is ever voiced here for a pack.
// ====================================================================

import {
  loadAll, pack as packFor, el, fitBoard, openChannel, createPresence, spriteFor, playerName,
  prefs, lsGet, lsSet, keys, onClicker, packParam, loadShowpack, loadModuleData, loadPool, moduleOptionsFor, modulesUsed
} from './common.js';
import { uiFor } from './module-ui.js';
import { createShow } from '../engine/show.js';
import { castEntry, castInSeatOrder, titleOf, actOf, roman, envelopeFor, cardMinutes } from '../engine/script.js';
import { narratorVoice, speechItems } from '../engine/themes.js';
import { createVoiceBank } from './voice-bank.js';
import { createSpeech } from './speech.js';
import { createSpeaker } from './speaker.js';
import { createMusic } from './music.js';
import { createDiceView } from './dice-view.js';
import { createPackAudio } from './showpack-audio.js';
import { screenTextOf, playedByText, holdMs } from '../engine/showpack.js';
import { pickTrack } from '../engine/jukebox.js';
import { loadRegistry, getCharacter } from '../../narrator/character-registry.js';
import { createSpeakerStage } from '../../narrator/speaker-stage.js';

const $ = (id) => document.getElementById(id);
fitBoard($('board'));

const data = await loadAll();
await loadRegistry();
const packId = packParam();
let sp = null; // the Show Pack: { entry, manifest, game, problems }
if (packId) {
  try {
    sp = await loadShowpack(packId, data.minigames);
  } catch (err) {
    $('coverTitle').textContent = 'This Show Pack could not be loaded.';
    $('coverSub').textContent = String(err.message || err);
    throw err;
  }
}
const game = sp ? sp.game : data.game;
// Mini-game modules' narrator lines and word pools; a Show Pack step may
// bring its own pool (a file in the pack).
const moduleData = await loadModuleData(modulesUsed(game, data.minigames));
const packPools = {};
if (sp) {
  await Promise.all(game.beats.filter((b) => b.type === 'mini_game' && b.pool).map((b) =>
    loadPool(sp.entry.path + b.pool, 'pack-' + b.id).then((pool) => { packPools[b.id] = pool; })
      .catch((err) => console.warn('Show Pack word pool not found: ' + b.pool + ' (the built-in pools are used instead).', err))));
}
const packCast = sp ? lsGet(keys.packCast(sp.entry.id), { guests: [] }) : null;
const pack = packFor(data, game.game.theme);
const TICK_MS = 250;
const MOUTH_SMOOTHING = 0.4;

// A Show Pack's audio is finished: no voice bank, and no voice FX on top.
const bank = sp ? null : createVoiceBank();
const speech = createSpeech();
speech.setPreset(sp ? 'none' : pack.voice_fx);
const packAudio = sp ? createPackAudio({ context: () => speech.context }) : null;
let packReady = false;
let captionsOnly = false;
const channel = openChannel(onMessage);
const music = createMusic({ manifest: data.jukebox, theme: pack.music_theme, volume: lsGet(keys.volume, 0.7), onChange: (m) => channel.post({ type: 'jukebox', state: m }) });
const speaker = createSpeaker({ bank: sp ? packAudio.bank : bank, speech, music });
const narrator = narratorVoice(pack);
const presence = createPresence();

/* -------------------- the spotlight (portraits don't talk: people do) -------------------- */
const spriteBox = $('spriteBox');
const stage = createSpeakerStage({ stageEl: spriteBox, primaryFrame: $('stageFrame') });
if (window.ResizeObserver) new ResizeObserver(() => stage.updateScale()).observe(spriteBox);
const spriteOf = {};
game.cast.forEach((c) => { spriteOf[c.character] = sp ? c.sprite : spriteFor(data, c.character); });
const sprites = [...new Set(Object.values(spriteOf))].filter((id) => getCharacter(id));
if (sprites.length) stage.setPrimary(getCharacter(sprites[0]));
stage.prepare(sprites);
stage.updateScale();

/* -------------------- the engine -------------------- */
let st = null;
let caption = null;     // { who, text }
let captionIndex = -1;  // the beat the caption belongs to
function beatOf() { return st && st.index >= 0 ? game.beats[st.index] : null; }

// Captions-only holds: count down with the show's tick (so Pause holds
// them too) and end at once on Next / Back.
let holds = [];
let stopCount = 0;
function hold(ms) { return new Promise((resolve) => holds.push({ left: ms, resolve })); }
function endHolds() { holds.forEach((h) => h.resolve()); holds = []; }

function packLineText(beat) {
  return screenTextOf({ text: beat.text, screenText: beat.screen_text }, sp.manifest, packCast);
}

function speakerLabel(seat) {
  return seat ? titleOf(game, seat).toUpperCase() : pack.narrator.name.toUpperCase();
}

// A mini-game's fixed narrator lines, one after another (at most two
// waiting, so the game never falls behind): the preloaded file if a Show
// Pack has it, otherwise the caption for a timed pause. Never voiced here.
const announcements = [];
let announcing = false;
function announce(a) {
  announcements.push(a);
  if (announcements.length > 2) announcements.splice(0, announcements.length - 2);
  if (!announcing) nextAnnouncement();
}
async function nextAnnouncement() {
  const a = announcements.shift();
  if (!a) { announcing = false; return; }
  announcing = true;
  const stops = stopCount;
  caption = { who: pack.narrator.name.toUpperCase(), text: a.text };
  render();
  let played = false;
  if (sp && !captionsOnly && packAudio.has(a.lineId)) {
    const clip = await packAudio.bank.get({ lineId: a.lineId });
    if (clip && stops === stopCount) { await speaker.say({ item: { lineId: a.lineId } }); played = true; }
  }
  if (!played && stops === stopCount) await hold(holdMs(a.text));
  nextAnnouncement();
}

// A Show Pack line: its preloaded file, else its caption for a timed pause.
async function speakPackLine({ seat, lineId, onStart }) {
  const i = game.beats.findIndex((b) => b.id === lineId);
  const beat = game.beats[i];
  const shown = packLineText(beat);
  const next = game.beats.slice(i + 1).find((b) => b.type === 'line');
  const sprite = seat && getCharacter(spriteOf[seat]) ? spriteOf[seat] : null;
  const stops = stopCount;
  let started = false;
  const begin = () => { started = true; caption = { who: speakerLabel(seat), text: shown }; onStart(); };
  if (!captionsOnly && packAudio.has(lineId)) {
    const clip = await packAudio.bank.get({ lineId });
    if (stops !== stopCount) return { stopped: true };
    if (next) packAudio.prime(next.id);
    if (clip) {
      let smoothed = 0;
      const r = await speaker.say({
        item: { lineId },
        isPaused: () => st && st.paused,
        onStart: begin,
        onLevel: sprite ? (level) => { smoothed += (level - smoothed) * MOUTH_SMOOTHING; if (level === 0 && smoothed < 0.02) stage.silence(); else stage.talk(sprite, smoothed); } : null
      });
      if (sprite) stage.silence();
      if (started) return r;
    }
  }
  if (stops !== stopCount) return { stopped: true };
  begin();
  await hold(holdMs(shown));
  return { done: true };
}

const show = createShow({
  game, minigames: data.minigames, mode: 'theatre',
  moduleOptions: moduleOptionsFor(moduleData, packPools),
  effects: {
    announce(a) { announce(a); },
    speak({ seat, text, standIn, lineId, onStart }) {
      if (sp && lineId) return speakPackLine({ seat, lineId, onStart });
      const who = standIn ? 'STAND-IN · ' + titleOf(game, seat).toUpperCase() : 'NARRATOR';
      // Host reads the narration: show it as a caption, no voice.
      if (!standIn && st && st.narration === 'text') {
        caption = { who: 'NARRATOR · READ BY YOUR HOST', text };
        onStart();
        return Promise.resolve();
      }
      return speaker.say({
        item: { text, voice: narrator.voice, speed: narrator.speed },
        rate: narrator.rate,
        onStart: () => { caption = { who, text }; onStart(); }
      });
    },
    stopSpeech() { stopCount += 1; speech.stop(); endHolds(); },
    music(cue) {
      if (sp && !cue.stop) {
        // A Show Pack names its track; one the Jukebox hasn't got is skipped quietly.
        const track = cue.track ? pickTrack(data.jukebox, { theme: pack.music_theme, mood: null, track: cue.track }) : null;
        if (track) music.cue({ mood: track.mood, track: track.file });
        return;
      }
      music.cue(cue);
    },
    changed(state) {
      // A new beat clears the caption, so old narration never lingers.
      if (state.index !== captionIndex) { captionIndex = state.index; caption = null; }
      if (sp && state.phase === 'ended') packAudio.release();
      st = state; render(); channel.post({ type: 'state', ...state }); saveKeepsake();
    },
    isHandOpen: (seat) => presence.open(seat)
  }
});
st = show.state;

setInterval(() => {
  show.tick(TICK_MS);
  if (holds.length && !(st && st.paused)) {
    holds = holds.filter((h) => { h.left -= TICK_MS; if (h.left > 0) return true; h.resolve(); return false; });
  }
  // The mini-game timer counts down between engine events.
  if (st && st.game && st.game.countdown) { st = show.state; renderRight(); }
}, TICK_MS);

/* -------------------- drawing -------------------- */
$('actFirst').textContent = 'ACT ' + roman(game.acts[0].number);
$('actLast').textContent = 'ACT ' + roman(game.acts[game.acts.length - 1].number);
$('coverTitle').textContent = game.game.title;
$('coverSub').textContent = 'Theatre · ' + pack.name + ' · told by ' + pack.narrator.name;


function spotlight(seat, name, sub, glow) {
  if (seat && (!sp || getCharacter(spriteOf[seat]))) {
    spriteBox.classList.remove('is-empty');
    stage.show(spriteOf[seat]);
  } else {
    spriteBox.classList.add('is-empty');
  }
  $('pulse').hidden = !glow;
  $('plateName').textContent = name;
  $('plateSub').textContent = sub;
}

function playedBy(seat) {
  const who = sp ? playedByText(packCast, seat) : playerName(seat);
  return who ? 'played by ' + who : castEntry(game, seat).role;
}

function renderLeft() {
  const beat = beatOf();
  if (beat && beat.type === 'character_turn') {
    $('leftLabel').textContent = 'THE SPOTLIGHT';
    spotlight(beat.character, titleOf(game, beat.character), playedBy(beat.character), true);
  } else if (beat && beat.type === 'mini_game' && st.game && st.game.module && (st.game.module.shooter || st.game.module.active)) {
    const at = st.game.module.shooter || st.game.module.active;
    $('leftLabel').textContent = 'AT THE TABLE';
    spotlight(at, titleOf(game, at), playedBy(at), true);
  } else if (beat && beat.type === 'line' && beat.speaker !== 'narrator') {
    $('leftLabel').textContent = 'THE SPOTLIGHT';
    spotlight(beat.speaker, titleOf(game, beat.speaker), playedBy(beat.speaker), true);
  } else if (beat && beat.type === 'finale') {
    $('leftLabel').textContent = 'THE REVEAL';
    spotlight(game.game.culprit, titleOf(game, game.game.culprit), playedBy(game.game.culprit), true);
  } else {
    $('leftLabel').textContent = 'THE STAGE';
    spotlight(null, pack.narrator.name, st && st.narration === 'text' && !sp ? 'Read aloud by your host' : 'Your narrator', false);
  }
}

const kicker = (t) => el('div', { style: "font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 3px; color: #2E6E69" }, t);
const big = (t, size) => el('div', { style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: " + (size || 34) + 'px; line-height: 1.15; color: #0F1E28' }, t);
const prose = (t, size) => el('div', { style: 'font-size: ' + (size || 24) + 'px; line-height: 1.5; color: #1B2A36' }, t);
const note = (t) => el('div', { style: 'margin-top: auto; font-size: 17px; font-style: italic; color: #3B4B57' }, t);
const tag = (text) => el('div', { style: "font-family: 'Silkscreen', monospace; font-size: 12px; letter-spacing: 1px; color: #2E6E69; border: 1px solid #CDBF9F; border-radius: 999px; padding: 6px 12px" }, text);

function mmss(ms) {
  const s = Math.ceil(ms / 1000);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function renderRight() {
  const box = $('right');
  box.innerHTML = '';
  const beat = beatOf();
  if (!beat) { $('rightLabel').textContent = 'THE SCENE'; box.append(prose('The tale is about to begin.')); return; }
  const n = 'BEAT ' + (st.index + 1);
  switch (beat.type) {
    case 'narration':
      $('rightLabel').textContent = 'THE SCENE';
      box.append(kicker(n + ' · THE NARRATOR'), prose(beat.text, 26));
      break;
    case 'line':
      $('rightLabel').textContent = 'THE SCENE';
      box.append(kicker(n + ' · ' + speakerLabel(beat.speaker === 'narrator' ? null : beat.speaker)), prose(packLineText(beat), 26));
      break;
    case 'pause':
      $('rightLabel').textContent = 'THE SCENE';
      box.append(kicker(n + ' · A PAUSE'), big(beat.prompt || 'A pause', 30), note('The show carries on when your host is ready.'));
      break;
    case 'character_turn': {
      $('rightLabel').textContent = 'THE SCENE';
      const act = actOf(game, beat);
      const clue = st.clues && st.clues.length ? st.clues[st.clues.length - 1] : null;
      box.append(...[kicker(n + ' · ACT ' + roman(act.number) + ' · ' + act.title.toUpperCase()), big(titleOf(game, beat.character) + ', your line'), prose(beat.prompt, 22),
        clue ? el('div', { style: 'display: flex; flex-direction: column; gap: 4px; padding: 12px 14px; border: 1px dashed #B8923E; border-radius: 8px' },
          el('div', { style: "font-family: 'Cinzel', serif; font-size: 12px; letter-spacing: 3px; color: #8A6420" }, 'LAST CLUE FOUND · ' + clue.title.toUpperCase()),
          el('div', { style: 'font-size: 19px; line-height: 1.45; color: #1B2A36' }, clue.text)) : null,
        note('Read one of your lines aloud, from your phone or your script.')].filter(Boolean));
      break;
    }
    case 'private_reveal':
    case 'clue_drop':
      $('rightLabel').textContent = 'THE SCENE';
      box.append(kicker(n), prose(beat.type === 'clue_drop' ? beat.narration || beat.clue.text : beat.announce, 24));
      break;
    case 'mini_game': {
      $('rightLabel').textContent = 'MINI-GAME';
      const card = data.minigames.find((m) => m.id === beat.card);
      if (!card) break;
      box.append(kicker(n), big(card.name, 30),
        el('div', { style: 'display: flex; gap: 8px; flex-wrap: wrap' }, tag('PLAYERS ' + card.players), tag('PROPS: ' + card.props.toUpperCase()), tag(card.time.toUpperCase())),
        el('ol', { style: 'margin: 0; padding-left: 26px; display: flex; flex-direction: column; gap: 6px; font-size: 20px; line-height: 1.45; color: #1B2A36' }, card.rules.slice(0, 5).map((r) => el('li', {}, r))));
      if (st.game && st.game.countdown) {
        box.append(el('div', { style: "margin-top: auto; display: flex; align-items: baseline; gap: 14px; font-family: 'Cinzel', serif; color: #0F1E28" },
          el('span', { style: 'font-size: 14px; letter-spacing: 3px; color: #8A6420' }, 'TIME LEFT'),
          el('span', { style: 'font-weight: 700; font-size: 44px' }, st.game.countdown.left > 0 ? mmss(st.game.countdown.left) : "Time's up")));
      }
      break;
    }
    case 'vote': {
      $('rightLabel').textContent = 'THE VOTE';
      const v = st.vote;
      if (!v) break;
      const counts = {};
      Object.values(v.votes).forEach((slug) => { counts[slug] = (counts[slug] || 0) + 1; });
      const total = Object.keys(v.votes).length;
      box.append(kicker(n), big(v.question, 30),
        ...v.options.map((slug) => el('div', { style: 'display: flex; flex-direction: column; gap: 6px' },
          el('div', { style: 'display: flex; justify-content: space-between; font-size: 21px; color: #1B2A36' }, el('span', {}, titleOf(game, slug)), el('span', { style: "font-family: 'Cinzel', serif; color: #2E6E69" }, String(counts[slug] || 0))),
          el('div', { style: 'height: 8px; border-radius: 999px; background: #D8CBB0; overflow: hidden' }, el('div', { style: 'height: 100%; background: #2E6E69; width: ' + (total ? ((counts[slug] || 0) / total) * 100 : 0) + '%' })))),
        note(v.open ? 'Vote on your phone, or by a show of hands.' : 'The vote is in.'));
      break;
    }
    case 'finale':
      $('rightLabel').textContent = 'THE REVEAL';
      box.append(kicker(n), ...beat.narration.map((t) => prose(t, 22)));
      break;
    default:
      break;
  }
}

let overlayFor = null; // the beat the overlay card was built for (the entrance plays once)

const KEY_ICON = '<svg width="120" height="60" viewBox="0 0 120 60" aria-hidden="true" style="position: relative; display: block"><circle cx="24" cy="30" r="16" fill="none" stroke="#B8923E" stroke-width="5"></circle><circle cx="24" cy="30" r="6" fill="#D9A441"></circle><path d="M40 30 H112 M92 30 V44 M104 30 V40" fill="none" stroke="#B8923E" stroke-width="5" stroke-linecap="round"></path></svg>';

function card(parts, { wide = false, unfold = false } = {}) {
  const c = $('overlayCard');
  c.style.width = wide ? '1220px' : '1000px';
  const key = st.phase + ':' + st.index;
  if (overlayFor !== key) {
    // A new card: replay the entrance once (only for cards that unfold).
    c.classList.remove('ls-unfold');
    if (unfold) { void c.offsetWidth; c.classList.add('ls-unfold'); }
    overlayFor = key;
  }
  c.innerHTML = '';
  c.appendChild(el('div', { style: 'position: absolute; inset: 14px; border: 1px solid #B8923E; border-radius: 4px; pointer-events: none' }));
  parts.forEach((p) => c.appendChild(p));
  c.hidden = false;
  $('overlayWide').hidden = true;
  $('overlay').hidden = false;
}

let diceView = null;
let diceBeat = null;

function renderOverlay() {
  const beat = beatOf();
  // The newer mini-games speak through the captions: keep them above the table.
  $('captions').style.zIndex = beat && beat.type === 'mini_game' && st.game && uiFor(st.game.module) && st.phase !== 'ended' ? '1' : '';
  const k = (t) => el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: 6px; color: #8A6420" }, t);
  const h = (t) => el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-weight: 700; font-size: 52px; line-height: 1.12; color: #0F1E28" }, t);
  const p = (t) => el('div', { style: 'position: relative; font-size: 26px; line-height: 1.5; color: #1B2A36; max-width: 820px' }, t);
  if (st.phase === 'ended') {
    card([k('CURTAIN'), h('The Cast'),
      ...castInSeatOrder(game).map((c) => el('div', { style: 'position: relative; font-size: 24px; color: #1B2A36' }, el('span', { style: "font-family: 'Cinzel', serif; font-weight: 700" }, c.title), ' — ' + playedBy(c.character))),
      p(!game.game.culprit ? 'The tale is told.' : st.result ? (st.result.correct ? 'The company named the culprit. Well played.' : 'The company named someone else. It was ' + titleOf(game, game.game.culprit) + '.') : 'It was ' + titleOf(game, game.game.culprit) + '.')]);
    return;
  }
  if (!beat) { $('overlay').hidden = true; return; }
  const first = game.beats.findIndex((b) => b.act === beat.act && b.type !== 'music') === st.index;
  if (beat.type === 'narration' && (beat.title_card || first)) {
    const act = actOf(game, beat);
    card([k('BEAT ' + (st.index + 1) + ' · ACT ' + roman(act.number)), h(act.title), p(beat.text)]);
  } else if (beat.type === 'private_reveal') {
    const env = envelopeFor(game, beat.id, 'secret');
    card([k('FOR YOUR EYES ONLY · BEAT ' + (st.index + 1)), h(titleOf(game, beat.character) + ', open envelope ' + (env ? env.number : '')), p(beat.announce)]);
  } else if (beat.type === 'clue_drop') {
    // Larger, for reading across a room, with a small gold key.
    const icon = el('div', { style: 'position: relative' });
    icon.innerHTML = KEY_ICON;
    card([k('A CLUE · BEAT ' + (st.index + 1)), icon,
      beat.clue.title ? el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-weight: 700; font-size: 64px; line-height: 1.1; color: #0F1E28" }, beat.clue.title) : null,
      el('div', { style: 'position: relative; font-size: 36px; line-height: 1.45; color: #1B2A36; max-width: 1040px' }, beat.clue.text)].filter(Boolean), { wide: true, unfold: true });
  } else if (beat.type === 'mini_game' && st.game && st.game.module) {
    const wide = $('overlayWide');
    if (diceBeat !== beat.id) {
      diceBeat = beat.id;
      wide.innerHTML = '';
      wide.appendChild(el('div', { id: 'diceCallout', role: 'status', style: "margin-bottom: 18px; text-align: center; font-family: 'Cinzel', serif; font-weight: 700; font-size: 40px; color: #D9A441" }));
      const holder = el('div');
      wide.appendChild(holder);
      const ui = uiFor(st.game.module);
      diceView = ui ? ui.createView(holder, { titleOf: (seat) => titleOf(game, seat), size: 'tv' }) : createDiceView(holder, { titleOf: (seat) => titleOf(game, seat), size: 'tv' });
    }
    diceView.render(st.game.module);
    const m = st.game.module;
    // The newer games carry their own Active Focus banner.
    $('diceCallout').textContent = uiFor(m) ? '' : m.done ? 'The dice are still.' : titleOf(game, m.shooter) + ', your roll';
    $('diceCallout').hidden = !!uiFor(m);
    const done = st.game.module.done;
    const env = envelopeFor(game, beat.id, 'prize');
    wide.dataset.done = done ? 'yes' : '';
    $('overlayCard').hidden = true;
    wide.hidden = false;
    $('overlay').hidden = false;
    // When the dice are still, call up the prize envelope.
    if (done && env && st.game.module.result) {
      const names = st.game.module.result.winners.map((s) => titleOf(game, s)).join(' and ');
      $('capWho').textContent = 'THE PRIZE · ENVELOPE ' + env.number;
      $('capText').textContent = names + ', take envelope ' + env.number + '.';
    }
  } else {
    $('overlay').hidden = true;
  }
}

function render() {
  const beat = beatOf();
  if (beat) {
    const act = actOf(game, beat);
    $('actLabel').textContent = 'Act ' + roman(act.number) + ' · ' + act.title;
  }
  $('beatBadge').textContent = 'BEAT ' + Math.max(1, st.index + 1) + ' OF ' + game.beats.length;
  $('actFill').style.width = (game.beats.length > 1 ? (Math.max(0, st.index) / (game.beats.length - 1)) * 100 : 0) + '%';
  $('capWho').textContent = caption ? caption.who : '';
  $('capText').textContent = caption ? caption.text : '';
  renderLeft();
  renderRight();
  renderOverlay();
}

/* -------------------- keepsake -------------------- */
function whoLabel(seat) {
  if (!seat) return 'NARRATOR';
  const who = sp ? playedByText(packCast, seat) : playerName(seat);
  return (titleOf(game, seat) + (who ? ' · ' + who : '')).toUpperCase();
}

function saveKeepsake() {
  if (!st || st.phase === 'cover') return;
  lsSet(keys.tale, {
    title: game.game.title, theme: pack.name, narrator: pack.narrator.name, mode: 'theatre', date: new Date().toISOString(),
    cast: castInSeatOrder(game).map((c) => ({ title: c.title, role: c.role, player: sp ? playedByText(packCast, c.character) : playerName(c.character) })),
    entries: st.tale.map((t) => ({ kind: t.kind, who: t.kind === 'line' ? whoLabel(t.seat) + (t.standIn ? ' (STAND-IN)' : '') : (t.kind === 'clue' ? 'CLUE · ' : '') + t.title.toUpperCase(), text: t.text })),
    result: st.result ? { correct: st.result.correct, tally: Object.fromEntries(Object.entries(st.result.tally).map(([slug, n]) => [titleOf(game, slug), n])) } : null,
    culprit: game.game.culprit ? titleOf(game, game.game.culprit) : null, solution: game.game.solution, finished: st.phase === 'ended'
  });
}

/* -------------------- commands (Host Console, Hands, clicker) -------------------- */
// Show Packs start from the cover's buttons once the audio is fetched
// (the clicker starts the show only then); captions only drops the audio.
function begin({ captions = false } = {}) {
  if (st.phase !== 'cover') return;
  if (sp && !captions && !packReady) return;
  if (sp && captions) { captionsOnly = true; packAudio.release(); }
  speech.unlock();
  $('cover').hidden = true;
  lsSet(keys.tale, null);
  show.start();
}

function setPaused(on) {
  show.setPaused(on);
  if (on) speech.pause(); else speech.resume();
}

function onMessage(msg) {
  if (msg.type === 'hello' && msg.seat) {
    if (presence.hello(msg.seat) || msg.want === 'state') channel.post({ type: 'state', ...show.state });
    return;
  }
  if (msg.type === 'bye' && msg.seat) { presence.bye(msg.seat); return; }
  if (msg.type === 'pick') show.pick(msg.seat, msg.beatId, msg.line);
  if (msg.type === 'vote') show.vote(msg.seat, msg.beatId, msg.choice);
  if (msg.type === 'roll') show.roll(msg.seat);
  if (msg.type === 'module' && msg.seat) show.moduleAct(msg.seat, msg.action);
  if (msg.type === 'console-hello') { channel.post({ type: 'state', ...show.state }); channel.post({ type: 'jukebox', state: music.state }); return; }
  if (msg.type !== 'cmd') return;
  switch (msg.cmd) {
    case 'start': begin(); break;
    case 'next': if (st.phase === 'cover') begin(); else show.next(); break;
    case 'back': show.back(); break;
    case 'goto': show.goTo(msg.index); break;
    case 'pause': setPaused(!st.paused); break;
    case 'standin': show.standIn(); break;
    case 'narration': if (sp) break; lsSet(keys.narration, msg.value); show.setNarration(msg.value); break;
    case 'hostvote': show.hostVote(msg.choice, msg.delta); break;
    case 'module-host': show.moduleHost(msg.action); break;
    case 'repeat': speaker.repeat(); break;
    case 'jb-pause': music.togglePause(); break;
    case 'jb-skip': music.skip(); break;
    case 'jb-volume': music.setVolume(msg.value); lsSet(keys.volume, msg.value); break;
    case 'jb-playnow': music.playNow(msg.mood); break;
  }
}

onClicker({ next: () => (st.phase === 'cover' ? begin() : show.next()), back: () => show.back() });
$('btnStart').addEventListener('click', begin);
$('btnConsole').addEventListener('click', () => window.open('console.html' + (sp ? '?pack=' + encodeURIComponent(sp.entry.id) : ''), 'ls3-console', 'popup,width=1280,height=860'));

// The narration (unless the host reads it) and the stand-in set lines,
// voiced quietly in the background if the Lobby didn't finish them.
if (!sp) bank.prepare(speechItems(game, pack, prefs, { mode: 'theatre', narration: lsGet(keys.narration, 'voice') }), null).catch((err) => console.error('Background voicing failed', err));

// The host's narration choice (voice or read aloud), once everything above exists.
// A Show Pack is always voiced by its own files.
show.setNarration(sp ? 'voice' : lsGet(keys.narration, 'voice'));

/* -------------------- Show Pack: fetch every audio file first -------------------- */
if (sp) {
  $('btnStart').hidden = true;
  $('coverBeginLabel').hidden = true;
  $('packPrep').hidden = false;
  $('coverHint').textContent = 'Move this window to the TV and make it full screen (F11). When the show is ready, click Start show, or press your clicker once.';
  if (sp.problems.length) {
    $('packWarn').hidden = false;
    $('packWarn').textContent = 'Name rule warning: the spoken text of ' + sp.problems.join(', ') + " contains {guest:…}. The narrator must never speak a guest's real name. Put names in screenText only, and re-voice these lines.";
  }
  const lines = game.beats.filter((b) => b.type === 'line').map((b) => ({ id: b.id, audio: b.audio }));
  // The mini-games' fixed narrator lines, if the pack has voiced them (audio/<file>).
  const packModules = new Set(game.beats.filter((b) => b.type === 'mini_game' && b.module).map((b) => b.module));
  packModules.forEach((m) => (moduleData[m] ? moduleData[m].lines : []).forEach((l) => lines.push({ id: l.id, audio: 'audio/' + l.audio })));
  const progress = (done, total) => {
    if (packReady || captionsOnly) return;
    $('packPrepText').textContent = 'Preparing the show… ' + done + ' / ' + total;
    $('packPrepBar').style.width = (total ? (done / total) * 100 : 100) + '%';
  };
  packAudio.preload(lines, sp.entry.path, progress).then((report) => {
    if (report.cancelled || captionsOnly) return;
    packReady = true;
    $('btnPackStart').disabled = false;
    $('packPrepBar').style.width = '100%';
    const bad = report.missing.length + report.failed.length;
    $('packPrepText').textContent = bad ? 'The show is ready, with ' + bad + ' of ' + lines.length + ' lines as captions only.' : 'The show is ready.';
    $('packReport').textContent = [
      report.missing.length ? 'Missing audio: ' + report.missing.join(', ') + '.' : '',
      report.failed.length ? 'Failed to load: ' + report.failed.join(', ') + '.' : '',
      bad ? 'These lines show their caption and carry on after a short pause.' : "Every line's audio is ready."
    ].filter(Boolean).join(' ');
    if (bad) console.warn('Show Pack "' + sp.entry.id + '": missing audio', report.missing, 'failed', report.failed);
  });
  $('btnPackStart').addEventListener('click', () => begin());
  $('btnPackCaptions').addEventListener('click', () => begin({ captions: true }));
  // The host leaves: let the audio go.
  window.addEventListener('pagehide', () => packAudio.release());
}
render();
channel.post({ type: 'ping' });
channel.post({ type: 'state', ...show.state });
setInterval(() => { if (st.phase === 'running') channel.post({ type: 'state', ...show.state }); }, 3000);
