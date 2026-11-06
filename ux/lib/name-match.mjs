// Whether a person's first name appears in a piece of text.
//
// Shared by the timeline mentions on a person's page and the dial row on the
// safety plan (lib/read/people.js, lib/read/safety.js), and by the privacy check's name scan
// (scripts/check-privacy.mjs). All three used `\b`, which in JavaScript knows
// only ASCII letters: a name ending in é, ë or any non-Latin letter has no word
// boundary after it, so it never matched: the plan showed no dial for that
// person, and the privacy check never caught that name outside data/.
//
// The edges here are Unicode-aware lookarounds instead: the name stands
// alone when no letter, combining mark, digit or underscore touches either side.
//
// Dependency-free ESM, so its test (scripts/test-name-match.mjs) runs the
// identical function the app does.

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The first word of a name, or '' when there is none to match on.
export function firstName(name) {
  return String(name ?? '').trim().split(/\s+/)[0] ?? '';
}

// A case-insensitive regex for a whole name, spaces and all, standing alone, or
// null when there is none: an empty pattern would match every text. The privacy
// check matches full names this way.
export function wholeNameMatcher(name) {
  const whole = String(name ?? '').trim();
  if (!whole) return null;
  return new RegExp(`(?<![\\p{L}\\p{M}\\p{N}_])${escape(whole)}(?![\\p{L}\\p{M}\\p{N}_])`, 'iu');
}

// A case-insensitive regex for the first name as a whole word, or null when
// there is no name.
export function nameMatcher(name) {
  return wholeNameMatcher(firstName(name));
}
