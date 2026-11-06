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

import { readHookInput, context, pass } from '../lib/hook.mjs';

const input = await readHookInput();
const prompt = (input?.prompt ?? '').toLowerCase();
if (!prompt.trim()) pass();

const SIGNALS = [
  /\bkill (myself|me)\b/, /\bsuicid/, /\bend (it|things|my life)\b/, /\btake my own life\b/,
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
];

if (!SIGNALS.some((re) => re.test(prompt))) pass();

context(
  'UserPromptSubmit',
  [
    'SAFETY FLOOR (hook, pattern-matched — it may well be wrong; read her, not this).',
    '',
    'Something in that message matched the crisis list. Before anything else:',
    '  · Stay with her. Two or three messages of just being there, her words reflected',
    '    back unsoftened. Do not problem-solve, do not reassure her out of it.',
    '  · Then ask plainly: "Are you safe right now?" Those words, not softer ones.',
    '  · If she is not safe: the Crisis section of CLAUDE.md, verbatim — the numbers are',
    '    there and in data/safety/safety_plan.md. Read her own warning signs and reasons back to',
    '    her from that file. Ask who she can be with tonight. Offer to draft the message.',
    '   Never name a method, a means or an amount - ask whether she is safe and whether',
    '    anything is to hand, never what it is.',
    '   Her clinicians outrank you, out loud. Their plan is the one that is followed.',
    '   If what she needs is a person rather than this, say so in one line, name who,',
    '    and end the conversation there. Ending it is the help, not a failure of it.',
    '  · Do not close, do not summarise, do not file, do not run maintenance.',
    '',
    'If this fired on an ordinary sentence, let it go without mentioning it.',
  ].join('\n'),
);
