// Rule test for the prompt pass of check-git-bypass.mjs: a git command an
// unattended prompt gives is put to the history guard itself. The incident
// (2026-10-08): the heartbeat's cleanup step said `git worktree remove
// --force`, which the guard refuses, so every orchestrated run would have
// stopped at its last step. Against invented prompt text, never the live
// prompts.
//
// Run from ux/: node scripts/test-check-git-bypass.mjs

import { guardRefuses, promptCommands } from './check-git-bypass.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

const prompt = [
  '3. Remove every checkout with `git worktree remove --force` and stop.',
  'Delete the branch: `git branch -D hb-x`.',
  'Then `git worktree remove ../hb-x` and `git branch -d hb-x`.',
  'Push once: `git push origin HEAD:main`.',
  'Read `jobs.json`, which runs no git.',
].join('\n');
const commands = promptCommands(prompt);

check('every backticked git command is read, and nothing else', commands.length === 5 && !commands.some((c) => c.command === 'jobs.json'));
check('the incident: a forced worktree remove is refused', guardRefuses('git worktree remove --force'));
check('a forced branch delete is refused', guardRefuses('git branch -D hb-x'));
check('a plain worktree remove passes', !guardRefuses('git worktree remove ../hb-x'));
check('a plain branch delete passes', !guardRefuses('git branch -d hb-x'));
check('an ordinary push passes', !guardRefuses('git push origin HEAD:main'));
check('each command keeps its line', commands[0].line === 1 && commands[2].line === 3);

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
