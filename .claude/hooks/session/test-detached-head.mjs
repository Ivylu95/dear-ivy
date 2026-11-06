#!/usr/bin/env node
// A session that opens on a clean detached HEAD behind main is moved onto main
// (session-brief.mjs); one with unsaved work stays where it is. Run against a
// throwaway clone, never this repository.
//
// Run: node .claude/hooks/session/test-detached-head.mjs

import { execFile, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { makeTemp } from '../lib/temp-litter.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'session-brief.mjs');
const sh = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
const run = promisify(execFile);

// One tiny origin, built once and cloned by every scenario: each scenario
// changes only its own clone, so sharing it proves the same and halves the git
// calls (10 s, 2026-10-04). Its own origin, so the test runs where this tree is
// no git repository (the commit gate's exported copy).
const dir = makeTemp('detached-');
function origin() {
  sh(dir, 'init', '-q', '--bare', '-b', 'main', 'origin.git');
  sh(dir, 'clone', '-q', 'origin.git', 'seed');
  const seed = join(dir, 'seed');
  for (const n of [1, 2, 3, 4]) {
    writeFileSync(join(seed, 'f.txt'), String(n));
    sh(seed, 'add', '.');
    sh(seed, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', String(n));
  }
  sh(seed, 'push', '-q', 'origin', 'HEAD:main');
}

/** Each scenario in its own clone; the hook runs are awaited side by side. */
async function scenario(name, prepare, expectBranch) {
  const r = join(dir, name.replace(/\W+/g, '-'));
  sh(dir, 'clone', '-q', 'origin.git', r);
  sh(r, 'checkout', '-q', '--detach', 'origin/main~3');
  sh(r, 'branch', '-q', '-D', 'main');
  prepare(r);
  const child = run('node', [hook], { cwd: r, env: { ...process.env, CLAUDE_PROJECT_DIR: r }, timeout: 120000 });
  child.child.stdin.end('{}');
  await child.catch(() => {});
  const got = sh(r, 'rev-parse', '--abbrev-ref', 'HEAD');
  const head = sh(r, 'rev-parse', 'HEAD');
  const ok = got === expectBranch && (expectBranch !== 'main' || head === sh(r, 'rev-parse', 'origin/main'));
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: on ${got}`);
  return ok;
}

let results = [];
try {
  origin();
  results = await Promise.all([
    scenario('clean detached HEAD behind main moves onto an up-to-date main', () => {}, 'main'),
    scenario('detached HEAD with unsaved work stays detached', (r) => writeFileSync(join(r, 'unsaved.txt'), 'x'), 'HEAD'),
  ]);
  // A session branch of its own commits, behind a main that moved, on a copy
  // with no name set: main is still merged in (review, 2026-10-16).
  const r = join(dir, 'no-name');
  sh(dir, 'clone', '-q', 'origin.git', r);
  sh(r, 'checkout', '-q', '-b', 'claude/s', 'origin/main~1');
  writeFileSync(join(r, 'mine.txt'), 'mine');
  sh(r, 'add', '.');
  sh(r, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'mine');
  const noName = { ...process.env, CLAUDE_PROJECT_DIR: r, GIT_CONFIG_GLOBAL: join(dir, 'no-global'), GIT_CONFIG_NOSYSTEM: '1' };
  const child = run('node', [hook], { cwd: r, env: noName, timeout: 120000 });
  child.child.stdin.end('{}');
  await child.catch(() => {});
  let merged = true;
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', 'origin/main', 'HEAD'], { cwd: r });
  } catch {
    merged = false;
  }
  console.log(`${merged ? 'ok  ' : 'FAIL'} a session branch on a copy with no name set still has main merged in`);
  results.push(merged);
  // Its message never names the branch: a chat's branch takes its name from
  // the topic, and the commit gate refuses a name from the record (review, 2026-10-16).
  const subject = sh(r, 'log', '-1', '--format=%s');
  const fixed = subject === 'merge: main into this session';
  console.log(`${fixed ? 'ok  ' : 'FAIL'} the merge message never names the branch (${subject})`);
  results.push(fixed);

  // A person's own branch is never merged into at session start (review, 2026-10-16).
  const p = join(dir, 'person');
  sh(dir, 'clone', '-q', 'origin.git', p);
  sh(p, 'checkout', '-q', '-b', 'my-work', 'origin/main~1');
  writeFileSync(join(p, 'mine.txt'), 'mine');
  sh(p, 'add', '.');
  sh(p, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'my work');
  const tipBefore = sh(p, 'rev-parse', 'HEAD');
  const pchild = run('node', [hook], { cwd: p, env: { ...process.env, CLAUDE_PROJECT_DIR: p }, timeout: 120000 });
  pchild.child.stdin.end('{}');
  await pchild.catch(() => {});
  const untouched = sh(p, 'rev-parse', 'HEAD') === tipBefore;
  console.log(`${untouched ? 'ok  ' : 'FAIL'} a person's own branch is never merged into at session start`);
  results.push(untouched);

  // A desk folder left on a chat's branch, all of it in main, moves back onto
  // main and the branch goes (review, 2026-10-16).
  const o = join(dir, 'old-chat');
  sh(dir, 'clone', '-q', 'origin.git', o);
  sh(o, 'checkout', '-q', '-b', 'claude/old', 'origin/main~1');
  const desk = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('CLAUDE_CODE_REMOTE')));
  const ochild = run('node', [hook], { cwd: o, env: { ...desk, CLAUDE_PROJECT_DIR: o }, timeout: 120000 });
  ochild.child.stdin.end('{}');
  await ochild.catch(() => {});
  const back = sh(o, 'rev-parse', '--abbrev-ref', 'HEAD') === 'main' && sh(o, 'branch', '--list', 'claude/old') === '';
  console.log(`${back ? 'ok  ' : 'FAIL'} a desk folder on a finished chat branch moves back onto main`);
  results.push(back);

  // A cloud chat on its claude/ branch stays where it is.
  const l = join(dir, 'live-chat');
  sh(dir, 'clone', '-q', 'origin.git', l);
  sh(l, 'checkout', '-q', '-b', 'claude/live', 'origin/main');
  // In the cloud, even with a disk that outlived a day (review, 2026-10-16).
  const days = new Date(Date.now() - 3 * 86400000);
  utimesSync(join(l, '.git', 'index'), days, days);
  const lchild = run('node', [hook], { cwd: l, env: { ...process.env, CLAUDE_CODE_REMOTE: 'true', CLAUDE_PROJECT_DIR: l }, timeout: 120000 });
  lchild.child.stdin.end('{}');
  await lchild.catch(() => {});
  const stays = sh(l, 'rev-parse', '--abbrev-ref', 'HEAD') === 'claude/live';
  console.log(`${stays ? 'ok  ' : 'FAIL'} a cloud chat stays on its branch, however old its disk`);
  results.push(stays);

  // A chat whose saves rest on its own GitHub branch, reopened after main moved:
  // the merge of main is never counted as unsaved work (review, 2026-10-16).
  const c = join(dir, 'rests-on-branch');
  sh(dir, 'clone', '-q', 'origin.git', c);
  sh(c, 'checkout', '-q', '-b', 'claude/rests', 'origin/main~1');
  writeFileSync(join(c, 'saved.txt'), 'saved');
  sh(c, 'add', '.');
  sh(c, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'a save');
  sh(c, 'push', '-q', 'origin', 'claude/rests');
  const cchild = run('node', [hook], { cwd: c, env: { ...process.env, CLAUDE_CODE_REMOTE: 'true', CLAUDE_PROJECT_DIR: c }, timeout: 120000 });
  cchild.child.stdin.end('{}');
  const { stdout: said = '' } = await cchild.catch((e) => e);
  const noFalseAlarm = !said.includes('on no GitHub branch');
  console.log(`${noFalseAlarm ? 'ok  ' : 'FAIL'} the merge of main is never counted as unsaved work`);
  results.push(noFalseAlarm);

  // A detached checkout holding harness commits on no GitHub branch: the save
  // will not push them, so the brief asks for them to be brought in, never
  // "nothing to do" (review, 2026-10-16).
  const d = join(dir, 'detached-work');
  sh(dir, 'clone', '-q', 'origin.git', d);
  sh(d, 'checkout', '-q', '--detach', 'origin/main');
  writeFileSync(join(d, 'tool.txt'), 'harness');
  sh(d, 'add', '.');
  sh(d, '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null', 'commit', '-q', '-m', 'harness work');
  const dchild = run('node', [hook], { cwd: d, env: { ...process.env, CLAUDE_PROJECT_DIR: d }, timeout: 120000 });
  dchild.child.stdin.end('{}');
  const { stdout: dsaid = '' } = await dchild.catch((e) => e);
  const asks = dsaid.includes('detached checkout are on no GitHub branch') && !dsaid.includes('nothing to do by hand');
  console.log(`${asks ? 'ok  ' : 'FAIL'} harness commits on a detached checkout are never waved through`);
  results.push(asks);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (results.length !== 9 || results.includes(false)) process.exit(1);
console.log(`detached-head tests: ${results.length} cases pass`);
