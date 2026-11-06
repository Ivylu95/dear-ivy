// Rule test for git/pre-commit's large-file refusal (round 3, D12): GitHub
// refuses a file over 100 MiB on push, and the gate once accepted a 105 MB file
// into the record, after which every save failed to push. Over 95 MiB is refused,
// a record commit included; over 50 MiB passes with a note. Replayed in a
// throwaway repository with invented files. Run by the hook self-test.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'pre-commit');
const dir = makeTemp('dear-large-file-');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/i.test(k)));
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
const gate = () => spawnSync(process.execPath, [hook], { cwd: dir, encoding: 'utf8', env });
const MiB = 1024 * 1024;

let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` ${detail.slice(0, 300)}`}`);
};

try {
  git('init', '-q');
  mkdirSync(join(dir, 'data', 'core', 'journal'), { recursive: true });
  writeFileSync(join(dir, 'data', 'core', 'journal', 'a.md'), 'an invented line\n');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'record: start');

  // The incident: a record-only commit carrying a file over the limit.
  writeFileSync(join(dir, 'data', 'core', 'journal', 'big.bin'), Buffer.alloc(96 * MiB));
  git('add', '--', 'data/core/journal/big.bin');
  let r = gate();
  check('the incident: a record file over 95 MiB is refused before it is history', r.status === 1 && /100 MiB/.test(r.stderr) && r.stderr.includes('data/core/journal/big.bin'), r.stderr);
  git('rm', '-q', '--cached', '--', 'data/core/journal/big.bin');
  rmSync(join(dir, 'data', 'core', 'journal', 'big.bin'));

  writeFileSync(join(dir, 'data', 'core', 'journal', 'large.bin'), Buffer.alloc(51 * MiB));
  git('add', '--', 'data/core/journal/large.bin');
  r = gate();
  check('a record file over 50 MiB passes, with a note', r.status === 0 && /large file/.test(r.stderr) && r.stderr.includes('data/core/journal/large.bin'), r.stderr);
  git('rm', '-q', '--cached', '--', 'data/core/journal/large.bin');
  rmSync(join(dir, 'data', 'core', 'journal', 'large.bin'));

  writeFileSync(join(dir, 'data', 'core', 'journal', 'b.md'), 'another invented line\n');
  git('add', '--', 'data/core/journal/b.md');
  r = gate();
  check('an ordinary record save passes quietly', r.status === 0 && !/large file|refused/.test(r.stderr), r.stderr);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`large-file test: ${failed} failed`);
  process.exit(1);
}
console.log('large-file test: all passed');
