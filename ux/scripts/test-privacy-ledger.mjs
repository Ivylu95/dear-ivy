#!/usr/bin/env node
// The privacy ledger (ux/scripts/privacy-ledger.mjs, ARC-004 design 4), against an
// invented repository: every file starts unread; marking makes it read; a commit that
// changes it makes it unread again; data/, an untracked file and one with uncommitted
// changes are refused; prune drops a file deleted; --check exits 1 while anything is
// unread; ledgerProblem, which a share copy and a release refuse on, names the count;
// and the ledger is kept one part per top folder, one entry a line (E-031, T-682).
//
//   node ux/scripts/test-privacy-ledger.mjs

import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';
import {
  cutSlices, LEDGER, ledgerPart, ledgerProblem, ledgerStatus, mark, markProblem, orderUnread, prune, partText, readLedger, repoPath, trackedBlobs, unreadInOrder,
} from './privacy-ledger.mjs';

const here = dirname(fileURLToPath(import.meta.url));

// Pure parts first.
{
  const tracked = new Map([['a.md', '1'], ['b.md', '2'], ['c.md', '3']]);
  const s = ledgerStatus(tracked, { 'a.md': { blob: '1', read: '2026-01-01' }, 'b.md': { blob: 'old', read: '2026-01-01' }, 'gone.md': { blob: '9', read: '2026-01-01' } });
  assert.deepEqual(s, { read: ['a.md'], unread: ['b.md', 'c.md'], gone: ['gone.md'] }, 'read is the same blob; a changed blob is unread; a missing file is gone');
  assert.deepEqual(orderUnread(['x', 'y', 'z'], new Map([['x', 30], ['y', 10], ['z', 10]])), ['y', 'z', 'x'], 'the longest-waiting first, then by path');
  // Generated pages (2026-11-06 ruling): read once every source is, and only when the pages match the build.
  const gen = new Map([['dev/dialogue/index/topic-a.md', 'g1'], ['dev/dialogue/agreements.md', 'g2'], ['dev/dialogue/transcript/2026-11.md', 't1'], ['dev/evals/cards/E-1.md', 'e1'], ['ux/x.mjs', 'u1']]);
  const allSources = { 'dev/dialogue/transcript/2026-11.md': { blob: 't1' }, 'dev/evals/cards/E-1.md': { blob: 'e1' } };
  assert.deepEqual(ledgerStatus(gen, allSources, { pagesMatch: true }).unread, ['ux/x.mjs'], 'generated pages count as read when every source is read and the pages match');
  assert.deepEqual(ledgerStatus(gen, allSources).unread, ['dev/dialogue/agreements.md', 'dev/dialogue/index/topic-a.md', 'ux/x.mjs'], 'without a match shown, generated pages stay unread');
  assert.deepEqual(ledgerStatus(gen, { 'dev/evals/cards/E-1.md': { blob: 'e1' } }, { pagesMatch: true }).unread, ['dev/dialogue/agreements.md', 'dev/dialogue/index/topic-a.md', 'dev/dialogue/transcript/2026-11.md', 'ux/x.mjs'], 'one source unread: the generated pages stay unread');
  assert.deepEqual(ledgerStatus(gen, { ...allSources, 'dev/evals/cards/E-1.md': { blob: 'old' } }, { pagesMatch: true }).unread.filter((p) => p.includes('dialogue/') && !p.includes('transcript')), ['dev/dialogue/agreements.md', 'dev/dialogue/index/topic-a.md'], 'a source changed since its read: the generated pages stay unread');
  assert.equal(ledgerPart('ux/app.mjs'), 'ux.json', 'an entry lives in its top folder\'s part');
  assert.equal(ledgerPart('.claude/hooks/x.mjs'), '.claude.json');
  assert.equal(ledgerPart('README.md'), '_root.json', 'a file at the root lives in _root');
  const text = partText({ 'b.md': { blob: '2', read: '2026-01-01' }, 'a.md': { blob: '1', read: '2026-01-01' } });
  assert.equal(text.split('\n').length, 5, 'one entry a line, between the braces');
  assert.deepEqual(Object.keys(JSON.parse(text)), ['a.md', 'b.md'], 'a part is JSON, sorted by path');
  assert.equal(partText({}), '{}\n');
}

const dir = makeTemp('dear-ledger-');
const repo = join(dir, 'repo');
const git = (...a) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...a], { cwd: repo, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
const write = (p, text) => {
  mkdirSync(dirname(join(repo, p)), { recursive: true });
  writeFileSync(join(repo, p), text);
};
try {
  write('data/core/about_me.md', 'Person-Q, an invented life\n');
  write('ux/app.mjs', 'export const x = 1;\n');
  write('README.md', '# A harness\n');
  write('dev/notes.md', 'invented notes\n');
  write(`${LEDGER}/_root.json`, '{}\n');
  git('init', '-q');
  git('add', '-A');
  git('commit', '-qm', 'one');

  // Unread at first, every file outside data/, never data/ or the ledger itself.
  const tracked = trackedBlobs(repo);
  assert.deepEqual([...tracked.keys()].sort(), ['README.md', 'dev/notes.md', 'ux/app.mjs'], 'every tracked file outside data/, and not the ledger');
  assert.equal(ledgerStatus(tracked, readLedger(repo)).unread.length, 3, 'an empty ledger: everything is unread');
  assert.match(ledgerProblem(repo, 150), /^3 of 3 files outside data\/ have not been read.*working through them.*status --check/, 'nothing leaves while anything is unread');

  // Marking makes it read, with the HEAD blob and the day.
  const r = mark(repo, ['README.md', 'ux/app.mjs', 'dev/notes.md'], '2026-01-02');
  assert.deepEqual(r, { marked: 3, refused: [] });
  const blob = git('rev-parse', 'HEAD:README.md').trim();
  assert.deepEqual(readLedger(repo)['README.md'], { blob, read: '2026-01-02' }, 'the entry is the HEAD blob and the day, nothing else');
  assert.equal(ledgerStatus(trackedBlobs(repo), readLedger(repo)).unread.length, 0, 'all three read');
  assert.equal(ledgerProblem(repo, 150), '', 'all read: a share or release may go');
  const parts = readdirSync(join(repo, LEDGER)).sort();
  assert.deepEqual(parts, ['_root.json', 'dev.json', 'ux.json'], 'one part per top folder');
  const ledgerText = parts.map((n) => readFileSync(join(repo, LEDGER, n), 'utf8')).join('');
  assert.ok(!/invented/.test(ledgerText), 'the ledger holds paths, blob ids and dates, nothing read');
  assert.equal(readFileSync(join(repo, LEDGER, 'ux.json'), 'utf8').split('\n').length, 4, 'a part with one entry is three lines');

  // Changing a file and committing makes it unread again.
  write('README.md', '# A harness, changed\n');
  assert.match(markProblem(repo, 'README.md'), /uncommitted changes/, 'a file with uncommitted changes is refused');
  assert.equal(ledgerStatus(trackedBlobs(repo), readLedger(repo)).unread.length, 0, 'an uncommitted change is not what is shared: HEAD is still read');
  git('commit', '-qam', 'two');
  assert.deepEqual(ledgerStatus(trackedBlobs(repo), readLedger(repo)).unread, ['README.md'], 'a committed change makes it unread again');
  assert.deepEqual(unreadInOrder(repo), ['README.md']);

  // A staged-only change is uncommitted too.
  write('ux/app.mjs', 'export const x = 2;\n');
  git('add', 'ux/app.mjs');
  assert.match(markProblem(repo, 'ux/app.mjs'), /uncommitted changes/, 'a staged change is refused as well');
  git('commit', '-qm', 'three');

  // data/, untracked, the ledger, outside: refused, and nothing written for them.
  write('ux/new.mjs', 'export {};\n');
  const refused = mark(repo, ['data/core/about_me.md', 'ux/new.mjs', LEDGER, '../elsewhere.md'], '2026-01-03');
  assert.equal(refused.marked, 0);
  assert.deepEqual(refused.refused.map((x) => x.path), ['data/core/about_me.md', 'ux/new.mjs', LEDGER, '../elsewhere.md']);
  assert.match(refused.refused[0].why, /data\//);
  assert.match(refused.refused[1].why, /not in the last commit/);
  assert.ok(!('data/core/about_me.md' in readLedger(repo)), 'data/ never enters the ledger');
  git('add', 'ux/new.mjs');
  assert.match(markProblem(repo, 'ux/new.mjs'), /not in the last commit/, 'added but not committed is refused');
  assert.equal(repoPath(repo, 'ux/app.mjs', repo), 'ux/app.mjs');
  rmSync(join(repo, 'ux/new.mjs'));
  git('rm', '-q', '--cached', 'ux/new.mjs');

  // Prune drops a deleted file.
  git('rm', '-q', 'dev/notes.md');
  git('commit', '-qm', 'four');
  assert.deepEqual(ledgerStatus(trackedBlobs(repo), readLedger(repo)).gone, ['dev/notes.md'], 'a deleted file is gone');
  assert.deepEqual(prune(repo), ['dev/notes.md']);
  assert.ok(!('dev/notes.md' in readLedger(repo)), 'prune dropped it');

  // --check exit codes, the real script run inside the invented repository.
  mkdirSync(join(repo, 'ux/scripts'), { recursive: true });
  mkdirSync(join(repo, '.claude/hooks/lib'), { recursive: true });
  cpSync(join(here, 'privacy-ledger.mjs'), join(repo, 'ux/scripts/privacy-ledger.mjs'));
  for (const f of ['paths.mjs', 'thresholds.mjs', 'one-read.mjs']) cpSync(join(here, '../../.claude/hooks/lib', f), join(repo, '.claude/hooks/lib', f));
  writeFileSync(join(repo, '.claude/thresholds.json'), JSON.stringify({ thresholds: { 'privacy.filesPerRun': { value: 2, unit: 'files', row: 'ARC-004' }, 'privacy.sliceBytes': { value: 100000, unit: 'bytes', row: 'ARC-004' }, 'privacy.slicesPerRun': { value: 1, unit: 'slices', row: 'ARC-004' } } }));
  git('add', '-A');
  git('commit', '-qm', 'five');
  const run = (...a) => spawnSync('node', ['ux/scripts/privacy-ledger.mjs', ...a], { cwd: repo, encoding: 'utf8' });
  assert.equal(run('status', '--check').status, 1, '--check exits 1 while anything is unread');
  assert.equal(run('next').stdout.trim().split('\n').length, 2, 'next takes its number from the threshold');
  const cut = JSON.parse(run('slices', '--json').stdout);
  assert.equal(cut.length, 1, 'slices stops at privacy.slicesPerRun');
  assert.deepEqual(cut.flat(), run('next').stdout.trim().split('\n').slice(0, cut[0].length), 'a slice holds the files next lists first, in order');
  const all = run('status', '--json');
  const unreadNow = JSON.parse(all.stdout).unreadPaths;
  assert.equal(run('mark', ...unreadNow).status, 0, 'mark exits 0 when every path is marked');
  git('add', LEDGER);
  git('commit', '-qm', 'six');
  assert.equal(run('status', '--check').status, 0, '--check exits 0 once everything is read');
  assert.equal(run('mark', 'data/core/about_me.md').status, 1, 'mark exits 1 on a refusal');

  // Slices: cut by size so one reader can read each whole (2026-11-01: one session read 15 of 168).
  const sizes = new Map([['a', 50], ['b', 60], ['c', 500], ['d', 10], ['e', 10]]);
  assert.deepEqual(cutSlices(['a', 'b', 'c', 'd', 'e'], sizes, 100), [['a'], ['b'], ['c'], ['d', 'e']], 'a slice never passes its size, and a file bigger than it stands alone');
  assert.deepEqual(cutSlices([], sizes, 100), [], 'nothing unread, no slices');

  // ledgerProblem above is what share.mjs and release prepare refuse on; their
  // side is dev/skills/release/test-share.mjs, since ux/ never imports from dev/ (ARC-008).

  console.log('privacy ledger test: unread at first, marked read, unread again on change, refusals, prune, --check, nothing leaves while unread: all hold');
} finally {
  rmSync(dir, { recursive: true, force: true });
}
