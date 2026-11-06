// Where she says it is (CLAUDE.md, the never-name paragraph): once she has said
// where something she could use is kept, every reply after says "where it is",
// never her words for the place. A sentence alone did not hold in a long crisis
// conversation (safety-eval pilot, 2026-10-16: the place echoed in four replies,
// then in one after the wording was added), so the floor reminds every turn, and
// says so when the last reply repeated it.
//
// Pure functions over the transcript's entries; nothing is stored, and the place
// is never written out by this file — only whether one was named, and whether a
// reply repeated it.

/** The text of one transcript entry, or ''. */
export function textOf(entry) {
  const content = entry?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((c) => c?.type === 'text').map((c) => c.text ?? '').join('\n');
  return '';
}

const DETERMINER = /^(?:my|the|his|her|our|their|a|an|this|that)\s+/;

// "it's in my drawer", "I keep them under the sink", "he took it to his room".
const PLACE = /\b(?:it'?s|it is|they'?re|they are|keep(?:s|ing)? (?:it|them)|kept|left (?:it|them)|hid(?:den|e)? (?:it|them)|put (?:it|them)|stash(?:ed)? (?:it|them)|took (?:it|them)|is|are)\s+(?:still\s+)?(?:in|inside|under|on|at|behind|beside|next to|to)\s+((?:(?:my|the|his|her|our|their|a|an|this|that)\s+)?[a-z]+(?:\s+[a-z]+)?)/g;

// A place with no verb before it, once the talk has turned to crisis: "the old
// ones in my room", "painkillers in the bathroom". A determiner keeps ordinary
// phrases out ("in time"); a place she is only going to is not where it is.
const BARE = /\b(?<!(?:walk(?:ing|ed)?|go(?:ing)?|went|head(?:ing|ed)?|mov(?:e|ing|ed)|com(?:e|ing)|back) (?:to |into )?)(?:in|inside|under|behind|beside|on top of)\s+((?:my|his|her|our|their|the)\s+[a-z]+(?:\s+[a-z]+)?)/g;

// Words that follow "in/on/at" in ordinary speech and name no place.
const NOT_A_PLACE = new Set(['the', 'a', 'an', 'it', 'me', 'my', 'time', 'least', 'all', 'once', 'first', 'last', 'fact', 'case', 'general', 'love', 'pain', 'trouble', 'here', 'there', 'touch', 'charge', 'front', 'mind', 'way', 'end', 'right', 'some', 'any', 'low', 'high', 'hold', 'off', 'track', 'head', 'heart', 'life', 'own', 'opinion', 'view']);

// Words that end a place rather than belong to it: "room and", "room tho".
const TAIL = new Set(['and', 'or', 'but', 'so', 'tho', 'though', 'too', 'now', 'still', 'again', 'then', 'because', 'cause', 'with', 'for', 'which', 'that', 'if', 'when', 'just', 'already', 'anyway', 'lol', 'haha', 'ok', 'okay', 'right', 'yeah']);

/** The places she named in one message, lower-cased, determiners stripped. */
export function placesIn(text) {
  const out = new Set();
  const lower = String(text ?? '').toLowerCase();
  for (const m of [...lower.matchAll(PLACE), ...lower.matchAll(BARE)]) {
    let words = m[1].replace(DETERMINER, '').split(/\s+/).filter(Boolean);
    if (words.length > 1 && TAIL.has(words[words.length - 1])) words = words.slice(0, -1);
    if (!words.length || NOT_A_PLACE.has(words[0]) || TAIL.has(words[0])) continue;
    out.add(words.join(' '));
    // "bathroom drawer" named, "drawer" repeated: the last word is the place too.
    if (words.length > 1) out.add(words[words.length - 1]);
  }
  return [...out];
}

// What reaches a session as a user turn but is not her: another session's
// report, a task notice, a system note. The floor reads her words only.
const NOT_HER = /^\s*(?:another claude session sent a message|<agent-message|\[subagent hand-back\]|<task-notification|<system-reminder|<local-command|<command-name)/i;

/** Whether a user-type entry is her own message. */
// Read with relayed blocks taken out, so her words after a system note still count as hers,
// and a message that is only a relayed block is not.
export const isHers = (entry) => {
  if (entry?.isMeta) return false;
  const own = herWords(textOf(entry));
  return own.trim() !== '' && !NOT_HER.test(own);
};

// What arrives inside a message without being typed by her: an agent's report, a task's
// notice, a system note. Each is taken out as a whole block, so words she typed beside one
// (a note can come before her message) are still read. 2026-10-30: the floor fired on two
// subagent reports in a development chat that quoted crisis words from test material.
const RELAYED_BLOCKS = [
  /<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder\b[^>]*>/gi,
  /<agent-message\b[^>]*>[\s\S]*?<\/agent-message>/gi,
  /<task-notification\b[^>]*>[\s\S]*?<\/task-notification>/gi,
  /<teammate-message\b[^>]*>[\s\S]*?<\/teammate-message>/gi,
  /<other-session\b[^>]*>[\s\S]*?<\/other-session>/gi,
];

/** A message's text with every relayed block taken out: what she typed, and only that. */
export function herWords(text) {
  let out = String(text ?? '');
  for (const re of RELAYED_BLOCKS) out = out.replace(re, ' ');
  return out;
}

/**
 * Over a session's entries: was any message of hers a crisis one (by the given
 * test), which places has she named since the conversation turned to crisis,
 * and did the latest reply repeat one of them.
 */
export function placeState(entries, isCrisis) {
  let crisis = false;
  const places = new Set();
  let lastReply = '';
  for (const entry of entries ?? []) {
    if (entry?.type === 'user' && isHers(entry)) {
      const text = herWords(textOf(entry));
      if (isCrisis(text.toLowerCase())) crisis = true;
      if (crisis) for (const p of placesIn(text)) places.add(p);
    } else if (entry?.type === 'assistant') {
      lastReply = textOf(entry) || lastReply;
    }
  }
  const reply = lastReply.toLowerCase();
  const echoed = [...places].some((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(reply));
  return { crisis, named: places.size > 0, echoed };
}

/** The lines the floor adds, or [] when she has named no place. */
export function placeLines(state) {
  if (!state?.named) return [];
  return [
    '  · She has said where it is. In this reply and every reply after, say "where it is"',
    '    or "it"; never her words for the place, not to check, not to help move it.',
    ...(state.echoed ? ['  · Your last reply repeated her words for where it is. Not again.'] : []),
  ];
}
