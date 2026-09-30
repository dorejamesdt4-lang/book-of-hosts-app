// ====================================================================
// ENGINE · TURN TIMER — a countdown driven by tick(ms), so pausing is
// simply not ticking and tests can run it without real time.
//
//   const t = createTurnTimer({ totalMs: 30000, nudgeAtMs: 15000 });
//   t.tick(250) -> [] | ['nudge'] | ['timeout'] | ['nudge', 'timeout']
//   t.left, t.total, t.done
// ====================================================================

export const TURN_MS = 30000;
export const NUDGE_AT_MS = 15000;

export function createTurnTimer({ totalMs = TURN_MS, nudgeAtMs = NUDGE_AT_MS } = {}) {
  let left = totalMs;
  let nudged = false;
  let done = false;
  return {
    get left() { return left; },
    get total() { return totalMs; },
    get elapsed() { return totalMs - left; },
    get done() { return done; },
    tick(ms) {
      if (done) return [];
      left = Math.max(0, left - ms);
      const events = [];
      if (!nudged && left <= nudgeAtMs) { nudged = true; events.push('nudge'); }
      if (left <= 0) { done = true; events.push('timeout'); }
      return events;
    },
    stop() { done = true; }
  };
}

// A plain countdown (mini-game rule cards in theatre mode).
export function createCountdown(totalMs) {
  let left = totalMs;
  return {
    get left() { return left; },
    get total() { return totalMs; },
    tick(ms) { left = Math.max(0, left - ms); return left === 0; },
    reset() { left = totalMs; }
  };
}
