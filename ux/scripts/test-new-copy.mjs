#!/usr/bin/env node
// Rule test: the README's download step makes a fresh clone a new copy, and
// refuses a copy in use (DEP-015).
//
// Builds a throwaway source and clones it in the system temp folder, never this
// repository, and runs new-copy.mjs against each clone through NEW_COPY_ROOT,
// with the templates read from this harness. No inherited GIT_* or CLAUDECODE
// variable is passed on. Exits non-zero on any failure.

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';
import { fingerprint } from '../../.claude/hooks/lib/update/release-lib.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'new-copy.mjs');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k) && k !== 'CLAUDECODE'));
const dir = makeTemp('dear-new-copy-');
let failed = 0;

const put = (root, path, text) => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};
const git = (cwd, ...args) => execFileSync('git', args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const gitOr = (cwd, ...args) => {
  try {
    return git(cwd, ...args);
  } catch {
    return null;
  }
};
const run = (root, args = [], extra = {}) => spawnSync(process.execPath, [script, ...args], { env: { ...env, NEW_COPY_ROOT: root, ...extra }, encoding: 'utf8', timeout: 60000 });
const runAsync = (root, args = []) =>
  new Promise((done) => {
    const child = spawn(process.execPath, [script, ...args], { env: { ...env, NEW_COPY_ROOT: root } });
    let out = '';
    child.stdout.on('data', (c) => (out += c));
    child.stderr.on('data', (c) => (out += c));
    child.on('close', (status) => done({ status, out }));
  });
const expect = (name, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
};

try {
  // A source copy with a record in it, on a bare origin.
  const origin = join(dir, 'origin.git');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin], { env, stdio: 'ignore' });
  const source = join(dir, 'source');
  mkdirSync(source);
  git(source, 'init', '-q', '-b', 'main');
  git(source, 'config', 'user.email', 'test@example.invalid');
  git(source, 'config', 'user.name', 'test');
  put(source, 'data/core/journal/2026-01-01.md', 'PLANTED-RECORD-LINE\n');
  put(source, 'modules/README.md', 'harness\n');
  put(source, 'dev/README.md', 'the developer\'s folder\n');
  put(source, '.gitignore', '/data/archive-local/*\n!/data/archive-local/README.md\n/.claude/settings.local.json\n');
  // What a release ships, as the developer's manifest says (D23).
  put(source, 'dev/skills/release/manifest.json', JSON.stringify({ ship: ['.claude/', 'modules/'], never: ['.claude/release/installed.json'] }));
  put(source, '.claude/skills/x/SKILL.md', 'a skill\n');
  put(source, 'data/archive-local/README.md', 'kept on this machine only\n');
  put(source, 'FEEDBACK.md', '# Feedback\n\nLessons, as general rules.\n\n## Entries\n\n- Rule: PLANTED-FEEDBACK-RULE\n  Why: the source copy\'s own lesson.\n');
  put(source, '.claude/jobs/state.json', `${JSON.stringify({ _what: 'Each heartbeat job\'s run record.', run: { status: 'running', last_started: '2026-01-01T00:00:00.000Z' }, 'PLANTED-JOB': { status: 'failed', failures: 3 } }, null, 2)}\n`);
  git(source, 'add', '-A');
  git(source, 'commit', '-qm', 'start');
  git(source, 'remote', 'add', 'origin', origin);
  git(source, 'push', '-q', 'origin', 'main');
  const fresh = (name) => {
    const to = join(dir, name);
    execFileSync('git', ['clone', '-q', origin, to], { env, stdio: 'ignore' });
    return to;
  };

  const a = fresh('a');
  let r = run(a, ['--go'], { CLAUDECODE: '1' });
  expect('refuses inside a Claude session', r.status === 1 && existsSync(join(a, 'data/core/journal/2026-01-01.md')));
  r = run(a);
  expect('without --go it changes nothing', r.status === 0 && /Would:/.test(r.stdout) && existsSync(join(a, 'data/core/journal/2026-01-01.md')));

  r = run(a, ['--go']);
  expect('without saying who it is for, it refuses and changes nothing', r.status === 1 && /--for/.test(r.stderr) && existsSync(join(a, '.git')) && existsSync(join(a, 'data/core/journal/2026-01-01.md')));
  put(a, '.claude/settings.local.json', '{}\n');
  r = run(a, ['--go', '--for', 'me']);
  expect('a fresh clone is made new', r.status === 0 && /Done/.test(r.stdout));
  {
    // Round 3 (D23): with no record of the harness it started from, a new
    // copy's first update read as a first install, and could not be undone.
    const installed = JSON.parse(readFileSync(join(a, '.claude/release/installed.json'), 'utf8'));
    const files = Object.keys(installed.files ?? {});
    expect('the incident: a new copy records the harness it starts from', installed.version === '0' && files.includes('modules/README.md') && files.includes('.claude/skills/x/SKILL.md') && installed.fingerprint === fingerprint(installed.files));
    expect('and lists only what a release ships: no record, no dev/, nothing local or ignored', !files.some((f) => /^(data|dev)\//.test(f) || f === '.claude/settings.local.json' || f === 'FEEDBACK.md'));
  }
  expect('for me, dev/ stays and the notes say so', existsSync(join(a, 'dev/README.md')) && readFileSync(join(a, 'data/core/state/setup_notes.md'), 'utf8').includes('- for · me'));
  expect('no record from the source is left', !existsSync(join(a, 'data/core/journal/2026-01-01.md')));
  expect('the record is blank, so the first conversation is a first contact', readFileSync(join(a, 'data/core/me/about_me.md'), 'utf8').includes('unfilled:'));
  expect('the profile and the safety plan are laid', existsSync(join(a, 'data/PROFILE.yaml')) && existsSync(join(a, 'data/safety/safety_plan.md')));
  expect('the history is gone, with no origin and on main', !git(a, 'remote') && git(a, 'symbolic-ref', '--short', 'HEAD') === 'main');
  expect('the commit gate is on', git(a, 'config', 'core.hooksPath') === '.claude/hooks/git');
  {
    // Round 2, 2026-10-29 (B23): the source copy's lessons came with the download.
    const fb = readFileSync(join(a, 'FEEDBACK.md'), 'utf8');
    expect('the incident: FEEDBACK.md keeps its heading and none of the source copy\'s entries', !fb.includes('PLANTED-FEEDBACK-RULE') && /^## Entries$/m.test(fb) && fb.startsWith('# Feedback\n\nLessons, as general rules.'));
  }
  {
    // Round 8 follow-up: the source copy's heartbeat run record came with the clone.
    const state = readFileSync(join(a, '.claude/jobs/state.json'), 'utf8');
    expect('a new copy starts with an empty run record, only its _what line', state === `${JSON.stringify({ _what: 'Each heartbeat job\'s run record.' }, null, 2)}\n`);
  }
  r = run(a, ['--go', '--for', 'me']);
  expect('running it twice is harmless', r.status === 0 && /already a new copy/.test(r.stdout));

  const f = fresh('f');
  r = run(f, ['--go', '--for=someone-else']);
  expect('for someone else, dev/ is removed', r.status === 0 && !existsSync(join(f, 'dev')) && existsSync(join(f, 'modules/README.md')));
  expect('for someone else, the setup notes say so', readFileSync(join(f, 'data/core/state/setup_notes.md'), 'utf8').includes('- for · someone else'));
  expect('for someone else too, the harness it starts from is recorded, read before dev/ went', existsSync(join(f, '.claude/release/installed.json')));

  // Round 3 (B11): two runs at once each started a history; one left no .git
  // and the other said git was too old. One run holds the folder at a time.
  {
    const held = fresh('held');
    put(held, 'temp/new-copy.lock', `${process.pid}\n`);
    r = run(held, ['--go', '--for', 'me']);
    expect('a run under way in the folder refuses another, nothing changed', r.status === 1 && /another run/.test(r.stderr) && existsSync(join(held, 'data/core/journal/2026-01-01.md')) && Boolean(gitOr(held, 'rev-parse', '--verify', '-q', 'HEAD')));
    const gone = spawnSync(process.execPath, ['-e', ''], { env });
    put(held, 'temp/new-copy.lock', `${gone.pid}\n`);
    r = run(held, ['--go', '--for', 'me']);
    expect('a lock left by a run that is gone is taken over', r.status === 0 && /Done/.test(r.stdout) && !existsSync(join(held, 'temp')));
    const twice = fresh('twice');
    const both = await Promise.all([runAsync(twice, ['--go', '--for', 'me']), runAsync(twice, ['--go', '--for', 'me'])]);
    const outs = both.map((b) => b.out).join('\n');
    expect('the incident: two runs at once leave one new copy, and neither blames git', both.some((b) => b.status === 0) && !/2\.28/.test(outs) && existsSync(join(twice, '.git')) && gitOr(twice, 'rev-parse', '--verify', '-q', 'HEAD') === null && gitOr(twice, 'symbolic-ref', '--short', 'HEAD') === 'main' && readFileSync(join(twice, 'data/core/me/about_me.md'), 'utf8').includes('unfilled:'));
  }

  // Round 3 (C22): a run stopped after it emptied FEEDBACK.md read its own
  // change as work since, and could never be finished.
  {
    const fb = fresh('feedback-stopped');
    execFileSync('git', ['init', '-q', '-b', 'main', join(fb, 'temp/new-copy')], { env, stdio: 'ignore' });
    writeFileSync(join(fb, 'temp/new-copy/for'), 'me\n');
    writeFileSync(join(fb, 'temp/new-copy/head'), `${git(fb, 'rev-parse', 'HEAD')}\n`);
    rmSync(join(fb, 'data'), { recursive: true, force: true });
    writeFileSync(join(fb, 'FEEDBACK.md'), '# Feedback\n\nLessons, as general rules.\n\n## Entries\n');
    r = run(fb, ['--go']);
    expect('the incident: a run stopped after emptying FEEDBACK.md is finished by the next', r.status === 0 && /Done: a new copy for me/.test(r.stdout));
    const other = fresh('feedback-edited');
    execFileSync('git', ['init', '-q', '-b', 'main', join(other, 'temp/new-copy')], { env, stdio: 'ignore' });
    writeFileSync(join(other, 'temp/new-copy/for'), 'me\n');
    writeFileSync(join(other, 'temp/new-copy/head'), `${git(other, 'rev-parse', 'HEAD')}\n`);
    writeFileSync(join(other, 'FEEDBACK.md'), '# Feedback\n\n## Entries\n\n- Rule: a lesson written since\n');
    r = run(other, ['--go']);
    expect('a FEEDBACK.md edited otherwise still reads as work since, refused', r.status === 1 && /earlier run/.test(r.stderr) && readFileSync(join(other, 'FEEDBACK.md'), 'utf8').includes('written since'));
    // The same for the run record it empties (round 8 follow-up).
    const js = fresh('jobstate-stopped');
    execFileSync('git', ['init', '-q', '-b', 'main', join(js, 'temp/new-copy')], { env, stdio: 'ignore' });
    writeFileSync(join(js, 'temp/new-copy/for'), 'me\n');
    writeFileSync(join(js, 'temp/new-copy/head'), `${git(js, 'rev-parse', 'HEAD')}\n`);
    writeFileSync(join(js, '.claude/jobs/state.json'), `${JSON.stringify({ _what: 'Each heartbeat job\'s run record.' }, null, 2)}\n`);
    r = run(js, ['--go']);
    expect('a run stopped after emptying the run record is finished by the next', r.status === 0 && /Done: a new copy for me/.test(r.stdout));
    const jo = fresh('jobstate-edited');
    execFileSync('git', ['init', '-q', '-b', 'main', join(jo, 'temp/new-copy')], { env, stdio: 'ignore' });
    writeFileSync(join(jo, 'temp/new-copy/for'), 'me\n');
    writeFileSync(join(jo, 'temp/new-copy/head'), `${git(jo, 'rev-parse', 'HEAD')}\n`);
    writeFileSync(join(jo, '.claude/jobs/state.json'), '{ "run": { "status": "ok" } }\n');
    r = run(jo, ['--go']);
    expect('a run record changed otherwise still reads as work since, refused', r.status === 1 && /earlier run/.test(r.stderr));
  }

  const b = fresh('b');
  put(b, 'data/core/journal/2026-01-02.md', 'unsaved\n');
  r = run(b, ['--go', '--for', 'me']);
  expect('uncommitted work reads as a copy in use, refused', r.status === 1 && existsSync(join(b, 'data/core/journal/2026-01-02.md')) && existsSync(join(b, '.git')));

  const c = fresh('c');
  git(c, 'config', 'user.email', 'test@example.invalid');
  git(c, 'config', 'user.name', 'test');
  put(c, 'data/core/journal/2026-01-03.md', 'unpushed\n');
  git(c, 'add', '-A');
  git(c, 'commit', '-qm', 'unpushed');
  r = run(c, ['--go', '--for', 'me']);
  expect('unpushed commits read as a copy in use, refused', r.status === 1 && existsSync(join(c, 'data/core/journal/2026-01-03.md')));

  expect('prints no word of the record', !(r.stdout + r.stderr).includes('PLANTED-RECORD-LINE'));

  // Edge cases, 2026-10-29 (A4, A5): what the history and the record's removal
  // would take that is on no remote, and that status does not show.
  const ignored = fresh('ignored');
  put(ignored, 'data/archive-local/kept.md', 'on this machine only\n');
  r = run(ignored, ['--go', '--for', 'me']);
  expect('the incident: an ignored file in the record reads as a copy in use, refused', r.status === 1 && existsSync(join(ignored, 'data/archive-local/kept.md')) && existsSync(join(ignored, '.git')));

  const side = fresh('side');
  git(side, 'config', 'user.email', 'test@example.invalid');
  git(side, 'config', 'user.name', 'test');
  git(side, 'checkout', '-qb', 'side');
  put(side, 'data/core/journal/2026-01-04.md', 'on a side branch\n');
  git(side, 'add', '-A');
  git(side, 'commit', '-qm', 'side');
  git(side, 'checkout', '-q', 'main');
  r = run(side, ['--go', '--for', 'me']);
  expect('the incident: an unpushed side branch reads as a copy in use, refused', r.status === 1 && gitOr(side, 'rev-parse', '--verify', '-q', 'side'));

  // Round 2, 2026-10-29 (C14): a commit on a detached HEAD is on no branch, and
  // another working folder on the same history loses it with this one.
  const detached = fresh('detached');
  git(detached, 'config', 'user.email', 'test@example.invalid');
  git(detached, 'config', 'user.name', 'test');
  git(detached, 'checkout', '-q', '--detach');
  put(detached, 'data/core/journal/2026-01-05.md', 'on a detached head\n');
  git(detached, 'add', '-A');
  git(detached, 'commit', '-qm', 'detached');
  r = run(detached, ['--go', '--for', 'me']);
  expect('the incident: an unpushed commit on a detached HEAD reads as a copy in use, refused', r.status === 1 && existsSync(join(detached, 'data/core/journal/2026-01-05.md')) && existsSync(join(detached, '.git')));

  const twin = fresh('twin');
  git(twin, 'worktree', 'add', '-q', '--detach', join(dir, 'twin-elsewhere'));
  r = run(twin, ['--go', '--for', 'me']);
  expect('the incident: another working folder on this history reads as a copy in use, refused', r.status === 1 && existsSync(join(twin, 'data/core/journal/2026-01-01.md')) && existsSync(join(twin, '.git')));

  // C15: a temp/new-copy/ left from an earlier run skipped every check, and work
  // done since was wiped. Only a run with nothing moved since is finished.
  const stale = fresh('stale');
  git(stale, 'config', 'user.email', 'test@example.invalid');
  git(stale, 'config', 'user.name', 'test');
  execFileSync('git', ['init', '-q', '-b', 'main', join(stale, 'temp/new-copy')], { env, stdio: 'ignore' });
  writeFileSync(join(stale, 'temp/new-copy/for'), 'me\n');
  put(stale, 'data/core/journal/2026-01-06.md', 'written after the stopped run\n');
  git(stale, 'add', '-A', '--', 'data');
  git(stale, 'commit', '-qm', 'later');
  r = run(stale, ['--go']);
  expect('the incident: a stale half-run does not skip the checks, refused', r.status === 1 && /earlier run/.test(r.stderr) && existsSync(join(stale, 'data/core/journal/2026-01-06.md')) && gitOr(stale, 'log', '-1', '--format=%s') === 'later');

  const paused = fresh('paused');
  execFileSync('git', ['init', '-q', '-b', 'main', join(paused, 'temp/new-copy')], { env, stdio: 'ignore' });
  writeFileSync(join(paused, 'temp/new-copy/for'), 'me\n');
  writeFileSync(join(paused, 'temp/new-copy/head'), `${git(paused, 'rev-parse', 'HEAD')}\n`);
  rmSync(join(paused, 'data'), { recursive: true, force: true });
  r = run(paused, ['--go']);
  expect('a run stopped before its history moved, nothing changed since, is finished', r.status === 0 && /Done: a new copy for me/.test(r.stdout) && !gitOr(paused, 'remote'));

  const stashed = fresh('stashed');
  git(stashed, 'config', 'user.email', 'test@example.invalid');
  git(stashed, 'config', 'user.name', 'test');
  put(stashed, 'dev/README.md', 'changed, then stashed\n');
  git(stashed, 'stash', '-q');
  r = run(stashed, ['--go', '--for', 'me']);
  expect('a stash reads as a copy in use, refused', r.status === 1 && Boolean(gitOr(stashed, 'stash', 'list')));

  // A1-3: a git too old for `init -b` once left a copy with its history removed
  // and none in its place; now the new history is started before anything goes.
  if (process.platform !== 'win32') {
    const old = fresh('old-git');
    const bin = join(dir, 'old-git-bin');
    const real = execFileSync('sh', ['-c', 'command -v git'], { env, encoding: 'utf8' }).trim();
    put(bin, 'git', `#!/bin/sh\nif [ "$1" = init ]; then for a in "$@"; do [ "$a" = -b ] && { echo "error: unknown switch" >&2; exit 129; }; done; fi\nexec ${JSON.stringify(real)} "$@"\n`);
    execFileSync('chmod', ['+x', join(bin, 'git')]);
    r = run(old, ['--go', '--for', 'me'], { PATH: `${bin}:${env.PATH}` });
    expect('the incident: a git too old for a history on main changes nothing', r.status === 1 && /2\.28/.test(r.stderr) && existsSync(join(old, 'data/core/journal/2026-01-01.md')) && Boolean(gitOr(old, 'rev-parse', '--verify', '-q', 'HEAD')) && !existsSync(join(old, 'temp/new-copy')));
  }

  // A run stopped part-way, after the old history and record were removed: the
  // rerun finishes it, for whom the first run was told.
  const cut = fresh('cut');
  mkdirSync(join(cut, 'temp/new-copy'), { recursive: true });
  execFileSync('git', ['init', '-q', '-b', 'main', join(cut, 'temp/new-copy')], { env, stdio: 'ignore' });
  writeFileSync(join(cut, 'temp/new-copy/for'), 'someone else\n');
  rmSync(join(cut, '.git'), { recursive: true, force: true });
  rmSync(join(cut, 'data'), { recursive: true, force: true });
  r = run(cut, ['--go']);
  expect('the incident: a run stopped part-way is finished by the next', r.status === 0 && /Done: a new copy for someone else/.test(r.stdout));
  expect('and it leaves a new copy, nothing of the half-way', gitOr(cut, 'symbolic-ref', '--short', 'HEAD') === 'main' && !gitOr(cut, 'remote') && gitOr(cut, 'config', 'core.hooksPath') === '.claude/hooks/git' && readFileSync(join(cut, 'data/core/me/about_me.md'), 'utf8').includes('unfilled:') && !existsSync(join(cut, 'temp')) && !existsSync(join(cut, 'dev')));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`\nnew copy test: ${failed} failed`);
  process.exit(1);
}
console.log('\nnew copy test: all passed');
