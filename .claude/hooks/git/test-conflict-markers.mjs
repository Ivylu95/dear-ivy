// Rule test for git/pre-commit's conflict-marker refusal: on 2026-10-20 a Transcript
// merge carrying conflict markers was committed in a scratch worktree, and the
// dialogue check still read it as matching. A staged file outside the record with an
// added line opening with seven < or > is refused; the record's saves never are, and a
// marker-like run inside a line is not a marker. Replayed in a throwaway repository with
// invented files; the markers are built at run time, so this file carries none. Run by
// the hook self-test.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'pre-commit');
const dir = makeTemp('dear-conflict-markers-');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/i.test(k)));
const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
const gate = () => spawnSync(process.execPath, [hook], { cwd: dir, encoding: 'utf8', env });
const OURS = '<'.repeat(7);
const THEIRS = '>'.repeat(7);
const conflicted = `one\n${OURS} HEAD\nours\n${'='.repeat(7)}\ntheirs\n${THEIRS} main\n`;

let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` ${detail.slice(0, 300)}`}`);
};
const refusedForMarkers = (r) => r.status === 1 && /conflict markers/.test(r.stderr);

try {
  git('init', '-q');
  mkdirSync(join(dir, 'dev', 'dialogue', 'transcript'), { recursive: true });
  mkdirSync(join(dir, 'data', 'core', 'journal'), { recursive: true });
  writeFileSync(join(dir, 'dev', 'dialogue', 'transcript', '2026-10.md'), 'one\n');
  writeFileSync(join(dir, 'data', 'core', 'journal', 'a.md'), 'an invented line\n');
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'start');

  // The incident: a merged month of the Transcript, its markers still in it.
  writeFileSync(join(dir, 'dev', 'dialogue', 'transcript', '2026-10.md'), conflicted);
  git('add', '-A');
  let r = gate();
  check('the incident: a harness file staged with conflict markers is refused, and named', refusedForMarkers(r) && r.stderr.includes('dev/dialogue/transcript/2026-10.md'), r.stderr);
  check('a lone closing marker is refused too', (() => {
    writeFileSync(join(dir, 'dev', 'dialogue', 'transcript', '2026-10.md'), `one\n${THEIRS}\n`);
    git('add', '-A');
    return refusedForMarkers(gate());
  })());

  // A run of the same characters inside a line is prose, not a marker.
  writeFileSync(join(dir, 'dev', 'dialogue', 'transcript', '2026-10.md'), `one\nA merge carrying ${OURS} markers was committed.\n`);
  git('add', '-A');
  r = gate();
  check('a marker named inside a line is not refused for markers', !/conflict markers/.test(r.stderr), r.stderr);
  git('restore', '--staged', '--', '.');
  writeFileSync(join(dir, 'dev', 'dialogue', 'transcript', '2026-10.md'), 'one\n');

  // The record's saves are never stopped by this check.
  writeFileSync(join(dir, 'data', 'core', 'journal', 'a.md'), conflicted);
  git('add', '--', 'data/core/journal/a.md');
  r = gate();
  check('a record-only commit is never stopped for markers', r.status === 0, r.stderr);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.log(`\n${failed} failing`);
  process.exit(1);
}
console.log('conflict markers test: all passed');
