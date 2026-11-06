// Rule test for lib/refused-staged.mjs's unownedStaged, as git/pre-commit uses
// it: chats sharing one tree share one staging area, and a chat's plain commit
// once carried another chat's staged files under its own message (T-330 edge
// cases, 2026-10-29). A commit carrying staged files this session never touched
// is refused once, naming them; the same commit again carries them on purpose;
// a merge, a session with no list, the record and what a hook stages itself are
// never asked. Replayed in a throwaway repository. Run by the hook self-test.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { unownedStaged } from '../lib/refused-staged.mjs';
import { typedFile } from '../lib/typed.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';

const dir = makeTemp('dear-unowned-');
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  git('init', '-q');
  git('config', 'core.hooksPath', '/dev/null');
  check('a first commit is never asked', unownedStaged(['a.md'], { touched: new Set(['b.md']), cwd: dir }).length === 0);
  writeFileSync(join(dir, 'base.txt'), 'x');
  git('add', 'base.txt');
  git('commit', '-qm', 'base');

  const mine = new Set(['dev/mine.md']);
  const staged = ['dev/mine.md', 'dev/theirs.md', 'data/core/journal/x.md'];
  const ask = (s, more = {}) => unownedStaged(s, { touched: mine, cwd: dir, ...more });
  // The incident: another chat's staged file would ride in under this chat's message.
  check('a staged file this session never touched is named', JSON.stringify(ask(staged)) === '["dev/theirs.md"]');
  check('the same commit again carries it on purpose', ask(staged).length === 0);
  check('and the next time it is asked afresh', ask(staged).length === 1);
  ask(staged);
  check("only this session's own files: nothing asked", ask(['dev/mine.md']).length === 0);
  check('the record is never asked', ask(['dev/mine.md', 'data/core/people/x.md']).length === 0);
  const hookOwn = relative(dir, typedFile(dir)).replace(/\\/g, '/');
  check('what its own hook stages is never asked', ask(['dev/mine.md', hookOwn]).length === 0);
  check('the cards the gate rebuilds from the Transcript are never asked (T-631)', ask(['dev/mine.md', 'dev/dialogue/agreements.md', 'dev/dialogue/index/topic-checks.md']).length === 0);
  check('a file merely beside the cards is still asked', ask(['dev/mine.md', 'dev/dialogue/agreements-notes.md']).length === 1);
  check("a merge carries main's files by design: not asked", ask(staged, { merging: true }).length === 0);
  check('a commit with no session list (a laptop, a script) is not asked', ask(staged, { touched: new Set() }).length === 0);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// 2026-11-02: an agent's own files, written by a script or staged in the same command as
// the commit, were refused as unowned, twice in one session, and a subagent took it for
// another chat's work. The refusal names that cause and its two ways out.
{
  const { readFileSync } = await import('node:fs');
  const said = readFileSync(new URL('./pre-commit', import.meta.url), 'utf8').split('\n').find((l) => l.includes('never touched these staged files')) ?? '';
  check('the refusal names a script-written or same-command file as a cause, and the way past it', /written by a script or a shell command/.test(said) && /staged in the same command as this commit/.test(said) && /Edit or Write/.test(said) && /run the same commit again/.test(said));
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
