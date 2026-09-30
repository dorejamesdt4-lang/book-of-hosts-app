// ====================================================================
// THE GUEST INVITATION (invite.html?seat=<slug>) — "The Book Has Chosen
// You". The guest fills in their character card. Phase 1 keeps it in
// this browser's localStorage (the Lobby reads it for player names);
// from Phase 2 it goes to Ruby.
// ====================================================================

import { loadAll, seatParam, lsGet, lsSet, keys } from './common.js';

const $ = (id) => document.getElementById(id);
const data = await loadAll();
const { game } = data;
const seat = seatParam(game);
const g = game.game;

$('hostName').textContent = g.host_name;
$('gameTitle').textContent = g.title;
// Phase 1: the host's choice in the Lobby lives in this same browser.
const how = lsGet(keys.playMode, 'online');
$('playedHow').textContent = how === 'theatre' ? 'played in person, with the Narrator on the big screen.' : 'played online with the Narrator.';
$('when').textContent = (g.date + ' · ' + g.time).toUpperCase();
$('replyBy').textContent = ('Reply by ' + g.reply_by).toUpperCase();
// "Your host" reads as "only your host" mid-sentence; a real name stays as written.
const hostInSentence = /^(your|the) /i.test(g.host_name) ? g.host_name.toLowerCase() : g.host_name;
$('privacy').textContent = 'Only ' + hostInSentence + ' and the Narrator see your answers.';
$('toWardrobe').href = 'wardrobe.html?seat=' + encodeURIComponent(seat);

const form = $('card');
const saved = lsGet(keys.card(seat), null);
if (saved) {
  $('g-name').value = saved.name || '';
  const spot = form.querySelector('input[name="spotlight"][value="' + saved.spotlight + '"]');
  if (spot) spot.checked = true;
  if (saved.costume) $('g-costume').value = saved.costume;
  $('g-avoid').value = saved.avoid || '';
  $('g-child').checked = !!saved.child;
}

function save() {
  const spot = form.querySelector('input[name="spotlight"]:checked');
  lsSet(keys.card(seat), {
    name: $('g-name').value.trim(),
    spotlight: spot ? spot.value : 'fair',
    costume: $('g-costume').value,
    avoid: $('g-avoid').value.trim(),
    child: $('g-child').checked,
    updatedAt: new Date().toISOString()
  });
}

form.addEventListener('input', save);
form.addEventListener('change', save);
form.addEventListener('submit', (e) => e.preventDefault());
$('toWardrobe').addEventListener('click', save);
