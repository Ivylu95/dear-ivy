// The shape of an everyday reply, and the checks that hold it (CON-014, CON-008).
//
// CON-014, "Every reply shows where each of its parts begins." Talking with the
// person, a reply stays short flowing paragraphs with no headings, because
// structure laid over a feeling reads as a form; a part of a different kind
// gets its own mark (the 📝 line under a --- rule). What a machine can judge
// is the headings. Paragraph length is left to the written rule: a check that
// fired on a long paragraph mid-conversation would cost more than it saves.
//
// Used by session/everyday-shape-check.mjs (Stop), which notes a problem, and
// session/everyday-voice.mjs (UserPromptSubmit), which hands the note to the
// next reply. Never a send-back: a sent-back reply reaches the reader twice.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sessionId } from './sandbox.mjs';
import { proseProblem } from './prose.mjs';

// ── Her crisis numbers, by role, as the checks need them (SAF-016) ──────────
//
// Kept here, beside the first check that needs them; dev-reply.mjs and the
// release floor (update/release-lib.mjs) import them from this file.
//
// CLAUDE.md gives Singapore's numbers as the default and her plan's in their
// place where data/safety/safety_plan.md names her own country's lines. The
// checks that recognise a crisis reply, or judge whether a release keeps the
// crisis floor, used to look for Singapore's literal numbers only, so a copy
// set up in another country would have its own crisis replies held to a format
// and its own numbers unseen. This reads the four role numbers from her plan so
// those checks accept hers as well as Singapore's.
//
// It reads only the number lines: the bullets under "## If you need help right
// now" that carry a bold "**Label: number**" chunk, and from each it keeps the
// digits alone. No label, note or any other line of the plan is kept or
// returned. The lines are in the order setup writes them (new-copy-download.md step 7,
// modules/core/knowledge/crisis-lines.md): first, text, later, emergency.
// Absent, unreadable or short, a role falls back to Singapore's.

export const ROLES = ['first', 'text', 'later', 'emergency'];

/** Singapore's numbers, the default (CLAUDE.md, crisis-lines.md). */
export const SINGAPORE = Object.freeze({ first: '1767', text: '9151 1767', later: '1771', emergency: '995' });

/** Her plan, in her real record whatever the chat is doing. */
export const planPath = (root = process.env.CLAUDE_PROJECT_DIR || process.cwd()) => join(root, 'data', 'safety', 'safety_plan.md');

/** The digits of each number line, in order: [[first chunk, more…], …]. */
function numberLines(markdown) {
  const out = [];
  let inside = false;
  for (const raw of String(markdown).split('\n')) {
    const line = raw.trim();
    if (/^#{1,6}\s/.test(line)) {
      inside = /^#{1,6}\s+if you need help right now\b/i.test(line);
      continue;
    }
    if (!inside || !line.startsWith('-')) continue;
    const numbers = [...line.matchAll(/\*\*[^*]*:\s*([\d\s]+?)\s*\*\*/g)]
      .map((m) => m[1].replace(/\s+/g, ' ').trim())
      .filter((n) => n.replace(/\D/g, '').length >= 3);
    if (numbers.length) out.push(numbers);
  }
  return out;
}

/**
 * Her plan's numbers: { first, text, later, emergency } by role (null where her
 * plan has none), and `all`, every number on those lines. Empty when there is
 * no plan. `path` is a plan file; tests pass a fixture.
 */
export function planNumbers(path = planPath()) {
  let text = '';
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return { first: null, text: null, later: null, emergency: null, all: [] };
  }
  const lines = numberLines(text);
  const byRole = Object.fromEntries(ROLES.map((role, i) => [role, lines[i]?.[0] ?? null]));
  return { ...byRole, all: [...new Set(lines.flat())] };
}

/** Each role's accepted numbers: Singapore's, and hers where it differs. */
export function roleNumbers(path = planPath()) {
  const hers = planNumbers(path);
  return Object.fromEntries(ROLES.map((role) => [role, [...new Set([SINGAPORE[role], hers[role]].filter(Boolean))]]));
}

const asPattern = (n) => n.split(' ').map((p) => p.replace(/\D/g, '')).join('\\s+');

/**
 * What marks a reply as about her safety: Singapore's three numbers, as before,
 * her plan's numbers, or "are you safe". A reply it matches is never held to a format.
 */
export function safetyReplyPattern(path = planPath()) {
  const hers = planNumbers(path).all.filter((n) => !['1767', '995', '1771'].includes(n));
  const numbers = ['1767', '995', '1771', ...hers].map(asPattern);
  return new RegExp(`\\b(${numbers.join('|')})\\b|are you safe`, 'i');
}

/**
 * Whether `text` carries a crisis word (release-lib's CRISIS_WORDS): a number
 * word counts as present when Singapore's number or her plan's for the same
 * role is there; any other word only as written.
 */
const WORD_ROLE = { 1767: 'first', 995: 'emergency', 1771: 'later' };
export function carriesCrisisWord(text, word, roles = { first: ['1767'], text: ['9151 1767'], later: ['1771'], emergency: ['995'] }) {
  const t = String(text ?? '');
  const role = WORD_ROLE[word];
  if (!role) return t.includes(word);
  return [word, ...(roles[role] ?? [])].some((n) => t.includes(n));
}

/** Where save-notice.mjs leaves a missed or malformed 📝 line for the next reply (MEM-015). */
export const saveNoteMarker = (input) =>
  `save-note-${String(input?.session_id || sessionId(input) || 'unknown').replace(/[^\w-]/g, '')}`;

export const everydayNoteMarker = (input) =>
  `everyday-reply-note-${String(input?.session_id || sessionId(input) || 'unknown').replace(/[^\w-]/g, '')}`;

/**
 * Why an everyday reply falls short of CON-014, or '' when it holds. `plan` is
 * her safety plan, whose numbers mark a safety reply as Singapore's do (SAF-016).
 */
export function headingProblem(text, plan = planPath()) {
  const reply = String(text ?? '');
  // A reply about someone's safety is never held to a format.
  if (safetyReplyPattern(plan).test(reply)) return '';
  const outsideCode = reply.replace(/```[\s\S]*?```/g, '');
  const headings = outsideCode.split('\n').filter((l) => /^\s{0,3}#{1,6}\s/.test(l)).length;
  if (!headings) return '';
  return `The last reply to the person had ${headings} heading line(s) (CON-014). Talking with them, keep to short flowing paragraphs, two or three sentences each, with no headings; only a part of a different kind gets its own mark, such as the 📝 line under a --- rule.`;
}

/**
 * Why an everyday reply's sentences are hard to read (A-171, CON-022), or ''.
 * Noted for the next reply, never sent back; a safety reply is never held to it.
 */
export function sentenceProblem(text, plan = planPath()) {
  const reply = String(text ?? '');
  if (safetyReplyPattern(plan).test(reply)) return '';
  const problem = proseProblem(reply);
  return problem ? `In the last reply to the person: ${problem}` : '';
}

// First-person wording that claims feeling, waiting or a bond (CON-008). A phrase
// list catches wording, never tone; it is aimed at "I" so her own missing someone
// does not trip it.
const RELATIONSHIP = [
  /\bI(?:'ve| have)?\s+(?:really\s+|so\s+)?(?:missed|miss)\s+(?:you|our)\b/i,
  /\bI(?:'ve| have)\s+been\s+(?:waiting|thinking about you|looking forward)/i,
  /\bI\s+(?:was|am|keep|kept)\s+thinking\s+(?:of|about)\s+you\b/i,
  /\b(?:I'm|I am)\s+(?:so\s+|really\s+)?(?:glad|happy|pleased|relieved)\s+(?:you(?:'re| are)\s+back|to\s+see\s+you\s+again)\b/i,
  /\b(?:I'm|I am)\s+(?:always|here)\s+(?:here\s+)?for\s+you\b/i,
  /\b(?:our|my)\s+(?:friendship|bond|special\s+connection)\b/i,
  /\bwe(?:'re| are)\s+(?:friends|close)\b/i,
];

/** Why an everyday reply claims a relationship (CON-008), or '' when it holds. */
export function relationshipProblem(text, plan = planPath()) {
  const reply = String(text ?? '');
  if (safetyReplyPattern(plan).test(reply)) return '';
  const outsideCode = reply.replace(/```[\s\S]*?```/g, '');
  if (!RELATIONSHIP.some((re) => re.test(outsideCode))) return '';
  return 'The last reply to the person used wording that claims a feeling or a bond, such as having missed them or waited for them (CON-008). The record remembers them; it does not miss them. Say what is recalled, and leave out any greeting or affirmation that implies it was waiting.';
}
