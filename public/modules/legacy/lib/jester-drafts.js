// lib/jester-drafts.js
//
// The Game Jester's panel 05: catalogue drafts, no AI. Generates 1–20
// variants of the Living Script mini-games (lib/catalogue-rules.js),
// checks them here, and sends them to GAMES_DB through the admin endpoint
// (/api/admin/variants, behind Cloudflare Access; the server checks them
// all again). 18+ drafts only while the page's "every player is 18 or over"
// box is ticked. If sending fails (e.g. not signed in), the drafts can be
// downloaded as JSON instead.

import { generateVariant, checkVariant, fingerprint, loadCatalogue, MAX_DRAFTS } from './catalogue-rules.js';

const $ = (id) => document.getElementById(id);
const out = $('gjDraftOut');
const TRIES = 40; // per draft, to find one that isn't a repeat within the batch

for (let n = 1; n <= MAX_DRAFTS; n++) {
  const o = document.createElement('option');
  o.value = String(n);
  o.textContent = String(n);
  if (n === 5) o.selected = true;
  $('gjDraftCount').appendChild(o);
}

// The 18+ option follows the page's existing 18+ confirmation.
const ageConfirm = $('gjAgeConfirm');
const adultOption = $('gjDraftAge').querySelector('option[value="18+"]');
function syncAge() {
  adultOption.disabled = !ageConfirm.checked;
  if (!ageConfirm.checked) $('gjDraftAge').value = '12+';
}
ageConfirm.addEventListener('change', syncAge);
syncAge();

let ctxPromise = null;
const getJSON = async (url) => { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(url + ': ' + r.status); return r.json(); };

function show(lines, isError) {
  out.innerHTML = '';
  lines.forEach((l) => {
    const p = document.createElement('p');
    p.style.cssText = 'margin: 4px 0; font-size: 0.8rem; color: ' + (isError ? '#ff2e88' : '#ffd8ec') + ';';
    if (typeof l === 'string') p.textContent = l; else p.appendChild(l);
    out.appendChild(p);
  });
}

function downloadLink(drafts) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ drafts }, null, 2)], { type: 'application/json' }));
  a.download = 'jester-drafts-' + new Date().toISOString().slice(0, 10) + '.json';
  a.textContent = 'Download these drafts as JSON';
  a.style.color = '#ff007f';
  return a;
}

$('gjDraftBtn').addEventListener('click', async () => {
  const count = Math.max(1, Math.min(MAX_DRAFTS, Number($('gjDraftCount').value) || 1));
  const age = $('gjDraftAge').value === '18+' && ageConfirm.checked ? '18+' : '12+';
  show(['The Jester is shuffling the deck…']);
  let ctx;
  try { ctx = await (ctxPromise = ctxPromise || loadCatalogue('living-script-v3/', getJSON)); } catch (e) { ctxPromise = null; show(['Could not read the game catalogue: ' + e.message], true); return; }

  // Generate, skipping repeats within this batch (the server rejects repeats of older ones).
  const drafts = [];
  const seen = new Set();
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < TRIES; t++) {
      const v = generateVariant(ctx, { ageRating: age });
      if (!v) break;
      const fp = fingerprint(v);
      if (seen.has(fp)) continue;
      seen.add(fp);
      const r = checkVariant(v, ctx);
      drafts.push({ ...v, checks: { passed: r.passed, notes: r.notes } });
      break;
    }
  }
  if (!drafts.length) { show(['No drafts could be made for ' + age + ' games.'], true); return; }
  const summary = drafts.map((d) => '• ' + d.name + ' (' + (ctx.metas[d.baseModule] ? ctx.metas[d.baseModule].name : d.baseModule) + ', ' + d.ageRating + ')' + (d.checks.passed ? '' : ' — fails a check here'));
  if (drafts.length < count) summary.push('Only ' + drafts.length + ' different drafts were possible this time.');

  // Send them for review (admin endpoint, behind Cloudflare Access).
  try {
    const res = await fetch('/api/admin/variants', { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ drafts }) });
    if (res.type === 'opaqueredirect') throw new Error('Sign in first: open the Jester Review page (admin) to sign in through Cloudflare Access, then try again.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || ('The review queue refused them (' + res.status + ').'));
    const saved = body.saved || [];
    const ok = saved.filter((s) => s.status === 'draft').length;
    const rejected = saved.filter((s) => s.status === 'rejected');
    show([
      ok + ' draft' + (ok === 1 ? '' : 's') + ' sent to the Jester Review page.' + (rejected.length ? ' ' + rejected.length + ' failed the checks and were saved as rejected.' : ''),
      ...rejected.map((s) => '✗ ' + s.id + ': ' + s.reason),
      ...summary
    ]);
  } catch (e) {
    show([e.message, ...summary, downloadLink(drafts)], true);
  }
});
