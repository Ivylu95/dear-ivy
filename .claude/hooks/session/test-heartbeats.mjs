// The heartbeat tracker decides "due" as HBT-006 and HBT-008 say.
//
//   node .claude/hooks/session/test-heartbeats.mjs
//
// Run by the hook self-test (selftest.mjs). Pure, but for the `due` command's
// own check, which runs in a throwaway copy under the system temp folder.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claimable, cloudMayRun, devOnly, due, dueNow, heartbeatsOf, migrate, orchestrated, parseState, withoutInline, readRegistry, reconcile, record, runFree, runnerName, STALE_MS, RETRY_MS, unlanded, writeState } from '../lib/heartbeats.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';

const NOW = Date.parse('2026-10-01T10:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const H = 3600e3;
const D = 24 * H;
const e = (fields) => ({ name: 'x', every: '7 days', ...fields });

const CASES = [
  ['never run is due', e({ status: 'never' }), 'due'],
  // 2026-11-05: night-loops, built at 11am with a 21:50 cron, would have fired at the next sweep.
  ['a never-run cron job waits for its first scheduled time', e({ status: 'never', cron: '50 21 * * *', timezone: 'Asia/Singapore' }), 'not-due', Date.parse('2026-11-05T03:00:00Z')],
  ['a never-run cron job is due just after its first scheduled time', e({ status: 'never', cron: '50 21 * * *', timezone: 'Asia/Singapore' }), 'due', Date.parse('2026-11-05T14:05:00Z')],
  ['no status at all is due', e({}), 'due'],
  ['ran well a day ago is not due', e({ status: 'ok', last_finished: ago(D) }), 'not-due'],
  ['ran well past its interval is due', e({ status: 'ok', last_finished: ago(8 * D) }), 'due'],
  ['a fresh claim is left alone', e({ status: 'running', last_started: ago(H) }), 'running'],
  ['a claim past the stale limit is due again', e({ status: 'running', last_started: ago(STALE_MS + H), failures: 0 }), 'due'],
  ['a stale claim counts as a failure toward the cap', e({ status: 'running', last_started: ago(STALE_MS + H), failures: 2 }), 'capped'],
  ['a failure waits before retrying', e({ status: 'failed', last_started: ago(H), last_finished: ago(H), failures: 1 }), 'retry-wait'],
  ['a failure past the wait retries', e({ status: 'failed', last_started: ago(RETRY_MS + H), failures: 1 }), 'due'],
  ['three failures in a row stop it', e({ status: 'failed', last_started: ago(2 * D), failures: 3 }), 'capped'],
  ['an unreadable interval never starts', e({ every: 'sometimes', status: 'never' }), 'unreadable'],
  ['a daily interval reads', e({ every: '1 day', status: 'ok', last_finished: ago(25 * H) }), 'due'],
  ['an interval counts from the last good run\'s start, not its finish', e({ every: '50 minutes', status: 'ok', last_started: ago(58 * 60e3), last_finished: ago(48 * 60e3) }), 'due'],
  ['a tick a few minutes short of the interval is forgiven', e({ every: '6 hours', status: 'ok', last_started: ago(6 * H - 4 * 60e3), last_finished: ago(5 * H) }), 'due'],
  // Edge cases of 2026-10-29: each failed before its fix.
  ['a failure waits from when it failed, not when it started', e({ status: 'failed', last_started: ago(7 * H), last_finished: ago(H), failures: 1 }), 'retry-wait'],
  ['a failure count that is not a number never runs', e({ status: 'failed', last_started: ago(7 * H), failures: 'abc' }), 'unreadable'],
  ['a claim stamped a year ahead is stale, not running forever', e({ status: 'running', last_started: new Date(NOW + 365 * D).toISOString(), failures: 0 }), 'due'],
  ['a run well inside its interval stays not due', e({ every: '6 hours', status: 'ok', last_started: ago(5 * H), last_finished: ago(5 * H - 600e3) }), 'not-due'],
];

let failed = 0;
for (const [what, entry, want, at = NOW] of CASES) {
  const got = due(entry, at).state;
  if (got !== want) {
    failed += 1;
    console.error(`FAIL ${what}: expected ${want}, got ${got}`);
  }
}

// Recording: a finish resets or counts failures; taking over a stale claim counts one.
const at = new Date(NOW);
function firstStepMatches() {
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const trigger = JSON.parse(readFileSync(`${root}/.claude/heartbeats.json`, 'utf8')).heartbeats.find((h) => h.name === 'orchestrator');
  const first = /^## (\d+)\./m.exec(readFileSync(`${root}/.claude/jobs/README.md`, 'utf8'))?.[1];
  return first !== undefined && new RegExp(`from step ${first}\\b`).test(trigger?.prompt ?? '');
}

// One launch spec for every runner (HBT-002, the developer 2026-10-20): the orchestrator's prompt is
// general (no repo, job or key named) and points at the README; the routine's prompt only points here.
function launchSpecGeneral() {
  const root = fileURLToPath(new URL('../../..', import.meta.url));
  const spec = JSON.parse(readFileSync(`${root}/.claude/heartbeats.json`, 'utf8'));
  const prompt = spec.heartbeats.find((h) => h.name === 'orchestrator')?.prompt ?? '';
  const pointer = spec.runners?.['claude-routine']?.prompt ?? '';
  const rules = /^## Rules of the run$/m.test(readFileSync(`${root}/.claude/jobs/README.md`, 'utf8'));
  return /\.claude\/jobs\/README\.md/.test(prompt) && !/dear-me|TELEGRAM|reminder|check-in/i.test(prompt) && /\.claude\/heartbeats\.json/.test(pointer) && /orchestrator/.test(pointer) && !/TELEGRAM|reminder/i.test(pointer) && rules;
}

// Round 44 of the git sync review, as a throwaway run: a job branch left unlanded when main moved
// twice holds `finish <job> ok` (exit 4) on the next run; parked, as README step 5.1 says, it does
// not, and its commit is still on a ref.
function parkedBranchFreesFinish() {
  const dir = makeTemp('hb-park-');
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
    const git = (cwd, ...a) => execFileSync('git', a, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    git(dir, 'init', '-q', '--bare', '-b', 'main', 'remote.git');
    const run = join(dir, 'run');
    git(dir, 'clone', '-q', 'remote.git', 'run');
    git(run, 'config', 'user.email', 't@example.invalid');
    git(run, 'config', 'user.name', 't');
    git(run, 'config', 'commit.gpgsign', 'false');
    git(run, 'config', 'core.hooksPath', '/dev/null');
    writeFileSync(join(run, 'a'), 'a\n');
    git(run, 'add', 'a');
    git(run, 'commit', '-q', '-m', 'init');
    git(run, 'push', '-q', 'origin', 'HEAD:main');
    git(run, 'fetch', '-q', 'origin', 'main');
    const branch = 'hb-privacy-check-202611020200';
    git(run, 'worktree', 'add', '-q', '-b', branch, join(dir, 'job'), 'origin/main');
    writeFileSync(join(dir, 'job', 'f'), 'x\n');
    git(join(dir, 'job'), 'add', 'f');
    git(join(dir, 'job'), 'commit', '-q', '-m', 'job');
    const tip = git(run, 'rev-parse', branch).trim();
    git(run, 'worktree', 'remove', join(dir, 'job'));
    const held = unlanded(run, 'privacy-check').join() === branch;
    git(run, 'branch', '-m', branch, `parked/${branch}`);
    const freed = unlanded(run, 'privacy-check').length === 0;
    const kept = git(run, 'rev-parse', `parked/${branch}`).trim() === tip;
    return held && freed && kept;
  } catch {
    return false;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const checks = [
  ['one launch spec: the orchestrator prompt is general, the routine only points to it, the README holds the rules', launchSpecGeneral()],
  ['an inline job keeps no run record, so none goes stale as "never ran" (2026-11-05)', (() => { const files = { reminders: '---\ninline: first\nevery: 1 hour\n---\n# r', 'safeguard-check': '---\nevery: 1 day\n---\n# s' }; const out = withoutInline({ run: { status: 'ok' }, reminders: { status: 'never' }, 'safeguard-check': { status: 'ok' } }, files); return !('reminders' in out) && out['safeguard-check']?.status === 'ok' && out.run?.status === 'ok' && !writeState(out, ['reminders', 'safeguard-check']).includes('"reminders"'); })()],
  ['one sender: the routine sends, BAXTER only as the backup, after a wait (HBT-002, A-177)', (() => { const root = fileURLToPath(new URL('../../..', import.meta.url)); const r = JSON.parse(readFileSync(`${root}/.claude/heartbeats.json`, 'utf8')).runners; return r['claude-routine']?.sends === true && r.baxter?.sends === 'backup' && r.baxter?.backup_after_min >= 75 && Object.values(r).filter((x) => x?.sends === true).length === 1; })()],
  ['the README calls a run stale at the threshold, not a guess', (() => { const root = fileURLToPath(new URL('../../..', import.meta.url)); const t = JSON.parse(readFileSync(`${root}/.claude/thresholds.json`, 'utf8')); const v = Object.values(t).flatMap((x) => Object.entries(x ?? {})).find(([k]) => k === 'heartbeat.staleClaim')?.[1]?.value; return new RegExp(`running\` for over ${v} hours`).test(readFileSync(`${root}/.claude/jobs/README.md`, 'utf8')); })()],
  ['the check-in makes its checkout before any step writes into it', (() => { const root = fileURLToPath(new URL('../../..', import.meta.url)); const c = readFileSync(`${root}/.claude/jobs/check-in.md`, 'utf8'); const made = c.indexOf('git worktree add temp/hb-ci'); return made > -1 && made < c.indexOf('\n2. **'); })()],
  // Round 43 of the git sync review: the reminders job removed its detached checkout after a
  // push refused twice, and its commit (the sent log of what went to her phone) was then on no ref.
  ['the reminders job keeps its checkout until its save lands, or goes out as a rescue', (() => { const root = fileURLToPath(new URL('../../..', import.meta.url)); const r = readFileSync(`${root}/.claude/jobs/reminders.md`, 'utf8'); const step = r.slice(r.indexOf('4. **Keep the mark'), r.indexOf('\n5. ')); return /HEAD:refs\/heads\/rescue\/main-/.test(step) && /Only once one of those pushes landed/.test(step) && /if neither did, leave it/.test(step) && !/and `git worktree remove temp\/hb-rem` from the root/.test(step) && /temp\/hb-rem-<HHMM>/.test(step); })()],
  // Round 43: a run that took `temp/<name>-<HHMM>` beside a kept checkout was told to remove
  // `temp/<name>` by name, the kept one; and the sweep's clean-up said "every checkout".
  ['a checkout kept for a save that never landed is never removed by a later step', (() => { const root = fileURLToPath(new URL('../../..', import.meta.url)); const c = readFileSync(`${root}/.claude/jobs/check-in.md`, 'utf8'); const r = readFileSync(`${root}/.claude/jobs/README.md`, 'utf8'); const clean = r.slice(r.indexOf('4. Remove'), r.indexOf('\n5. **The developer')); return !/`git worktree remove temp\/hb-ci`/.test(c) && /the checkout step 1 made/.test(c) && /made in steps 1 and 3/.test(clean) && /never removed/.test(clean); })()],
  // Round 44: a job branch not landed because main moved twice (step 4) was not parked, only a
  // clashed one, so every later `finish <job> ok` was refused (exit 4) until the job stopped.
  ['every job branch that did not land is parked, and so is an earlier run\'s that holds a finish', (() => { const root = fileURLToPath(new URL('../../..', import.meta.url)); const r = readFileSync(`${root}/.claude/jobs/README.md`, 'utf8'); const step = r.slice(r.indexOf('1. Every job, in **one** commit: `node .claude/hooks/lib/heartbeats.mjs finish'), r.indexOf('\n2. Only what needs the developer')); return /did not land,\s+whatever the reason/.test(step) && /main moved/.test(step) && /an earlier run's/.test(step) && /parked\/hb-<job>-<stamp>/.test(step) && !/A branch that clashed, once its/.test(step); })()],
  ['a parked job branch no longer holds the job\'s finish; an unlanded hb- one does', parkedBranchFreesFinish()],
  // Round 45: a run whose job had nothing to land met an earlier run's unlanded branch; the rule
  // parked that one only where this run's own had landed, so `finish ok` was refused and a job that
  // did its work was recorded failed.
  ['an earlier run\'s branch is parked when this run\'s job landed or had nothing to land', (() => { const root = fileURLToPath(new URL('../../..', import.meta.url)); const r = readFileSync(`${root}/.claude/jobs/README.md`, 'utf8'); const step = r.slice(r.indexOf('1. Every job, in **one** commit: `node .claude/hooks/lib/heartbeats.mjs finish'), r.indexOf('\n2. Only what needs the developer')); const earlier = step.slice(step.indexOf('Where the branch `finish` names')); return /an earlier run's/.test(earlier) && /landed,?\s+or\s+(it\s+)?had\s+nothing\s+to\s+land/.test(earlier.slice(0, earlier.indexOf('park that one'))); })()],
  ['ok resets failures', record(e({ status: 'running', failures: 2 }), 'finish', 'ok', at).failures === 0],
  ['failed counts one', record(e({ status: 'running', failures: 1 }), 'finish', 'failed', at).failures === 2],
  ['a claim marks running', record(e({ status: 'ok' }), 'claim', undefined, at).status === 'running'],
  ['taking a stale claim counts it', record(e({ status: 'running', failures: 1 }), 'claim', undefined, at).failures === 2],
  // BAXTER's trigger entry (a schedule, no every) is not a heartbeat (2026-10-07).
  ['a trigger entry is not read as a heartbeat', heartbeatsOf({ heartbeats: [{ name: 't', schedule: { type: 'every', minutes: 1 } }, e({})] }).length === 1],
  // HBT-002: the check-in is GitHub's to start, so BAXTER's orchestrator never lists it (2026-10-09).
  ['BAXTER runs every job; the cloud only those marked anywhere (HBT-011)', orchestrated(e({}), 'baxter') && orchestrated(e({ runs: 'local' }), 'baxter') && orchestrated(e({ runs: 'anywhere' }), 'cloud') && !orchestrated(e({ runs: 'local' }), 'cloud') && !orchestrated(e({}), 'cloud')],
  ['only the check-in may run anywhere; the upkeep stays local', (() => { const reg = heartbeatsOf(readRegistry(fileURLToPath(new URL('../../..', import.meta.url)))); return reg.filter((h) => h.runs === 'anywhere').map((h) => h.name).sort().join() === 'check-in'; })()],
  ['every claim and finish names its runner', record(e({}), 'claim', null, new Date(), 'cloud').last_runner === 'cloud' && record(e({}), 'finish', 'ok', new Date(), 'baxter').last_runner === 'baxter'],
  ['the runner is read from where it runs', runnerName({ GITHUB_ACTIONS: 'true', CLAUDE_CODE_REMOTE: 'true' }) === 'cloud' && runnerName({ CLAUDE_CODE_REMOTE: 'true' }) === 'cc-routine' && runnerName({}) === 'baxter' && runnerName({ CLAUDE_CODE_REMOTE: 'true' }, { byHand: true }) === 'by-hand'],
  ['DEAR_RUNNER names the runner over where it runs', runnerName({ DEAR_RUNNER: 'cloud' }) === 'cloud' && runnerName({ DEAR_RUNNER: 'baxter', CLAUDE_CODE_REMOTE: 'true' }) === 'baxter'],
  ['the cloud stands down for the Routine as for BAXTER', !cloudMayRun({ last_finished: new Date(Date.now() - 3600e3).toISOString(), last_runner: 'cc-routine' })],
  ['the cloud stands down while BAXTER ran in the last two hours', !cloudMayRun({ last_finished: new Date(Date.now() - 3600e3).toISOString(), last_runner: 'baxter' }) && cloudMayRun({ last_finished: new Date(Date.now() - 3 * 3600e3).toISOString(), last_runner: 'baxter' }) && cloudMayRun({ last_finished: new Date().toISOString(), last_runner: 'cloud' })],
  ['the registry\'s heartbeats all have a readable every', heartbeatsOf(readRegistry(fileURLToPath(new URL('../../..', import.meta.url)))).every((h) => due(h).state !== 'unreadable')],
  // HBT-008: a stopped job stays stopped for the schedule, and a run started by
  // hand can still claim it, since only a run that succeeds restarts it
  // (spec-health, stopped 2026-10-14, could not be claimed to be repaired).
  ['a stopped job is not claimed by the schedule', !claimable(e({ status: 'failed', last_started: ago(2 * D), failures: 3 }), NOW)],
  ['a stopped job is claimed by a run started by hand', claimable(e({ status: 'failed', last_started: ago(2 * D), failures: 3 }), NOW, true)],
  ['a live claim is never taken, even by hand', !claimable(e({ status: 'running', last_started: ago(H) }), NOW, true)],
  ['a job that ran recently can be run by hand', claimable(e({ status: 'ok', last_finished: ago(H) }), NOW, true) && !claimable(e({ status: 'ok', last_finished: ago(H) }), NOW)],
  // The trigger starts the orchestrator at its first step: it said "from step 1" after a
  // step 0 was added, so every run skipped the cheap check (2026-10-08).
  ['the trigger starts the orchestrator at its first step', firstStepMatches()],
  // HBT-003: a job with a cron comes due on its clock, not `every` after a run by hand (2026-10-18).
  ['a weekly cron job run by hand on Saturday is still due on Sunday at its hour', due({ every: '7 days', cron: '0 10 * * 0', timezone: 'Asia/Singapore', status: 'ok', failures: 0, last_finished: '2026-10-17T12:11:00Z' }, Date.parse('2026-10-18T02:06:00Z')).due],
  ['and not before its hour', !due({ every: '7 days', cron: '0 10 * * 0', timezone: 'Asia/Singapore', status: 'ok', failures: 0, last_finished: '2026-10-17T12:11:00Z' }, Date.parse('2026-10-18T01:00:00Z')).due],
  ['and not again once it has run since', !due({ every: '7 days', cron: '0 10 * * 0', timezone: 'Asia/Singapore', status: 'ok', failures: 0, last_finished: '2026-10-18T02:20:00Z' }, Date.parse('2026-10-18T05:00:00Z')).due],
];
// Edge case of 2026-10-29: an unreadable job (thresholds missing, a file with no
// frontmatter) made `due` print nothing, so the run read "nothing was due" forever.
// The CLI runs in a throwaway copy holding only the lib, with no thresholds.json.
function dueCliNamesUnreadable() {
  const dir = makeTemp('dear-hb-due-');
  try {
    const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
    cpSync(join(repoRoot, '.claude', 'hooks', 'lib'), join(dir, '.claude', 'hooks', 'lib'), { recursive: true });
    mkdirSync(join(dir, '.claude', 'jobs'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'jobs', 'README.md'), '---\njobs: broken\nevery: 1 hour\n---\n');
    writeFileSync(join(dir, '.claude', 'jobs', 'broken.md'), 'no frontmatter here\n');
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
    execFileSync('git', ['init', '-q'], { cwd: dir, env });
    const run = spawnSync(process.execPath, [join(dir, '.claude', 'hooks', 'lib', 'heartbeats.mjs'), 'due'], { cwd: dir, env: { ...env, DEAR_RUNNER: 'baxter' }, encoding: 'utf8', timeout: 30000 });
    return run.status === 1 && run.stdout.trim() === '' && /^unreadable: broken: /m.test(run.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const sorted = dueNow({ run: {}, jobs: [e({ name: 'a', status: 'never' }), e({ name: 'b', every: 'sometimes' }), e({ name: 'c', status: 'never', inline: 'first' })] }, 'baxter', NOW);
checks.push(
  ['dueNow lists the due jobs and names each unreadable one with why', sorted.due.join() === 'a' && sorted.unreadable.length === 1 && sorted.unreadable[0].name === 'b' && /every/.test(sorted.unreadable[0].why)],
  ['the due command prints an unreadable job on stderr and exits 1, never silence', dueCliNamesUnreadable()],
  ['the README says exit 1 from due is a broken step, not nothing due', /`due` exits 1[^.]*broken/.test(readFileSync(fileURLToPath(new URL('../../jobs/README.md', import.meta.url)), 'utf8'))],
);

// Round 3 of the set-up edge cases. B8: a whole-run claim stamped ahead of the clock is dead.
checks.push(
  ['a run claim stamped two days ahead is free, not standing every sweep down (B8)', runFree({ status: 'running', last_started: new Date(NOW + 2 * D).toISOString() }, NOW)],
  ['a fresh run claim still holds', !runFree({ status: 'running', last_started: ago(H) }, NOW)],
  ['a run claim past the stale limit is free', runFree({ status: 'running', last_started: ago(STALE_MS + H) }, NOW)],
);
// Set-up round 3, D1: run records live in .claude/jobs/state.json, the copy's own,
// so an update or going back over one never meets a heartbeat's edit of a job file.
{
  const ran = { status: 'ok', last_started: ago(2 * H), last_finished: ago(H), failures: 0, last_runner: 'cc-routine' };
  const front = { emoji: 'x', every: '1 day', status: 'never', failures: 0 };
  checks.push(
    ['the state file\'s record stands over a file laid down never run (D1)', reconcile(front, ran).status === 'ok' && reconcile(front, ran).every === '1 day'],
    ['a later record written into the file by older code stands (D1)', reconcile({ ...front, status: 'failed', last_started: ago(0), last_finished: ago(0), failures: 1 }, ran).status === 'failed'],
    ['with no state, the file\'s own record is read (D1)', reconcile(front, undefined).status === 'never'],
    ['the state file round-trips, one line per entry, run first (D1)', (() => {
      const text = writeState({ b: ran, run: ran, a: ran }, ['a', 'b']);
      const back = parseState(text);
      return text.split('\n').length === 7 && /^ {2}"run"/.test(text.split('\n')[2]) && back.a.status === 'ok' && !('_what' in back);
    })()],
    ['no state file reads as no records; an unreadable one throws (D1)', Object.keys(parseState(null)).length === 0 && (() => { try { parseState('{ not json'); return false; } catch { return true; } })()],
    ['migrate moves each record over and strips only its lines (D1)', (() => {
      const { state, stripped } = migrate({ x: '---\nemoji: x\nstatus: ok\nlast_finished: 2026-10-01T09:00:00.000Z\nfailures: 0\n---\n# X\nstatus: in the body stays\n', y: '---\nemoji: y\n---\n# Y\n' }, {});
      return state.x.status === 'ok' && stripped.x === '---\nemoji: x\n---\n# X\nstatus: in the body stays\n' && !('y' in stripped) && !('y' in state);
    })()],
    ['migrate keeps a file\'s line endings (D1)', migrate({ x: '---\r\nemoji: x\r\nstatus: ok\r\n---\r\n# X\r\n' }, {}).stripped.x === '---\r\nemoji: x\r\n---\r\n# X\r\n'],
  );
}

// D17: a developer's job stands down in a copy with no dev/, and runs where dev/ is.
{
  const reg = { run: {}, jobs: [e({ name: 'mine', status: 'never' }), e({ name: 'devs', status: 'never', gate: 'dev' })] };
  checks.push(
    ['a gate: dev job is not due in a copy with no dev/ (D17)', dueNow(reg, 'cc-routine', NOW, { dev: false }).due.join() === 'mine'],
    ['a gate: dev job runs where dev/ is', dueNow(reg, 'cc-routine', NOW, { dev: true }).due.join() === 'mine,devs'],
  );
  const shipped = readRegistry(fileURLToPath(new URL('../../..', import.meta.url)));
  const gated = shipped.jobs.filter(devOnly).map((j) => j.name).sort().join();
  checks.push(['every job that writes dev/ is gated; her check-in, reminders and safeguards are not (D17)', gated === 'code-maintenance,dev-hygiene,dialogue-loop,for-you-week,heartbeat-doctor,restore-drill']);
  const dir = makeTemp('hb-gate-');
  try {
    const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
    cpSync(join(repoRoot, '.claude', 'hooks', 'lib'), join(dir, '.claude', 'hooks', 'lib'), { recursive: true });
    cpSync(join(repoRoot, '.claude', 'thresholds.json'), join(dir, '.claude', 'thresholds.json'));
    mkdirSync(join(dir, '.claude', 'jobs'), { recursive: true });
    writeFileSync(join(dir, '.claude', 'jobs', 'README.md'), '---\njobs: mine, devs\n---\n');
    writeFileSync(join(dir, '.claude', 'jobs', 'mine.md'), '---\nevery: 1 hour\nstatus: never\n---\n');
    writeFileSync(join(dir, '.claude', 'jobs', 'devs.md'), '---\ngate: dev\nevery: 1 hour\nstatus: never\n---\n');
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
    execFileSync('git', ['init', '-q'], { cwd: dir, env });
    const cli = (...a) => spawnSync(process.execPath, [join(dir, '.claude', 'hooks', 'lib', 'heartbeats.mjs'), ...a], { cwd: dir, env: { ...env, DEAR_RUNNER: 'cc-routine' }, encoding: 'utf8', timeout: 30000 });
    checks.push(['her copy\'s due command leaves the developer\'s job out (D17)', cli('due').stdout.trim() === 'mine']);
    const claimed = cli('claim', 'devs', '--by-hand');
    checks.push(['her copy never claims the developer\'s job, even by hand (D17)', claimed.status === 3 && /gate: dev/.test(claimed.stderr)]);
    mkdirSync(join(dir, 'dev'));
    checks.push(['the developer\'s copy lists it', cli('due').stdout.trim().split('\n').join() === 'mine,devs']);
    // S26: main shows both jobs ran a minute ago, while this folder's copy still
    // reads never; `due` follows main, so no run starts for the claim to stand down.
    const ran = `---\nevery: 1 hour\nstatus: ok\nlast_started: ${new Date(Date.now() - 120e3).toISOString()}\nlast_finished: ${new Date(Date.now() - 60e3).toISOString()}\nfailures: 0\n---\n`;
    writeFileSync(join(dir, '.claude', 'jobs', 'mine.md'), ran);
    writeFileSync(join(dir, '.claude', 'jobs', 'devs.md'), ran.replace('---\n', '---\ngate: dev\n'));
    const g = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: dir, env, encoding: 'utf8' }).trim();
    g('add', '.claude/jobs');
    g('commit', '-q', '-m', 'ran');
    g('update-ref', 'refs/remotes/origin/main', 'HEAD');
    writeFileSync(join(dir, '.claude', 'jobs', 'mine.md'), '---\nevery: 1 hour\nstatus: never\n---\n');
    checks.push(['due reads the records as origin/main holds them, not a lagging folder (S26)', cli('due').stdout.trim() === '']);
    g('update-ref', '-d', 'refs/remotes/origin/main');
    checks.push(['and the folder\'s own copy where there is no origin/main', cli('due').stdout.trim() === 'mine']);
    // D1: the same, with the records moved to state.json and the job files bare.
    writeFileSync(join(dir, '.claude', 'jobs', 'mine.md'), '---\nevery: 1 hour\n---\n');
    writeFileSync(join(dir, '.claude', 'jobs', 'devs.md'), '---\ngate: dev\nevery: 1 hour\n---\n');
    const was = { status: 'ok', last_started: new Date(Date.now() - 120e3).toISOString(), last_finished: new Date(Date.now() - 60e3).toISOString(), failures: 0 };
    writeFileSync(join(dir, '.claude', 'jobs', 'state.json'), writeState({ mine: was, devs: was }));
    checks.push(['due reads a job\'s run from state.json (D1)', cli('due').stdout.trim() === '']);
    writeFileSync(join(dir, '.claude', 'jobs', 'state.json'), writeState({ devs: was }));
    checks.push(['a job with no line in state.json has never run (D1)', cli('due').stdout.trim() === 'mine']);
    writeFileSync(join(dir, '.claude', 'jobs', 'state.json'), '{ broken');
    const broken = cli('due');
    checks.push(['an unreadable state file is a broken step, never an empty list (D1)', broken.status !== 0 && /state\.json/.test(broken.stderr)]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

for (const [what, ok] of checks) {
  if (!ok) {
    failed += 1;
    console.error(`FAIL ${what}`);
  }
}

if (failed) process.exit(1);
console.log(`heartbeat tests: ${CASES.length + checks.length} cases pass`);
