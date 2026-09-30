// ====================================================================
// SCRIPT PARSER -- turns the script text into an ordered list of
// sentences, each tagged with who speaks it. DOM-free.
//
// Format: a line starting with a speaker name and a colon switches
// speaker ("WIZARD: Welcome, travellers."). The tag itself is not
// spoken. Lines without a tag continue with the current speaker; the
// script starts with the default speaker (the selected hero), so a
// script with no tags at all is spoken entirely by them.
//
// A speaker tag is 1-3 words of letters (plus spaces, apostrophes,
// hyphens) before the colon -- so "10:30" or a long clause ending in a
// colon is never mistaken for one. A tag that doesn't resolve to a
// character produces a warning and is spoken by the default speaker.
// ====================================================================

const TAG_RE = /^\s*([A-Za-z][A-Za-z'\-]*(?:[ \t]+[A-Za-z][A-Za-z'\-]*){0,2})[ \t]*:(?!\/\/)[ \t]*(.*)$/;

// Kokoro handles up to ~500 phoneme tokens per call; keep each
// generation well under that and short enough for a quick first chunk.
const MAX_SENTENCE_CHARS = 280;
// Very short fragments ("Oh." "No!") are merged into the next sentence
// by the same speaker so the prosody doesn't sound chopped up.
const MIN_SENTENCE_CHARS = 12;

function splitSentences(text) {
  let parts;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const seg = new Intl.Segmenter('en', { granularity: 'sentence' });
    parts = Array.from(seg.segment(text), (s) => s.segment);
  } else {
    parts = text.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g) || [text];
  }
  parts = parts.map((s) => s.trim()).filter(Boolean);

  // Merge short fragments forward.
  const merged = [];
  let carry = '';
  parts.forEach((p) => {
    const joined = carry ? carry + ' ' + p : p;
    if (joined.length < MIN_SENTENCE_CHARS) carry = joined;
    else { merged.push(joined); carry = ''; }
  });
  if (carry) {
    if (merged.length) merged[merged.length - 1] += ' ' + carry;
    else merged.push(carry);
  }

  // Break over-long sentences at clause boundaries, then at spaces.
  const out = [];
  merged.forEach((s) => {
    while (s.length > MAX_SENTENCE_CHARS) {
      const window = s.slice(0, MAX_SENTENCE_CHARS);
      let cut = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(' — '), window.lastIndexOf(': '));
      if (cut < MAX_SENTENCE_CHARS / 3) cut = window.lastIndexOf(' ');
      if (cut <= 0) cut = MAX_SENTENCE_CHARS;
      out.push(s.slice(0, cut + 1).trim());
      s = s.slice(cut + 1).trim();
    }
    if (s) out.push(s);
  });
  return out;
}

/**
 * @param {string} text
 * @param {{ defaultSpeakerId: string, resolveSpeaker: (name: string) => ({ id: string } | null) }} opts
 * @returns {{
 *   sentences: { speakerId: string, text: string }[],
 *   speakers: string[],            // distinct speaker ids, in order of first appearance
 *   warnings: { line: number, name: string }[],
 *   hasTags: boolean
 * }}
 */
export function parseScript(text, { defaultSpeakerId, resolveSpeaker }) {
  const segments = []; // { speakerId, lines: [] }, consecutive same speaker merged
  const warnings = [];
  let hasTags = false;
  let speakerId = defaultSpeakerId;

  function push(line) {
    const last = segments[segments.length - 1];
    if (last && last.speakerId === speakerId) last.lines.push(line);
    else segments.push({ speakerId, lines: [line] });
  }

  String(text || '').split(/\r?\n/).forEach((rawLine, i) => {
    const m = rawLine.match(TAG_RE);
    let body = rawLine;
    if (m) {
      hasTags = true;
      const character = resolveSpeaker(m[1]);
      if (character) {
        speakerId = character.id;
      } else {
        warnings.push({ line: i + 1, name: m[1].trim() });
        speakerId = defaultSpeakerId;
      }
      body = m[2];
    }
    if (body.trim()) push(body.trim());
  });

  const sentences = [];
  const speakers = [];
  segments.forEach((seg) => {
    splitSentences(seg.lines.join(' ')).forEach((s) => {
      sentences.push({ speakerId: seg.speakerId, text: s });
      if (!speakers.includes(seg.speakerId)) speakers.push(seg.speakerId);
    });
  });

  return { sentences, speakers, warnings, hasTags };
}
