// PostToolUse on Skill — a skill due its re-check does the re-check first.
//
// The owner's agreement A-015, "No heartbeats for keeping a skill up to date":
// no timer keeps a skill current; when a skill is used and its tracker says it
// is due (lib/precursor.mjs: its log's re-check, and its precursor.md where it
// has one), the agent checks first, records the date, then does the job.
//
// Development mode only. In her conversations a due re-check waits, silently,
// for the next development session that uses the skill: nothing about the
// harness reaches her chat (MNT-001), and the skill runs as written meanwhile
// (PMM-006 clause 3).

import { readHookInput, context, pass, repoRoot } from '../lib/hook.mjs';
import { devModeActive } from '../lib/dev-mode.mjs';
import { skillDue } from '../lib/precursor.mjs';

const input = await readHookInput();
// A development skill is loaded by reading its page (dev/skills/<name>/SKILL.md, routed from
// dev/skills/README.md), never through the Skill tool, so a read of that page counts as using
// it: matched on Skill alone, eight dev skills used every day stayed overdue (2026-10-30).
const devRead = input?.tool_name === 'Read' ? /(?:^|\/)dev\/skills\/([a-z0-9-]+)\/SKILL\.md$/.exec(String(input?.tool_input?.file_path ?? '')) : null;
if (input?.tool_name !== 'Skill' && !devRead) pass();
// A module skill is "module:name"; its development half sits under the name.
// A typed `dev-` entry is its body in dev/skills/ under the name without the prefix (ARC-005, T-479).
const name = devRead ? devRead[1] : String(input?.tool_input?.skill ?? '').split(':').pop().trim().replace(/^dev-/, '');
if (!/^[a-z0-9-]+$/.test(name)) pass();
if (!devModeActive(input)) pass();

let due;
try {
  due = skillDue(repoRoot, name, undefined, { model: input?.model });
} catch {
  pass(); // a tracker it cannot read never stops the skill
}
if (!due.due) pass();

const lines = due.reasons.map((r) => `  - ${r.what}: ${r.why}`).join('\n');
const steps = [
  due.precursor && due.reasons.some((r) => r.what === due.precursor.path)
    ? `its precursor, ${due.precursor.path}: follow its steps, then set its last_run to today`
    : null,
  due.reasons.some((r) => r.what.endsWith('/log.md'))
    ? `its re-check: the skill-writer skill, re-ground mode, on ${name}, which stamps the log's Last run`
    : null,
].filter(Boolean);
context(
  'PostToolUse',
  `SKILL PRECURSOR (A-015): ${name} is due its re-check, so check first, then do the job.\n${lines}\nBefore following ${name}, do ${steps.join('; then ')}. Say so in one line in your reply. If what the developer asked cannot wait, do the job first and the re-check straight after, in this session.`,
);
