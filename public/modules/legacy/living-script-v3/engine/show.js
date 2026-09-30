// ====================================================================
// ENGINE · THE SHOW — runs a master script beat by beat. Plain JS: no
// DOM, no audio, no storage, no timers of its own. The page drives time
// with tick(ms) (so pausing is just not ticking) and supplies `effects`
// for everything the show makes happen:
//
//   effects = {
//     speak({ seat, text, standIn, lineId, onStart }) -> Promise   // voice a line (seat null = narrator;
//                                                         // lineId: a Show Pack line's id);
//                                                         // call onStart when it starts
//     stopSpeech()
//     music(cue)            // { mood, track } | { stop: true }
//     changed(state)        // redraw + broadcast
//     isHandOpen(seat) -> bool
//     announce({ lineId, text })  // optional: a mini-game's fixed narrator line
//                                 // (audio if preloaded, else a caption); not queued
//                                 // behind the beat, so the game keeps its pace
//   }
//
// Self-paced mini-game modules (export selfPaced = true, e.g. Twenty-One &
// Trouble, Lexical Lanterns) run their own turns and timers: the show
// ticks them, passes guests' moves (moduleAct) and the host's commands
// (moduleHost) through, and tells them when a Hand goes away or comes
// back. In theatre, Next is the host's main command for the moment
// (Deal, Reveal Keeper, Next Round, Next Scroll...). moduleOptions(beat, id)
// adds page data (narrator lines, word pools) to the module's options.
//
// Modes:
//   online    turns wait for the player's Hand (30 s timer, nudge at
//             15 s, Reveal line auto-picked at 0); the show moves on by itself
//   rehearse  like online, but lines, votes and dice are picked for everyone
//   theatre   people read aloud; every beat waits for the host's Next
//             (clicker), Back goes to the previous beat
//
// Show Packs (engine/showpack.js) add two beats: 'line', a pre-voiced
// line that plays and then carries on by itself in every mode, and
// 'pause', which waits for the host's Next in every mode.
// ====================================================================

import { castEntry, castInSeatOrder, setLine, envelopeFor, cardMinutes } from './script.js';
import { createTurnTimer, createCountdown } from './turn-timer.js';
import { moduleForCard } from './minigames.js';

export const BETWEEN_BEATS_MS = 900;
export const REHEARSE_PICK_MS = 1500;
export const VOTE_CLOSE_MS = 1200;
export const VOTE_LIMIT_MS = 60000;      // online: the vote closes by itself after this
export const DICE_PAUSE_MS = 1400;       // after each roll, so the dice can be seen
export const DICE_WAIT_OPEN_MS = 20000;  // a player with an open Hand gets this long to roll
export const DICE_WAIT_CLOSED_MS = 2500; // no Hand open: the Stage rolls for them
export const MODULE_DONE_HOLD_MS = 5000; // Show Packs: the final scores stay up this long

export function createShow({ game, minigames, mode, rng = Math.random, effects, familyClean = () => true, ownLineMax = 160, moduleOptions = () => ({}) }) {
  const theatre = mode === 'theatre';
  const rehearse = mode === 'rehearse';
  const beats = game.beats;

  const s = {
    phase: 'cover',     // cover | running | ended
    index: -1,
    paused: false,
    narration: 'voice', // theatre: 'voice' (narrator speaks) or 'text' (host reads)
    turn: null,         // { seat, beatId, prompt, lines, left, total, picked }
    vote: null,         // { beatId, question, options, votes: { seat: slug }, open }
    game: null,         // { beatId, cardId, module: state | null, countdown: { left, total } | null }
    secrets: {},        // seat -> [{ id, title, text, envelope }]
    clues: [],
    tale: [],           // { kind: 'line' | 'clue' | 'note', seat, text, title, standIn }
    muted: [],
    selected: {},       // theatre: seat -> line index tapped on their phone
    result: null        // { correct, tally }
  };

  let token = 0;
  let waits = [];
  let timer = null;       // turn timer (online / rehearse)
  let countdown = null;   // mini-game rule card timer (theatre)
  let instance = null;    // running mini-game module
  let rollSignal = null;  // resolves when a Hand rolls
  let hands = {};         // self-paced modules: seat -> 'open' | 'gone' (their Hand)
  let speakChain = Promise.resolve();

  /* ---------- plumbing ---------- */
  function changed() { effects.changed(publicState()); }

  function wait(ms) {
    return new Promise((resolve) => waits.push({ left: ms, resolve, token }));
  }

  function cancelWaits() {
    waits.forEach((w) => w.resolve(false));
    waits = [];
  }

  function say({ seat = null, text, standIn = false, lineId = null }) {
    const t = token;
    const run = speakChain.then(() => {
      if (t !== token || !text) return null;
      return effects.speak({
        seat, text, standIn, lineId,
        onStart: () => { if (t === token) { s.tale.push({ kind: 'line', seat, text, standIn }); changed(); } }
      });
    });
    speakChain = run.catch((err) => console.error('The show could not speak a line', err));
    return speakChain;
  }

  function note(entry) {
    s.tale.push(entry);
    changed();
  }

  // The show ends after the last beat (a Show Pack has no finale).
  function advanceFrom(i) {
    if (i + 1 < beats.length) { runBeat(i + 1); return; }
    s.phase = 'ended';
    changed();
  }

  /* ---------- beats ---------- */
  async function runBeat(i, { replay = true } = {}) {
    if (i < 0 || i >= beats.length) return;
    const t = ++token;
    cancelWaits();
    if (timer) { timer.stop(); timer = null; }
    countdown = null;
    instance = null;
    rollSignal = null;
    hands = {};
    s.index = i;
    s.turn = null;
    s.vote = null;
    s.game = null;
    const beat = beats[i];
    changed();

    switch (beat.type) {
      case 'narration':
        if (replay) await say({ text: beat.text });
        if (theatre) return;
        break;

      case 'line':
        // Pre-voiced: it plays, then the show carries on by itself, even in
        // theatre. Shown again with Back, it waits for Next like any beat.
        if (!replay) return;
        await say({ seat: beat.speaker && beat.speaker !== 'narrator' ? beat.speaker : null, text: beat.text, lineId: beat.id });
        if (t !== token) return;
        if (await wait(BETWEEN_BEATS_MS) && t === token) advanceFrom(i);
        return;

      case 'pause':
        return; // the host's Next carries on

      case 'music':
        effects.music(beat.stop ? { stop: true } : { mood: beat.mood, track: beat.track || null });
        // A cue, not a moment: the show carries straight on.
        if (t === token) return runBeat(i + 1, { replay });
        return;

      case 'character_turn':
        if (theatre) {
          s.turn = { seat: beat.character, beatId: beat.id, prompt: beat.prompt, lines: beat.lines, left: null, total: null, picked: false };
          changed();
          return; // the guest reads aloud; the host presses Next
        }
        await runTurn(beat, t);
        break;

      case 'private_reveal': {
        const env = envelopeFor(game, beat.id, 'secret');
        addSecret(beat.character, { id: beat.id, title: beat.title, text: beat.text, envelope: env ? env.number : null });
        changed();
        if (replay) await say({ text: beat.announce });
        if (theatre) return;
        break;
      }

      case 'clue_drop':
        if (!s.clues.some((c) => c.id === beat.clue.id)) {
          s.clues.push(beat.clue);
          note({ kind: 'clue', title: beat.clue.title, text: beat.clue.text });
        }
        if (replay) await say({ text: beat.narration });
        if (theatre) return;
        break;

      case 'mini_game':
        await runMiniGame(beat, t, replay);
        return;

      case 'vote':
        s.vote = { beatId: beat.id, question: beat.question, options: beat.options, votes: {}, open: true };
        changed();
        if (replay) say({ text: beat.narration });
        if (theatre) return; // the host's Next closes the vote
        if (rehearse) {
          if (!(await wait(REHEARSE_PICK_MS)) || t !== token) return;
          castInSeatOrder(game).forEach((c) => { s.vote.votes[c.character] = beat.options[Math.floor(rng() * beat.options.length)]; });
          closeVote();
        } else {
          // Closes when every open Hand has voted, or when time runs out.
          const voted = new Promise((resolve) => { s.vote.resolve = resolve; });
          const limit = wait(VOTE_LIMIT_MS).then((ok) => { if (ok && t === token) closeVote(); });
          await Promise.race([voted, limit]);
          if (t !== token) return;
        }
        if (!(await wait(VOTE_CLOSE_MS)) || t !== token) return;
        break;

      case 'finale':
        await runFinale(beat, t);
        return;
    }

    if (t !== token || theatre) return;
    if (await wait(BETWEEN_BEATS_MS)) runBeat(i + 1);
  }

  function addSecret(seat, secret) {
    const list = (s.secrets[seat] = s.secrets[seat] || []);
    if (!list.some((x) => x.id === secret.id)) list.push(secret);
  }

  /* ---------- turns (online / rehearse) ---------- */
  function runTurn(beat, t) {
    return new Promise((resolve) => {
      timer = createTurnTimer();
      s.turn = { seat: beat.character, beatId: beat.id, prompt: beat.prompt, lines: beat.lines, left: timer.left, total: timer.total, picked: false, resolve, nudge: beat.nudge, t };
      changed();
    });
  }

  function choose(text) {
    const turn = s.turn;
    if (!turn || turn.picked) return;
    turn.picked = true;
    if (timer) { timer.stop(); timer = null; }
    changed();
    say({ seat: turn.seat, text }).then(() => {
      if (s.turn === turn) { s.turn = null; turn.resolve('spoken'); }
    });
  }

  function tickTurn(ms) {
    const turn = s.turn;
    if (!timer || !turn || turn.picked) return;
    const events = timer.tick(ms);
    turn.left = timer.left;
    if (rehearse && timer.elapsed >= REHEARSE_PICK_MS) {
      choose(turn.lines[Math.floor(rng() * turn.lines.length)].text);
      return;
    }
    if (events.includes('nudge') && turn.nudge) say({ text: turn.nudge });
    if (events.includes('timeout')) {
      // Time's up: their Reveal line is spoken for them.
      choose(setLine({ lines: turn.lines }).text);
      return;
    }
  }

  /* ---------- mini-games ---------- */
  async function runMiniGame(beat, t, replay) {
    const card = minigames.find((m) => m.id === beat.card) || null;
    const mod = moduleForCard(card);
    s.game = { beatId: beat.id, cardId: beat.card, module: null, countdown: null, events: [] };
    if (mod) {
      const players = castInSeatOrder(game).map((c) => ({ seat: c.character, title: c.title }));
      // Self-paced: nobody at a console online, so the module plays the
      // host's part itself; in rehearsal it plays every guest's too.
      const extra = mod.selfPaced ? { autoHost: !theatre, autoPlay: rehearse, ...moduleOptions(beat, mod.id) } : {};
      instance = mod.create({ players, options: { ...(beat.options || {}), ...extra }, rng });
      s.game.events = instance.start();
      s.game.module = instance.state;
    } else if (theatre && card) {
      countdown = createCountdown(cardMinutes(card) * 60000);
      s.game.countdown = { left: countdown.left, total: countdown.total };
    }
    changed();
    if (replay) await say({ text: beat.narration });
    if (t !== token) return;
    if (!mod || theatre) return; // the host moves on (and, in theatre, rolls with Next)
    if (instance && instance.selfPaced) return; // it plays itself; moduleEvents() moves on at the end

    // Online: players roll from their Hands; the Stage rolls for anyone
    // without an open Hand (and for everyone in rehearsal).
    while (instance && !instance.done && t === token) {
      const shooter = instance.state.shooter;
      const byHand = !rehearse && effects.isHandOpen(shooter);
      const rolled = new Promise((resolve) => { rollSignal = resolve; });
      const waited = wait(byHand ? DICE_WAIT_OPEN_MS : DICE_WAIT_CLOSED_MS);
      const outcome = await Promise.race([rolled.then(() => 'hand'), waited.then((ok) => (ok ? 'auto' : 'cancel'))]);
      if (outcome === 'cancel' || t !== token) return;
      if (outcome === 'auto') doRoll(shooter);
      if (!(await wait(DICE_PAUSE_MS)) || t !== token) return;
    }
    if (t !== token) return;
    if (await wait(BETWEEN_BEATS_MS)) runBeat(s.index + 1);
  }

  function doRoll(seat) {
    if (!instance || instance.done) return false;
    const events = instance.act({ type: 'roll', seat });
    if (!events.length) return false;
    s.game.events = events;
    s.game.module = instance.state;
    const end = events.find((e) => e.type === 'end');
    if (end) {
      finishModule(end.result);
      afterModule();
    }
    changed();
    if (rollSignal) { const r = rollSignal; rollSignal = null; r(); }
    return true;
  }

  // Once the final scores have been seen: Show Packs (and self-paced
  // games online) go back to the next step; otherwise the host's Next.
  function afterModule() {
    const beat = beats[s.index];
    const selfPaced = instance && instance.selfPaced;
    if (theatre ? !(beat && beat.return_when_done) : !selfPaced) return;
    const t = token;
    const i = s.index;
    wait(MODULE_DONE_HOLD_MS).then((ok) => { if (ok && t === token) advanceFrom(i); });
  }

  /* ---------- self-paced modules ---------- */
  function moduleEvents(events) {
    if (!instance || !events || !events.length) return;
    s.game.events = events;
    s.game.module = instance.state;
    events.forEach((e) => {
      if (e.type !== 'narrate' || !e.text) return;
      s.tale.push({ kind: 'line', seat: null, text: e.text });
      if (effects.announce) effects.announce({ lineId: e.id, text: e.text });
    });
    const end = events.find((e) => e.type === 'end');
    if (end) {
      finishModule(end.result);
      afterModule();
    }
    changed();
  }

  // A Hand that was open and went away is a disconnect; back again, a reconnect.
  function trackHands() {
    if (rehearse) return;
    game.cast.forEach((c) => {
      const seat = c.character;
      const open = effects.isHandOpen(seat);
      if (open && hands[seat] === 'gone') moduleEvents(instance.act({ type: 'reconnect', seat }));
      if (!open && hands[seat] === 'open') moduleEvents(instance.act({ type: 'disconnect', seat }));
      if (open) hands[seat] = 'open'; else if (hands[seat]) hands[seat] = 'gone';
    });
  }

  const GUEST_MOVES = ['twist', 'stick', 'guess', 'hint-request', 'answer', 'pass-forfeit'];

  // The result feeds the master script: the winner(s) receive the prize clue.
  function finishModule(result) {
    const beat = beats[s.index];
    const clue = beat && beat.on_result && beat.on_result.winner_clue;
    if (!clue || !result.winners.length) return;
    const env = envelopeFor(game, beat.id, 'prize');
    result.winners.forEach((seat) => addSecret(seat, { id: beat.id + '-prize', title: clue.title, text: clue.text, envelope: env ? env.number : null }));
    note({ kind: 'note', title: 'The prize', text: result.winners.map((seat) => castEntry(game, seat).title).join(' and ') + (result.winners.length > 1 ? ' share' : ' wins') + ' the prize: a secret clue.' });
  }

  /* ---------- votes ---------- */
  function closeVote() {
    const v = s.vote;
    if (!v || !v.open) return;
    v.open = false;
    const tally = {};
    Object.values(v.votes).forEach((slug) => { tally[slug] = (tally[slug] || 0) + 1; });
    const culprit = game.game.culprit;
    const culpritVotes = tally[culprit] || 0;
    const correct = culpritVotes > 0 && Object.entries(tally).every(([slug, n]) => slug === culprit || n < culpritVotes);
    s.result = Object.keys(tally).length ? { correct, tally } : null;
    changed();
    if (v.resolve) { const r = v.resolve; v.resolve = null; r(); }
  }

  function maybeCloseVote() {
    if (!s.vote || !s.vote.open || theatre || rehearse) return;
    const open = game.cast.map((c) => c.character).filter((seat) => effects.isHandOpen(seat));
    if (open.length && open.every((seat) => s.vote.votes[seat])) closeVote();
  }

  /* ---------- finale ---------- */
  async function runFinale(beat, t) {
    if (s.result) await say({ text: s.result.correct ? beat.reactions.correct : beat.reactions.mistaken });
    for (const line of beat.narration) await say({ text: line });
    await say({ text: beat.closing });
    if (t !== token) return;
    s.phase = 'ended';
    changed();
  }

  /* ---------- what every screen sees ---------- */
  function publicState() {
    const beat = s.index >= 0 ? beats[s.index] : null;
    const turn = s.turn && !s.turn.picked
      ? { seat: s.turn.seat, beatId: s.turn.beatId, prompt: s.turn.prompt, lines: s.turn.lines, left: timer ? timer.left : null, total: timer ? timer.total : null, theatre }
      : null;
    return {
      mode,
      phase: s.phase,
      paused: s.paused,
      narration: s.narration,
      index: s.index,
      count: beats.length,
      beat: beat ? { id: beat.id, type: beat.type, number: s.index + 1, act: beat.act } : null,
      turn,
      vote: s.vote ? { beatId: s.vote.beatId, question: s.vote.question, options: s.vote.options, votes: { ...s.vote.votes }, open: s.vote.open } : null,
      game: s.game ? { ...s.game, countdown: countdown ? { left: countdown.left, total: countdown.total } : null } : null,
      secrets: s.secrets,
      clues: s.clues,
      tale: s.tale,
      muted: s.muted,
      selected: s.selected,
      result: s.result,
      culprit: s.phase === 'ended' ? game.game.culprit : null
    };
  }

  /* ---------- controls ---------- */
  return {
    get state() { return publicState(); },

    start() {
      if (s.phase !== 'cover') return;
      s.phase = 'running';
      runBeat(0);
    },

    // Called by the page every ~250 ms. Pausing = the page keeps calling,
    // but nothing moves.
    tick(ms) {
      if (s.phase !== 'running' || s.paused) return;
      const due = [];
      waits = waits.filter((w) => {
        if (w.token !== token) { w.resolve(false); return false; }
        w.left -= ms;
        if (w.left <= 0) { due.push(w); return false; }
        return true;
      });
      due.forEach((w) => w.resolve(true));
      tickTurn(ms);
      if (instance && instance.selfPaced && !instance.done) {
        trackHands();
        if (instance && instance.tick) moduleEvents(instance.tick(ms));
      }
      if (countdown) {
        countdown.tick(ms);
        if (s.game) s.game.countdown = { left: countdown.left, total: countdown.total };
      }
    },

    // Host: Next. Online = skip to the next beat. Theatre = the clicker:
    // roll the dice for the shooter while a dice game runs, close an open
    // vote, otherwise the next beat.
    next() {
      if (s.phase === 'cover') return;
      if (theatre) {
        if (instance && !instance.done && instance.selfPaced) {
          // The clicker is the host's main command right now, if there is one.
          const cmd = instance.state.primary;
          if (cmd) moduleEvents(instance.act({ type: 'host', cmd }));
          return;
        }
        if (instance && !instance.done) { doRoll(instance.state.shooter); return; }
        if (s.vote && s.vote.open) { closeVote(); return; }
        const beat = beats[s.index];
        if (beat && beat.type === 'character_turn' && s.selected[beat.character] !== undefined) {
          // Keep the line they read in the keepsake.
          const line = beat.lines[s.selected[beat.character]];
          const already = s.tale.some((e) => e.kind === 'line' && e.seat === beat.character && line && e.text === line.text);
          if (line && !already) s.tale.push({ kind: 'line', seat: beat.character, text: line.text, standIn: false });
        }
      }
      if (s.index >= beats.length - 1) {
        // A script without a finale (a Show Pack) ends on Next at its last beat.
        if (s.phase === 'running' && beats[s.index].type !== 'finale') { effects.stopSpeech(); ++token; cancelWaits(); advanceFrom(s.index); }
        return;
      }
      effects.stopSpeech();
      runBeat(s.index + 1);
    },

    // Host: Back (theatre). Shows the previous beat again without
    // re-speaking it; music cues are stepped over.
    back() {
      if (s.phase !== 'running') return;
      let i = s.index - 1;
      while (i > 0 && beats[i].type === 'music') i -= 1;
      if (i < 0) return;
      effects.stopSpeech();
      runBeat(i, { replay: false });
    },

    // Theatre never skips ahead: Next is the only way forward, one beat
    // at a time; jumping is allowed only backwards (to repeat something).
    goTo(i) {
      if (s.phase !== 'running' || i < 0 || i >= beats.length) return;
      if (theatre && i > s.index) return;
      effects.stopSpeech();
      runBeat(i, { replay: false });
    },

    setPaused(on) {
      s.paused = !!on;
      changed();
    },

    setNarration(value) {
      s.narration = value === 'text' ? 'text' : 'voice';
      changed();
    },

    skipTurn() {
      const turn = s.turn;
      if (!turn || turn.picked || theatre) return;
      turn.picked = true;
      if (timer) { timer.stop(); timer = null; }
      s.turn = null;
      changed();
      turn.resolve('skipped');
    },

    setMuted(seat, on) {
      s.muted = s.muted.filter((x) => x !== seat);
      if (on) s.muted.push(seat);
      changed();
    },

    // From a Player's Hand.
    pick(seat, beatId, lineIndex) {
      if (theatre) {
        if (s.turn && s.turn.seat === seat && s.turn.beatId === beatId) { s.selected[seat] = lineIndex; changed(); }
        return;
      }
      if (rehearse || !s.turn || s.turn.picked || s.turn.seat !== seat || s.turn.beatId !== beatId) return;
      const line = s.turn.lines[lineIndex];
      if (line) choose(line.text);
    },

    own(seat, beatId, text) {
      if (theatre || rehearse || !s.turn || s.turn.picked || s.turn.seat !== seat || s.turn.beatId !== beatId) return;
      const clean = String(text || '').trim().slice(0, ownLineMax);
      if (!clean || s.muted.includes(seat) || !familyClean(clean)) return;
      choose(clean);
    },

    vote(seat, beatId, choice) {
      const v = s.vote;
      if (!v || !v.open || v.beatId !== beatId || !v.options.includes(choice)) return;
      v.votes[seat] = choice;
      changed();
      maybeCloseVote();
    },

    // Theatre: a show of hands, counted by the host.
    hostVote(choice, delta) {
      const v = s.vote;
      if (!v || !v.open || !v.options.includes(choice)) return;
      if (delta > 0) v.votes['host-' + choice + '-' + Object.keys(v.votes).length] = choice;
      else {
        const key = Object.keys(v.votes).reverse().find((k) => k.startsWith('host-' + choice + '-'));
        if (key) delete v.votes[key];
      }
      changed();
    },

    roll(seat) {
      if (!instance || instance.done || instance.state.shooter !== seat) return;
      doRoll(seat);
    },

    // A guest's move in a self-paced mini-game (from their Hand):
    // { type: 'twist' | 'stick' | 'guess' | 'hint-request' | 'answer' | 'pass-forfeit', seq, letter, choice }.
    // The module checks it's their turn and their move number.
    moduleAct(seat, action) {
      if (s.phase !== 'running' || !instance || !instance.selfPaced || instance.done || !seat || !action || !GUEST_MOVES.includes(action.type)) return;
      moduleEvents(instance.act({ ...action, seat }));
    },

    // The host's command (Host Console): { cmd, settings }.
    moduleHost(action) {
      if (s.phase !== 'running' || !instance || !instance.selfPaced || instance.done || !action) return;
      moduleEvents(instance.act({ ...action, type: 'host' }));
    },

    // Theatre: the narrator's voice reads the current line for a guest
    // who would rather not — the one they tapped on their phone, or the
    // set (Reveal) line.
    standIn() {
      const turn = s.turn;
      if (!theatre || !turn) return;
      const picked = s.selected[turn.seat];
      const line = picked !== undefined ? turn.lines[picked] : setLine({ lines: turn.lines });
      if (line) say({ seat: turn.seat, text: line.text, standIn: true });
    }
  };
}
