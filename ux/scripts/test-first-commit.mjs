#!/usr/bin/env node
// Rule test: the first commit of every new copy passes the commit gate (DEP-015,
// ARC-008; set-up cases, 2026-10-27 · 8).
//
// test-new-copy.mjs proves what new-copy.mjs does to a clone, against a stand-in
// source; the gate itself was only ever run in the developer's tree, where every
// pointer into the record resolves and dev/ exists, and it refused the first
// commit of every real new copy. So this makes a real download: this harness's
// tracked files (never data/ or data-sandbox/, which are not read at all) with
// a stand-in record, committed as a source and cloned from a bare origin; then
// runs the clone's own new-copy.mjs with each answer of --for, and makes step 8's
// commit there through the real pre-commit hook. Each must pass on the first try.
//
// Slow (the whole gate, twice, the hook self-test included), so it runs in
// `npm run check`, not inside the gate. The copies borrow this checkout's
// ux/node_modules, as one set up by `npm install` would hold it. Everything is
// built in the system temp folder; no inherited GIT_*, CLAUDECODE or
// CLAUDE_PROJECT_DIR is passed on. Exits non-zero on any failure.
//
//   node ux/scripts/test-first-commit.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k) && k !== 'CLAUDECODE' && k !== 'CLAUDE_PROJECT_DIR'));
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 }).trim();
const who = ['-c', 'user.email=test@example.invalid', '-c', 'user.name=test'];
let failed = 0;
const expect = (name, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${!ok && detail ? `\n${detail}` : ''}`);
};

const modules = join(REPO, 'ux', 'node_modules');
if (!existsSync(modules)) {
  console.error('first commit test: ux/node_modules is not installed here; run npm --prefix ux install first');
  process.exit(1);
}

// The harness as a download has it: every tracked file outside the record. The
// pathspec keeps data/ and data-sandbox/ out of the listing itself, so no name
// in either is read.
let tracked;
try {
  tracked = git(REPO, '-c', 'core.quotePath=false', 'ls-files', '-z', '--', '.', ':(exclude)data', ':(exclude)data-sandbox').split('\0').filter(Boolean);
} catch {
  console.log('first commit test: no git history here to build a download from (a snapshot without .git), skipped');
  process.exit(0);
}
// A download is made only from the developer's tree. A copy made for someone else
// has no dev/, and a new copy before step 8 has no harness committed yet; built
// from either, the download held no new-copy.mjs and this failed step 6's
// `npm run check` on every new copy (set-up cases, rehearsal 2026-10-27).
if (!existsSync(join(REPO, 'dev')) || !tracked.includes('ux/scripts/new-copy.mjs')) {
  console.log('first commit test: not the developer\'s committed tree (no dev/, or the harness not yet committed), so nothing to download from here, skipped');
  process.exit(0);
}

const dir = makeTemp('dear-first-commit-');
try {
  const source = join(dir, 'source');
  for (const rel of tracked) {
    const from = join(REPO, rel);
    if (!lstatSync(from, { throwIfNoEntry: false })) continue; // removed in this tree, not yet committed
    const to = join(source, rel);
    mkdirSync(dirname(to), { recursive: true });
    if (lstatSync(from).isSymbolicLink()) symlinkSync(readlinkSync(from), to);
    else copyFileSync(from, to);
  }
  // A stand-in record: the source copy's, which new-copy.mjs removes.
  mkdirSync(join(source, 'data', 'core', 'journal'), { recursive: true });
  writeFileSync(join(source, 'data', 'core', 'journal', '2026-01-01.md'), 'PLANTED-RECORD-LINE\n');
  git(source, 'init', '-q', '-b', 'main');
  git(source, 'add', '-A');
  git(source, ...who, 'commit', '-q', '-m', 'source'); // no hook is switched on in the source
  const origin = join(dir, 'origin.git');
  execFileSync('git', ['clone', '-q', '--bare', source, origin], { env, stdio: 'ignore' });

  for (const [answer, label] of [['me', 'for the developer himself'], ['someone-else', 'for someone else']]) {
    const copy = join(dir, answer);
    execFileSync('git', ['clone', '-q', origin, copy], { env, stdio: 'ignore' });
    const made = spawnSync(process.execPath, [join(copy, 'ux', 'scripts', 'new-copy.mjs'), '--go', '--for', answer], { cwd: copy, env, encoding: 'utf8', timeout: 120000 });
    expect(`${label}: new-copy.mjs makes the copy`, made.status === 0 && /Done/.test(made.stdout), made.stderr);
    if (made.status !== 0) continue;
    expect(`${label}: dev/ ${answer === 'me' ? 'stays' : 'is gone'}`, existsSync(join(copy, 'dev')) === (answer === 'me'));
    symlinkSync(modules, join(copy, 'ux', 'node_modules'), 'junction');

    // Step 6's `npm run check` runs this test inside the copy, before anything is committed.
    const inCopy = spawnSync(process.execPath, [join(copy, 'ux', 'scripts', 'test-first-commit.mjs')], { cwd: copy, env, encoding: 'utf8', timeout: 60000 });
    expect(`${label}: this test, run inside the new copy, skips`, inCopy.status === 0 && /skipped/.test(inCopy.stdout), `${inCopy.stdout}${inCopy.stderr}`);
    // The two other checks of step 6's `npm run check` a blank record failed (rehearsal 2026-10-27).
    for (const [what, args] of [['folder index', ['ux/scripts/check-folder-index.mjs']], ['sandbox template', ['ux/scripts/sandbox.mjs', 'check']]]) {
      const ran = spawnSync(process.execPath, args, { cwd: copy, env, encoding: 'utf8', timeout: 60000 });
      expect(`${label}: the ${what} check passes on the blank record`, ran.status === 0, `${ran.stdout}${ran.stderr}`);
    }

    // Step 8 of new-copy-finish.md, as the set-up skill runs it.
    git(copy, 'add', '-A');
    const commit = spawnSync('git', [...who, 'commit', '-q', '-m', 'record: start a new record'], { cwd: copy, env, encoding: 'utf8', timeout: 900000, maxBuffer: 64 * 1024 * 1024 });
    const said = `${commit.stderr ?? ''}${commit.stdout ?? ''}`
      .split('\n')
      .filter((l) => !/^\s*ok\b/.test(l) && !/^  [\w./-]+$/.test(l))
      .join('\n')
      .trim();
    expect(`${label}: the first commit passes the commit gate`, commit.status === 0, said);
    expect(`${label}: the gate reports nothing as failing`, !/reported, not blocking/.test(said), said);
    let count = '0';
    try {
      count = git(copy, 'rev-list', '--count', 'HEAD');
    } catch {}
    expect(`${label}: one commit, the history cut`, count === '1');
    expect(`${label}: the gate prints no word of the source's record`, !said.includes('PLANTED-RECORD-LINE'));
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`\nfirst commit test: ${failed} failed`);
  process.exit(1);
}
console.log('\nfirst commit test: all passed');
