// ====================================================================
// MINI-GAME MODULE · LEXICAL LANTERNS (family version)
// 1–16 guests, one team, light a hidden phrase letter by letter. Written
// fresh from the plain rules below.
//
//   - The phrase shows as blank slots; spaces and punctuation show.
//   - In seat order, each guest picks one letter a turn. Right: every
//     matching slot lights. Wrong: one lantern goes out, and the letter
//     joins the used letters. No letter can be picked twice.
//   - One "Pixie Whisper" hint a phrase: any guest asks, the host
//     approves, it costs a lantern (not allowed on the last lantern).
//   - Win: the phrase is fully lit. Lose: every lantern is out.
//   - Arcade: as many phrases as possible before the Sundial runs out;
//     the lanterns reset with each phrase.
//   - Turn timer 20 s: time's up, the most common unused letter (by
//     English letter frequency) is picked for the guest.
//   - A pool that runs out is reshuffled ("The library begins again").
//
// A self-paced module (see ../../MINIGAME-MODULES.md). Guests act with
// { type: 'guess', seat, letter, seq } and { type: 'hint-request', seat };
// the host with { type: 'host', cmd: 'next-scroll' | 'skip-scroll' |
// 'approve-hint' | 'extend' | 'end' | 'settings', settings }.
// Narrator lines are events { type: 'narrate', id, text }.
// ====================================================================

export const id = 'lexical-lanterns';
export const name = 'Lexical Lanterns';
export const selfPaced = true;
export const MAX_PLAYERS = 16;
export const TURN_MS = 20000;
export const EXTEND_MS = 30000;
export const LANTERN_CHOICES = [4, 6, 8];
export const SUNDIAL_MINUTES = [2, 3, 5];
export const MODES = ['classic', 'arcade'];
export const AUTO_HOST_MS = 2500;
export const AUTO_PLAY_MS = 1200;
// Most common first (English letter frequency).
export const FREQUENCY = 'ETAOINSHRDLCUMWFGYPBVKJXQZ';
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const LINE_IDS = { start: 'LL-01', right: 'LL-02', wrong: 'LL-03', hint: 'LL-04', lastLantern: 'LL-05', lose: 'LL-06', win: 'LL-07', sundial: 'LL-08' };

const isLetter = (ch) => ch >= 'A' && ch <= 'Z';

// A pool file is { "name": "...", "entries": [{ "phrase", "hint" }] } or
// just the array of entries.
export function poolEntries(pool) {
  const list = Array.isArray(pool) ? pool : (pool && Array.isArray(pool.entries) ? pool.entries : []);
  return list.filter((e) => e && typeof e.phrase === 'string' && /[A-Za-z]/.test(e.phrase));
}

// create({ players, options, rng })
//   options: { lines: { id: text }, pools: [{ id, name, entries }],
//              lanterns: 6, mode: 'classic', sundial: 3, pool: id,
//              autoHost: false, autoPlay: false }
export function create({ players, options = {}, rng = Math.random }) {
  const lines = options.lines || {};
  const pools = (options.pools || []).map((p) => ({ id: p.id, name: p.name || p.id, entries: poolEntries(p) })).filter((p) => p.entries.length);
  const settings = {
    lanterns: LANTERN_CHOICES.includes(Number(options.lanterns)) ? Number(options.lanterns) : 6,
    mode: MODES.includes(options.mode) ? options.mode : 'classic',
    sundial: SUNDIAL_MINUTES.includes(Number(options.sundial)) ? Number(options.sundial) : 3,
    pool: pools.some((p) => p.id === options.pool) ? options.pool : (pools[0] ? pools[0].id : null)
  };
  const autoHost = !!options.autoHost;
  const autoPlay = !!options.autoPlay;
  const table = players.slice(0, MAX_PLAYERS).map((p) => ({ seat: p.seat, title: p.title, away: false }));

  let phase = 'setup';   // setup | play | scroll-done
  let done = false;
  let seq = 0;
  let active = -1;
  let timerLeft = null;
  let sundialLeft = null;
  let sundialTotal = null;
  let queue = [];        // the pool's entries, shuffled
  let lastPhrase = null;
  let entry = null;      // { phrase, hint }
  let chars = [];        // the phrase, upper case
  let shown = new Set(); // letters lit
  let used = [];         // every letter picked, in order
  let wrong = [];
  let lanternsLeft = settings.lanterns;
  let hintUsed = false;
  let hintRequest = null;
  let outcome = null;    // 'won' | 'lost' | 'skipped' | null
  let solved = 0;
  let scrolls = 0;
  let lastLine = '';
  let notice = '';
  let idle = 0;

  function narrate(events, key) {
    const lineId = LINE_IDS[key];
    lastLine = lines[lineId] || '';
    events.push({ type: 'narrate', id: lineId, text: lastLine });
  }

  function pool() { return pools.find((p) => p.id === settings.pool) || null; }

  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function nextEntry(events) {
    const p = pool();
    if (!p) return null;
    if (!queue.length) {
      queue = shuffled(p.entries);
      if (scrolls > 0) {
        notice = 'The library begins again';
        events.push({ type: 'notice', text: notice });
        // Don't open with the phrase that was just played.
        if (queue.length > 1 && queue[queue.length - 1] === lastPhrase) [queue[0], queue[queue.length - 1]] = [queue[queue.length - 1], queue[0]];
      }
    }
    lastPhrase = queue.pop();
    return lastPhrase;
  }

  const letterSlots = () => chars.filter(isLetter);
  const solvedNow = () => letterSlots().every((ch) => shown.has(ch));
  const inTurn = () => table.filter((p) => !p.away);

  function newScroll(events) {
    notice = ''; // nextEntry() sets "The library begins again" when it reshuffles
    const e = nextEntry(events);
    if (!e) { notice = 'This word pool is empty.'; events.push({ type: 'notice', text: notice }); return; }
    entry = e;
    chars = [...e.phrase.toUpperCase()];
    shown = new Set();
    used = [];
    wrong = [];
    lanternsLeft = settings.lanterns;
    hintUsed = false;
    hintRequest = null;
    outcome = null;
    scrolls += 1;
    if (settings.mode === 'arcade' && sundialLeft === null) { sundialTotal = settings.sundial * 60000; sundialLeft = sundialTotal; }
    // Arcade moves fast: the opening line once, not every scroll.
    if (settings.mode === 'classic' || scrolls === 1) narrate(events, 'start');
    phase = 'play';
    // The next guest in order starts each new scroll.
    active = -1;
    nextTurn();
  }

  function nextTurn() {
    idle = 0;
    seq += 1;
    const order = inTurn().length ? table.map((p, i) => i).filter((i) => !table[i].away) : table.map((p, i) => i);
    if (!order.length) { active = -1; timerLeft = null; return; }
    const after = order.find((i) => i > active);
    active = after !== undefined ? after : order[0];
    timerLeft = TURN_MS;
  }

  function endScroll(events, how) {
    outcome = how;
    phase = 'scroll-done';
    active = -1;
    timerLeft = null;
    hintRequest = null;
    idle = 0;
    seq += 1;
    if (how === 'won') { if (settings.mode === 'arcade') solved += 1; narrate(events, 'win'); }
    if (how === 'lost') narrate(events, 'lose');
  }

  function loseLantern(events) {
    lanternsLeft = Math.max(0, lanternsLeft - 1);
    events.push({ type: 'lantern-out', left: lanternsLeft });
    if (lanternsLeft === 1) narrate(events, 'lastLantern');
  }

  function guess(events, letter) {
    used.push(letter);
    if (chars.includes(letter)) {
      shown.add(letter);
      narrate(events, 'right');
      if (solvedNow()) { endScroll(events, 'won'); return; }
    } else {
      wrong.push(letter);
      narrate(events, 'wrong');
      loseLantern(events);
      if (lanternsLeft === 0) { endScroll(events, 'lost'); return; }
    }
    nextTurn();
  }

  function autoLetter() {
    return [...FREQUENCY].find((ch) => !used.includes(ch));
  }

  function approveHint(events) {
    if (phase !== 'play' || hintUsed || lanternsLeft <= 1) return;
    hintUsed = true;
    hintRequest = null;
    seq += 1;
    narrate(events, 'hint');
    loseLantern(events);
  }

  function endGame(events) {
    if (done) return;
    done = true;
    active = -1;
    timerLeft = null;
    seq += 1;
    events.push({ type: 'end', result: result() });
  }

  function result() {
    const won = settings.mode === 'arcade' ? solved > 0 : outcome === 'won';
    const scores = {};
    table.forEach((p) => { scores[p.seat] = settings.mode === 'arcade' ? solved : (outcome === 'won' ? 1 : 0); });
    return { winners: won ? table.map((p) => p.seat) : [], scores, solved, mode: settings.mode };
  }

  function primary() {
    if (done) return null;
    if (phase === 'setup' || phase === 'scroll-done') return 'next-scroll';
    return null;
  }

  function host(events, action) {
    const cmd = action.cmd;
    if (cmd === 'end') { endGame(events); return; }
    if (cmd === 'settings' && phase === 'setup' && action.settings) {
      const s = action.settings;
      if (LANTERN_CHOICES.includes(Number(s.lanterns))) settings.lanterns = Number(s.lanterns);
      if (MODES.includes(s.mode)) settings.mode = s.mode;
      if (SUNDIAL_MINUTES.includes(Number(s.sundial))) settings.sundial = Number(s.sundial);
      if (s.pool && pools.some((p) => p.id === s.pool)) { settings.pool = s.pool; queue = []; }
      seq += 1;
      events.push({ type: 'settings' });
      return;
    }
    if (cmd === 'next-scroll' && (phase === 'setup' || phase === 'scroll-done')) { newScroll(events); return; }
    // Skips the phrase, never a guest's turn.
    if (cmd === 'skip-scroll' && phase === 'play') { outcome = 'skipped'; newScroll(events); return; }
    if (cmd === 'approve-hint') { approveHint(events); return; }
    if (cmd === 'extend' && sundialLeft !== null) { sundialLeft += EXTEND_MS; sundialTotal += EXTEND_MS; seq += 1; events.push({ type: 'timer' }); }
  }

  return {
    id,
    selfPaced: true,
    get done() { return done; },

    start() { return [{ type: 'start' }]; },

    act(action) {
      const events = [];
      if (done || !action) return events;
      if (action.type === 'host') { host(events, action); return events; }
      if (action.type === 'disconnect' || action.type === 'reconnect') {
        // Out of the turn order from the end of the current turn (the
        // active guest keeps their turn); progress is kept.
        const p = table.find((x) => x.seat === action.seat);
        if (!p) return events;
        p.away = action.type === 'disconnect';
        seq += 1;
        events.push({ type: 'presence' });
        return events;
      }
      if (action.type === 'hint-request') {
        if (phase !== 'play' || hintUsed || hintRequest || lanternsLeft <= 1 || !table.some((p) => p.seat === action.seat)) return events;
        hintRequest = action.seat;
        seq += 1;
        events.push({ type: 'hint-request', seat: action.seat });
        if (autoHost) approveHint(events);
        return events;
      }
      if (action.type !== 'guess') return events;
      const p = table[active];
      const letter = String(action.letter || '').toUpperCase();
      if (phase !== 'play' || !p || p.seat !== action.seat) return events;
      if (action.seq !== undefined && action.seq !== seq) return events;
      if (letter.length !== 1 || !isLetter(letter) || used.includes(letter)) return events;
      guess(events, letter);
      return events;
    },

    tick(ms) {
      const events = [];
      if (done) return events;
      if (sundialLeft !== null && phase !== 'setup') {
        const before = Math.ceil(sundialLeft / 1000);
        sundialLeft = Math.max(0, sundialLeft - ms);
        if (sundialLeft === 0) { narrate(events, 'sundial'); endGame(events); return events; }
        if (Math.ceil(sundialLeft / 1000) !== before) events.push({ type: 'timer' });
      }
      if (phase === 'play' && active >= 0 && timerLeft !== null) {
        const before = Math.ceil(timerLeft / 1000);
        timerLeft = Math.max(0, timerLeft - ms);
        // Time's up: the most common unused letter is picked for them.
        if (timerLeft === 0) { guess(events, autoLetter()); return events; }
        if (Math.ceil(timerLeft / 1000) !== before && !events.some((e) => e.type === 'timer')) events.push({ type: 'timer' });
      }
      idle += ms;
      if (autoPlay && phase === 'play' && active >= 0 && idle >= AUTO_PLAY_MS) { guess(events, autoLetter()); return events; }
      if (autoHost && idle >= AUTO_HOST_MS) {
        idle = 0;
        if (phase === 'scroll-done' && settings.mode === 'classic') { endGame(events); return events; }
        const cmd = primary();
        if (cmd) host(events, { cmd });
      }
      return events;
    },

    // Hidden letters are never sent: only lit ones, spaces and punctuation.
    get state() {
      const reveal = phase === 'scroll-done' || done;
      const p = pool();
      return {
        id,
        phase,
        done,
        seq,
        settings: { ...settings },
        pools: pools.map((x) => ({ id: x.id, name: x.name })),
        poolName: p ? p.name : '',
        primary: primary(),
        active: active >= 0 ? table[active].seat : null,
        timer: timerLeft === null ? null : { left: timerLeft, total: TURN_MS },
        sundial: sundialLeft === null ? null : { left: sundialLeft, total: sundialTotal },
        lanterns: { total: settings.lanterns, left: entry ? lanternsLeft : settings.lanterns },
        slots: chars.map((ch) => (isLetter(ch) ? { c: shown.has(ch) || reveal ? ch : '', letter: true, lit: shown.has(ch) } : { c: ch, letter: false, lit: true })),
        used: used.slice(),
        wrong: wrong.slice(),
        hint: hintUsed && entry ? entry.hint || '' : null,
        hintRequest,
        hintAvailable: phase === 'play' && !hintUsed && lanternsLeft > 1 && !!(entry && entry.hint),
        outcome,
        solved,
        scrolls,
        players: table.map((x) => ({ seat: x.seat, title: x.title, away: x.away })),
        line: lastLine,
        notice,
        result: done ? result() : null
      };
    },

    end() {
      endGame([]);
      return result();
    }
  };
}
