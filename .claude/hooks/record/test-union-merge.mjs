// Rule test for .gitattributes: files appended to from more than one computer
// merge by keeping both sides' lines (round 3, B5, B22: two saves appending to
// the end of the session log conflicted, and phone saves stayed on side
// branches). The timeline is deliberately not among them. Replayed in a
// throwaway repository with invented lines. Run by the hook self-test.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dir = makeTemp('dear-union-');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/i.test(k)));
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const UNION = ['.claude/release/update-log.jsonl', 'data/core/state/log.md', 'data/core/state/open_loops.md'];

let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` ${detail}`}`);
};
const put = (path, text) => {
  mkdirSync(dirname(join(dir, path)), { recursive: true });
  writeFileSync(join(dir, path), text);
};

try {
  git('init', '-q', '-b', 'main');
  cpSync(join(repo, '.gitattributes'), join(dir, '.gitattributes'));
  for (const f of [...UNION, 'data/core/timeline.md']) put(f, 'line one\n');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'start');
  git('checkout', '-q', '-b', 'phone');
  for (const f of UNION) put(f, 'line one\nfrom the phone\n');
  git('commit', '-q', '--no-verify', '-am', 'record: phone');
  git('checkout', '-q', 'main');
  for (const f of UNION) put(f, 'line one\nfrom the desk\n');
  git('commit', '-q', '--no-verify', '-am', 'record: desk');
  const r = spawnSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', 'merge', '-q', '--no-edit', '--no-verify', 'phone'], { cwd: dir, encoding: 'utf8', env });
  check('the incident: two appends to the same end merge without a conflict', r.status === 0, r.stdout + r.stderr);
  for (const f of UNION) {
    const text = readFileSync(join(dir, f), 'utf8');
    check(`both sides' lines are kept: ${f}`, text.includes('from the phone') && text.includes('from the desk'), text);
  }
  check('the timeline is not merged by union', !/merge: union/.test(git('check-attr', 'merge', '--', 'data/core/timeline.md')));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`union merge test: ${failed} failed`);
  process.exit(1);
}
console.log('union merge test: all passed');
