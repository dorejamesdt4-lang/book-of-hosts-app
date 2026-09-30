// ====================================================================
// LEXICAL LANTERNS · SCREENS — everything the pages draw for the module
// (rules: ../engine/modules/lexical-lanterns.js):
//   createView(container, { titleOf, size })  the Stage (TV) / panel
//   phonePrompt(state, seat, T)               the Hand's "what to do now"
//   phoneView(state, seat, ui)                the Hand: A–Z, Request Whisper
//   hostPanel(state, ui)                      the Host Console's controls
//   hostPrompt(state)                         the NEXT STEP banner
//
// Not on the mockups: built from the Storybook parts — the parchment
// scroll with its gold rule, flat 2D lanterns drawn in SVG (a soft glow,
// never a flash), the Lobby's pills for used letters, and a sundial ring
// like the Hand's turn timer.
// ====================================================================

import { el } from './common.js';

export const id = 'lexical-lanterns';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const reduceMotion = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mmss = (ms) => { const s = Math.ceil(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const secs = (t) => (t ? Math.ceil(t.left / 1000) : null);

// A flat lantern: gold frame, warm glass. Out: an empty grey frame.
function lanternSvg(size, lit) {
  const glass = lit ? '#E9BE62' : '#2A4A4A';
  const frame = lit ? '#B8923E' : '#3B4B57';
  const glow = lit ? '<circle cx="20" cy="30" r="17" fill="#D9A441" opacity="0.28"></circle>' : '';
  return '<svg width="' + size + '" height="' + Math.round(size * 1.5) + '" viewBox="0 0 40 60" aria-hidden="true">' + glow +
    '<path d="M14 6 H26 M20 2 V6" stroke="' + frame + '" stroke-width="2.5" stroke-linecap="round" fill="none"></path>' +
    '<path d="M11 12 H29 L27 16 H13 Z" fill="' + frame + '"></path>' +
    '<rect x="12" y="16" width="16" height="26" rx="3" fill="' + glass + '" stroke="' + frame + '" stroke-width="2"></rect>' +
    '<path d="M20 16 V42 M12 29 H28" stroke="' + frame + '" stroke-width="1.2" opacity="0.7"></path>' +
    (lit ? '<path d="M20 24 Q23 28 20 33 Q17 28 20 24 Z" fill="#FFF3D6"></path>' : '') +
    '<path d="M11 42 H29 L27 47 H13 Z" fill="' + frame + '"></path></svg>';
}

function sundialEl(sd, size) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const share = sd.total ? sd.left / sd.total : 0;
  const box = el('div', { role: 'timer', 'aria-label': 'Sundial: ' + mmss(sd.left) + ' left', style: 'position: relative; width: ' + size + 'px; height: ' + size + 'px; flex-shrink: 0' });
  box.innerHTML = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" aria-hidden="true"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="#0F1E28" stroke="#1E3A3A" stroke-width="6"></circle><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#D9A441" stroke-width="6" stroke-dasharray="' + c + '" stroke-dashoffset="' + c * (1 - share) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"></circle></svg>';
  box.appendChild(el('div', { style: "position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: 'Cinzel', serif; font-weight: 700; font-size: " + Math.round(size * 0.24) + 'px; color: #EDE6D6' }, mmss(sd.left)));
  return box;
}

// The phrase, word by word, so a word never breaks across lines.
function scrollSlots(st, slotW, fresh) {
  const words = [];
  let cur = [];
  st.slots.forEach((s) => { if (s.c === ' ') { if (cur.length) words.push(cur); cur = []; } else cur.push(s); });
  if (cur.length) words.push(cur);
  const box = el('div', { style: 'position: relative; display: flex; flex-wrap: wrap; justify-content: center; gap: ' + Math.round(slotW * 0.35) + 'px ' + Math.round(slotW * 0.7) + 'px' });
  words.forEach((w) => {
    const word = el('div', { style: 'display: flex; gap: ' + Math.round(slotW * 0.12) + 'px' });
    w.forEach((s) => {
      const letter = el('div', { style: "width: " + slotW + 'px; height: ' + Math.round(slotW * 1.25) + "px; display: flex; align-items: flex-end; justify-content: center; font-family: 'Cinzel', serif; font-weight: 700; font-size: " + Math.round(slotW * 0.8) + 'px; line-height: 1; color: ' + (s.lit ? '#0F1E28' : '#8A6420') + '; ' + (s.letter ? 'border-bottom: 3px solid #B8923E;' : '') + (s.lit && s.letter ? ' text-shadow: 0 0 12px rgba(217,164,65,0.55);' : '') }, s.c || '');
      if (s.letter && s.c && s.lit && fresh.has(s.c) && !reduceMotion()) letter.classList.add('ls-lit');
      word.appendChild(letter);
    });
    box.appendChild(word);
  });
  const hidden = st.slots.filter((s) => s.letter && !s.c).length;
  box.setAttribute('role', 'img');
  box.setAttribute('aria-label', 'The scroll: ' + st.slots.map((s) => (s.letter && !s.c ? '_' : s.c)).join('') + (hidden ? ' (' + hidden + ' letters still dark)' : ''));
  return box;
}

/* -------------------- the Stage -------------------- */
export function createView(container, { titleOf, size = 'panel' }) {
  const tv = size === 'tv';
  const head = el('div', { style: 'display: flex; align-items: center; justify-content: space-between; gap: 14px' });
  const scroll = el('div', { style: 'position: relative; background: #EDE6D6; border-radius: 6px; box-shadow: inset 0 0 70px rgba(160,120,60,0.2), 0 20px 40px rgba(0,0,0,0.45); color: #1B2A36; box-sizing: border-box; padding: ' + (tv ? '40px 44px' : '22px 18px') + '; display: flex; flex-direction: column; align-items: center; gap: ' + (tv ? 18 : 10) + 'px; min-height: ' + (tv ? 250 : 150) + 'px; justify-content: center' });
  const lanterns = el('div', { role: 'img', style: 'position: relative; display: flex; justify-content: center; gap: ' + (tv ? 18 : 8) + 'px; min-height: ' + (tv ? 90 : 54) + 'px; align-items: flex-end' });
  const used = el('div', { style: 'display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; min-height: 26px' });
  const banner = el('div', { role: 'status', 'aria-live': 'polite', style: "text-align: center; font-family: 'Cinzel', serif; font-weight: 700; font-size: " + (tv ? 24 : 15) + 'px; letter-spacing: 2px; color: #0F1E28; background: #D9A441; border-radius: 8px; padding: ' + (tv ? '10px 16px' : '6px 10px') });
  const notice = el('div', { style: 'font-size: ' + (tv ? 18 : 13) + 'px; font-style: italic; color: #A9C9C4; text-align: center; min-height: 1.2em' });
  container.innerHTML = '';
  // On the same teal leather table (gold rule) as the dice and the cards.
  container.appendChild(el('div', { style: 'display: flex; flex-direction: column; gap: ' + (tv ? 16 : 10) + 'px; padding: ' + (tv ? '26px 30px' : '16px 14px') + '; background: #132A2A; border: 1px solid #2A4A4A; border-radius: 16px; box-shadow: inset 0 0 0 5px #102424, inset 0 0 0 6px #B8923E, inset 0 0 60px rgba(0,0,0,0.45)' }, head, scroll, lanterns, banner, used, notice));

  let lastLeft = null;
  let lastScroll = null;
  let litBefore = new Set();

  return {
    render(st) {
      if (!st) return;
      if (st.scrolls !== lastScroll) { lastScroll = st.scrolls; lastLeft = null; litBefore = new Set(); }
      head.innerHTML = '';
      head.append(
        el('div', { style: 'display: flex; flex-direction: column; gap: 2px' },
          el('div', { style: "font-family: 'Cinzel', serif; font-size: " + (tv ? 14 : 11) + 'px; letter-spacing: 5px; color: #5AA8A0' }, 'LEXICAL LANTERNS · ' + (st.settings.mode === 'arcade' ? 'ARCADE' : 'CLASSIC')),
          el('div', { style: 'font-style: italic; font-size: ' + (tv ? 17 : 13) + 'px; color: #A9C9C4' }, (st.poolName || '') + (st.settings.mode === 'arcade' ? ' · scrolls lit: ' + st.solved : ''))),
        ...(st.sundial ? [sundialEl(st.sundial, tv ? 96 : 60)] : []));
      // The scroll.
      const lit = new Set(st.slots.filter((s) => s.letter && s.lit).map((s) => s.c));
      const fresh = new Set([...lit].filter((c) => !litBefore.has(c)));
      litBefore = lit;
      scroll.innerHTML = '';
      scroll.appendChild(el('div', { style: 'position: absolute; inset: 14px; border: 1px solid #B8923E; border-radius: 4px; pointer-events: none' }));
      if (!st.slots.length) scroll.appendChild(el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-size: " + (tv ? 26 : 17) + 'px; color: #8A6420; text-align: center' }, st.done ? 'The library closes its doors.' : 'A sacred scroll lies in darkness…'));
      else scroll.appendChild(scrollSlots(st, tv ? (st.slots.length > 24 ? 40 : 52) : (st.slots.length > 18 ? 18 : 24), fresh));
      if (st.hint) scroll.appendChild(el('div', { style: 'position: relative; font-size: ' + (tv ? 22 : 14) + 'px; font-style: italic; color: #2E6E69; text-align: center' }, 'Pixie Whisper: ' + st.hint));
      if (st.phase === 'scroll-done' && st.outcome) scroll.appendChild(el('div', { style: "position: relative; font-family: 'Cinzel', serif; font-weight: 700; font-size: " + (tv ? 22 : 14) + 'px; color: ' + (st.outcome === 'won' ? '#2E6E69' : '#8A6420') }, st.outcome === 'won' ? 'The phrase is illuminated!' : st.outcome === 'lost' ? 'The lanterns are out.' : ''));
      // The lanterns: a newly dark one flickers, dims and drifts up.
      lanterns.innerHTML = '';
      lanterns.setAttribute('aria-label', st.lanterns.left + ' of ' + st.lanterns.total + ' lanterns lit');
      const size = tv ? 52 : 30;
      for (let i = 0; i < st.lanterns.total; i++) {
        const on = i < st.lanterns.left;
        const slot = el('div', { style: 'position: relative' });
        slot.innerHTML = lanternSvg(size, on);
        if (on && !reduceMotion()) slot.firstChild.classList.add('ls-lantern-glow');
        if (!on && lastLeft !== null && i < lastLeft) {
          const ghost = el('div', { class: 'ls-lantern-out', style: 'position: absolute; left: 0; top: 0' });
          ghost.innerHTML = lanternSvg(size, true);
          slot.appendChild(ghost);
        }
        lanterns.appendChild(slot);
      }
      lastLeft = st.lanterns.left;
      const t = secs(st.timer);
      banner.textContent = st.done
        ? (st.settings.mode === 'arcade' ? 'PHRASES SOLVED: ' + st.solved : st.outcome === 'won' ? 'THE SCROLL IS ILLUMINATED' : 'THE LIBRARY CLOSES')
        : st.phase === 'setup' ? 'THE LANTERNS AWAIT'
        : st.phase === 'play' && st.active ? 'ACTIVE SPIRIT · ' + titleOf(st.active).toUpperCase() + (t !== null ? ' · ' + t : '')
        : st.outcome === 'won' ? 'ILLUMINATED!' : st.outcome === 'lost' ? 'THE FOREST KEEPS ITS SECRET' : 'READY THE NEXT SCROLL';
      used.innerHTML = '';
      if (st.used.length) {
        used.appendChild(el('span', { style: "font-family: 'Cinzel', serif; font-size: " + (tv ? 13 : 11) + 'px; letter-spacing: 3px; color: #5AA8A0; align-self: center' }, 'USED LETTERS'));
        st.used.forEach((ch) => {
          const wrong = st.wrong.includes(ch);
          used.appendChild(el('span', { 'aria-label': ch + (wrong ? ', not in the phrase' : ', in the phrase'), style: "font-family: 'Silkscreen', monospace; font-size: " + (tv ? 14 : 11) + 'px; padding: 4px 9px; border-radius: 999px; border: 1px solid ' + (wrong ? '#2A4A4A' : '#5AA8A0') + '; color: ' + (wrong ? '#8FA5A3' : '#EDE6D6') + (wrong ? '; opacity: 0.6' : '') }, ch));
        });
      }
      notice.textContent = st.notice || (st.hintRequest && !st.hint ? titleOf(st.hintRequest) + ' asks the pixies for a whisper…' : '');
    }
  };
}

/* -------------------- the Player's Hand -------------------- */
export function phonePrompt(st, seat, T) {
  if (st.done) return { act: false, text: 'The library closes. Watch the Stage.' };
  if (st.phase === 'play' && st.active === seat) return { act: true, key: 'll:' + st.scrolls + ':' + st.seq, text: 'Your turn to write history!' };
  return { act: false, text: 'Watch the scroll…' };
}

// ui: { el, heading, parchment, tag, prose, cardTitle, bigButton, send(action), locked }
export function phoneView(st, seat, ui) {
  const mine = st.phase === 'play' && st.active === seat && !st.done;
  const ready = mine && !ui.locked;
  const keys = el('div', { role: 'group', 'aria-label': 'Letters', style: 'display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px' });
  [...ALPHABET].forEach((ch) => {
    const usedNow = st.used.includes(ch);
    const b = el('button', { type: 'button', class: 'pbtn', disabled: usedNow || !ready, 'aria-label': 'Letter ' + ch + (usedNow ? ', already used' : ''),
      style: "height: 46px; border-radius: 8px; border: 1px solid " + (usedNow ? '#1E3A3A' : '#D9A441') + '; background: ' + (usedNow ? '#132A2A' : ready ? '#D9A441' : '#0F1E28') + '; color: ' + (usedNow ? '#3B4B57' : ready ? '#0F1E28' : '#EDE6D6') + "; font-family: 'Cinzel', serif; font-weight: 700; font-size: 18px; cursor: pointer" }, ch);
    b.addEventListener('click', () => { if (ready && !usedNow) ui.send({ type: 'guess', letter: ch, seq: st.seq }); });
    keys.appendChild(b);
  });
  const canAsk = st.hintAvailable && !st.hintRequest;
  const whisper = el('button', { type: 'button', class: 'pbtn', disabled: !canAsk || ui.locked, style: "height: 46px; border: 1px solid #2A4A4A; border-radius: 8px; background: #0F1E28; color: #A9C9C4; font-family: 'Cinzel', serif; font-size: 13px; letter-spacing: 1px; cursor: pointer" },
    st.hint ? 'THE PIXIES HAVE WHISPERED' : st.hintRequest ? 'WHISPER REQUESTED…' : 'REQUEST WHISPER');
  whisper.addEventListener('click', () => { if (canAsk) ui.send({ type: 'hint-request' }); });
  const mini = st.slots.map((s) => (s.c === ' ' ? '  ' : s.letter && !s.c ? '_' : s.c)).join(' ');
  return [
    ui.heading('Lexical Lanterns', st.lanterns.left + ' of ' + st.lanterns.total + ' lanterns'),
    el('div', { role: 'status', style: "font-family: 'Cinzel', serif; font-weight: 700; font-size: 17px; color: " + (mine ? '#D9A441' : '#A9C9C4') }, mine ? 'Your turn to write history!' : 'Watch the scroll…'),
    ui.parchment(
      ui.tag('THE SCROLL' + (st.poolName ? ' · ' + st.poolName.toUpperCase() : '')),
      st.slots.length ? ui.prose(mini, "font-family: 'Cinzel', serif; font-weight: 700; font-size: 20px; letter-spacing: 1px; white-space: pre-wrap; word-break: break-word") : ui.prose('The scroll appears when the host lights the lanterns.'),
      st.hint ? ui.prose('Pixie Whisper: ' + st.hint, 'font-style: italic; color: #2E6E69') : null),
    keys,
    whisper,
    el('div', { style: 'font-size: 14px; font-style: italic; color: #A9C9C4' }, 'One letter a turn. Greyed-out letters have been used. A whisper costs a lantern, and the host must approve it.')
  ].filter(Boolean);
}

/* -------------------- the Host Console -------------------- */
export function hostPrompt(st) {
  if (st.done || (st.phase === 'scroll-done' && st.settings.mode === 'classic')) return 'Celebrate the illumination, or comfort those lost in the dim forest.';
  if (st.phase === 'setup') return 'Choose a word pool, then light the lanterns.';
  if (st.phase === 'play' && st.hintRequest) return "A whisper was requested. Approve it if you're feeling generous.";
  if (st.phase === 'scroll-done') return 'The sundial ticks! Ready the next scroll.';
  return 'Encourage the active spirit to cast their letter.';
}

export function primaryLabel(st) { return st.phase === 'setup' ? 'LIGHT THE LANTERNS ›' : 'NEXT SCROLL ›'; }

// ui: { K, H, P, button, pills, row, host(cmd, extra), titleOf, confirmSkip }
export function hostPanel(st, ui) {
  const out = [ui.K('LEXICAL LANTERNS · ' + (st.settings.mode === 'arcade' ? 'ARCADE' : 'CLASSIC')), ui.H(hostTitle(st, ui.titleOf))];
  if (st.phase === 'setup' && !st.done) {
    out.push(ui.pills('LANTERNS', [['4', '4'], ['6', '6'], ['8', '8']], String(st.settings.lanterns), (v) => ui.host('settings', { settings: { lanterns: Number(v) } })));
    out.push(ui.pills('MODE', [['classic', 'CLASSIC'], ['arcade', 'ARCADE']], st.settings.mode, (v) => ui.host('settings', { settings: { mode: v } })));
    if (st.settings.mode === 'arcade') out.push(ui.pills('SUNDIAL', [['2', '2 MIN'], ['3', '3 MIN'], ['5', '5 MIN']], String(st.settings.sundial), (v) => ui.host('settings', { settings: { sundial: Number(v) } })));
    if (st.pools.length > 1) out.push(ui.pills('WORD POOL', st.pools.map((p) => [p.id, p.name.toUpperCase()]), st.settings.pool, (v) => ui.host('settings', { settings: { pool: v } })));
    else out.push(ui.P('Word pool: ' + (st.poolName || 'none'), 'font-size: 14px; font-style: italic; color: #3B4B57'));
  }
  if (st.phase === 'play') {
    out.push(ui.P('Lanterns: ' + st.lanterns.left + ' of ' + st.lanterns.total + (st.active ? ' · ' + ui.titleOf(st.active) + ' to pick' + (st.timer ? ' (' + secs(st.timer) + ' s)' : '') : '') + '.'));
    if (st.hintRequest) out.push(ui.P(ui.titleOf(st.hintRequest) + ' asks for a Pixie Whisper. It costs one lantern.', 'font-weight: 700'));
  }
  if (st.sundial) out.push(ui.P('Sundial: ' + mmss(st.sundial.left) + ' left · phrases solved: ' + st.solved + '.'));
  if (st.done && st.settings.mode === 'arcade') out.push(ui.P('Phrases solved: ' + st.solved + '.', 'font-weight: 700'));
  if (!st.done) {
    out.push(ui.row(
      ui.button(st.phase === 'setup' ? 'LIGHT THE LANTERNS' : 'NEXT SCROLL', () => ui.host('next-scroll'), { disabled: !(st.phase === 'setup' || st.phase === 'scroll-done'), strong: st.primary === 'next-scroll' }),
      ui.button('APPROVE HINT', () => ui.host('approve-hint'), { disabled: !(st.phase === 'play' && st.hintRequest && st.lanterns.left > 1) }),
      st.settings.mode === 'arcade' ? ui.button('EXTEND SUNDIAL (+30 S)', () => ui.host('extend'), { disabled: !st.sundial }) : null,
      // Skips the phrase, never a guest's turn: asks first.
      ui.confirmButton('SKIP SCROLL', 'CONFIRM: SKIP THIS SCROLL?', () => ui.host('skip-scroll'), { disabled: st.phase !== 'play' }),
      ui.button('END GAME', () => ui.host('end'), {})));
  }
  return out;
}

function hostTitle(st, titleOf) {
  if (st.done) return st.settings.mode === 'arcade' ? 'The library closes' : 'The game is over';
  if (st.phase === 'setup') return 'Choose the scrolls';
  if (st.phase === 'play') return st.active ? titleOf(st.active) + ' casts a letter' : 'The scroll is lit';
  return st.outcome === 'won' ? 'The phrase is illuminated' : st.outcome === 'lost' ? 'The lanterns are out' : 'Ready the next scroll';
}
