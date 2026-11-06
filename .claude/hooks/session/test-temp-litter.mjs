// Rule test: the system temp folder stays bounded (A-147, lib/temp-litter.mjs).
//
// Every mkdtempSync in the repository that writes to the system temp folder uses a
// prefix the sweep knows, so a new test cannot leave litter the sweep misses; and
// the sweep removes only the harness's own folders, only once a day old, keeps the
// live chats and anything else, and clears the chats Claude Code kept for eval runs.
// Run against throwaway folders. Exits non-zero on any failure. Run by selftest.mjs.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkFiles } from '../../../ux/lib/walk-skip.mjs';
import { TEMP_ROOT, isLitter, litterLeft, makeTemp, projectSlug, pruneMarkers, sweepLitter, trimScratch } from '../lib/temp-litter.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
let failed = 0;
const expect = (name, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
};

// 1. Every throwaway folder is made through makeTemp, in the one parent folder (T-485):
// a bare mkdtempSync on the system temp folder anywhere else is refused.
const SKIP = new Set(['node_modules', '.git', 'data', 'temp', '.next', 'data-sandbox', 'worktrees']); // worktrees: agents' copies of this tree, not its code (ux/lib/walk-skip.mjs skips them too)
const files = walkFiles(repo, { names: SKIP, keep: (n) => /\.(mjs|js|cjs)$/.test(n) }).map((f) => relative(repo, f).split(sep).join('/'));
const BARE = /mkdtempSync\(\s*(?:path\.)?join\(\s*(?:os\.)?tmpdir\(\)/;
const bare = [];
let central = 0;
for (const f of files) {
  if (f === '.claude/hooks/lib/temp-litter.mjs') continue;
  let text;
  try { text = readFileSync(join(repo, f), 'utf8'); } catch { continue; }
  if (BARE.test(text)) bare.push(f);
  central += (text.match(/\bmakeTemp\(/g) ?? []).length;
}
expect(`every throwaway folder is made by makeTemp (${central} calls)`, central > 50 && bare.length === 0);
if (bare.length) console.log(`  use makeTemp from .claude/hooks/lib/temp-litter.mjs in: ${bare.join(', ')}`);
expect('the parent folder is dear-me in the system temp folder', TEMP_ROOT === join(tmpdir(), 'dear-me'));
const t = makeTemp('dear-litter-probe-');
expect('makeTemp makes its folder inside the parent', t.startsWith(join(TEMP_ROOT, 'dear-litter-probe-')) && existsSync(t));

// 1a. A run stopped from outside clears its folders, and still ends as stopped (T-643):
// a child makes a folder, is sent SIGTERM, and is checked from here.
{
  const lib = join(repo, '.claude', 'hooks', 'lib', 'temp-litter.mjs');
  const child = `import { makeTemp } from ${JSON.stringify(lib)}; const d = makeTemp('dear-litter-stop-'); console.log(d); setTimeout(() => {}, 30000); process.kill(process.pid, 'SIGTERM');`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', child], { encoding: 'utf8', timeout: 20000 });
  const made = r.stdout.trim();
  expect('a stopped run removes the folder it made', made.startsWith(join(TEMP_ROOT, 'dear-litter-stop-')) && !existsSync(made));
  expect('and still ends as stopped, not as a normal exit', r.signal === 'SIGTERM');
}

// 1b. The sweep runs where the litter is made, and as a daily backstop (T-480).
const has = (rel, pattern) => { try { return pattern.test(readFileSync(join(repo, rel), 'utf8')); } catch { return false; } };
expect('the hook selftest sweeps when it finishes', has('.claude/hooks/selftest.mjs', /^sweepLitter\(\);/m));
// The eval runner is in dev/, which a copy made for someone else does not have (ARC-008; first commit test, 2026-11-01).
expect('the eval runner sweeps on every exit', !existsSync(join(repo, 'dev')) || has('dev/evals/runner.mjs', /process\.on\('exit', \(\) => sweepLitter\(\)\)/));
expect('session start sweeps', has('.claude/hooks/session/sweep-temp.mjs', /^sweepLitter\(\);/m));
expect('code maintenance runs the backstop daily', has('.claude/jobs/code-maintenance.md', /node \.claude\/hooks\/lib\/temp-litter\.mjs/));

// 2. The sweep, on a throwaway temp folder and projects folder.
const root = makeTemp('dear-litter-test-');
const dir = join(root, 'tmp');
const projects = join(root, 'projects');
const day = 86_400_000;
const now = Date.now();
const make = (base, name, ageMs) => {
  const p = join(base, name);
  mkdirSync(p, { recursive: true });
  const t = (now - ageMs) / 1000;
  utimesSync(p, t, t);
  return p;
};
try {
  const oldTest = make(dir, 'dear-selftest-Ab12Cd', 2 * day);
  const oldRemote = make(dir, 'dear-persona-Ab12Cd.remote.git', 2 * day);
  const newTest = make(dir, 'reminders-list-Zz99Yy', 60_000);
  const kept = make(dir, 'dear-evals-private', 30 * day);
  const foreign = make(dir, 'npm-cache-Ab12Cd', 30 * day);
  const bare = make(dir, 'dear-', 30 * day);
  const oldChat = make(projects, `${projectSlug(join(dir, '/'))}dear-judge-Qq11Ww`, 2 * day);
  const oldCentral = make(join(dir, 'dear-me'), 'anything-Ab12Cd', 2 * day);
  const newCentral = make(join(dir, 'dear-me'), 'anything-Zz99Yy', 60_000);
  const oldCentralChat = make(projects, `${projectSlug(join(dir, 'dear-me', '/'))}dear-play-Pp00Oo`, 2 * day);
  const otherChat = make(projects, '-home-user-dear-me', 30 * day);
  const settledCentral = make(join(dir, 'dear-me'), 'stopped-Hh22Jj', 2 * 3_600_000);
  const n = sweepLitter({ dir, projects, now });
  expect('a test folder a day old goes', !existsSync(oldTest));
  expect('a persona copy\'s remote goes with it', !existsSync(oldRemote));
  expect('a folder made a minute ago stays (in use)', existsSync(newTest));
  expect('the kept live chats stay', existsSync(kept));
  expect('a folder the harness did not make stays', existsSync(foreign));
  expect('a name with no mkdtemp suffix stays', existsSync(bare));
  expect('the chat Claude Code kept for an old eval run goes', !existsSync(oldChat));
  expect('a real project\'s chats stay', existsSync(otherChat));
  expect('a day-old folder in the parent goes, whatever its name', !existsSync(oldCentral));
  expect('a fresh one in the parent stays', existsSync(newCentral));
  expect('the chat kept for an old run in the parent goes', !existsSync(oldCentralChat));
  expect('the count says what went', n === 5);
  expect('one two hours old stays too (under a day)', existsSync(settledCentral));
  const left = litterLeft(dir, { now });
  expect('only what is left over an hour old is counted, not a run under way (T-643)', left.count === 1);
  expect('with no age floor everything left is counted', litterLeft(dir, { now, minAgeMs: 0 }).count === 3);
  // A link inside litter is measured as a link, not as what it points to (T-643).
  const big = join(root, 'big');
  mkdirSync(big, { recursive: true });
  writeFileSync(join(big, 'blob'), Buffer.alloc(3_000_000));
  symlinkSync(big, join(settledCentral, 'node_modules'));
  const t2 = (now - 2 * 3_600_000) / 1000;
  utimesSync(settledCentral, t2, t2);
  expect('a link to a big folder is not counted as litter', litterLeft(dir, { now }).mb === 0);
  // 3. Per-chat markers of chats long over go; standing state and recent chats stay.
  const state = join(root, 'state');
  mkdirSync(state, { recursive: true });
  const file = (name, ageDays) => { const p = join(state, name); writeFileSync(p, ''); const t = (now - ageDays * day) / 1000; utimesSync(p, t, t); return p; };
  const oldMark = file('touched-ee5017a4-8bff-54a8-aba3-9d8002d1bfa6.json', 60);
  const oldDev = file('dev-mode-cse_018PhnEy4FiDMeAnN9j5sota', 60);
  const freshMark = file('save-note-0123456789abcdefghijkl', 2);
  const standing = file('selftest-last.json', 400);
  const gate = file('record-gate-last-pass', 400);
  const gone = pruneMarkers(state, { now });
  expect('a marker from a chat long over goes', !existsSync(oldMark) && !existsSync(oldDev) && gone === 2);
  expect('a recent chat\'s marker stays', existsSync(freshMark));
  expect('standing state files stay, however old', existsSync(standing) && existsSync(gate));
  // 4. A scratch log kept fresh by appends keeps only its newest lines past its limit.
  const scratch = join(root, 'scratch');
  mkdirSync(scratch, { recursive: true });
  const log = join(scratch, 'reminders-sent.txt');
  writeFileSync(log, Array.from({ length: 2000 }, (_, i) => `line ${i}`).join('\n'));
  const small = join(scratch, 'small.txt');
  writeFileSync(small, 'keep me\n');
  const n4 = trimScratch(scratch, { maxBytes: 4000 });
  const logText = readFileSync(log, 'utf8');
  expect('a log past its limit keeps only its newest lines', n4 === 1 && logText.length <= 2000 && logText.trimEnd().endsWith('line 1999') && /^line \d+/.test(logText));
  expect('a small file is left alone', readFileSync(small, 'utf8') === 'keep me\n');
} finally {
  rmSync(root, { recursive: true, force: true });
}

if (failed) {
  console.log(`${failed} failing`);
  process.exit(1);
}
console.log('temp litter tests: all pass');
