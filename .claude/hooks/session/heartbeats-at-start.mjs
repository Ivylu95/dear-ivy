// SessionStart — what heartbeats are due, failing or stopped, and scratch past its ceiling.
//
// HBT-006, "A heartbeat that is due runs, whether or not anything schedules it."
// HBT-008, "A heartbeat that failed is known to have failed, and is retried only
// so often."
//
// Reads .claude/jobs/ and the tracker in each job (lib/heartbeats.mjs
// decides), what is due a recheck (lib/currency.mjs), and the scratch folder past
// its ceiling (lib/scratch.mjs; ARC-013). Silent when nothing is due, running long,
// failing or stopped, and the folder is under its ceiling.
// Otherwise it names them to the developer only: an everyday chat never hears
// about heartbeats (CON-013, HBT-005).
//
// It does not launch a run. Starting an unattended agent session from here is
// the developer's decision, not yet made (HBT-006's design); until then this
// names what is due and the exact command to run it.
//
// Skipped under the hook selftest (DEAR_RECORD_READONLY), and inside a
// heartbeat run itself (DEAR_HEARTBEAT_RUN), which must never start another.

import { context, pass, readHookInput, repoRoot } from '../lib/hook.mjs';
import { due, heartbeatsOf, readRegistry } from '../lib/heartbeats.mjs';
import { summary } from '../lib/currency.mjs';
import { measureScratch, scratchCeilingMb } from '../lib/scratch.mjs';

if (process.env.DEAR_RECORD_READONLY === '1' || process.env.DEAR_HEARTBEAT_RUN === '1') pass();

let reg;
try {
  reg = readRegistry(repoRoot);
} catch {
  pass(); // no registry, nothing to judge: the selftest and the links check own its absence
}

const lines = [];
// An inline job (reminders) keeps no record of its own; the sweep runs it every time (HBT-010).
for (const h of heartbeatsOf(reg).filter((j) => !j.inline)) {
  const d = due(h);
  if (d.state === 'due') lines.push(`  ${h.name}: due (${d.why}). Run: ${h.prompt}, in a fresh session with no one present`);
  if (d.state === 'capped') lines.push(`  ${h.name}: STOPPED after ${d.why}; it will not retry until a run succeeds. Look at why it fails.`);
  if (d.state === 'retry-wait') lines.push(`  ${h.name}: last run failed; retrying later`);
  if (d.state === 'unreadable') lines.push(`  ${h.name}: its "every" cannot be read, so it never runs`);
}
// What is due a recheck rides on the same developer-only notice (PMM-006).
// The payload names the session's model, so a log checked under another one is
// brought forward (PMM-006 clause 2); without it the model trigger is skipped.
let rechecks = [];
try {
  const input = process.stdin.isTTY ? {} : await readHookInput();
  rechecks = summary(repoRoot, undefined, { model: input.model });
} catch {
  // a currency read that fails must not cost the heartbeat notice
}
// ARC-013: size is bounded by report, never by removal; this is the report.
let scratch = null;
try {
  const ceiling = scratchCeilingMb();
  const m = ceiling && measureScratch(repoRoot);
  if (m && m.mb > ceiling) scratch = `  temp/ holds ${m.mb.toFixed(0)} MB in ${m.files} file(s), past its ${ceiling} MB ceiling; oldest ${m.oldestDays} day(s). Move anything worth keeping to its home; the rest can go.`;
} catch {
  // a scratch read that fails must not cost the other notices
}
if (!lines.length && !rechecks.length && !scratch) pass();

context(
  'SessionStart',
  [
    'FOR THE DEVELOPER ONLY — do not raise in an everyday chat.',
    ...(lines.length ? ['HEARTBEATS (HBT-006, HBT-008):', ...lines] : []),
    ...(scratch ? ['SCRATCH (ARC-013):', scratch] : []),
    ...(rechecks.length ? ['RECHECKS (PMM-006; node .claude/hooks/lib/currency.mjs --all):', ...rechecks] : []),
  ].join('\n'),
);
