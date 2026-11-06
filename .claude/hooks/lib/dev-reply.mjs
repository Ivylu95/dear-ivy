// The shape of a reply in development mode, and the check that holds it
// (DEV-002..011, DEV-003: the menu, view and tracker shapes). One home for both: the hook that puts the shape in front of
// every development message and the Stop hook that sends back a reply without
// it read from here, so the two cannot drift.
//
// The developer works from a phone, in pieces, and comes back after an hour or
// a day. Every reply therefore opens with a tracker that makes it readable cold
// (DEV-002), walks one step (DEV-009), names the assumptions both ways
// (DEV-011), carries what a decision needs (DEV-010), asks one thing (DEV-008)
// fits a phone (DEV-004), and shows progress without rewarding time spent
// (DEV-005).
//
// What the chat app renders decides the shape: line-break tags print as
// literal text and every line gets a paragraph's gap, so the shape uses
// neither; the small-text tag renders, and the header block relies on it
// (.claude/memory/the-chat-app-renders-little-html.md).

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { threshold } from './thresholds.mjs';
import { sessionId } from './sandbox.mjs';
import { normChat } from './for-you.mjs';
import { planPath, safetyReplyPattern } from './everyday-reply.mjs';
import { DEV_DIR } from './paths.mjs';
import { proseProblem } from './prose.mjs';

/**
 * WKB-007 and DEV-001 design 3: the line the per-turn development hook gives on
 * every message. Every request starts at the dialogue: the remark is kept in
 * the Transcript, what was said and agreed is searched before anything is
 * built, an agreement is drafted for the owner's yes only if the remark binds,
 * and agents then amend the specs and build. The spec work is still never shown.
 */
export const DIALOGUE_FIRST =
  `DIALOGUE FIRST, SPECS UNSHOWN (WKB-007): keep this message in the Transcript (${DEV_DIR}/dialogue/transcript/, last part), ` +
  'verbatim, sorted into one of the sixteen ways. To build or change anything, first search what was said and agreed ' +
  '(node ux/scripts/dialogue.mjs ask <words>); only if it binds, draft the agreement in the owner\'s plain voice for their yes; ' +
  'then amend or add the specs that carry it and build. Show no Specs step, no Specs section, no row IDs or quoted row words in the reply. ' +
  // E-002 and E-007 (2026-10-20): a persona asking "did we think about X?" got proof but no
  // earlier entry or verdict, and was then asked whether to plan the follow-up.
  'A "did we…?" gets ask\'s entry, agreement, eval, verdict; do follow-ups yourself.';

/** In DIALOGUE_FIRST's place when the message is a hand-back or a notification (relayedTurn). */
export const RELAYED_TURN =
  'RELAYED, NOT HIS (WKB-007): this message is a subagent\'s hand-back or a task\'s notification, not the developer\'s words: nothing from it goes in the Transcript, and the dialogue-first line applies again to his next message. Show no Specs step or row IDs in the reply.';

/** Where the Stop check leaves its note on a reply, for the next message to carry. */
// Keyed by the hook payload's own session id first, so a selftest run under a
// live session writes to its own marker and not the live one.
export const noteMarker = (input) => `dev-reply-note-${String(input?.session_id || sessionId(input) || 'unknown').replace(/[^\w-]/g, '')}`;

/** The shapes (DEV-003, and the lesson, A-160): the tracker is for work in motion only. */
export const SHAPES = [
  'THREE SHAPES (DEV-003). Pick the one the moment needs; the header\'s first line always names it (· Menu, · View or · Tracker),',
  'so the developer can tell them apart at a glance and the check knows which to hold:',
  '- MENU, header "🛠️ **Dev Mode · Menu**": dev mode has just started with nothing chosen, or a workstream has just closed.',
  '- VIEW, header "🛠️ **Dev Mode · View**": the developer asked to SEE something (a preview, a mockup, a draft) or a quick',
  '  question that changes nothing. A view reports no change and asks no decision; if either is needed, use the tracker.',
  '  Drafts (A-027): ONE per reply, as it would arrive, then its situation, why each part, a pick. Never all at once.',
  '- TRACKER, header "🛠️ **Dev Mode · Tracker**": a workstream is under way — steps, a decision, a commit to report. Shape below.',
  '',
  'MENU, one phone screen (under ~200 words), items drawn from the for-you list and the heartbeat notices, never invented:',
  '🛠️ **Dev Mode · Menu**',
  '> Turn … (the header line given with the message)',
  '',
  '---',
  '# 📋 Dev menu',
  '> **What shall we build?** Reply with a number, or just say it.',
  '',
  '1. **For you** · <n> waiting on you · <each item of the FOR YOU list, in a few words, until he answers it>',
  '2. **<in progress in this chat>** · ▰▱▱ <n>/<m> · next: *<step>*',
  '3. **<small fixes the heartbeat notices name>** · <each in a few words>',
  '4. **Something new** · just describe it',
  '',
  '**Health:** <coloured dots, only what needs attention: 🟡 heartbeats due, 🟠 context high; or 🟢 all clear>',
  '  (a plain numbered list, 1. 2. 3., never circled numbers; no emoji on the options: the title and the',
  '   health dots are the only ones. Ordered: what waits on the developer (A-152), then work in progress,',
  '   then fixes; a group with nothing in it is left out; "Something new" is always last.',
  '   Progress, not rewards: no streaks or points. If a review is owed, one last line names it.',
  '   If the heartbeat notice names an oldest overdue spec register, one small-fix item offers its review (MNT-008).)',
  '',
  'VIEW: the header block, a --- rule, then what was asked for, shown as it should look, not nested in a tracker.',
  '',
].join('\n');

export const SHAPE = [
  SHAPES,
  'TRACKER (DEV-002..014, DEV-008), in this order:',
  '',
  '🛠️ **Dev Mode · Tracker**',
  '> Turn <n> · Started <date, time> · Last reply <date, time> (took <how long>)',
  '  (copy the header block given with this message, adding the shape\'s name.',
  '   Turn 1 has no "Last reply". On the turn development mode switches on, a second callout line,',
  '   "> Development mode on · <rows>", sits under this one, as given)',
  '',
  '---',
  '# 🎯 Current dev goal',
  '> **<workstream>**: <one or two lines: what it is for and why it matters, so it reads cold>',
  '',
  '## Progress • ▰▰▱▱ <done>/<total>',
  '  (an em space, U+2003, either side of the •, as ordinary ones collapse)',
  '  (steps finished out of all; one ▰ per finished step, one ▱ per step left, the current one included)',
  '~~<step done>~~ ⟶ 🟢 **<this step>** ⟶ <step to come>',
  '  (on one line, joined by ⟶, so it wraps on a phone. When new work arrives',
  '   inside the workstream, add it as a step rather than doing it under one already crossed out. When',
  '   every step is finished, all are crossed out, the count is full and ✅ follows it; closing the chat',
  '   is not a step. Start at the dialogue (WKB-007), and never show the spec work: no Specs step, no',
  '   Specs section, no row cited in the reply; say what changed in plain words)',
  '',
  '- **Last turn:** <what was done in answer to the developer\'s last message, with the commit if one was pushed;',
  '  a few words when a section below reports the change>',
  '- **What\'s next:** <what is needed from the developer now: the decision or input this reply asks for>',
  '',
  '---',
  '<the body: sections under ## headings of your own choosing, each named and opened with an emoji chosen',
  ' for what it actually holds this turn. Cover, where they apply: this step (what it is, why now, and',
  ' anything the developer may not know, explained); what you are assuming, each as a yes/no; the',
  " developer's own assumptions worth a second look, with the reason; the perspectives that bear on it",
  ' (the person the record serves, the developer, safety, privacy, upkeep); or what changed, if work was done.',
  ' When his ask could have been sharper (a vague goal or "done"), one "## 💡 Worth knowing" (WKB-010, A-093):',
  ' quote his words, give the sharper version; kept as a Lesson line. Else none; never the system, never a quiz>',
  '---',
  '<the one ask, the last section: a ## heading, opened with an emoji, that IS the question, ending in "?",',
  ' with your pick, why and costs; a how is yours: choose, ask yes/no, never "which?" (A-092). It ends here, no Still open.',
  ' Or, once the work in hand is done, a ## heading saying nothing is needed from the developer and what you',
  ' will do next, and then Still open closes the reply>',
  '---',
  '## 🗂️ Still open',
  '  (only once the work in hand is done and nothing is asked; left out while anything waits on the developer,',
  '   DEV-004, DEV-014)',
  '- **In this chat:** <"nothing" if none; else this chat\'s unfinished work, in full, numbered (A-152: finish or drop each)>',
  '  1. <item>',
  '  2. <item>',
  '- **For you:** <only the count of the FOR YOU list, with an offer to show it>',
  '- 🏁 **End chat:** <one short line: the end-of-session review (lessons banked, harness refined) while it has',
  '  not run (DEV-020), then each item above finished or dropped, a question for him to dev/for-you.md (DEV-014);',
  '  or "all settled, you can close this chat">',
  '',
  'Momentum, not stickiness (DEV-005): a short done moment when a stage closes. The header block first, never a',
  'heading; the workstream is the # title; a --- rule between tracker, step, ask and (once work is done) Still open, and every',
  'section after a rule opens with a ## heading, and every ## heading below the tracker has its own --- above it',
  'a few emoji where they carry meaning. Never streaks, points, loss-framed nudges or surprise rewards.',
  'Only the header, the title, the progress line and, once work is done, "🗂️ Still open" are fixed. A table: three columns and rows under 60 characters at most, else a bold-led list, unless the chat chose wide (FIT-001). One step, one question (one heading ending',
  'in "?"), one phone screen or two (under ~450 words). Walk the plan in the order that explains it, not build order.',
  'Say only what the tools show (A-101): "on", "refused", "done", "pushed" only when a tool result this chat says so.',
  'At a limit: what you hit, each way round tried, the one you recommend, and one question on it (A-101).',
  'A card for his yes names its weak spots and asks him whether it should be better; its gaps are his (A-080).',
  'A new service, channel or login names where its secrets live (never the repository) and how it is proven (A-092).',
  'Never proceed on an unconfirmed assumption that changes what gets built. Safety outranks all of this:',
  'if anyone may be unsafe, the crisis rules in CLAUDE.md come first and this shape waits.',
].join('\n');

// DEV-004 and DEV-003 state them (FND-009). Unreadable, length goes unchecked.
const WORD_LIMIT = threshold('devReply.words', 'words');
const GROWTH_LINES = threshold('devReply.growthLines', 'lines');
const MENU_LIMIT = threshold('devReply.menuWords', 'words');

/** Fenced code is shown, not structure: its headings and rules are never judged. */
const withoutCode = (text) => text.replace(/```[\s\S]*?```/g, (block) => block.replace(/[^\n]/g, ''));

/** The shapes a header may name (DEV-003), as written after "Dev Mode ·". */
export const SHAPE_NAMES = ['Menu', 'View', 'Tracker', 'Lesson'];

/**
 * Which shape a reply declares in its first line (DEV-003): 'menu', 'view' or
 * 'tracker'; 'unnamed' when the label carries no shape, and 'unknown' when it
 * names one that does not exist (an old "· Plain", a typo). A reply with no
 * label at all is held to the tracker, whose check then asks for the header.
 */
export function shapeOf(text) {
  const first = String(text ?? '').trim().split('\n')[0] ?? '';
  const m = first.match(/^🛠️\s*\*\*Dev Mode\s*(?:·\s*([^*]*?))?\s*\*\*$/u);
  if (!m) return 'tracker';
  if (m[1] === undefined) return 'unnamed';
  const name = SHAPE_NAMES.find((n) => n.toLowerCase() === m[1].toLowerCase());
  return name ? name.toLowerCase() : 'unknown';
}

const RULE = /^(---|\*\*\*|___)$/;
// Tags a reply might reach for; a placeholder such as <shape> is not one.
const HTML_TAG = /<\/?(sub|sup|br|div|span|p|b|i|u|small|big|details|summary|img|a|font|center|table|tr|td|th)\b[^>]*>/i;
// Turn 1 has no reply before it, so its line ends at Started. No context figure:
// the app shows it already (T-450).
const META = /^>\s*Turn\s+(?:1 · Started [^·]+|\d+ · Started [^·]+ · Last reply [^·]+)$/;
// A row cited by its ID and its words, as dev/specs/README.md asks:
// the ID, then words of its statement in quotes, at least three of them. The
// words must be the row's own, checked against .claude/spec-statements.json,
// which ux/scripts/spec-statements.mjs generates from the registers: the harness
// never reads dev/ while it runs (ARC-008). That file never ships (ARC-007); a
// copy without it holds the shape alone. Hardened 2026-10-03 after a fresh agent
// passed the check with WKB-007: "ok". Since WKB-007 starts every request at the
// dialogue (2026-10-19), the spec work comes after the Transcript and the
// Agreements and is never shown in a reply; this still decides what counts as a
// row cited, for the checks and tests that read one.
// The words may follow a comma, a colon, a dash or an opening bracket:
// "**DEV-004** (*"…"*)" was read as no citation on 2026-10-04.
const CITE = /\b([A-Z]{3}-\d{3})\b\**\s*[,:—–(-]?\s*\*?["“]([^"”]+)["”]/g;
const plain = (s) => s.toLowerCase().replace(/…|\.\.\./g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
let carried;
/**
 * Every row's statement by ID, as .claude/spec-statements.json carries them out
 * of the registers (ARC-008); {} in a copy without it. dev-mode.mjs reads its
 * row range here too, so nothing in the harness reads dev/ while it runs.
 */
export function rowStatements() {
  if (!carried) {
    try {
      carried = JSON.parse(readFileSync(new URL('../../spec-statements.json', import.meta.url), 'utf8')).statements ?? {};
      // Its later parts, past the one-read line (spec-statements.mjs, T-768): 2.json, 3.json… in order.
      const parts = fileURLToPath(new URL('../../spec-statements/', import.meta.url));
      if (existsSync(parts)) {
        for (const f of readdirSync(parts).filter((n) => /^\d+\.json$/.test(n)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))) {
          Object.assign(carried, JSON.parse(readFileSync(new URL(`../../spec-statements/${f}`, import.meta.url), 'utf8')).statements ?? {});
        }
      }
    } catch {
      carried = {}; // not in this copy: the shape alone is held
    }
  }
  return carried;
}
let statements;
function statementOf(id) {
  statements ??= new Map(Object.entries(rowStatements()).map(([rid, text]) => [rid, plain(text)]));
  return statements.get(id);
}
export function citesARow(text) {
  const prose = withoutCode(String(text)).replace(/`[^`\n]*`/g, '');
  return [...prose.matchAll(CITE)].some(([, id, words]) => {
    const quoted = plain(words);
    if (quoted.split(' ').length < 3) return false;
    const own = statementOf(id);
    return !own || own.includes(quoted);
  });
}
// A line that asks: a question mark with nothing after it but punctuation or an
// emoji, or one leading into the choices ("? → yes / no"). A table cell is a line
// of its own here; a callout and inline code are not asked.
const ASKS = /[?？]([^\p{L}\p{N}]*$|\s*[→⟶:—–-])/u;
const asks = (l) => {
  if (/^>/.test(l)) return false;
  const bare = l.replace(/`[^`]*`|https?:\/\/\S+/g, '');
  return (/^\|/.test(bare) ? bare.split('|') : [bare]).some((c) => ASKS.test(c.trim()));
};
// The status line the turn that switches development mode on carries, as a
// callout line of its own under the figures; dropped before the shape is read.
const STATUS = /^>\s*Development mode on\b.*$/i;
// FIT-001: the view line a chat's first reply may carry under the header.
const VIEW_LINE = /^>\s*View\s*·/i;

// FIT-001, DEV-004: the view the developer chose for this chat, from the
// messages they typed, the latest choice winning: "wide" (desktop) or
// "narrow" (mobile). Only a short message that is the choice counts, so a
// sentence that merely mentions a wide table does not switch it. '' if none.
const VIEW_CHOICE = /^\s*(?:(?:switch|change|go|set)(?:\s+it)?\s+(?:to\s+)?)?(wide|narrow|desktop|mobile)(?:\s+(?:view|mode))?(?:\s*\((?:desktop|mobile)\))?\s*[.!]?\s*(?:please)?\s*$/i;
export function viewChoice(text) {
  const m = String(text ?? '').replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim().match(VIEW_CHOICE);
  if (!m) return '';
  return /wide|desktop/i.test(m[1]) ? 'wide' : 'narrow';
}
export function chatView(typed) {
  let view = '';
  for (const t of typed) view = viewChoice(t) || view;
  return view;
}

/** The menu (DEV-003): header, rule, title, numbered options ending in something new, one screen. */
function menuProblem(reply, lines) {
  if (!META.test(lines[1] ?? '') || !RULE.test(lines[2] ?? '')) {
    return 'The menu does not open with the header block and a rule (DEV-003): "🛠️ **Dev Mode · Menu**", the metadata line given with the message, then ---.';
  }
  if (!/^#\s+📋\s*Dev menu\s*$/iu.test(lines[3] ?? '')) {
    return 'The line under the menu\'s header rule must be the title "# 📋 Dev menu" (DEV-003).';
  }
  if (lines.some((l) => /^##\s*Progress\b|^#\s+🎯/u.test(l))) {
    return 'The menu carries a tracker (DEV-003): no goal and no progress heading until a workstream is chosen.';
  }
  const options = lines.filter((l) => /^([-*]\s*)?(\*\*)?\s*([①-⑨]|\d+[.)])/u.test(l));
  if (options.length < 2) {
    return 'The menu has fewer than two numbered options (DEV-003): a plain numbered list, "1. **<item>** · <detail>".';
  }
  if (options.some((l) => /[①-⑨]/u.test(l))) {
    return 'The menu uses circled numbers (DEV-003): number the options as a plain list, 1. 2. 3.';
  }
  if (options.some((l) => /\p{Extended_Pictographic}/u.test(l))) {
    return 'The menu\'s options carry emoji (DEV-003): the title and the health dots are the only ones.';
  }
  if (!/something new|something else|anything else/i.test(options[options.length - 1])) {
    return 'The menu\'s last option must be "Something new" (DEV-003), so the developer is never held to the list.';
  }
  const n = words(reply);
  if (MENU_LIMIT && n > MENU_LIMIT) {
    return `The menu runs to ${n} words (DEV-003): keep it to one phone screen, under ${MENU_LIMIT}.`;
  }
  return '';
}

/** A view (DEV-003): header, rule, then the content itself; no decision asked. */
function viewProblem(reply, lines) {
  if (!META.test(lines[1] ?? '') || !RULE.test(lines[2] ?? '')) {
    return 'The view does not open with the header block and a rule (DEV-003): "🛠️ **Dev Mode · View**", the metadata line given with the message, then ---.';
  }
  // A question asked in a plain line asks a decision as surely as one in a
  // heading: on 2026-10-03 a view put a build plan to the developer that way.
  if (lines.some(asks)) {
    return 'A view asks a decision (DEV-003): a question heading needs the tracker, so switch the header to "🛠️ **Dev Mode · Tracker**" and use it.';
  }
  const n = words(reply);
  if (WORD_LIMIT && n > WORD_LIMIT) {
    return `The reply runs to ${n} words (DEV-004): cut it to one phone screen or two, under ${WORD_LIMIT}, or offer the rest.`;
  }
  return '';
}

/**
 * A lesson (A-160): in the learning chat, teaching with nothing built, changed or waiting on a
 * decision has no tracker: the header line, the Turn line, then the lesson laid out to read
 * well, a title and short labelled sections, emojis only where they add meaning (a few at
 * most), a phone-width diagram where one helps; at most one question, and that one last.
 */
/** A-160: "Use them as relevant"; the developer found one per section too many. */
const LESSON_EMOJI = 6;
function lessonProblem(reply, lines) {
  if (!META.test(lines[1] ?? '')) {
    return 'The lesson does not open with its header (A-160): "🛠️ **Dev Mode · Lesson**", then the Turn line given with the message.';
  }
  const body = lines.slice(2).filter((l) => !RULE.test(l));
  if (body.some((l) => /▰|▱|^##?\s*Progress\b|^#\s+🎯/u.test(l))) {
    return 'A lesson carries a tracker or progress bar (A-160): none while only teaching. If work was done or a decision is needed, use the tracker.';
  }
  const labels = body.filter((l) => /^#{1,6}\s/.test(l) || /^(?:>\s*)?(?:\p{Extended_Pictographic}\uFE0F?\s*)?\*\*[^*]+\*\*/u.test(l));
  if (labels.length < 2) {
    return 'The lesson is a wall of text (A-160): give it a title and short sections with clear labels (a heading or a bold label).';
  }
  const emoji = (withoutCode(reply).split('\n').slice(2).join('\n').match(/\p{Extended_Pictographic}/gu) ?? []).length;
  if (emoji > LESSON_EMOJI) return `The lesson carries ${emoji} emojis outside its diagrams (A-160): only where they add meaning, ${LESSON_EMOJI} at most.`;
  const wideLine = String(reply).match(/```[\s\S]*?```/g)?.flatMap((b) => b.split('\n')).find((l) => [...l].length > 40);
  if (wideLine) return `A diagram line runs ${[...wideLine].length} characters (A-160): keep diagrams within about 36 so they fit a phone.`;
  const questions = body.map((l, i) => [l, i]).filter(([l]) => !l.startsWith('>') && /\?\s*(\**)?\s*$/.test(l));
  if (questions.length > 1) return `A lesson asks ${questions.length} questions (A-160): at most one, as its last line.`;
  if (questions.length === 1 && questions[0][1] !== body.length - 1) return 'A lesson\'s question is not its last line (A-160): end on it, or drop it.';
  const n = words(reply);
  if (WORD_LIMIT && n > WORD_LIMIT) return `The lesson runs to ${n} words (DEV-004): one phone screen or two, under ${WORD_LIMIT}.`;
  return '';
}

/** Words outside code blocks: commands and paths are not reading. */
function words(text) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * Why a reply falls short of what the end-of-session review owes (DEV-020), or ''.
 * state is lib/dev-review.mjs's: 'owed' means "Still open" must name the
 * review; 'confirm' means the review is done and this reply says all is settled.
 */
/** Steps the tracker's progress heading still counts as left, or 0 without a tracker. */
export function stepsLeft(text) {
  const m = String(text ?? '').match(/^##\s*Progress\b.*?(\d+)\s*\/\s*(\d+)/mu);
  return m ? Math.max(0, Number(m[2]) - Number(m[1])) : 0;
}

/**
 * Whether the reply claims the chat is all settled. A quote of the phrase (in a
 * blockquote, or in quotation marks, as when a spec draft cites it) is not a
 * claim: the check fired on one on 2026-10-02.
 */
export function claimsSettled(text) {
  return String(text ?? '')
    .split('\n')
    .filter((l) => !/^\s*>/.test(l))
    .some((l) => /(^|[^"“'*_\w])all settled\s*[—–-]+\s*nothing outstanding/i.test(l));
}

/**
 * "All settled" only when nothing this chat opened is open (DEV-020): not a step
 * left on the tracker. On 2026-10-02 a finished second workstream hid three open
 * items from the first. There is no backlog to carry what is left (A-152): each
 * step is finished or dropped before the chat closes.
 */
export function closeProblem(text) {
  if (!claimsSettled(text)) return '';
  const left = stepsLeft(text);
  if (!left) return '';
  return `The reply says "all settled" with ${left} step(s) on the tracker still open (DEV-020, A-152): finish or drop each before the chat closes, say which were dropped, and only then say all is settled.`;
}

/**
 * Commits on no remote branch, split by the session their Claude-Session
 * trailer names (DEV-015). `commits` is [{ hash, session }], `ids` every id
 * this chat goes by (the local and the remote one). The shared tree's HEAD can
 * hold another chat's finished commit (2026-10-03, 81dd433 was called "from
 * this chat"), so only a commit naming this chat is this chat's; one naming no
 * session may be anyone's, this chat's included, so it is named too.
 */
export function unpushedProblem(commits, ids) {
  const mine = new Set(ids.filter(Boolean).map(normChat));
  const own = commits.filter((c) => c.session && mine.has(normChat(c.session))).length;
  const unnamed = commits.filter((c) => !c.session).length;
  return [
    own && `${own} commit(s) from this chat are on no remote branch: push them in this reply's turn, to main (never a branch of this chat's own: DEP-011), and say so under "Last turn".`,
    unnamed && `${unnamed} commit(s) on this branch name no session (no Claude-Session trailer), so they may be this chat's: if they are finished, push them too (fast-forward only) and say whose they are.`,
  ].filter(Boolean).join(' ');
}

/** `git log --format=%x00%H%x01%(trailers:key=Claude-Session,valueonly)` output, as unpushedProblem reads it. */
export const parseSessionLog = (log) =>
  String(log ?? '')
    .split('\0')
    .slice(1)
    .map((chunk) => {
      const [hash, trailer = ''] = chunk.split('\x01');
      return { hash: hash.trim(), session: trailer.trim().split(/\s+/)[0] ?? '' };
    })
    .filter((c) => c.hash);

/**
 * The "Still open" section alone: its heading to the next rule or heading. It
 * sits under the tracker or at the end (DEV-014), so what follows it is not it.
 */
const STILL_OPEN = /^##\s*🗂️\s*Still open\s*$/u;
const STILL_OPEN_ANY = /^\s*##\s*🗂️\s*Still open\s*$/mu;
export function stillOpen(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const at = lines.findIndex((l) => STILL_OPEN.test(l.trim()));
  if (at < 0) return '';
  const end = lines.findIndex((l, i) => i > at && (RULE.test(l.trim()) || /^#{1,6}\s/.test(l.trim())));
  return lines.slice(at + 1, end < 0 ? undefined : end).join('\n');
}

/**
 * A `set-up` run that closes without its learning step (DEP-014 design 3,
 * `dev/skills/set-up/README.md`): every block, correction and wrong turn of a run
 * becomes a case before it ends, and the run says in one line what it taught.
 * `content` is the chat's assistant content in order (tool_use and text items);
 * only what follows the last run counts, so an earlier run's case or line never
 * clears a later one. Judged only on a reply that closes the work ("Still open",
 * or a menu), so a run paused mid-step is not nagged.
 */
const SET_UP_WRITE = /dev\/skills\/set-up\/(cases|log|import-cases|import-log)\.md|\.claude\/skills\/set-up\//;
const isRun = (c) => c?.type === 'tool_use' && ((c.name === 'Skill' && /^set-up$/.test(String(c.input?.skill ?? ''))) || (c.name === 'Bash' && /(^|[\s/])setup-doctor\.mjs/.test(String(c.input?.command ?? ''))));
const isLesson = (c) =>
  (c?.type === 'text' && /this (set-up )?run taught/i.test(String(c.text ?? ''))) ||
  (c?.type === 'tool_use' && ((['Edit', 'Write', 'NotebookEdit'].includes(c.name) && SET_UP_WRITE.test(String(c.input?.file_path ?? ''))) || (c.name === 'Bash' && SET_UP_WRITE.test(String(c.input?.command ?? '')) && /(>|sed -i|python|tee |git (mv|add|commit))/.test(String(c.input?.command ?? '')))));
// The skill itself running, not a doctor run used to verify other work
// (2026-10-26: a check after removing the Worker read a question about an
// agreement as mid-setup feedback).
/**
 * D-G1: distress typed in a development chat is not skill feedback, and a reply
 * that stays with the person is not held to the development shape. CLAUDE.md
 * says to stay with her for two or three messages before any number or "are you
 * safe", and the shape and set-up checks would otherwise flag exactly that reply.
 *
 * The crisis list is the floor's own (hooks/safety/crisis-floor.mjs, in the
 * locked safety core), kept unexported in a script that runs on import. It is
 * read here from that file's source, read-only, so there is one list and never
 * a second copy that drifts. A list that cannot be read is empty, and the
 * self-test (test-dev-reply.mjs) fails on it.
 */
let signalsRead = null;
export function crisisSignals() {
  if (signalsRead) return signalsRead;
  try {
    const src = readFileSync(fileURLToPath(new URL('../safety/crisis-floor.mjs', import.meta.url)), 'utf8');
    const body = src.match(/\nconst SIGNALS = \[([\s\S]*?)\n\];/)?.[1];
    // eslint-disable-next-line no-new-func
    const list = body ? new Function(`return [${body}\n];`)() : [];
    signalsRead = Array.isArray(list) && list.length && list.every((re) => re instanceof RegExp) ? list : [];
  } catch {
    signalsRead = [];
  }
  return signalsRead;
}
/**
 * What the harness relays rather than a person types, the frames
 * safety/unlock-safety-core.mjs's RELAYED names (read there, never changed here). A
 * subagent's hand-back quoting crisis words once tripped the step-aside and dropped the
 * development shape (round 2, E1). A closed frame is cut out; an unclosed one, or a
 * bracketed marker, carries the rest of the message, so all from it on is cut. What a
 * person typed before it is still read, so their own words always count.
 */
const RELAYED_TAGS = ['agent-message', 'task-notification', 'system-reminder', 'teammate-message'];
const RELAYED_MARKS = /\[Subagent hand-back\]|\[SYSTEM NOTIFICATION/i;
export function typedPart(text = '') {
  let said = String(text ?? '');
  for (const tag of RELAYED_TAGS) said = said.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, 'gi'), ' ');
  // An unclosed frame or a bracketed marker counts as relayed only where it opens the
  // message: named mid-sentence ("the test printed [Subagent hand-back] ok, anyway …"),
  // it once cut the person's own words after it (round 3, C16). Closed frames go anywhere.
  const opens = new RegExp(`^\\s*(?:<(?:${RELAYED_TAGS.join('|')})\\b|${RELAYED_MARKS.source})`, 'i');
  return opens.test(said) ? '' : said;
}

/**
 * Whether this message is wholly relayed by the harness, never typed by the developer:
 * a subagent's hand-back (it arrives as "Another Claude session sent a message:" and an
 * agent-message frame, with the harness's own guidance after it), a background task's or
 * a scheduled task's notification. The per-turn dialogue line ("keep this message in
 * the Transcript") and the kept-question line once fired on these (2026-11-02), though
 * dialogue-record.mjs rightly kept none of them. Closed system-reminder blocks are set
 * aside first, so a typed message the harness prefixed with one still counts as his.
 */
// The harness's own words around a peer frame, set aside like the frame. Should their
// wording change, they are left in, read as typed, and the lines fire as before.
const PEER_INTRO = /^\s*Another Claude session sent a message:\s*/i;
const PEER_TRAILER = /That "other Claude session" is an agent[\s\S]*?permission laundering\./i;
export function relayedTurn(text = '') {
  const said = String(text ?? '').replace(/<system-reminder\b[^>]*>[\s\S]*?<\/system-reminder>/gi, ' ');
  if (!said.trim()) return false;
  return !typedPart(said.replace(PEER_INTRO, '').replace(PEER_TRAILER, ' ')).trim();
}

/** Whether the developer's typed message trips the crisis floor's list, read as the floor reads it. */
export function typedCrisis(typed = '') {
  const said = typedPart(typed).toLowerCase();
  return Boolean(said.trim()) && crisisSignals().some((re) => re.test(said));
}

const isSkillRun = (c) => c?.type === 'tool_use' && ((c.name === 'Skill' && /^set-up$/.test(String(c.input?.skill ?? ''))) || (c.name === 'Read' && /\.claude\/skills\/set-up\/SKILL\.md$/.test(String(c.input?.file_path ?? ''))));
export function setUpLearnProblem(content = [], reply = '', typed = '') {
  if (typedCrisis(typed)) return '';
  let last = -1;
  content.forEach((c, i) => { if (isSkillRun(c)) last = i; });
  if (last < 0) return '';
  if (!(STILL_OPEN_ANY.test(reply) || shapeOf(reply) === 'menu')) return '';
  if (content.slice(last + 1).some(isLesson) || /this (set-up )?run taught/i.test(reply)) return '';
  return 'A set-up run in this chat is closing without its learning step (DEP-014, dev/skills/set-up/README.md): give every block, correction and wrong turn its case in dev/skills/set-up/cases.md, or say in one line "This run taught: nothing new", before the work is called done.';
}

/**
 * The learning step carried past the chat (DEP-014): the Stop check's note is read
 * only on the next message, so a chat's final reply is never caught. The marker
 * `SET_UP_LEARN_OWED` outlives the session, and the next session's brief says it
 * once. `prior` is the marker's text: set by a closing reply that falls short,
 * cleared once a lesson follows the last run, otherwise kept as it was.
 */
export const SET_UP_LEARN_OWED = 'set-up-learn-owed';
export function setUpLearnCarry(content = [], problem = '', prior = '', day = new Date().toISOString().slice(0, 10)) {
  if (problem) return `${day}: a set-up run closed without its learning step (DEP-014): give its blocks, corrections and wrong turns their cases in dev/skills/set-up/cases.md, or say "This run taught: nothing new".`;
  let last = -1;
  content.forEach((c, i) => { if (isSkillRun(c)) last = i; });
  if (last >= 0 && content.slice(last + 1).some(isLesson)) return '';
  return prior;
}

/**
 * During a `set-up` run, anything the developer says other than moving on is a
 * gap in the skill (the developer, 2026-10-23: "As long as I don't say next, or
 * give the next instruction, it means that the skill needs to be updated"): a
 * clarification asked means a step was unclear, and "it doesn't work" or "it
 * looks different" means one is wrong or out of date. `typed` is the developer's
 * latest message; `turn` the assistant content since it. Judged only once a run
 * has started in the chat (`earlier`), and only on a message that reads as a
 * question or a correction, never on a bare "next".
 */
const ADVANCE = /^\s*(next|continue|go( on| ahead)?|ok(ay)?|done|yes|yep|y|proceed|carry on|sure|👍|✅)[\s.!]*$/i;
const FEEDBACK = /\?|\b(doesn'?t|didn'?t|isn'?t|wasn'?t|not (work|working|there|showing|found|clear)|wrong|error|fail(ed|s|ing)?|can'?t|cannot|unclear|confus\w*|what do you mean|which one|where (is|do|are)|how do i|why|different|instead|missing|stuck|broke\w*)\b/i;
/**
 * The assistant content of the last `n` exchanges before the latest typed
 * message: a set-up run counts as under way only when it was this recent, so a
 * doctor run at a chat's start does not turn every later question into a gap
 * (2026-10-26: a question about repeated replies, days after one run, was flagged).
 * `entries` is the transcript, `isTyped` tells a typed message, `start` its index.
 */
export function recentAssistantContent(entries = [], isTyped = () => false, start = entries.length, n = 10) {
  let from = start, seen = 0;
  for (let i = start - 1; i >= 0 && seen < n; i -= 1) if (isTyped(entries[i])) { seen += 1; from = i; }
  return entries.slice(from, start).filter((e) => e?.type === 'assistant' && Array.isArray(e.message?.content)).flatMap((e) => e.message.content);
}
/** True when, with a set-up run under way (`earlier`), the typed message asks or corrects rather than moves on. */
function setUpGapSaid(earlier = [], typed = '') {
  if (!earlier.some(isSkillRun) || typedCrisis(typed)) return false;
  const said = String(typed ?? '').replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').trim();
  return !ADVANCE.test(said) && FEEDBACK.test(said);
}
/**
 * The same gap, said before the reply rather than noted after it (E-060, A-016):
 * the Stop check's note reaches only the next reply, so a question that ends a
 * run went unrecorded in some runs and recorded in others (proving pass,
 * 2026-10-27). Read by dev-reply-shape.mjs on UserPromptSubmit.
 */
export function setUpGapAhead(earlier = [], typed = '') {
  if (!setUpGapSaid(earlier, typed)) return '';
  return 'SET-UP GAP (A-016): a set-up run is under way and this message asks or corrects rather than moves on, so a step, or the opening, left it unanswered. In this reply: answer it, then, before any next step, add its dated case to dev/skills/set-up/cases.md and fix the step (or the opening) in the skill, and say so in one line opening "Gap noted:". Answering alone is never enough. A gap still when the question is about something no step has reached, or the run is blocked: the opening never said what the setup will need or why, so that is the step to fix. Write both files with Edit or Write this turn; the copy\'s changes must show them.';
}
export function setUpFeedbackProblem(earlier = [], typed = '', turn = []) {
  if (!setUpGapSaid(earlier, typed)) return '';
  // A line saying so is not enough: the case or the step must be written this turn.
  if (turn.some((c) => c?.type === 'tool_use' && isLesson(c))) return '';
  return 'During a set-up run the developer asked or corrected rather than moved on, which means a step was unclear, wrong or out of date (dev/skills/set-up/README.md, Learning from every run): add its case to dev/skills/set-up/cases.md and fix the step this turn, grounded on a page fetched now where it leans on another service, and say so in one line opening "Gap noted:".';
}

export function reviewProblem(text, state) {
  const reply = String(text ?? '');
  if (state === 'owed' && ['menu', 'view'].includes(shapeOf(reply))) {
    if (!/\breviews?\b/i.test(reply)) {
      return 'This session changed the harness and its end-of-session review is not done (DEV-020): even a menu or a view ends with one line naming it.';
    }
  } else if (state === 'owed' && STILL_OPEN_ANY.test(reply)) {
    // While work is pending "Still open" is left out (DEV-014), so the review
    // is named in every "Still open", not in every reply.
    if (!/\breviews?\b/i.test(stillOpen(reply))) {
      return 'This session changed the harness and its end-of-session review is not done (DEV-020): name it under "End chat" in every "Still open" until it is, and offer it as the next step once the work is done.';
    }
  }
  const open = stepsLeft(reply) > 0;
  if (state === 'confirm' && open && !/\bfinished or dropped\b/i.test(reply)) {
    return 'The end-of-session review is done but this chat still has steps open (DEV-020, A-152): there is no backlog to carry them, so say plainly — "Review done. Before this chat closes, each step left is finished or dropped." — name each, and finish or drop it. Never "all settled" while anything is open.';
  }
  if (state === 'confirm' && !open && !/\bAll settled\b/i.test(reply)) {
    return 'The end-of-session review is done (DEV-020): confirm it plainly — "All settled — nothing outstanding. You can close this chat, or /compact it and start the next workstream here."';
  }
  return '';
}

/**
 * Why a development reply falls short of the shape, or '' when it holds.
 * Judges only what a machine can: the tracker first, a "Last:" line in it,
 * exactly one question heading, and the length. Whether the tracker is true is the reader's.
 */
/**
 * A-093: a reply that teaches leaves the lesson where it can be found again, as a Lesson line on
 * the Transcript entry it answered; a recall question is kept there too, as a Recalled line,
 * so the weekly limit can be counted. `entry` is that entry's text, newest in the Transcript.
 */
export function lessonLineProblem(reply, entry) {
  if (entry == null || !/^##\s*💡\s*Worth knowing/imu.test(String(reply))) return '';
  if (!/^- \*\*Lesson:\*\* /m.test(entry)) return 'The reply taught something under "Worth knowing" but its Transcript entry has no Lesson line (A-093): add "- **Lesson:** <what> · style: example, principle or question" to the entry this reply answered.';
  if (/^\s*[-*]?\s*\**Recall:/imu.test(String(reply)) && !/^- \*\*Recalled:\*\* T-\d+/m.test(entry)) return 'The reply asked a recall question but its Transcript entry has no "- **Recalled:** T-NNN" line naming the lesson (A-093), so the weekly limit cannot be counted.';
  return '';
}

/**
 * A-101: a reply says only what its tools show. `turn` is the transcript since the
 * developer's last message. A reply saying something was refused, blocked or
 * rejected with no tool result this turn that says so, or saying development mode
 * is on after its switch was refused, is noted (E-050, E-036, 2026-10-31).
 */
const resultText = (c) => (typeof c.content === 'string' ? c.content : Array.isArray(c.content) ? c.content.map((x) => x?.text ?? '').join('\n') : '');
const NAY = /\b(refus\w*|denied|blocked|rejected|not allowed|permission|fail\w*|error)\b/i;
const CLAIMS_REFUSAL = /\b(was|were|got|been|is|are)\s+(refused|blocked|rejected)\b|\b(commit|push|save|hook|gate)s?\s+(was\s+|were\s+)?(refused|rejected|blocked)\b/i;
const CLAIMS_ON = /\b(development|dev) mode (is )?(now )?on\b/i;
export function claimProblem(reply = '', turn = []) {
  const text = String(reply);
  const results = turn.filter((e) => e?.type === 'user' && Array.isArray(e.message?.content)).flatMap((e) => e.message.content).filter((c) => c?.type === 'tool_result');
  const uses = turn.filter((e) => e?.type === 'assistant' && Array.isArray(e.message?.content)).flatMap((e) => e.message.content).filter((c) => c?.type === 'tool_use');
  const nay = (c) => c.is_error === true || NAY.test(resultText(c));
  const said = withoutCode(text).replace(/`[^`\n]*`/g, '');
  if (CLAIMS_REFUSAL.test(said) && !results.some(nay)) {
    return 'The reply says something was refused, blocked or rejected, but no tool result this turn says so (A-101): say only what the tools show; if it came from an earlier turn, name the turn.';
  }
  const switches = uses.filter((u) => /dev-mode\.mjs/.test(String(u.input?.command ?? ''))).map((u) => results.find((r) => r.tool_use_id === u.id));
  if (CLAIMS_ON.test(said) && switches.length && switches.every((r) => !r || nay(r))) {
    return 'The reply says development mode is on, but every run of its switch this turn was refused or failed (A-101): say plainly that it is not on yet, and what would turn it on.';
  }
  return '';
}

export function replyProblem(text, view = '', plan = planPath(), typed = '') {
  const reply = String(text ?? '').trim();
  if (!reply) return '';
  // D-G1: answering distress typed in this chat, the reply stays with the
  // person first (CLAUDE.md, Crisis) and the development shape waits.
  if (typedCrisis(typed)) return '';
  // A reply about someone's safety is never held to a format: Singapore's
  // numbers, or her plan's in their place (SAF-016).
  if (safetyReplyPattern(plan).test(reply)) return '';

  const lines = withoutCode(reply).split('\n').map((l) => l.trim()).filter(Boolean);
  if (STATUS.test(lines[2] ?? '')) lines.splice(2, 1);
  if (VIEW_LINE.test(lines[2] ?? '')) lines.splice(2, 1);
  // WKB-009: plain Markdown only. The phone app renders a few tags and the
  // desktop editor prints them raw, so a tag makes one screen unreadable.
  const tag = withoutCode(reply).replace(/`[^`\n]*`/g, '').match(HTML_TAG);
  if (tag) return `The reply carries an HTML tag, "${tag[0]}" (WKB-009): the desktop editor prints it raw. Use plain Markdown only: bold, headings, quote lines, rules, lists.`;
  // DEV-004: a wide table makes a phone scroll sideways. A narrow one is fine:
  // the developer's rule (2026-10-02) is that it must fit the screen. Held as
  // at most three columns and no row over 60 characters of text.
  // The reminders table keeps its own columns, the developer's choice (reminders skill):
  // its rows, from its "| # | Created | Reminder |" (or "| Check-in |") header down, are not measured.
  const REMINDERS_HEAD = /^\|\s*#\s*\|\s*Created\s*\|\s*(Reminder|Check-in)\s*\|/;
  const rawLines = withoutCode(reply).split('\n').map((l) => l.trim());
  const own = new Set();
  rawLines.forEach((l, i) => { if (REMINDERS_HEAD.test(l)) for (let j = i; j < rawLines.length && /^\|.*\|$/.test(rawLines[j]); j++) own.add(rawLines[j]); });
  const tableRows = lines.filter((l) => !own.has(l) && /^\|.*\|$/.test(l) && !/^\|?\s*:?-{3,}/.test(l));
  const cells = (l) => l.slice(1, -1).split('|').map((c) => c.replace(/[*_`]/g, '').trim());
  // With "wide" chosen for this chat (FIT-001), a table may be as wide as it needs.
  const wide = view === 'wide' ? undefined : tableRows.find((l) => cells(l).length > 3 || cells(l).join(' ').length > 60);
  if (wide) {
    return `The reply carries a table too wide for a phone (DEV-004): "${wide.slice(0, 50)}…". Keep a table to three columns and rows under 60 characters, or use a bold-led list.`;
  }
  const shape = shapeOf(reply);
  if (shape === 'menu') return menuProblem(reply, lines);
  if (shape === 'view') return viewProblem(reply, lines);
  if (shape === 'lesson') return lessonProblem(reply, lines);
  if (shape === 'unnamed' || shape === 'unknown') {
    return `The header's first line does not name a known shape (DEV-003): it reads "${lines[0]}". Write "🛠️ **Dev Mode · <shape>**", with the shape one of ${SHAPE_NAMES.join(', ')}.`;
  }
  const header = [/^🛠️\s*\*\*Dev Mode\s*·\s*Tracker\*\*$/iu, META];
  if (!header.every((re, i) => re.test(lines[i] ?? ''))) {
    return 'The reply does not open with the header block (DEV-002): the label "🛠️ **Dev Mode · Tracker**", then one line in a callout, "> Turn … · Started … · Last reply …" (no Last reply on turn 1), copied as given with the message.';
  }
  if (!/^(---|\*\*\*|___)$/.test(lines[2] ?? '')) {
    return 'The header is not ruled off from the title (DEV-002): a --- rule goes between the metadata line and "# 🎯 Current dev goal".';
  }
  if (!/^#\s+🎯\s*Current dev goal\s*$/iu.test(lines[3] ?? '')) {
    return 'The line under the header rule must be the title (DEV-002): "# 🎯 Current dev goal", with the workstream and its goal in the callout beneath.';
  }
  // The tracker is everything above the first rule: Goal, then the steps as a
  // downward checklist, then Last and Now.
  const end = lines.findIndex((l, i) => i > 3 && /^(---|\*\*\*|___)$/.test(l));
  const block = lines.slice(4, end < 0 ? 24 : end);
  const head = block.map((l) => l.replace(/^>\s?/, ''));
  const find = (re) => head.findIndex((l) => re.test(l));
  const goal = block.findIndex((l) => l.startsWith('>'));
  const step = find(/^##\s*Progress\s*•\s*[▰▱]+\s*\d+\s*\/\s*\d+(\s*✅)?\s*$/u);
  const last = find(/\bLast turn:/i);
  const now = find(/What['’]s next:/i);
  if (goal < 0 || last < 0 || now < 0) {
    return 'The tracker must hold the goal, Last turn and What\'s next (DEV-002): the callout "> **<workstream>**: <goal>" first, then the steps, then the bullets "- **Last turn:**" and "- **What’s next:**".';
  }
  if (step < 0) {
    return 'The tracker has no progress heading (DEV-002): "## Progress • ▰▰▱▱ <n>/<m>", above the steps.';
  }
  if (!(goal < step && step < last && last < now)) {
    return 'The tracker is out of order (DEV-002): Goal first, then the step line and checklist, then Last, then Now.';
  }
  // Only the Goal sits in the callout; the steps, Last and Now stand outside it.
  if (!block[goal].startsWith('>') || [step, last, now].some((i) => block[i].startsWith('>'))) {
    return 'Only the goal is a callout (DEV-002): "> **<workstream>**: <goal>". Progress, the steps, Last turn and What\'s next sit outside it.';
  }
  if (head.slice(last, now + 1).some((l) => l.includes('✅'))) {
    return 'Last turn and What\'s next carry a tick (DEV-005): state what happened in words, with no ✅.';
  }
  // The steps are one breadcrumb line: done steps crossed out, the current one
  // green, the rest plain, joined by ⟶.
  // Once every step is finished there is no current one: the line is all
  // crossed out and the count full. Closing the chat is not a step.
  const flow = head.find((l) => /🟢/u.test(l)) ?? head.find((l) => /^~~.+~~(\s*⟶\s*~~.+~~)*\s*$/u.test(l));
  const steppy = (l) => /^([-*]\s*)?(~~|🟢|[⚫⚪●◉○│])/u.test(l);
  if (head.filter(steppy).length > 1) {
    return 'The steps are stacked (DEV-005): put them on one line, joined by ⟶, not one per line or as bullets.';
  }
  if (!flow) {
    return 'The steps are not a breadcrumb (DEV-005): one line under the progress bar — "~~done~~ ⟶ 🟢 **this step** ⟶ to come".';
  }
  if (/[⚫⚪→›]/u.test(flow)) {
    return 'The steps use the old marks (DEV-005): write them as a breadcrumb, "~~done~~ ⟶ 🟢 **this step** ⟶ to come", with no ⚫, ⚪, → or ›.';
  }
  if ((flow.match(/🟢/gu) ?? []).length > 1) {
    return 'The breadcrumb has more than one current step (DEV-009): a reply walks one step, so only one is green.';
  }
  const parts = flow.split('⟶').map((p) => p.trim());
  const at = parts.some((p) => p.includes('🟢')) ? parts.findIndex((p) => p.includes('🟢')) : parts.length;
  if (parts.length > 1 && !flow.includes('⟶')) {
    return 'The steps are not joined by ⟶ (DEV-005).';
  }
  // The count is steps finished, not the step reached: the current step is
  // not done until it is crossed out. The bar matches the count.
  const [, bar, doneN, totalN] = head[step].match(/^##\s*Progress\s*•\s*([▰▱]+)\s*(\d+)\s*\/\s*(\d+)/u) ?? [];
  const crossed = parts.filter((p) => /^~~.+~~$/u.test(p)).length;
  if (Number(totalN) !== parts.length || Number(doneN) !== crossed) {
    return `The count is wrong (DEV-005): ${crossed} of ${parts.length} steps are finished, so the heading reads "${crossed}/${parts.length}". The current step counts once it is crossed out, not before.`;
  }
  // A green tick closes the count once, when every step is finished, and never before.
  const ticked = /✅\s*$/u.test(head[step]);
  if (ticked !== (crossed === parts.length)) {
    return ticked
      ? 'The progress heading carries ✅ with steps still open (DEV-005): the tick comes only when every step is finished.'
      : 'Every step is finished, so the progress heading ends with ✅ after the full count (DEV-005).';
  }
  if ([...bar].filter((c) => c === '▰').length !== crossed || [...bar].length !== parts.length) {
    return `The bar does not match the count (DEV-005): one ▰ per finished step and one ▱ per step left — "${'▰'.repeat(crossed)}${'▱'.repeat(parts.length - crossed)}".`;
  }
  if (parts.slice(0, at).some((p) => !/^~~.+~~$/u.test(p))) {
    return 'A finished step is not crossed out (DEV-005): every step before the green one is written "~~<step>~~".';
  }
  // WKB-007: every request starts at the dialogue, and the spec work that follows
  // the agreement is never shown in the reply (the developer, 2026-10-19: "for
  // all dev chats now, remove the specs line").
  if (!head.some((l) => l.includes('▰') || l.includes('▱'))) {
    return 'The step line has no progress bar (DEV-005): ▰ for steps done and ▱ for steps to come, beside "Step <n>/<m>".';
  }
  const raw = withoutCode(reply).split('\n');
  for (let i = 0; i < raw.length; i += 1) {
    if (!/^\s*(---|\*\*\*|___)\s*$/.test(raw[i])) continue;
    const next = raw.slice(i + 1).find((l) => l.trim());
    if (next && !/^\s*##\s/.test(next) && !/^\s*#\s+🎯/u.test(next) && !/^\s*(---|\*\*\*|___)\s*$/.test(next) && !/^\s*🛠️/u.test(next)) {
      return `The section after a --- rule does not open with a heading (DEV-005): "${next.trim().slice(0, 60)}". Start every section with a ## heading.`;
    }
  }
  const open = lines.findIndex((l) => STILL_OPEN.test(l));
  // Below the tracker, every section heading has a rule of its own above it, so
  // each section reads as separate at a glance, the step split into several
  // included.
  for (let i = Math.max(end, 0) + 1; i < lines.length; i += 1) {
    if (/^##\s/.test(lines[i]) && !/^(---|\*\*\*|___)$/.test(lines[i - 1])) {
      return `A section heading has no rule above it (DEV-005): "${lines[i].slice(0, 60)}". Put a --- line above every ## heading below the tracker.`;
    }
    if (/^##\s/.test(lines[i]) && !/^##\s*\p{Extended_Pictographic}/u.test(lines[i])) {
      return `A section heading has no emoji (DEV-005): "${lines[i].slice(0, 60)}". Open every ## heading below the tracker with one that fits what the section holds.`;
    }
  }
  // WKB-010: the growth section stays short, so it teaches rather than lectures.
  const growth = lines.findIndex((l) => /^##\s*💡\s*Worth knowing/iu.test(l));
  if (growth >= 0 && GROWTH_LINES) {
    let end = growth + 1;
    while (end < lines.length && !RULE.test(lines[end]) && !/^##\s/.test(lines[end])) end += 1;
    const body = end - growth - 1; // lines arrive trimmed, blanks dropped
    if (body > GROWTH_LINES) {
      return `"Worth knowing" runs to ${body} lines (WKB-010): keep it to ${GROWTH_LINES}, the one thing most worth carrying away.`;
    }
    // WKB-010 design #2: teaching is never a quiz, a score or a streak. The one question it may
    // ask is a single recall of an earlier lesson, tied to the work, once a week at most (A-093,
    // the owner: "Okay do all of it and harden"); it opens "Recall:" so it reads as what it is.
    const said = lines.slice(growth + 1, end);
    const recalls = said.filter((l) => /^\**Recall:\**/i.test(l.replace(/^[-*]\s*/, '')));
    const text = said.filter((l) => !recalls.includes(l) || recalls.length > 1).join('\n');
    if (/\?\s*$/m.test(text) || /\b(quiz|score|streak|points)\b/i.test(said.join('\n'))) {
      return '"Worth knowing" quizzes or scores (WKB-010): state the tip, the reason or the past decision; never a quiz, a score or a streak, and at most one question, a single line opening "Recall:" about an earlier lesson (A-093).';
    }
  }
  // WKB-008: a reply that drafts a spec row says what it was checked against.
  if (/\*\*Statement\*\*/.test(reply) && /\*\*Design\*\*/.test(reply) && !lines.some((l) => /^##\s.*conflict/i.test(l))) {
    return 'The reply drafts a spec row with no conflicts section (WKB-008): add a ## section naming each row or past decision it was checked against, why each exists, and whether the draft contradicts it, or that none was found.';
  }
  // The one ask is the last section: a heading that is the question (ending
  // in "?"), or one saying nothing is needed. The other headings are the
  // agent's to choose, so only a heading's "?" counts as a question: a symbol,
  // or a question mark inside a sentence, never does. While something is
  // asked the reply ends on it and carries no "Still open"; only once the work
  // in hand is done and nothing is asked does "Still open" close the reply
  // (DEV-004, DEV-014).
  const below = lines.map((l, i) => ({ l, i })).filter(({ l, i }) => i > end && /^##\s/.test(l));
  const heads = below.filter(({ i }) => i !== open);
  const ask = heads[heads.length - 1]?.l ?? '';
  const asking = /\?\s*$/.test(ask);
  if (!asking && !/nothing (is )?needed/i.test(ask)) {
    return 'The reply has no ask (DEV-002, DEV-010): the last section must be the one question, its heading ending in "?", with your pick, why and its cost; or, once the work is done, a heading saying nothing is needed from the developer, followed by "Still open".';
  }
  const asks = heads.filter(({ l }) => /\?\s*$/.test(l)).length;
  if (asks > 1) {
    return `The reply asks ${asks} things (DEV-008): keep one question heading, the last in the reply, and name the rest in the body, not asked.`;
  }
  // DEV-008: the body under the one ask heading holds one question too, unless
  // the reply says it is a declared batch.
  if (asking && heads.length) {
    const body = withoutCode(lines.slice(heads[heads.length - 1].i + 1).join('\n')).split('\n');
    const qs = body.filter((l) => !/^>/.test(l) && !/https?:\/\//.test(l) && /\?\s*$/.test(l.trim())).length;
    if (qs > 1 && !/\bbatch\b/i.test(reply)) {
      return `The ask puts ${qs} questions to the developer (DEV-008): one decision per reply. Keep one, list the rest unasked; or say the reply is a batch and itemise it.`;
    }
  }
  if (asking && open >= 0) {
    return 'The reply asks the developer something and still carries "Still open" (DEV-004, DEV-014): leave it out while work is pending, so the reply ends on the ask; it returns once the work in hand is done.';
  }
  if (!asking) {
    if (open < 0) {
      return 'Nothing is asked, so the work in hand is done and "## 🗂️ Still open" closes the reply (DEV-014): add it after the heading saying nothing is needed.';
    }
    if (below[below.length - 1]?.i !== open) {
      return 'Nothing is asked, so "Still open" closes the reply (DEV-004, DEV-014): move it to the end, after the heading saying nothing is needed.';
    }
    const tail = stillOpen(lines.join('\n')).split('\n').map((l) => l.replace(/^[-*]\s*/, ''));
    const has = (label) => tail.findIndex((l) => new RegExp(`^(\\p{Extended_Pictographic}\\s*)?\\**${label}:?\\**:?`, 'iu').test(l));
    const [chat, overall, close] = ['In this chat', 'For you', 'End chat'].map(has);
    if (chat < 0 || overall < 0 || close < 0 || !(chat < overall && overall < close)) {
      return '"Still open" must hold three bullets, in order (DEV-014, A-152): "In this chat:" (this chat\'s unfinished work, each finished or dropped before it closes), "For you:" (the count of the for-you list, with an offer to show it), "End chat:" (the review if it has not run, then what is left finished or dropped; or that it can close).';
    }
  }
  const n = words(reply);
  if (WORD_LIMIT && n > WORD_LIMIT) {
    return `The reply runs to ${n} words (DEV-004): cut it to one phone screen or two, under ${WORD_LIMIT}. Split the step and say so, or offer the rest rather than sending it.`;
  }
  // A-171: the sentences read like a good book; a count catches only the worst.
  return proseProblem(reply);
}

/**
 * DEV-018: how full the chat is, read from the measured header. Reliability
 * falls with length itself, not only with the share of the window: 70% of a 1M
 * window is 700k, well past where a long chat drifts, so the note also fires at
 * 400k, whichever comes first (the developer's call, 2026-10-01).
 */
export function contextLoad(meta) {
  const share = Number((String(meta).match(/\((\d+)%\)/) ?? [])[1] ?? 0);
  const [, num, unit] = String(meta).match(/Context ~([\d.]+)(k|M)/) ?? [];
  return { share, used: num ? Number(num) * (unit === 'M' ? 1e6 : 1e3) : 0 };
}

export const contextHeavy = (meta) => {
  const { share, used } = contextLoad(meta);
  return share >= 70 || used >= 400000;
};
