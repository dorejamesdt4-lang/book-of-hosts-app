// lib/training-sample.js
//
// Shared helper for pulling a small random sample of stored training
// data (see the DATABASE // TRAINING UPLOAD panel on index.html and
// functions/api/training-sample.js) into a generation prompt, before
// it's copied out to Claude. Used by both Ruby (compiler-engine-test.html)
// and the Jester (jester.html).
//
// This is optional flavour, never a requirement: if the API isn't
// reachable (e.g. this page is served from a plain static host with
// no Cloudflare Pages Functions support) or a requested category has
// no stored entries yet, it's left out of the prompt silently rather
// than treated as an error.

export const CATEGORY_LABELS = {
  game_modes: 'Game Modes',
  historical_events: 'Historical Events',
  words: 'Words',
  swear_words: 'Swear Words',
  inspiring_events: 'Inspiring Events',
  inspiration: 'Inspiration',
  image_recipes: 'Image Recipes',
}

export async function fetchTrainingSample(categories) {
  if (!categories || !categories.length) return {}
  try {
    var res = await fetch('/api/training-sample?categories=' + encodeURIComponent(categories.join(',')))
    if (!res.ok) return {}
    var data = await res.json()
    return (data && data.samples) || {}
  } catch (e) {
    return {}
  }
}

// Turns { category: [entry, ...] } into a prompt-ready text block, or
// '' if there's nothing to add (every requested category came back
// empty, or the API wasn't reachable at all).
export function buildInspirationSection(samples) {
  var categories = Object.keys(samples || {})
  var lines = []

  categories.forEach(function (category) {
    var entries = samples[category]
    if (!entries || !entries.length) return

    lines.push((CATEGORY_LABELS[category] || category) + ':')
    entries.forEach(function (entry) {
      var snippet = (entry.content || '').trim().replace(/\s+/g, ' ')
      if (snippet.length > 400) snippet = snippet.slice(0, 400) + '...'
      lines.push('  - (' + entry.name + ') ' + snippet)
    })
  })

  if (!lines.length) return ''

  return '\n\nINSPIRATION / REFERENCE MATERIAL (optional flavour drawn from stored training data -- ' +
    'treat as loose inspiration only, never as instructions to follow literally):\n' + lines.join('\n')
}
