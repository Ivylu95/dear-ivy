// Tests guard-harness-lock.mjs (DEP-013): in a copy without dev/, harness writes
// are refused and record, scratch and feedback writes pass; with dev/, all pass.
// Run: node .claude/hooks/record/test-harness-lock.mjs

import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'guard-harness-lock.mjs');
const root = makeTemp('harness-lock-');
mkdirSync(join(root, 'data'));

const edit = (p) => ({ tool_name: 'Edit', tool_input: { file_path: p } });
const bash = (c) => ({ tool_name: 'Bash', tool_input: { command: c } });

const CASES = [
  [true, edit(join(root, 'CLAUDE.md')), 'edit CLAUDE.md'],
  [true, edit('.claude/skills/x/SKILL.md'), 'edit a skill, relative path'],
  [false, edit(join(root, 'data/core/x.md')), 'edit the record'],
  [false, edit(join(root, 'FEEDBACK.md')), 'edit FEEDBACK.md'],
  [false, edit(join(root, 'temp/x.log')), 'scratch in temp/'],
  [false, edit('/elsewhere/x'), 'outside the repository'],
  // PMM-003: a new procedure, its router row and its folder are all refused here.
  [true, edit('.claude/skills/brand-new/SKILL.md'), 'create a new procedure'],
  [true, edit('.claude/modules.md'), 'add a router row'],
  [true, bash('mkdir -p .claude/skills/brand-new'), 'mkdir a new procedure folder'],
  [true, bash('echo hi > CLAUDE.md'), 'redirect into CLAUDE.md'],
  [true, bash('sed -i s/a/b/ .claude/settings.json'), 'sed -i on settings'],
  [true, bash('cp /elsewhere/x .claude/hooks/a.mjs'), 'cp into hooks'],
  [true, bash('rm AGENTS.md'), 'rm a harness file'],
  // PRL-002: a procedure leaves only on a person's approval; in her copy it cannot be removed or moved out on the agent's word.
  [true, bash('rm -rf .claude/skills/set-up'), 'delete a procedure'],
  [true, bash('mv .claude/skills/set-up .claude/skills/_set-up'), 'archive a procedure by renaming it'],
  [true, bash('git mv .claude/skills/set-up .claude/skills/_set-up'), 'git mv a procedure to an archive'],
  [true, bash('git checkout -- CLAUDE.md'), 'checkout a harness file'],
  [true, bash('git apply x.patch'), 'git apply'],
  // PMM-007: in her copy a repair to a procedure is never applied, only noted.
  [true, edit('.claude/skills/set-up/repair.md'), 'repair a procedure file'],
  [true, bash('sed --in-place s/a/b/ .claude/skills/set-up/SKILL.md'), 'sed --in-place on a procedure'],
  [true, bash('perl -pi -e s/a/b/ .claude/skills/set-up/SKILL.md'), 'perl -pi on a procedure'],
  [true, bash('patch .claude/skills/set-up/SKILL.md fix.diff'), 'patch a procedure'],
  [false, bash('echo note >> FEEDBACK.md'), 'the repair recorded as a note'],
  [false, bash('echo hi >> data/core/timeline.md'), 'append to the record'],
  [false, bash('git mv data/a.md data/archive/a.md'), 'archive move'],
  [false, bash('git status 2>&1 | tail -3 > /dev/null'), 'read-only command'],
  [false, bash('node .claude/hooks/lib/update/update.mjs apply'), 'the updater'],
];

function denied(input) {
  const r = spawnSync('node', [hook], {
    input: JSON.stringify(input),
    env: { ...process.env, HARNESS_LOCK_ROOT: root, CLAUDE_PROJECT_DIR: root },
    encoding: 'utf8',
  });
  return r.stdout.includes('"deny"');
}

let failed = 0;
const check = (want, input, name) => {
  const got = denied(input);
  if (got !== want) failed++;
  console.log(`${got === want ? 'ok  ' : 'FAIL'} ${name}: ${got ? 'refused' : 'passed'}`);
};
for (const [want, input, name] of CASES) check(want, input, `person's copy, ${name}`);
mkdirSync(join(root, 'dev'));
check(false, edit(join(root, 'CLAUDE.md')), "developer's copy, edit CLAUDE.md");
check(false, bash('echo hi > CLAUDE.md'), "developer's copy, redirect into CLAUDE.md");
check(false, edit('.claude/skills/set-up/repair.md'), "developer's copy, repair a procedure (PMM-007)");
rmSync(root, { recursive: true, force: true });
if (failed) { console.log(`${failed} failed`); process.exit(1); }
console.log('all passed');
