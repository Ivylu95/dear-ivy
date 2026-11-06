// Rule test for update() in lib/heartbeats.mjs, jobs and the run lock, against a throwaway origin and
// clone. The incident (2026-10-07): the commit gate refused a spec-stress
// claim, the claim stayed in the file, the retry read it as a rival's and stood
// down, and the checkout was left dirty, so no later claim could start. Run by
// the hook self-test.

import { execFileSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const lib = join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');
const dir = makeTemp('dear-claim-');
const origin = join(dir, 'origin.git');
const clone = join(dir, 'clone');
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  execFileSync('git', ['clone', '-q', origin, clone], { stdio: 'ignore' });
  git(clone, 'checkout', '-q', '-b', 'main');
  // The tracker and what it imports, in the clone's own copy, as a run sees it.
  mkdirSync(join(clone, '.claude', 'hooks'), { recursive: true });
  cpSync(lib, join(clone, '.claude', 'hooks', 'lib'), { recursive: true, filter: (p) => !/test-/.test(p) });
  cpSync(join(lib, '..', '..', 'thresholds.json'), join(clone, '.claude', 'thresholds.json'));
  // The records as .claude/jobs/ kept them until 2026-11-02: the run's in README.md's
  // frontmatter with the job order, each job's in its own file's (2026-10-08). The
  // first claim moves them to state.json (set-up round 3, D1).
  mkdirSync(join(clone, '.claude', 'jobs'), { recursive: true });
  writeFileSync(join(clone, '.claude', 'jobs', 'README.md'), '---\nstatus: never\nfailures: 0\njobs: stress\n---\n# Jobs\n');
  writeFileSync(join(clone, '.claude', 'jobs', 'stress.md'), '---\nevery: 7 days\nstatus: never\nfailures: 0\n---\n# Stress\n');
  writeFileSync(join(clone, '.gitignore'), 'hooks/\n');
  git(clone, 'add', '.');
  git(clone, 'commit', '-q', '-m', 'base');
  git(clone, 'push', '-q', 'origin', 'main');

  const { parseFront, readRegistry, update } = await import(new URL(`file:///${join(clone, '.claude', 'hooks', 'lib', 'heartbeats.mjs').replace(/\\/g, '/')}`).href);
  const tipJobs = () => readRegistry(clone, 'origin/main');
  const onMain = () => tipJobs().jobs.find((j) => j.name === 'stress');
  const tipFront = (file) => parseFront(git(clone, 'show', `origin/main:.claude/jobs/${file}`)).record;
  const tipState = () => {
    try {
      return JSON.parse(git(clone, 'show', 'origin/main:.claude/jobs/state.json'));
    } catch {
      return null;
    }
  };

  // A gate that refuses every commit.
  mkdirSync(join(clone, 'hooks'));
  writeFileSync(join(clone, 'hooks', 'pre-commit'), '#!/bin/sh\necho "a check failed" >&2\nexit 1\n');
  chmodSync(join(clone, 'hooks', 'pre-commit'), 0o755);
  git(clone, 'config', 'core.hooksPath', 'hooks');

  const refused = update(clone, 'stress', 'claim');
  check('a claim the gate refuses says refused, not claimed elsewhere', refused.result === 'refused');
  check('the refusal carries the gate\'s reason', /a check failed/.test(refused.why ?? ''));
  check('the checkout is left clean', git(clone, 'status', '--porcelain').trim() === '');
  check('nothing reached main', onMain().status === 'never');
  check('a refused claim leaves no state file behind', tipState() === null && !git(clone, 'status', '--porcelain', '--untracked-files=all').trim());

  // The gate passes now: the same claim goes through, not stood down.
  git(clone, 'config', '--unset', 'core.hooksPath');
  check('the next claim is not mistaken for a rival', update(clone, 'stress', 'claim').result === 'pushed');
  check('main shows it running', onMain().status === 'running');
  // D1: the first claim moves every record out of the shipped job files, in the same commit.
  const moved = tipState();
  check('the claim keeps the record in state.json', moved?.stress?.status === 'running' && moved?.run?.status === 'never' && typeof moved?._what === 'string');
  check('and takes it out of every job file, keeping its settings', !('status' in tipFront('stress.md')) && !('failures' in tipFront('README.md')) && tipFront('stress.md').every === '7 days' && tipFront('README.md').jobs === 'stress');
  check('the move and the claim are one commit', git(clone, 'show', '--name-only', '--format=', 'origin/main').trim().split('\n').sort().join() === '.claude/jobs/README.md,.claude/jobs/state.json,.claude/jobs/stress.md');

  // A real rival: a second claim on a running entry stands down.
  check('a second claim stands down', update(clone, 'stress', 'claim').result === 'claimed-elsewhere');

  // A job is ok only once its branch is on main: the first spec-health run pushed its review
  // branch instead, recorded ok, and main never had its verdicts (2026-10-08).
  git(clone, 'checkout', '-q', '-b', 'hb-stress-20261008', 'origin/main');
  writeFileSync(join(clone, 'result.txt'), 'the job\'s work\n');
  git(clone, 'add', 'result.txt');
  git(clone, 'commit', '-q', '-m', 'the job');
  check('a job whose branch is not on main cannot finish ok', update(clone, 'stress', 'finish', 'ok').result === 'unlanded' && onMain().status === 'running');
  git(clone, 'push', '-q', 'origin', 'hb-stress-20261008:main');
  check('the run finishes once its branch is on main', update(clone, 'stress', 'finish', 'ok').result === 'pushed' && onMain().status === 'ok');

  // HBT-009: the whole run claims first, so a second call of the heartbeat stands down.
  check('a run claims the heartbeat', update(clone, 'run', 'claim').result === 'pushed' && tipJobs().run.status === 'running');
  check('a claim once moved touches only the state file', git(clone, 'show', '--name-only', '--format=', 'origin/main').trim() === '.claude/jobs/state.json');
  check('a second run while one is going stands down', update(clone, 'run', 'claim').result === 'claimed-elsewhere');
  check('the run records its finish', update(clone, 'run', 'finish', 'ok', new Date(), '- stress · ok · nothing to land').result === 'pushed' && tipJobs().run.status === 'ok');
  check('the run summary is the finish commit body (HBT-009)', /stress · ok · nothing to land/.test(git(clone, 'log', '-1', '--format=%b', 'origin/main')));
  check('a finished run frees the next one', update(clone, 'run', 'claim').result === 'pushed');

  // A run of the code before the move writes its record into the file again: the
  // later stamp stands, and the next claim or finish moves it over once more.
  const later = new Date(Date.now() + 60e3).toISOString();
  git(clone, 'checkout', '-q', '--detach', 'origin/main');
  writeFileSync(join(clone, '.claude', 'jobs', 'stress.md'), `---\nevery: 7 days\nstatus: failed\nfailures: 2\nlast_started: ${later}\nlast_finished: ${later}\n---\n# Stress\n`);
  git(clone, 'commit', '-q', '-am', 'an old runner finishes');
  git(clone, 'push', '-q', 'origin', 'HEAD:main');
  check('a record written back into the file by old code is read, being later', onMain().status === 'failed' && onMain().failures === 2);
  check('the next finish moves it over and counts on from it', update(clone, 'stress', 'finish', 'failed').result === 'pushed' && tipState()?.stress?.failures === 3 && !('status' in tipFront('stress.md')));
  // A frontmatter `status: never` with no times never outranks a recorded run.
  git(clone, 'checkout', '-q', '--detach', 'origin/main');
  writeFileSync(join(clone, '.claude', 'jobs', 'stress.md'), '---\nevery: 7 days\nstatus: never\nfailures: 0\n---\n# Stress\n');
  git(clone, 'commit', '-q', '-am', 'a release lays the file down never run');
  git(clone, 'push', '-q', 'origin', 'HEAD:main');
  check('a never-run line in the file does not undo the recorded run', onMain().status === 'failed' && onMain().failures === 3);

  // 2026-11-05: several jobs claimed and finished in one commit, since each commit is a pass of the
  // whole gate (about four minutes); a claim takes what it can and names the rest.
  git(clone, 'checkout', '-q', '--detach', 'origin/main');
  writeFileSync(join(clone, '.claude', 'jobs', 'README.md'), '---\njobs: stress, extra, more, sends\n---\n# Jobs\n');
  writeFileSync(join(clone, '.claude', 'jobs', 'extra.md'), '---\nevery: 7 days\n---\n# Extra\n');
  writeFileSync(join(clone, '.claude', 'jobs', 'more.md'), '---\nevery: 7 days\n---\n# More\n');
  writeFileSync(join(clone, '.claude', 'jobs', 'sends.md'), '---\ninline: first\nevery: 1 hour\n---\n# Sends\n');
  git(clone, 'add', '.');
  git(clone, 'commit', '-q', '-m', 'two more jobs');
  git(clone, 'push', '-q', 'origin', 'HEAD:main');
  const before = Number(git(clone, 'rev-list', '--count', 'origin/main').trim());
  const both = update(clone, [{ name: 'extra' }, { name: 'more' }], 'claim');
  check('two jobs are claimed in one commit', both.result === 'pushed' && both.done?.join() === 'extra,more' && Number(git(clone, 'rev-list', '--count', 'origin/main').trim()) === before + 1);
  check('its title names both', /^chore\(heartbeats\): claim extra, more \(/.test(git(clone, 'log', '-1', '--format=%s', 'origin/main')));
  check('both show running on main', tipState()?.extra?.status === 'running' && tipState()?.more?.status === 'running');
  check('a second batch claim on running jobs stands down, naming them', (() => { const r = update(clone, [{ name: 'extra' }, { name: 'more' }], 'claim'); return r.result === 'claimed-elsewhere' && r.skipped?.join() === 'extra,more'; })());
  const fin = update(clone, [{ name: 'extra', outcome: 'ok' }, { name: 'more', outcome: 'failed' }], 'finish');
  check('two jobs finish in one commit, each with its own outcome', fin.result === 'pushed' && tipState()?.extra?.status === 'ok' && tipState()?.more?.status === 'failed' && tipState()?.more?.failures === 1);
  check('the finish title names each outcome', /^chore\(heartbeats\): finish extra ok, more failed \(/.test(git(clone, 'log', '-1', '--format=%s', 'origin/main')));
  check('an inline job is refused in a batch, and keeps no line', update(clone, [{ name: 'extra' }, { name: 'sends' }], 'claim').result === 'failed' && !('sends' in (tipState() ?? {})));
  check('the run is never batched with a job', update(clone, [{ name: 'run' }, { name: 'extra' }], 'claim').result === 'failed');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
