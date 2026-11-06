// UserPromptSubmit — records the developer unlocking the safety core.
//
// guard-safety-core.mjs refuses any change to the safety core (MNT-006) unless
// this session carries an unlock written here. The guard refuses the agent
// writes to the record itself, so the only way in is a submitted prompt.
//
// A submitted prompt is not always one the person typed. A subagent's report,
// a message from another session and a background task's notice all arrive
// through this same event, and on 2026-09-27 a subagent's report that quoted the
// phrase unlocked the core. So the phrase counts only when it opens the prompt
// (the first words of the first line, as a person types a command), and never in
// a prompt that carries any frame an agent or the harness wraps its messages in.
// Nobody opens a message with "unlock safety core" by accident, and she never
// will.

import { readHookInput, markerWrite, context, pass } from '../lib/hook.mjs';

const input = await readHookInput();
const prompt = String(input?.prompt ?? '');
const session = String(input?.session_id ?? '').replace(/[^\w-]/g, '');

// Frames the harness puts around text it relays rather than text a person typed.
const RELAYED = /<agent-message\b|\[Subagent hand-back\]|<task-notification\b|<system-reminder\b|<teammate-message\b|\[SYSTEM NOTIFICATION/i;
const opensWithPhrase = /^\s*unlock safety core\b/i.test(prompt);

if (!session || !opensWithPhrase || RELAYED.test(prompt)) pass();

markerWrite(`core-unlock-${session}`, String(Date.now()));
context(
  'UserPromptSubmit',
  'The developer unlocked the safety core for this session, for two hours (MNT-006). ' +
    'A change to it still needs a hazard-log entry in policies/SAFETY_POLICY.md before the turn ends.',
);
