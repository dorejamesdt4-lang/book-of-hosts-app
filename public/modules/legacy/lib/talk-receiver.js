// lib/talk-receiver.js
//
// MASTER COPY. Classic script — deliberately NOT an ES module and NOT
// meant to be <script src="..."> loaded from inside a sandboxed
// character iframe. A talking-enabled (v2) character animation runs in
// <iframe sandbox="allow-scripts"> (no allow-same-origin), which gives
// it an opaque "null" origin: a module script's fetch is treated as
// cross-origin and blocked, and a relative path like "../lib/..." has
// nothing to resolve against when the page is instead loaded from a
// blob: URL (as the TEST SCREENS uploader does for uploaded files). A
// plain inline classic <script> has neither problem, so every v2
// animation pastes this file's contents inline, marked:
//   <!-- talk-receiver.js (inlined copy — master in lib/talk-receiver.js) -->
// Keep any future edits here in sync with those inlined copies.
//
// Listens for postMessage from the parent page's lib/talk-bridge.js and
// exposes a tiny, purely-reactive API:
//
//   window.TalkReceiver.level     current 0..1 speech level
//   window.TalkReceiver.talking   true while speech is playing
//   window.TalkReceiver.onLevel(fn)   fn(level) on every talk-level
//   window.TalkReceiver.onStart(fn)   fn() on talk-start
//   window.TalkReceiver.onStop(fn)    fn() on talk-stop
//
// This does nothing visible by itself. It's a message-in, callback-out
// relay -- the character animation decides what, if anything, to do
// with the level.
(function () {
  var levelHandlers = [];
  var startHandlers = [];
  var stopHandlers = [];

  function clamp01(n) {
    n = Number(n);
    if (!isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  var TalkReceiver = {
    level: 0,
    talking: false,
    onLevel: function (fn) { if (typeof fn === 'function') levelHandlers.push(fn); },
    onStart: function (fn) { if (typeof fn === 'function') startHandlers.push(fn); },
    onStop: function (fn) { if (typeof fn === 'function') stopHandlers.push(fn); }
  };

  window.addEventListener('message', function (event) {
    // The iframe's own origin is opaque ("null"), so event.origin on an
    // incoming message can't be checked meaningfully either way.
    // Identity is instead verified by exact window reference (must be
    // our real parent) plus an explicit message tag.
    if (event.source !== window.parent) return;
    var data = event.data;
    if (!data || data.source !== 'dore-narrator-talk') return;

    if (data.type === 'talk-start') {
      TalkReceiver.talking = true;
      TalkReceiver.level = clamp01(data.level || 0);
      startHandlers.forEach(function (fn) { fn(); });
    } else if (data.type === 'talk-level') {
      TalkReceiver.level = clamp01(data.level);
      if (TalkReceiver.talking) {
        levelHandlers.forEach(function (fn) { fn(TalkReceiver.level); });
      }
    } else if (data.type === 'talk-stop') {
      TalkReceiver.talking = false;
      TalkReceiver.level = 0;
      stopHandlers.forEach(function (fn) { fn(); });
    }
  });

  window.TalkReceiver = TalkReceiver;
})();
