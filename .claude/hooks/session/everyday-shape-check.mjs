// Stop — an everyday reply with headings is noted for the next reply.
//
// CON-014, "Every reply shows where each of its parts begins", and CON-008,
// wording that claims a relationship. The judgement is
// in ../lib/everyday-reply.mjs. Silent in development mode outside its sandbox mode (WKB-013), which has its own
// shape and check. Never blocks: a sent-back reply reaches the person twice,
// so a problem is noted and handed to the next reply by everyday-voice.mjs.

import { readHookInput, pass, markerWrite, readEntries, turnStart, saidAfter } from '../lib/hook.mjs';
import { devModeActive } from '../lib/dev-mode.mjs';
import { everydayNoteMarker, headingProblem, relationshipProblem, sentenceProblem } from '../lib/everyday-reply.mjs';

const input = await readHookInput();
if (input?.stop_hook_active) pass();
if (devModeActive(input)) pass();

const entries = readEntries(input?.transcript_path);
if (!entries) pass(); // No transcript, nothing to judge.
const said = saidAfter(entries, turnStart(entries));

const last = said[said.length - 1] ?? '';
markerWrite(everydayNoteMarker(input), [headingProblem(last), relationshipProblem(last), sentenceProblem(last)].filter(Boolean).join('\n'));
pass();
