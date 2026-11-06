// Rule test: a privacy refusal never echoes the line it stopped (A-155). Two hooks,
// each in a throwaway tree with an invented record:
//
//   guard-harness-privacy.mjs   a write outside data/ carrying a line of the record is
//                               refused by path and line of the write; the refusal
//                               used to print the first 80 characters of the line.
//   check-privacy-at-stop.mjs   a tracked harness file repeating a line of the record
//                               blocks the turn, named by path and line only. The
//                               finding's ":<line>" was read as part of the path, so a
//                               copy in a tracked file was taken for another session's
//                               untracked one, and passed.
//
// Run by the hook self-test.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const dir = makeTemp('dear-privacy-findings-');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_(?!CONFIG_)|CLAUDE_CODE_SESSION_ID$)/i.test(k)));
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });

let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` ${detail.slice(0, 300)}`}`);
};

const QUOTE = 'Walked the long way home along the canal and felt lighter by the bridge.';
const put = (rel, text) => {
  mkdirSync(dirname(join(dir, rel)), { recursive: true });
  writeFileSync(join(dir, rel), text);
};
const run = (hook, payload) =>
  spawnSync(process.execPath, [join(dir, '.claude', 'hooks', 'privacy', hook)], {
    cwd: dir,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...env, CLAUDE_PROJECT_DIR: dir },
  });

try {
  git('init', '-q');
  mkdirSync(join(dir, '.claude', 'hooks'), { recursive: true });
  cpSync(here, join(dir, '.claude', 'hooks', 'privacy'), { recursive: true });
  cpSync(join(here, '..', 'lib'), join(dir, '.claude', 'hooks', 'lib'), { recursive: true });
  mkdirSync(join(dir, 'ux', 'scripts'), { recursive: true });
  cpSync(join(repo, 'ux', 'scripts', 'check-privacy.mjs'), join(dir, 'ux', 'scripts', 'check-privacy.mjs'));
  cpSync(join(repo, 'ux', 'lib'), join(dir, 'ux', 'lib'), { recursive: true });
  put('data/PROFILE.yaml', 'mandatory:\n  name:\n    value: Person-J\n    status: answered\n');
  put('data/core/journal/2026-01-02.md', `# A walk\n\n${QUOTE}\n`);
  put('README.md', '# A tree\n');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'start');

  // Before the write lands.
  let r = run('guard-harness-privacy.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(dir, 'dev', 'notes.md'), content: `# Notes\n${QUOTE}\n` } });
  check('a write carrying a line of the record is refused', /"permissionDecision":\s*"deny"/.test(r.stdout), r.stdout + r.stderr);
  check('the refusal names the path and the line of the write', r.stdout.includes('dev/notes.md, line 2 of this write'), r.stdout);
  check('the refusal never echoes the line, nor any part of it', !r.stdout.includes(QUOTE.slice(0, 30)), r.stdout);
  r = run('guard-harness-privacy.mjs', { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(dir, 'dev', 'notes.md'), content: '# Notes\nA long line of this tree\'s own, about the gate and nothing of hers.\n' } });
  check('a long line of its own passes', !/"deny"/.test(r.stdout), r.stdout + r.stderr);

  // At the turn's end, a copy in a tracked file.
  put('dev/notes.md', `# Notes\n${QUOTE}\n`);
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'notes');
  r = run('check-privacy-at-stop.mjs', { hook_event_name: 'Stop', session_id: 'test-privacy-findings' });
  check('the incident: a tracked file repeating a line of the record blocks the turn', /"decision":\s*"block"/.test(r.stdout), r.stdout + r.stderr);
  check('it is named by path and line', r.stdout.includes('dev/notes.md:2 repeats a line verbatim from data/'), r.stdout);
  check('and never echoed', !r.stdout.includes(QUOTE.slice(0, 30)), r.stdout);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.log(`\n${failed} failing`);
  process.exit(1);
}
console.log('privacy findings test: all passed');
