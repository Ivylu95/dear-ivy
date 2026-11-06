// A-015, "No heartbeats for keeping a skill up to date": a skill's tracker says
// when it is due, and the hook asks for the check only when the skill is used,
// only in development.
//
//   node .claude/hooks/lib/test-precursor.mjs

import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readPrecursor, skillDue } from './precursor.mjs';
import { makeTemp } from './temp-litter.mjs';

let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
};

const root = makeTemp('precursor-');
const dev = (name) => join(root, 'dev', 'skills', name);
const log = (next, last = '2026-10-01') => `# Log\n\n| | |\n|---|---|\n| **Last run** | ${last} |\n| **Next due** | ${next} |\n`;
for (const n of ['fresh', 'stale', 'pages']) mkdirSync(dev(n), { recursive: true });
writeFileSync(join(dev('fresh'), 'log.md'), log('2027-01-01'));
writeFileSync(join(dev('stale'), 'log.md'), log('2026-10-10'));
writeFileSync(join(dev('pages'), 'log.md'), log('2027-01-01'));
writeFileSync(join(dev('pages'), 'precursor.md'), '---\nevery: 30 days\nlast_run: 2026-09-15\n---\n# Pages\n');

check('a skill inside its dates is not due', !skillDue(root, 'fresh', '2026-10-21').due);
check('a skill past its Next due is due, saying so', /re-check was due 2026-10-10/.test(skillDue(root, 'stale', '2026-10-21').reasons[0]?.why ?? ''));
check('a precursor reads its every and last_run', readPrecursor(root, 'pages')?.every === '30 days' && readPrecursor(root, 'pages')?.lastRun === '2026-09-15');
check('a precursor inside its month is not due', !skillDue(root, 'pages', '2026-10-10').due);
check('a precursor past its month is due', skillDue(root, 'pages', '2026-10-21').reasons.some((r) => r.what.endsWith('precursor.md')));
writeFileSync(join(dev('pages'), 'precursor.md'), '---\nevery: 30 days\nlast_run:\n---\n');
check('a precursor never run is due', skillDue(root, 'pages', '2026-10-10').reasons.some((r) => r.why === 'never run'));
check('a skill with no tracker is never due', !skillDue(root, 'nothing-here', '2026-10-21').due);

// The hook: silent outside development mode, and on anything but a skill.
const hook = new URL('../session/skill-precursor.mjs', import.meta.url).pathname;
const run = (input) => spawnSync(process.execPath, [hook], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root, CLAUDE_CODE_REMOTE_SESSION_ID: '', CLAUDE_CODE_SESSION_ID: '' } });
check('the hook says nothing in her chat, even when due', run({ hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'stale' }, session_id: 'not-dev' }).stdout.trim() === '');
check('the hook says nothing for another tool', run({ hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: {}, session_id: 'x' }).stdout.trim() === '');

mkdirSync(join(root, '.claude', 'hooks', 'state'), { recursive: true });
writeFileSync(join(root, '.claude', 'hooks', 'state', 'dev-mode-dev-1'), 'on');
const said = run({ hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'stale' }, session_id: 'dev-1' }).stdout;
check('in development, a due skill is told to check first, then do the job', /SKILL PRECURSOR \(A-015\): stale is due/.test(said) && /check first, then do the job/.test(said));
check('in development, reading a due dev skill\'s page counts as using it', /SKILL PRECURSOR \(A-015\): stale is due/.test(run({ hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: `${root}/dev/skills/stale/SKILL.md` }, session_id: 'dev-1' }).stdout));
check('reading any other page is not using a skill', run({ hook_event_name: 'PostToolUse', tool_name: 'Read', tool_input: { file_path: `${root}/dev/skills/stale/log.md` }, session_id: 'dev-1' }).stdout.trim() === '');
check('in development, a skill inside its dates is left alone', run({ hook_event_name: 'PostToolUse', tool_name: 'Skill', tool_input: { skill: 'fresh' }, session_id: 'dev-1' }).stdout.trim() === '');

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
