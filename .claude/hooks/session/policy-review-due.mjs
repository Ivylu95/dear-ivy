// UserPromptSubmit — on /dev-mode, raise a policy review that has fallen due.
//
// POL-014, "A policy review is started by the agent, never left waiting for
// someone to remember." A six-monthly legal task that waits for a person to
// recall it does not happen; this puts it in front of the agent at the first
// development session after it falls due, so the agent offers it unasked.
//
// Development mode only, and silent on every other message. Her conversations
// never hear about the repository (session-brief's EVERYDAY rule, MNT-001), so
// this fires on nothing but the command that switches development on. No
// heartbeat runs the review (A-015): it runs when the skill is used.
//
// The due date comes from lib/policy-review.mjs, the one parser the check also
// uses, so the notice and `npm run check` never disagree.

import { join } from 'node:path';
import { readHookInput, context, pass, repoRoot } from '../lib/hook.mjs';
import { readReviewLog } from '../lib/policy-review.mjs';

const input = await readHookInput();
const prompt = String(input.prompt ?? '');
// Typed as `/dev-mode …`, or expanded with its command name when the client
// passes the command through.
if (!/^\s*\/dev-mode\b/.test(prompt) && !/<command-name>\/?dev-mode<\/command-name>/.test(prompt)) pass();

const review = readReviewLog(join(repoRoot, 'policies', 'review-log.md'));
if (!review.due) pass();

context(
  'UserPromptSubmit',
  `POLICY REVIEW DUE (POL-014): ${review.dueBecause}. In your first reply, after saying development mode is on, say in one line that the legal policies are due for review and offer to run the policy-review skill now. If the developer says not now, record that under "Carried to the next review" in policies/review-log.md and do not raise it again this session.`,
);
