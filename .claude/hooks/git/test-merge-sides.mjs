// Rule test for git/pre-push's merge check (lib/merge-sides.mjs): on 2026-11-03 merge
// f5041f36 committed its first parent's files and silently dropped the second parent's
// changes. A push to main is refused when a merge it adds holds one parent's version of
// a file whole while the other parent changed it; a sound merge, a hand-merged clash and
// a rebuilt generated page pass, and so does a loss put back by a later commit, a card
// renumbered by the merge, or a side kept on purpose and said so where keeping it lost
// nothing; said over a real loss, that line excuses nothing. Replayed in a
// throwaway repository with invented files. Run by the hook self-test.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const hook = join(here, 'pre-push');
const dir = makeTemp('dear-merge-sides-');
const work = join(dir, 'work');
const origin = join(dir, 'origin.git');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/i.test(k)));
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: work, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitAny = (...a) => spawnSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: work, encoding: 'utf8', env });
const write = (path, text) => {
  mkdirSync(dirname(join(work, path)), { recursive: true });
  writeFileSync(join(work, path), text);
};
// The hook as git runs it on a push of `tip` to main, where main was `remote`.
const push = (tip, remote, ref = 'refs/heads/main') =>
  spawnSync(process.execPath, [hook, 'origin', origin], { cwd: work, encoding: 'utf8', env, input: `refs/heads/x ${tip} ${ref} ${remote}\n` });

let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` ${String(detail).slice(0, 400)}`}`);
};

const lines = (n, mark = '') => Array.from({ length: n }, (_, i) => `line ${i + 1}${i === 4 ? mark : ''}`).join('\n') + '\n';

/** A base, a side that changes `side`, main that changes `mine`; returns the base commit. */
function fork(name, side, mine) {
  git('checkout', '-q', 'main');
  const base = git('rev-parse', 'HEAD');
  git('checkout', '-q', '-b', `side-${name}`);
  for (const [p, t] of Object.entries(side)) write(p, t);
  git('add', '-A');
  git('commit', '-q', '-m', `side ${name}`);
  git('checkout', '-q', 'main');
  for (const [p, t] of Object.entries(mine)) write(p, t);
  git('add', '-A');
  git('commit', '-q', '-m', `main ${name}`);
  return base;
}
const merge = (name, message = `merge ${name}`) => gitAny('merge', '-q', '--no-ff', '--no-edit', '-m', message, `side-${name}`);
const commitMerge = (message) => {
  git('add', '-A');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
};

try {
  // The harness the hook loads, beside invented files.
  mkdirSync(work, { recursive: true });
  symlinkSync(join(repo, '.claude'), join(work, '.claude'));
  git('init', '-q', '-b', 'main');
  // No commit gate on these invented commits (it is minutes of checks a commit); only the push below runs a hook.
  git('config', 'core.hooksPath', join(dir, 'no-hooks'));
  write('.gitignore', '.claude\n');
  write('notes.md', lines(10));
  write('tool.mjs', lines(10));
  write('other.md', lines(10));
  write('dev/dialogue/agreements.md', 'generated 0\n');
  write('dev/evals/cards/E-001.md', lines(10));
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  execFileSync('git', ['init', '-q', '--bare', origin], { env });
  git('remote', 'add', 'origin', origin);
  git('push', '-q', 'origin', 'main');

  // 1. A clean merge passes.
  let base = fork('clean', { 'tool.mjs': lines(10, ' side') }, { 'other.md': lines(10, ' main') });
  merge('clean');
  check('a clean merge passes', push(git('rev-parse', 'HEAD'), base).status === 0);

  // 2. A clash settled by keeping one side whole is refused, naming only the path.
  base = fork('whole', { 'notes.md': lines(10, ' invented side words') }, { 'notes.md': lines(10, ' invented main words') });
  merge('whole');
  git('checkout', '--ours', 'notes.md');
  const whole = commitMerge('merge whole');
  let r = push(whole, base);
  check('a clash settled by keeping one side whole is refused', r.status === 1, r.stderr);
  check('the refusal names the merge and the path', r.stderr.includes(whole.slice(0, 8)) && /notes\.md/.test(r.stderr), r.stderr);
  check('the refusal names no content', !/invented/.test(r.stderr), r.stderr);
  check('a push to another branch is not checked', push(whole, base, 'refs/heads/claude/x').status === 0);

  // 2b. The same loss, put back by a later commit in the same push, passes.
  write('notes.md', lines(10, ' invented main words and invented side words'));
  git('commit', '-q', '-am', 'put back the side the merge dropped');
  check('a later commit that puts the side back passes', push(git('rev-parse', 'HEAD'), base).status === 0);

  // 3. A merge that silently reverts a non-clashing change from parent 2 is refused.
  base = fork('revert', { 'tool.mjs': lines(12) }, { 'other.md': lines(12) });
  gitAny('merge', '-q', '--no-ff', '--no-commit', 'side-revert');
  git('checkout', 'HEAD', '--', 'tool.mjs');
  r = push(commitMerge('merge revert'), base);
  check("a merge that drops parent 2's clean change is refused", r.status === 1 && /tool\.mjs/.test(r.stderr) && !/other\.md/.test(r.stderr), r.stderr);
  // So does the incident's shape: every file of parent 1, parent 2's file left out whole.
  base = fork('gone', { 'new-page.md': lines(3) }, { 'other.md': lines(14) });
  gitAny('merge', '-q', '--no-ff', '--no-commit', 'side-gone');
  rmSync(join(work, 'new-page.md'));
  r = push(commitMerge('merge gone'), base);
  check('a merge that leaves out a file parent 2 added is refused', r.status === 1 && /new-page\.md/.test(r.stderr), r.stderr);

  // 4. A clash merged by hand, both sides kept, passes.
  base = fork('hand', { 'notes.md': lines(10, ' side again') }, { 'notes.md': lines(10, ' main again') });
  merge('hand');
  write('notes.md', lines(10, ' main again, side again'));
  check('a clash merged by hand passes', push(commitMerge('merge hand'), base).status === 0);

  // 5. A generated page rebuilt after the merge passes, even where it equals one side.
  base = fork('generated', { 'dev/dialogue/agreements.md': 'generated side\n', 'tool.mjs': lines(16) }, { 'dev/dialogue/agreements.md': 'generated main\n' });
  merge('generated');
  write('dev/dialogue/agreements.md', 'generated main\n');
  check('a rebuilt generated page passes', push(commitMerge('merge generated'), base).status === 0);

  // A card both sides added under one number, the incoming one renumbered, passes.
  base = fork('card', { 'dev/evals/cards/E-002.md': `${lines(20, ' theirs')}` }, { 'dev/evals/cards/E-002.md': `${lines(20, ' mine')}x\n` });
  merge('card');
  git('checkout', '--theirs', 'dev/evals/cards/E-002.md');
  write('dev/evals/cards/E-003.md', `${lines(20, ' mine')}x\nrenumbered\n`);
  check('a card renumbered by the merge passes', push(commitMerge('merge card'), base).status === 0);

  // One side kept on purpose, said for that path, passes where both sides made the same
  // change: here main made it and more beside it, so the two clash and main's copy is kept.
  const fixed = (extra) => lines(10).replace('line 5\n', 'line 5 shared fix\n').replace('line 6\n', `line 6${extra}\n`);
  base = fork('same', { 'notes.md': fixed('') }, { 'notes.md': fixed(' and more of main') });
  merge('same');
  git('checkout', '--ours', 'notes.md');
  const same = commitMerge('merge same');
  check('a side kept whole over the same change is still refused unsaid', push(same, base).status === 1);
  git('commit', '-q', '--allow-empty', '-m', 'say why\n\nKept one side: notes.md');
  check('an escape line over an identical shared change passes', push(git('rev-parse', 'HEAD'), base).status === 0);

  // The same line said over a real loss (the dropped side's words are not in the kept
  // file, however alike) is refused, naming the path and why the line does not excuse it.
  base = fork('words', { 'notes.md': lines(10, ' one fix') }, { 'notes.md': lines(10, ' the same fix in other words') });
  merge('words');
  git('checkout', '--ours', 'notes.md');
  r = push(commitMerge('merge words\n\nKept one side: notes.md'), base);
  check('an escape line over a real loss is refused', r.status === 1, r.stderr);
  check("the refusal says the line can't excuse a real loss, naming the path", /"Kept one side: notes\.md" can't excuse a real loss/.test(r.stderr), r.stderr);
  // So is one where the dropped side's added line is in the kept file but its removal came back.
  base = fork('back', { 'notes.md': lines(10).replace('line 3\n', '').replace('line 5\n', 'line 5 fixed\n') }, { 'notes.md': lines(10).replace('line 5\n', 'line 5 fixed\nline 5b\n') });
  merge('back');
  git('checkout', '--ours', 'notes.md');
  r = push(commitMerge('merge back\n\nKept one side: notes.md'), base);
  check('an escape line where a line the dropped side removed came back is refused', r.status === 1 && /notes\.md/.test(r.stderr), r.stderr);

  // Wired: a real push of the lossy merge to origin's main is refused by git itself.
  git('config', 'core.hooksPath', '.claude/hooks/git');
  r = gitAny('push', '-q', 'origin', `${whole}:refs/heads/main`);
  check('git push runs the check', r.status !== 0 && /lost one side/.test(r.stderr), r.stderr);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// The incident itself, where this clone holds it (a shallow one may not).
const INCIDENT = 'f5041f364d5a32ff0badac6b9902998293a5fbdc';
if (spawnSync('git', ['cat-file', '-e', `${INCIDENT}^{commit}`], { cwd: repo, env }).status === 0) {
  const { lostSides } = await import('../lib/merge-sides.mjs');
  const named = lostSides(repo, INCIDENT).map((l) => l.path);
  const want = ['dev/dialogue/transcript/2026-11-2.md', 'ux/scripts/dialogue.mjs', 'ux/scripts/test-dialogue.mjs', 'dev/session-reviews.md'];
  check('the incident: f5041f36 is flagged, naming what it lost', want.every((p) => named.includes(p)), named.join(', '));
  const notes = named.map((p) => `Kept one side: ${p}`).join('\n');
  check('the incident stays refused even with a Kept-one-side line for each path', lostSides(repo, INCIDENT, { notes }).length === named.length);
  // Three merges kept main's copy of a fix both sides had made, but in other words: the
  // dropped side's comment, test line or notes went with it, so the line excuses none.
  for (const past of ['d28928b0b86b55eb74800996619a4b03b3d46890', '12639d47715b97f62135b1d39e5dd289ef264046', '0bff8d8bb827437ee14c2705d689c8ae5d2b8664']) {
    if (spawnSync('git', ['cat-file', '-e', `${past}^{commit}`], { cwd: repo, env }).status !== 0) continue;
    const paths = lostSides(repo, past).map((l) => l.path);
    const left = lostSides(repo, past, { notes: paths.map((p) => `Kept one side: ${p}`).join('\n') });
    check(`${past.slice(0, 8)}: a Kept-one-side line does not excuse its loss`, paths.length > 0 && left.length === paths.length && left.every((l) => l.declared), paths.join(', '));
  }
}

if (failed) {
  console.error(`merge-sides test: ${failed} failing`);
  process.exit(1);
}
console.log('merge-sides test: a merge pushed to main that kept one side whole is refused and named; sound merges pass');
