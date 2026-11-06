// Rule test for git/pre-merge-commit: a merge git commits by itself never runs
// pre-commit, and on 2026-10-29 two such merges each lost three Transcript remarks
// both of their parents held. A merge under way that would lose one is stopped,
// naming it; the same merge with the remark kept, and a merge that touches no
// remark, pass. Replayed in a throwaway repository with invented remarks. Run by
// the hook self-test.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const hook = join(here, 'pre-merge-commit');
const dir = makeTemp('dear-pre-merge-commit-');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/i.test(k)));
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
const run = () => spawnSync(process.execPath, [hook], { cwd: dir, encoding: 'utf8', env });

let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` ${String(detail).slice(0, 300)}`}`);
};

const month = join(dir, 'dev', 'dialogue', 'transcript', '2026-10.md');
const entry = (n, words) => `### T-00${n} · 2026-10-0${n} · 💭 want\n> ${words}\n- **Gist:** invented.\n\n`;
const both = entry(1, 'an invented first remark') + entry(2, 'an invented second remark');

try {
  // The harness the hook loads, beside an invented Transcript.
  symlinkSync(join(repo, 'ux'), join(dir, 'ux'));
  symlinkSync(join(repo, '.claude'), join(dir, '.claude'));
  writeFileSync(join(dir, '.gitignore'), 'ux\n.claude\n');
  mkdirSync(dirname(month), { recursive: true });
  git('init', '-q', '-b', 'main');
  writeFileSync(month, `# 2026-10\n\n${both}`);
  writeFileSync(join(dir, 'a.txt'), 'a\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'base');
  git('checkout', '-q', '-b', 'side');
  writeFileSync(join(dir, 'b.txt'), 'b\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'side');
  git('checkout', '-q', 'main');
  writeFileSync(join(dir, 'a.txt'), 'a2\n');
  git('commit', '-q', '-am', 'main');

  git('merge', '-q', '--no-commit', '--no-ff', 'side');
  const clean = run();
  check('a merge that keeps every remark passes', clean.status === 0, clean.stderr);

  writeFileSync(month, `# 2026-10\n\n${entry(1, 'an invented first remark')}`);
  git('add', '-A');
  const lossy = run();
  check('a merge that loses a remark both sides hold is stopped', lossy.status === 1, lossy.stderr);
  check('the stop names the remark', /an invented second remark/.test(lossy.stderr), lossy.stderr);

  writeFileSync(month, `# 2026-10\n\n${both}`);
  git('add', '-A');
  check('once it is put back, the merge passes', run().status === 0);
  git('commit', '-q', '--no-edit');

  // A generated page the merge carries out of date (2026-11-04: a chat's old one-file
  // Agreements reached main this way) never stops the merge: a merge the hooks make is
  // undone when it fails (branches.mjs mergeSigned), so her saves could stop reaching main
  // (2026-11-05). The post-merge rebuild commits the pages straight after instead.
  const { readTranscript, writeAgreements, writeIndex } = await import(pathToFileURL(join(repo, 'ux', 'scripts', 'dialogue.mjs')).href);
  const ddir = join(dir, 'dev', 'dialogue');
  const es = readTranscript(join(ddir, 'transcript'));
  writeAgreements(es, [], ddir);
  writeIndex(es, join(ddir, 'index'));
  git('add', '-A');
  git('commit', '-q', '-m', 'pages built');
  const built = readFileSync(join(ddir, 'agreements.md'), 'utf8');
  git('checkout', '-q', '-b', 'old');
  writeFileSync(join(ddir, 'agreements.md'), '# Agreements\n\nan old one-file page\n');
  git('commit', '-q', '-am', 'old build');
  git('checkout', '-q', 'main');
  writeFileSync(join(dir, 'a.txt'), 'a3\n');
  git('commit', '-q', '-am', 'main again');
  git('merge', '-q', '--no-commit', '--no-ff', 'old');
  const stale = run();
  check('a merge carrying an out-of-date page is never stopped', stale.status === 0, stale.stderr);
  git('commit', '-q', '--no-edit');
  const after = (env2) => spawnSync(process.execPath, [join(repo, 'ux', 'scripts', 'dialogue.mjs'), 'after-merge'], { cwd: dir, encoding: 'utf8', env: { ...env, ...env2, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@local', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@local' } });
  const rebuilt = after();
  check('after the merge, the page is rebuilt and committed', rebuilt.status === 0 && git('show', 'HEAD:dev/dialogue/agreements.md') === built && /committed/.test(rebuilt.stdout), rebuilt.stdout + rebuilt.stderr);
  check('and nothing is left staged or changed', git('status', '--porcelain', '--', 'dev/dialogue') === '');

  // Remarks not yet committed are never built into a commit.
  git('checkout', '-q', '-b', 'old2');
  writeFileSync(join(ddir, 'agreements.md'), '# Agreements\n\nanother old page\n');
  git('commit', '-q', '-am', 'old build 2');
  git('checkout', '-q', 'main');
  writeFileSync(join(dir, 'a.txt'), 'a4\n');
  git('commit', '-q', '-am', 'main once more');
  writeFileSync(month, `# 2026-10\n\n${both}${entry(3, 'an invented third remark, not yet committed')}`);
  git('merge', '-q', '--no-ff', '-m', 'merge old2', 'old2');
  const dirty = after();
  check('with remarks not yet committed, the pages are rebuilt but not committed', dirty.status === 0 && git('show', 'HEAD:dev/dialogue/agreements.md') !== readFileSync(join(ddir, 'agreements.md'), 'utf8') && /next commit/.test(dirty.stdout), dirty.stdout + dirty.stderr);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`pre-merge-commit test: ${failed} failing`);
  process.exit(1);
}
console.log('pre-merge-commit test: a merge that would lose a remark both sides hold is stopped and named; one carrying an out-of-date generated page goes through, and post-merge commits the rebuilt page unless remarks are uncommitted; a sound one passes');
