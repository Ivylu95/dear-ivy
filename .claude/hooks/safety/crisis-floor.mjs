// UserPromptSubmit — the safety floor, made mechanical.
//
// CLAUDE.md puts crisis in the always-loaded file and out of the skills, because
// "a skill loads only if a description matches - a dispatch decision that can
// miss. The safety floor must not depend on one." A regex is a worse reader than
// the model, but it is not a reader that can be having a different kind of day.
//
// It deliberately over-triggers, exactly as the file instructs. A false positive
// costs one line of context the model can set aside. A false negative costs the
// only thing here that cannot be repaired afterwards.
//
// It states no phone numbers. The numbers live in data/safety/safety_plan.md and in
// CLAUDE.md, and a third copy is a copy that drifts. It points at them instead.

import { readHookInput, context, pass, read, dataDir, repoRoot } from '../lib/hook.mjs';
import { CORE_DATA } from '../lib/modules.mjs';
import { crisisMarker } from '../lib/opening.mjs';
import { profilePath, record } from '../lib/profile.mjs';
import { appendFileSync } from 'node:fs';
import { entries } from '../lib/new-chat-tip.mjs';
import { herWords, placeLines, placeState, textOf } from './place.mjs';
import { isTyped, typedCounts } from '../lib/typed.mjs';
import { owedLines, owedState } from './owed.mjs';
import { join } from 'node:path';

const input = await readHookInput();
const prompt = (input?.prompt ?? '').toLowerCase();
if (!prompt.trim()) pass();

const SIGNALS = [
  /\bkill (myself|me)\b/, /\bsuicid/, /\bend(ing|ed)? (it|things|my life|everything)\b/, /\btak(e|ing) my (own )?life\b/,
  /\bwant to die\b/, /\bdon'?t want to (be here|wake up|exist|live)\b/, /\bbetter off without me\b/,
  /\bself[- ]?harm\b/, /\bhurt(ing)? myself\b/, /\bcut(ting)? myself\b/, /\bcutting again\b/,
  /\boverdose\b/, /\bpills\b/, /\bnot safe\b/, /\bunsafe\b/, /\bcan'?t (go on|do this any ?more|keep going)\b/,
  /\bno point\b/, /\bgive up\b/, /\bgiving up\b/, /\bwhat'?s the point\b/, /\bdisappear\b/,
  /\bhopeless\b/, /\bworthless\b/, /\bburden\b/, /\bempty\b/, /\bnumb\b/, /\bscared of myself\b/,
  // Indirect phrasing, added 2026-09-26: the list above catches a stated
  // intention, and most of what is actually said is sideways.
  /\btired of (living|being here|everything|it all)\b/, /\bwish i (was|were) (dead|gone|not here)\b/,
  /\bsleep (forever|and never wake)\b/, /\bnot worth (it|living)\b/, /\bnothing matters\b/,
  /\beveryone would be (better|happier|fine)\b/, /\bdeserve to (die|suffer)\b/, /\bpunish myself\b/,
  /\bwant it (to stop|to end|over)\b/, /\bmake it stop\b/, /\bcan'?t (take|handle|bear) (it|this)\b/,
  /\brelaps/, /\bstopped (taking )?(my )?(meds|medication)\b/, /\bskipped my meds\b/,
  // Local and online shorthand, added 2026-09-26 (safety policy, recommendation
  // 6): how it is actually typed in Singapore and on a phone. Detection only;
  // nothing here is ever said back.
  /\bkms\b/, /\bunalive/, /\bsewer ?slide\b/, /\bend myself\b/, /\boff myself\b/,
  /\b(cannot|can'?t|tak) tahan\b/, /\bjump (down|off)\b/, /\bno reason to (live|stay|go on)\b/,
  /\b(sleep|go to sleep) and not wake( up)?\b/, /\bnot wake up\b/, /\b(final|last) goodbye\b/,
  /\bgoodbye (forever|everyone)\b/, /\bwon'?t be (here|around) (much longer|tomorrow|anymore)\b/,
  /\bwant to go away forever\b/, /不想活/, /想死/,
];

const isCrisis = (text) => SIGNALS.some((re) => re.test(text));

// Where she says it is: read over the whole conversation, her message now
// included, so the reminder holds on turns that match nothing (place.mjs).
// A message he typed while building (its fingerprint in the development record) quotes crisis
// words for the floor, it does not say them (T-850: once development mode was switched off, a chat
// that had been building got "this conversation turned to crisis earlier" with no crisis in it).
// So earlier turns he typed in development, and the replies to them, are left out of the
// carry-over; the message now always counts. If the record cannot be read, nothing is left out.
let typedCount = new Map();
try {
  typedCount = typedCounts(repoRoot);
} catch {
  typedCount = new Map();
}
// The replies to such a message are building talk too ("it asks 'Are you safe right now?'"), so
// they go with it, up to the next message that was not typed while building.
const earlier = [];
let building_turn = false;
for (const e of entries(input?.transcript_path)) {
  if (e?.type === 'user' && Array.isArray(e?.message?.content) && e.message.content.every((p) => p?.type === 'tool_result')) {
    if (!building_turn) earlier.push(e);
    continue;
  }
  if (e?.type === 'user') building_turn = typedCount.size > 0 && isTyped(textOf(e), repoRoot, typedCount);
  if (!building_turn) earlier.push(e);
}
const turns = [...earlier, { type: 'user', message: { content: input?.prompt ?? '' } }];
// In a development chat the turns before carry crisis words quoted while building, not
// said by anyone in distress, so what they would carry over is left out there (2026-10-29:
// "1,628 replies since her first crisis message" in a chat building the floor). A crisis
// word in the message itself still brings the whole floor below. If the check cannot
// run, the chat counts as hers: the reminders stay.
let building = false;
try {
  // Only reads: switched on, and not playing her conversation (sandbox). Never the
  // turn's kind, which writes markers and can switch the mode off.
  const [{ markerSeen }, { sessionId, inSandbox }] = await Promise.all([import('../lib/hook.mjs'), import('../lib/sandbox.mjs')]);
  const id = sessionId(input);
  building = Boolean(id) && markerSeen(`dev-mode-${id}`) && !inSandbox(id);
} catch {
  building = false;
}
const place = building ? [] : placeLines(placeState(turns, isCrisis));
// A person and a line, while still owed after the safety question (owed.mjs, A-143).
const owed = building ? [] : owedLines(owedState(turns, isCrisis));

// Her words only: a relayed report or system note inside the message is not hers (place.mjs).
if (!isCrisis(herWords(prompt))) {
  if (place.length || owed.length) context('UserPromptSubmit', ['SAFETY FLOOR, continued (this conversation turned to crisis earlier):', ...place, ...owed].join('\n'));
  pass();
}

// SAF-005's marker, on disk: the crisis session may write nothing else, and a
// crisis in the very first message would otherwise leave the next session no sign
// of it. One line in her log, her date, nothing personal (lib/opening.mjs reads it
// and softens the next opener; a later steady session clears it). It over-triggers
// with the list, which costs one gentler opener. Never in the self-test, and a
// write that fails costs the marker, never the floor below.
if (!process.env.DEAR_RECORD_READONLY) {
  try {
    const logPath = join(dataDir, CORE_DATA, 'state', 'log.md');
    const log = read(logPath);
    const zone = record.readProfile(read(profilePath(dataDir))).value.timezone ?? 'UTC';
    const line = log && crisisMarker(log, record.zonedDateTime(new Date(), zone).slice(0, 10));
    if (line) appendFileSync(logPath, `${log.endsWith('\n') ? '' : '\n'}${line}\n`);
  } catch {
    /* the floor matters more than the marker */
  }
}

context(
  'UserPromptSubmit',
  [
    'SAFETY FLOOR (hook, pattern-matched — it may well be wrong; read her, not this).',
    '',
    'Something in that message matched the crisis list. Before anything else:',
    '  · Stay with her. Two or three messages of just being there, her words reflected',
    '    back unsoftened. Do not problem-solve, do not reassure her out of it. If she',
    '    says something is to hand or names a time, ask the question below at once.',
    '  · Then ask plainly: "Are you safe right now?" Those words, not softer ones.',
    '  · If she is not safe: the Crisis section of CLAUDE.md, verbatim — the numbers are',
    '    there and in data/safety/safety_plan.md. If that file holds her own warning signs',
    '    and reasons, read them back to her. Ask who she can be with tonight. Offer to',
    '    draft the message to the person she names.',
    '   Say plainly that you are an AI, not a person. With thoughts of ending her life,',
    '    ask once whether anything is to hand even if she says she is safe.',
    '   Never name a method, a means or an amount - ask whether she is safe and whether',
    '    anything is to hand, never what it is.',
    '   Her clinicians outrank you, out loud, where she has them; where she has none,',
    '    point to a GP or the helplines. Never name a means, even its general kind.',
    '   If what she needs is a person rather than this, say so in one line, name who,',
    '    and end the conversation there. Ending it is the help, not a failure of it.',
    '  · Do not close, do not summarise, do not file, do not run maintenance.',
    ...place,
    ...owed,
    '',
    'If this fired on an ordinary sentence, let it go without mentioning it.',
  ].join('\n'),
);
