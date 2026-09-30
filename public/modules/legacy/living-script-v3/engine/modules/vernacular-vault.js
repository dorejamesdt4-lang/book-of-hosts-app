// ====================================================================
// MINI-GAME MODULE · VERNACULAR VAULT (12+) — and the shared engine for
// Slang-O-Meter 18+ (vernacular-vault-18.js is this same code with its
// own id, age rating, lines and skin; nothing is copied).
//
// Slang trivia for 2–32 guests, all answering at once on their phones:
//   Slang → Meaning: the word is shown; pick its real meaning (4 options:
//                    the meaning and the entry's 3 made-up ones).
//   Meaning → Slang: the meaning is shown; pick the word (4 options: the
//                    word and 3 other words from the same pool).
//   Mixed:           either, at random.
// Options are shuffled every time. Correct: 100 points; the fastest
// correct answer is worth 1.5× or 2× (or no bonus). No answer by the end
// of the timer is "No answer" (0 points) and the game carries on.
// Final standings: points, then the most speed bonuses, then joint.
//
// AGE LOCK (hard rule): every pool file carries "ageRating", and a module
// only ever loads pools with its own rating. Anything else is refused
// with a clear error. 18+ forfeits (always optional, with a Pass) exist
// only in the 18+ module, and only from an 18+ forfeits file.
//
// A self-paced module (see ../../MINIGAME-MODULES.md). Guests act with
// { type: 'answer', seat, choice: 0-3, seq } and { type: 'pass-forfeit', seat };
// the host with { type: 'host', cmd: 'next-question' | 'round-type' |
// 'standings' | 'end' | 'settings', value, settings }.
// ====================================================================

export const MAX_PLAYERS = 32;
export const POINTS = 100;
export const SPEED_BONUS = ['off', 1.5, 2];
export const TIME_LIMITS = [10, 15, 20, 30];
export const LENGTHS = [5, 10, 15];
export const ROUND_TYPES = ['slang', 'meaning', 'mixed'];
export const FORFEIT_CHANCE = 1 / 3;
export const READ_MS = 3000;        // the first moments of a question: "read it out"
export const AUTO_HOST_MS = 2500;
export const AUTO_REVEAL_MS = 6000; // no host: how long the reveal stays up
export const AUTO_PLAY_MS = 1500;
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

// Each skin's narrator line ids.
export const LINES_12 = { start: 'SLG-01', correct: 'SLG-02', wrong: 'SLG-03', fastest: 'SLG-04', timeout: 'SLG-05', switch: 'SLG-06', close: 'SLG-07', over: 'SLG-08' };
export const LINES_18 = { start: 'SLG18-01', correct: 'SLG18-02', wrong: 'SLG18-03', fastest: 'SLG18-04', timeout: 'SLG18-05', forfeit: 'SLG18-06', close: 'SLG18-07', over: 'SLG18-08' };

// The age lock, for pools and forfeits alike. Returns null or an error.
export function ageLockError(file, ageRating, what = 'pool') {
  if (!file || !file.ageRating) return 'This ' + what + ' has no age rating, so it can\'t be used.';
  if (file.ageRating !== ageRating) return 'This ' + what + ' is rated ' + file.ageRating + '; this game only loads ' + ageRating + ' ' + what + 's.';
  return null;
}

export function entryProblems(e) {
  if (!e || !e.id || !e.word || !e.realMeaning) return 'missing id, word or realMeaning';
  if (!Array.isArray(e.fakes) || e.fakes.length < 3) return 'needs 3 fakes';
  return null;
}

// makeModule({ id, name, ageRating, lineIds, forfeitsAllowed, skin }) -> a module
export function makeModule(cfg) {
  const { id, name, ageRating, lineIds, forfeitsAllowed = false, skin } = cfg;

  function create({ players, options = {}, rng = Math.random }) {
    const lines = options.lines || {};
    // The age lock: refuse every pool (and forfeit list) with the wrong rating.
    const errors = [];
    const pools = [];
    (options.pools || []).forEach((p) => {
      const err = ageLockError(p, ageRating);
      if (err) { errors.push((p.name || p.id) + ': ' + err); return; }
      const entries = (p.entries || []).filter((e) => !entryProblems(e));
      if (entries.length < 4) { errors.push((p.name || p.id) + ': needs at least 4 complete entries.'); return; }
      pools.push({ id: p.id, name: p.name || p.title || p.id, entries });
    });
    let forfeitList = [];
    // options.forfeitsFile: the shared forfeits file (18+ module only).
    if (forfeitsAllowed && options.forfeitsFile) {
      const err = ageLockError(options.forfeitsFile, '18+', 'forfeit list');
      if (err) errors.push('Forfeits: ' + err); else forfeitList = (options.forfeitsFile.forfeits || []).filter((f) => typeof f === 'string' && f.trim());
    }
    const pick = (v, list, dflt) => (list.includes(v) ? v : dflt);
    const settings = {
      speedBonus: pick(options.speedBonus === 'off' ? 'off' : Number(options.speedBonus), SPEED_BONUS, 1.5),
      timeLimit: pick(Number(options.timeLimit), TIME_LIMITS, 15),
      length: pick(Number(options.length), LENGTHS, 5),
      roundType: pick(options.roundType, ROUND_TYPES, 'slang'),
      forfeits: forfeitsAllowed && forfeitList.length ? options.forfeits === true : false, // off by default
      pool: pools.some((p) => p.id === options.pool) ? options.pool : (pools[0] ? pools[0].id : null)
    };
    const autoHost = !!options.autoHost;
    const autoPlay = !!options.autoPlay;
    const table = players.slice(0, MAX_PLAYERS).map((p) => ({ seat: p.seat, title: p.title, score: 0, bonuses: 0, away: false, waiting: false }));

    let phase = 'lobby';    // lobby | question | reveal | final
    let done = false;
    let seq = 0;
    let number = 0;         // questions asked
    let question = null;    // { entryId, kind, prompt, options: [text], correct, example }
    let answers = {};       // seat -> { choice, at }
    let elapsed = 0;
    let timerLeft = null;
    let lastKind = null;
    let queue = [];
    let reveal = null;      // { counts, fastest, correctSeats, noAnswer }
    let forfeits = {};      // seat -> text
    let showStandings = false;
    let lastLine = '';
    let notice = '';
    let idle = 0;
    let started = false;

    function narrate(events, key) {
      const lineId = lineIds[key];
      if (!lineId) return;
      lastLine = lines[lineId] || '';
      events.push({ type: 'narrate', id: lineId, text: lastLine });
    }
    const pool = () => pools.find((p) => p.id === settings.pool) || null;
    function shuffled(list) {
      const a = list.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }

    // No entry repeats until the whole pool has been used.
    function nextEntry(events) {
      if (!queue.length) {
        queue = shuffled(pool().entries);
        if (number > 0) { notice = 'The vault reshuffles its words.'; events.push({ type: 'notice', text: notice }); }
      }
      return queue.pop();
    }

    function ask(events) {
      if (!pool()) { notice = 'No word pool can be loaded.'; events.push({ type: 'notice', text: notice }); return; }
      notice = '';
      if (!started) { started = true; narrate(events, 'start'); }
      const entry = nextEntry(events);
      const kind = settings.roundType === 'mixed' ? (rng() < 0.5 ? 'slang' : 'meaning') : settings.roundType;
      let opts;
      if (kind === 'slang') {
        opts = shuffled([entry.realMeaning, ...entry.fakes.slice(0, 3)]);
      } else {
        const others = shuffled(pool().entries.filter((e) => e.id !== entry.id && e.word.toLowerCase() !== entry.word.toLowerCase())).slice(0, 3).map((e) => e.word);
        opts = shuffled([entry.word, ...others]);
      }
      if (kind === 'meaning' && lastKind === 'slang') narrate(events, 'switch');
      lastKind = kind;
      number += 1;
      question = { number, entryId: entry.id, word: entry.word, kind, prompt: kind === 'slang' ? entry.word : entry.realMeaning, options: opts, correct: opts.indexOf(kind === 'slang' ? entry.realMeaning : entry.word), example: entry.example || '' };
      answers = {};
      forfeits = {};
      reveal = null;
      elapsed = 0;
      timerLeft = settings.timeLimit * 1000;
      showStandings = false;
      phase = 'question';
      // A guest who came back mid-question plays from this one.
      table.forEach((p) => { p.waiting = false; });
      idle = 0;
      seq += 1;
    }

    const present = () => table.filter((p) => !p.away && !p.waiting);

    function closeQuestion(events) {
      timerLeft = null;
      const counts = [0, 0, 0, 0];
      Object.values(answers).forEach((a) => { counts[a.choice] += 1; });
      const correctSeats = table.filter((p) => answers[p.seat] && answers[p.seat].choice === question.correct).map((p) => p.seat);
      const noAnswer = table.filter((p) => !answers[p.seat]).map((p) => p.seat);
      let fastest = null;
      correctSeats.forEach((seat) => { if (!fastest || answers[seat].at < answers[fastest].at) fastest = seat; });
      correctSeats.forEach((seat) => {
        const p = table.find((x) => x.seat === seat);
        const bonus = seat === fastest && settings.speedBonus !== 'off';
        p.score += bonus ? Math.round(POINTS * settings.speedBonus) : POINTS;
        if (bonus) p.bonuses += 1;
      });
      if (noAnswer.some((seat) => { const p = table.find((x) => x.seat === seat); return !p.away; })) narrate(events, 'timeout');
      if (fastest && settings.speedBonus !== 'off') narrate(events, 'fastest');
      else if (correctSeats.length) narrate(events, 'correct');
      else narrate(events, 'wrong');
      // 18+ forfeits: a 1-in-3 chance for each guest who answered wrong.
      if (settings.forfeits && forfeitList.length) {
        table.forEach((p) => {
          const a = answers[p.seat];
          if (a && a.choice !== question.correct && rng() < FORFEIT_CHANCE) forfeits[p.seat] = forfeitList[Math.floor(rng() * forfeitList.length)];
        });
        if (Object.keys(forfeits).length) narrate(events, 'forfeit');
      }
      reveal = { counts, fastest, correctSeats, noAnswer };
      phase = 'reveal';
      idle = 0;
      seq += 1;
      if (number >= settings.length) finish(events);
    }

    function standings() {
      const sorted = table.slice().sort((a, b) => b.score - a.score || b.bonuses - a.bonuses);
      let rank = 0;
      return sorted.map((p, i) => {
        if (i === 0 || p.score !== sorted[i - 1].score || p.bonuses !== sorted[i - 1].bonuses) rank = i + 1;
        return { seat: p.seat, title: p.title, score: p.score, bonuses: p.bonuses, rank };
      });
    }

    // After the last question: its reveal stays up; Show Standings (the
    // host's main command now) brings the final leaderboard.
    function finish(events) {
      phase = 'final';
      showStandings = false;
      const s = standings();
      if (s.length > 1 && s[0].score - s[1].score <= POINTS) narrate(events, 'close');
      narrate(events, 'over');
      seq += 1;
    }

    function endGame(events) {
      if (done) return;
      done = true;
      timerLeft = null;
      seq += 1;
      events.push({ type: 'end', result: result() });
    }

    function result() {
      const s = standings();
      const top = s.filter((x) => x.rank === 1 && x.score > 0).map((x) => x.seat);
      return { winners: top, scores: Object.fromEntries(table.map((p) => [p.seat, p.score])) };
    }

    function primary() {
      if (done || phase === 'question') return null;
      if (phase === 'final') return showStandings ? null : 'standings';
      return pool() ? 'next-question' : null;
    }

    function host(events, action) {
      const cmd = action.cmd;
      if (cmd === 'end') { endGame(events); return; }
      if (cmd === 'settings' && phase === 'lobby' && action.settings) {
        const s = action.settings;
        if (s.speedBonus !== undefined) settings.speedBonus = pick(s.speedBonus === 'off' ? 'off' : Number(s.speedBonus), SPEED_BONUS, settings.speedBonus);
        if (s.timeLimit !== undefined) settings.timeLimit = pick(Number(s.timeLimit), TIME_LIMITS, settings.timeLimit);
        if (s.length !== undefined) settings.length = pick(Number(s.length), LENGTHS, settings.length);
        if (s.forfeits !== undefined && forfeitsAllowed && forfeitList.length) settings.forfeits = s.forfeits === true;
        if (s.pool && pools.some((p) => p.id === s.pool)) { settings.pool = s.pool; queue = []; }
        seq += 1;
        events.push({ type: 'settings' });
        return;
      }
      // Round type: any time between questions.
      if (cmd === 'round-type' && ROUND_TYPES.includes(action.value) && phase !== 'question') { settings.roundType = action.value; seq += 1; events.push({ type: 'settings' }); return; }
      if (cmd === 'standings' && phase !== 'question') { showStandings = !showStandings; seq += 1; events.push({ type: 'standings' }); return; }
      if (cmd === 'next-question' && (phase === 'lobby' || phase === 'reveal')) ask(events);
    }

    function answer(events, p, choice) {
      answers[p.seat] = { choice, at: elapsed };
      seq += 1;
      events.push({ type: 'answered', seat: p.seat });
      // Everyone here has answered: reveal now.
      if (present().every((x) => answers[x.seat])) closeQuestion(events);
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
        const p = table.find((x) => x.seat === action.seat);
        if (!p) return events;
        if (action.type === 'disconnect') { p.away = true; seq += 1; events.push({ type: 'presence' }); if (phase === 'question' && present().length && present().every((x) => answers[x.seat])) closeQuestion(events); return events; }
        // Back again: they rejoin at the next question.
        if (action.type === 'reconnect') { p.away = false; if (phase === 'question') p.waiting = true; seq += 1; events.push({ type: 'presence' }); return events; }
        if (action.type === 'pass-forfeit') { if (forfeits[p.seat]) { delete forfeits[p.seat]; seq += 1; events.push({ type: 'forfeit-passed', seat: p.seat }); } return events; }
        if (action.type !== 'answer' || phase !== 'question' || p.away || p.waiting || answers[p.seat]) return events;
        if (action.seq !== undefined && action.seq !== seq) return events;
        const choice = Number(action.choice);
        if (!(choice >= 0 && choice <= 3)) return events;
        answer(events, p, choice);
        return events;
      },

      tick(ms) {
        const events = [];
        if (done) return events;
        if (phase === 'question' && timerLeft !== null) {
          const before = Math.ceil(timerLeft / 1000);
          elapsed += ms;
          timerLeft = Math.max(0, timerLeft - ms);
          // Time's up: anyone left is "No answer" (0 points).
          if (timerLeft === 0) { closeQuestion(events); return events; }
          if (Math.ceil(timerLeft / 1000) !== before) events.push({ type: 'timer' });
          if (autoPlay && elapsed >= AUTO_PLAY_MS) present().forEach((p) => { if (!answers[p.seat] && phase === 'question') answer(events, p, Math.floor(rng() * 4)); });
          return events;
        }
        idle += ms;
        if (autoHost) {
          if (phase === 'lobby' && idle >= AUTO_HOST_MS) { idle = 0; ask(events); }
          else if (phase === 'reveal' && idle >= AUTO_REVEAL_MS) { idle = 0; ask(events); }
          else if (phase === 'final' && idle >= AUTO_REVEAL_MS) { idle = 0; if (!showStandings) { showStandings = true; seq += 1; events.push({ type: 'standings' }); } else endGame(events); }
        }
        return events;
      },

      // The right answer is only sent once the question is closed.
      get state() {
        const open = phase === 'question';
        return {
          id,
          skin,
          ageRating,
          phase,
          done,
          seq,
          settings: { ...settings },
          forfeitsAvailable: forfeitsAllowed && forfeitList.length > 0,
          pools: pools.map((p) => ({ id: p.id, name: p.name })),
          poolName: pool() ? pool().name : '',
          errors: errors.slice(),
          primary: primary(),
          number,
          length: settings.length,
          question: question ? { number: question.number, kind: question.kind, prompt: question.prompt, options: question.options.slice(), correct: open ? null : question.correct, example: open ? null : question.example, word: open ? null : question.word } : null,
          timer: timerLeft === null ? null : { left: timerLeft, total: settings.timeLimit * 1000 },
          reading: open && elapsed < READ_MS,
          answered: Object.keys(answers),
          answers: open ? {} : Object.fromEntries(Object.entries(answers).map(([s, a]) => [s, a.choice])),
          reveal: reveal ? { ...reveal } : null,
          forfeits: { ...forfeits },
          showStandings,
          standings: standings(),
          players: table.map((p) => ({ seat: p.seat, title: p.title, score: p.score, bonuses: p.bonuses, away: p.away, waiting: p.waiting })),
          line: lastLine,
          notice,
          result: done ? result() : null
        };
      },

      end() { endGame([]); return result(); }
    };
  }

  return { id, name, ageRating, selfPaced: true, forfeitsAllowed, create };
}

const mod = makeModule({ id: 'vernacular-vault', name: 'Vernacular Vault', ageRating: '12+', lineIds: LINES_12, forfeitsAllowed: false, skin: 'storybook' });
export const id = mod.id;
export const name = mod.name;
export const ageRating = mod.ageRating;
export const selfPaced = true;
export const create = mod.create;
