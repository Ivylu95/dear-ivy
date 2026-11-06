// The heartbeat tracker: when a heartbeat is due, and recording its runs.
//
// HBT-006, "A heartbeat that is due runs, whether or not anything schedules it."
// HBT-007, "A heartbeat runs apart from her conversation, and never twice at once."
// HBT-008, "A heartbeat that failed is known to have failed, and is retried only
// so often."
//
// Each job in .claude/jobs/, and the run itself, has a run record in
// .claude/jobs/state.json: status (never, running, ok, failed), last_started,
// last_finished, failures and last_runner. The job files hold only what ships
// (the prompt, its cadence, where it runs). `due` is pure and tested by test-heartbeats.mjs. Run directly, it
// records from its own checkout; <name> is a job, or `run` for the whole run:
//
//   node .claude/hooks/lib/heartbeats.mjs claim  <name>        exit 3: claimed elsewhere
//   node .claude/hooks/lib/heartbeats.mjs claim  <name> --by-hand   a person's run: also a stopped job
//   node .claude/hooks/lib/heartbeats.mjs finish <name> ok|failed
//   node .claude/hooks/lib/heartbeats.mjs due                  the due jobs, one name a line
//
// HBT-011, "The same heartbeats run on whichever scheduler a copy has, and every run
// records which one ran it." DEAR_RUNNER names the runner: `baxter` (the default, a
// machine of the developer's), `cc-routine` (the hourly Claude routine) or `cloud`
// (GitHub's heartbeats.yml, started by hand). Every claim and finish writes it as `last_runner` and
// into its commit's title; the cloud runs only jobs marked `runs: anywhere`.
//
// A claim is a commit pushed to main, built on main's tip after re-reading it:
// of two sessions, the second finds the entry running and stands down (HBT-007).
// Run it only in a checkout of its own, never the tree her conversation saves
// from: it moves that checkout to main's tip.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { threshold } from './thresholds.mjs';
import { forgetRefused } from './refused-staged.mjs';
import { RECORD_KEYS, withoutRecord } from './hazard-log.mjs';

// HBT-008 states all three (FND-009). Unreadable, they are null, and nothing is
// started: a heartbeat that cannot tell a dead claim from a live one waits.
const hours = (key) => (threshold(key, 'hours') ?? NaN) * 3600e3;
export const STALE_MS = hours('heartbeat.staleClaim'); // a running claim older than this failed
export const RETRY_MS = hours('heartbeat.retryAfter'); // a failed run waits this long to retry
export const MAX_FAILURES = threshold('heartbeat.maxFailures', 'failures'); // then it stops starting itself
export const GRACE_MS = (threshold('heartbeat.dueGrace', 'minutes') ?? NaN) * 60e3; // a fixed tick's drift, forgiven

/**
 * Who is running this, read from where it runs unless DEAR_RUNNER names it: GitHub
 * Actions is `cloud`; a Claude Code cloud session, which is what the hourly Routine
 * starts, is `cc-routine`; a person's run by hand is `by-hand`; anything else, a
 * machine of the developer's, is `baxter`. Until 2026-10-17 every non-GitHub run
 * signed `baxter`, so the Routine's runs read as BAXTER's.
 */
export function runnerName(env = process.env, { byHand = false } = {}) {
  if (['cloud', 'cc-routine', 'baxter', 'by-hand'].includes(env.DEAR_RUNNER)) return env.DEAR_RUNNER;
  if (env.GITHUB_ACTIONS === 'true') return 'cloud';
  if (byHand) return 'by-hand';
  if (env.CLAUDE_CODE_REMOTE === 'true') return 'cc-routine';
  return 'baxter';
}

/** HBT-011 design 3: BAXTER counts as alive while a run of its own finished, or started, this recently. */
export const BAXTER_QUIET_MS = 2 * 3600e3;

/** Whether the cloud may run now: no run by BAXTER or the Routine (any runner but `cloud`) in the last two hours. */
export function cloudMayRun(run, now = Date.now()) {
  if (run?.last_runner === 'cloud') return true;
  const latest = Math.max(Date.parse(run?.last_finished ?? '') || 0, Date.parse(run?.last_started ?? '') || 0);
  return now - latest >= BAXTER_QUIET_MS;
}

const UNITS = { minute: 60e3, hour: 3600e3, day: 86400e3, week: 7 * 86400e3 };

/** "7 days", "1 day", "12 hours" → milliseconds; null when unreadable. */
export function intervalMs(every) {
  const m = /^\s*(\d+)\s*(minute|hour|day|week)s?\s*$/i.exec(String(every ?? ''));
  return m ? Number(m[1]) * UNITS[m[2].toLowerCase()] : null;
}

const time = (iso) => {
  const t = Date.parse(iso ?? '');
  return Number.isNaN(t) ? null : t;
};

// A job's own clock, read here rather than from the reminders engine, so this file
// stays whole on its own (the claim runs it from a bare checkout). Each field is
// `*`, a number, or a comma list of numbers; day of week 0 or 7 is Sunday.
const field = (f, v) => f === '*' || f.split(',').some((x) => Number(x) === v || (v === 0 && Number(x) === 7));
const clocks = new Map();
const wallClock = (ms, timeZone) => {
  if (!clocks.has(timeZone)) clocks.set(timeZone, new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short' }));
  const p = Object.fromEntries(clocks.get(timeZone).formatToParts(new Date(ms)).map(({ type, value }) => [type, value]));
  return { M: +p.minute, H: +p.hour % 24, d: +p.day, mo: +p.month, dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
};

/** The latest minute at or before `now` that `cron` names in `timeZone`, looking back eight days; null if none or unreadable. */
export function lastSlot(cron, timeZone = 'UTC', now = Date.now()) {
  const f = String(cron ?? '').trim().split(/\s+/);
  if (f.length !== 5 || f.some((x) => !/^(\*|\d+(,\d+)*)$/.test(x))) return null;
  try { wallClock(now, timeZone); } catch { return null; }
  for (let ms = Math.floor(now / 60e3) * 60e3; ms > now - 8 * 86400e3; ms -= 60e3) {
    const p = wallClock(ms, timeZone);
    if (field(f[0], p.M) && field(f[1], p.H) && field(f[2], p.d) && field(f[3], p.mo) && field(f[4], p.dow)) return ms;
  }
  return null;
}

/**
 * Whether an entry should start now, and why. `state` is one of:
 * due · not-due · running · retry-wait · capped · unreadable.
 */
export function due(entry, now = Date.now()) {
  const every = intervalMs(entry?.every);
  if (!every) return { due: false, state: 'unreadable', why: 'no readable "every"' };
  if (!STALE_MS || !RETRY_MS || !MAX_FAILURES || !GRACE_MS) return { due: false, state: 'unreadable', why: 'its thresholds in .claude/thresholds.json' };
  const status = entry.status ?? 'never';
  const failures = Number(entry.failures ?? 0);
  // A count that is not one would switch the cap off for good (NaN is never >= the cap).
  if (!Number.isInteger(failures) || failures < 0) return { due: false, state: 'unreadable', why: 'its failures is not a count' };
  const started = time(entry.last_started);
  const finished = time(entry.last_finished);

  // A claim still marked running: in progress, or dead if older than STALE_MS.
  let failed = status === 'failed';
  let fails = failures;
  if (status === 'running') {
    // A claim stamped ahead of the clock (a skewed runner) would otherwise never go stale.
    if (started !== null && now - started < STALE_MS && started - now <= GRACE_MS) return { due: false, state: 'running', why: 'a run is in progress' };
    failed = true;
    fails = failures + 1;
  }
  if (failed) {
    if (fails >= MAX_FAILURES) return { due: false, state: 'capped', why: `${fails} failures in a row` };
    // HBT-008 design 3: six hours after it failed, so from a reported failure's finish;
    // counted from its start, a run that took four hours retried two hours after failing.
    const since = status === 'failed' ? (finished ?? started) : (started ?? finished);
    // A stale claim has already waited out STALE_MS; only a reported failure waits RETRY_MS.
    if (status === 'failed' && since !== null && now - since < RETRY_MS) return { due: false, state: 'retry-wait', why: 'failed, waiting to retry' };
    return { due: true, state: 'due', why: status === 'running' ? 'a claim went stale' : 'failed, retrying' };
  }
  // A job with a `cron` that has never run waits for its first scheduled time, not the next
  // sweep: night-loops, new on 2026-11-05 at 21:50, would have sent its roster that morning.
  // Its latest slot counts only when it passed within FIRST_SLOT_MS, about two sweeps.
  if ((status === 'never' || finished === null) && entry.cron) {
    const slot = lastSlot(entry.cron, entry.timezone, now);
    if (slot !== null && now - slot > FIRST_SLOT_MS) return { due: false, state: 'not-due', why: 'waiting for its first scheduled time' };
  }
  if (status === 'never' || finished === null) return { due: true, state: 'due', why: 'never run' };
  // HBT-003, "A heartbeat fires at the time its purpose needs, in her timezone": a job
  // with a `cron` is due once its latest slot has passed since its last good run, not
  // `every` after that run (2026-10-18: a check-in run by hand on a Saturday evening
  // pushed Sunday's 10 am to the next Saturday).
  if (entry.cron) {
    const slot = lastSlot(entry.cron, entry.timezone, now);
    if (slot !== null) return finished < slot ? { due: true, state: 'due', why: 'its scheduled time has come' } : { due: false, state: 'not-due', why: 'ran since its scheduled time' };
  }
  // HBT-006 design 1: counted from the last good run's start, less GRACE_MS. Counted
  // from its finish, a 50-minute job on an hourly tick came due two minutes after
  // the next tick and ran every other hour (2026-10-18).
  const since = started !== null && started <= finished ? started : finished;
  if (now - since >= every - GRACE_MS) return { due: true, state: 'due', why: `last good run over ${entry.every} ago` };
  return { due: false, state: 'not-due', why: 'ran recently' };
}

/**
 * Whether a claim may take the entry now. A scheduled claim takes only a due
 * entry. A run a person starts by hand takes any entry no live claim holds:
 * HBT-008 stops a job after repeated failures "until a run succeeds", and the
 * only run that can is one started by hand, which the due test alone refused
 * (spec-health, stopped 2026-10-14, could not be claimed to be repaired).
 */
export function claimable(entry, now = Date.now(), byHand = false) {
  const d = due(entry, now);
  if (d.due) return true;
  return byHand && !['running', 'unreadable'].includes(d.state);
}

// HBT-002, "One schedule starts the heartbeat, and each job's instructions live
// in one prompt that only that run starts." Two files, one job each:
// .claude/heartbeats.json is BAXTER's manifest, one entry with a `schedule`
// that starts .claude/jobs/README.md every 30 minutes (BAXTER never writes it: "stamp_manifest": false);
// .claude/jobs/ holds the jobs and their records, which this tracker reads and
// commits. They were one file until 2026-10-07, so the sweep's stamps and the
// tracker's commits landed in the same lines. An entry with a `schedule` is a
// trigger, never a job, wherever it is found.
export const isTrigger = (entry) => Boolean(entry?.schedule);
export const heartbeatsOf = (reg) => (reg?.jobs ?? reg?.heartbeats ?? []).filter((h) => !isTrigger(h));

/**
 * A job marked `gate: dev` is the developer's: it reads or writes dev/ (the for-you list, the
 * specs, the dialogue), which a copy made for someone else does not carry. There it
 * stands down, so it never runs on her subscription to write a file her copy lacks
 * (round 3, D17). A copy with dev/ runs it as before.
 */
export const devOnly = (entry) => entry?.gate === 'dev';

/**
 * What the `due` command reports: the jobs this runner starts now, and every job whose
 * state could not be read, with why. An unreadable job is never silence: the run read
 * an empty list as "nothing was due" for good (edge-case run of 2026-10-29).
 */
export function dueNow(reg, runner = 'baxter', now = Date.now(), { dev = true } = {}) {
  const out = { due: [], unreadable: [] };
  for (const h of heartbeatsOf(reg)) {
    if (h.inline || !orchestrated(h, runner) || (!dev && devOnly(h))) continue;
    const d = due(h, now);
    if (d.state === 'unreadable') out.unreadable.push({ name: h.name, why: d.why });
    else if (d.due) out.due.push(h.name);
  }
  return out;
}

// HBT-009: the whole run claims too, so a second call of the heartbeat while
// one runs stands down before it starts a single job.
export const RUN = 'run';
/** How long after its scheduled time a never-run cron job still counts as due: two hourly sweeps. */
export const FIRST_SLOT_MS = 2 * 60 * 60 * 1000;
/** Whether a new run may start: none is marked running, or that claim went stale. */
// With no stale threshold readable, nothing is started (as `due` holds): `now - t < NaN` is false.
// A claim stamped ahead of the clock is dead too, as `due` holds: one stamped two days
// ahead once stood every sweep down, reminders included, for 49 hours (round 3, B8).
export const runFree = (run, now = Date.now()) => {
  if (!STALE_MS || !GRACE_MS) return false;
  if (run?.status !== 'running') return true;
  const started = Date.parse(run.last_started ?? '') || 0;
  return !(now - started < STALE_MS && started - now <= GRACE_MS);
};

// Each job's prompt and settings live in its own <name>.md, the run's (with
// `jobs`, the order jobs run in) in README.md's frontmatter: flat `key: value`
// lines, read by a person where the prompt is. The run records live apart, in
// one state file, the copy's own: kept in the job files' frontmatter until
// 2026-11-02 (the developer's choice of 2026-10-08), every heartbeat rewrote the
// files a release ships, so an update and going back over one met each run's
// edits there (set-up round 3, D1). A copy whose job files still carry a record
// is moved over by its next claim or finish (`migrate`).
export const JOBS_DIR = '.claude/jobs';
export const ENTRY = 'README.md';
export const STATE_FILE = `${JOBS_DIR}/state.json`;
const jobFile = (name) => (name === RUN ? ENTRY : `${name}.md`);
const relPath = (name) => `${JOBS_DIR}/${jobFile(name)}`;
export const registryPath = (root) => join(root, ...JOBS_DIR.split('/'), ENTRY);

const STATE_WHAT = 'Each heartbeat job\'s run record, and the run\'s ("run"): written only by .claude/hooks/lib/heartbeats.mjs claim|finish; this copy\'s own, never shipped or overwritten by a release (HBT-008). The inline jobs (reminders, check-ins) keep no line here: what they sent is in her sent logs, and the developer\'s report names each send, late one and miss.';

/** The run record fields of a parsed frontmatter (or entry), and nothing else. */
export const recordOf = (fields) => Object.fromEntries(RECORD_KEYS.filter((k) => fields?.[k] !== undefined).map((k) => [k, fields[k]]));
const settingsOf = (fields) => Object.fromEntries(Object.entries(fields ?? {}).filter(([k]) => !RECORD_KEYS.includes(k)));
const latest = (r) => Math.max(time(r?.last_started) ?? -Infinity, time(r?.last_finished) ?? -Infinity);

/**
 * One entry as it stands: its file's settings and its run record. The record is
 * the state file's, unless the file's frontmatter still carries one stamped
 * later (a copy not yet moved over, or a run of the code before the move); a
 * frontmatter `status: never` with no times never outranks a recorded run.
 */
export function reconcile(front, saved) {
  const legacy = recordOf(front);
  const record = !saved ? legacy : Object.keys(legacy).length && latest(legacy) > latest(saved) ? legacy : recordOf(saved);
  return { ...settingsOf(front), ...record };
}

/** The state file's text as { name: record }; {} when there is none. Unreadable JSON throws. */
export function parseState(text) {
  if (text === null || text === undefined || !String(text).trim()) return {};
  let state;
  try {
    state = JSON.parse(text);
  } catch {
    throw new Error(`${STATE_FILE} is not readable JSON`);
  }
  if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error(`${STATE_FILE} is not an object of run records`);
  const { _what, ...records } = state;
  return records;
}

/**
 * The state without the inline jobs' lines (reminders, check-ins): the orchestrator runs them
 * itself every sweep, never through claim|finish, so a line for one could only go stale and read
 * as "never ran" (2026-11-05: reminders "never", check-ins last on 18 Oct). Their record is the
 * sent logs, and the developer's report. `files` is { name: job file text }.
 */
export function withoutInline(state, files) {
  const out = { ...state };
  for (const [name, text] of Object.entries(files ?? {})) if (text && parseFront(text).record?.inline) delete out[name];
  return out;
}

/** The state file's text: one line per entry, the run first, then in `order`, so two runs' commits touch separate lines. */
export function writeState(state, order = []) {
  const names = [...new Set([RUN, ...order, ...Object.keys(state)])].filter((n) => state[n] && n !== '_what');
  const lines = [`  "_what": ${JSON.stringify(STATE_WHAT)}`, ...names.map((n) => `  ${JSON.stringify(n)}: ${JSON.stringify(recordOf(state[n]))}`)];
  return `{\n${lines.join(',\n')}\n}\n`;
}

/** A job file with its run record taken out of the frontmatter, line endings kept. */
export function stripRecord(text) {
  const t = String(text ?? '');
  const out = withoutRecord(t);
  return t.includes('\r\n') ? out.replace(/\n/g, '\r\n') : out;
}

/**
 * The one migration: every file in `files` ({ name: text }) whose frontmatter
 * still carries a run record gives it to `state` (reconciled, so the later one
 * stands) and is returned without it. Pure, for the tests; `update` commits it.
 */
export function migrate(files, state) {
  const next = { ...state };
  const stripped = {};
  for (const [name, text] of Object.entries(files)) {
    if (text === null || text === undefined) continue;
    const { record: front } = parseFront(text);
    if (!Object.keys(recordOf(front)).length) continue;
    next[name] = recordOf(reconcile(front, next[name]));
    stripped[name] = stripRecord(text);
  }
  return { state: next, stripped };
}

/** One entry's run record as this folder holds it: its file and the state file, reconciled. Throws when the job file is missing. */
export function jobRecord(root, name) {
  const front = parseFront(readFileSync(join(root, ...relPath(name).split('/')), 'utf8')).record;
  const statePath = join(root, ...STATE_FILE.split('/'));
  const state = parseState(existsSync(statePath) ? readFileSync(statePath, 'utf8') : null);
  return reconcile(front, state[name]);
}

/** { record, body } from a file's text: the frontmatter as an object, the rest as written. */
export function parseFront(text) {
  const t = String(text ?? '').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(t);
  if (!m) return { record: {}, body: t };
  const record = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const v = kv[2].trim();
    record[kv[1]] = v === 'null' || v === '' ? null : /^-?\d+$/.test(v) ? Number(v) : v;
  }
  return { record, body: t.slice(m[0].length) };
}

/** The same file with its frontmatter replaced by `record`, its body untouched. */
export function writeFront(record, body) {
  const lines = Object.entries(record).map(([k, v]) => `${k}: ${v === null || v === undefined ? 'null' : v}`);
  return ['---', ...lines, '---', ''].join('\n') + body;
}

const jobsOf = (runRecord) => String(runRecord.jobs ?? '').split(',').map((n) => n.trim()).filter(Boolean);
const entryOf = (name, record) => ({ name, prompt: relPath(name), ...record });

// HBT-011 design 1: a job marked `runs: local` runs only on BAXTER, so the cloud never
// spends GitHub minutes on the heavy developer upkeep; `runs: anywhere` runs on either.
// A job with no mark is local, the safe side for the minutes.
export const orchestrated = (entry, runner = 'baxter') => runner !== 'cloud' || entry.runs === 'anywhere';

/**
 * { run, jobs: [entry] } as it stands on disk, in README.md's order; with `ref`
 * (origin/main, as `due` passes), as that commit holds it, each file falling back
 * to the disk where the ref lacks it. A folder's records can only lag main's, and
 * `due` read from the disk started runs the claim then found nothing to do for:
 * a checkout, an install and an empty claim and finish (set-up scenario S26).
 */
export function readRegistry(root, ref = '') {
  const fromRef = (rel) => {
    if (!ref) return null;
    try {
      return git(root, ['show', `${ref}:${rel}`]);
    } catch {
      return null;
    }
  };
  const statePath = join(root, ...STATE_FILE.split('/'));
  const state = parseState(fromRef(STATE_FILE) ?? (existsSync(statePath) ? readFileSync(statePath, 'utf8') : null));
  const read = (name) => reconcile(parseFront(fromRef(relPath(name)) ?? readFileSync(join(root, ...relPath(name).split('/')), 'utf8')).record, state[name]);
  const run = read(RUN);
  return { run, jobs: jobsOf(run).map((name) => entryOf(name, read(name))) };
}

/** Apply a claim or a finish to one entry; pure, for the tests. */
export function record(entry, event, outcome, now = new Date(), runner = 'baxter') {
  const at = now.toISOString();
  if (event === 'claim') {
    // A stale claim being taken over was a failure: count it.
    const stale = entry.status === 'running';
    return { ...entry, status: 'running', last_started: at, failures: Number(entry.failures ?? 0) + (stale ? 1 : 0), last_runner: runner };
  }
  const ok = outcome === 'ok';
  return { ...entry, status: ok ? 'ok' : 'failed', last_finished: at, failures: ok ? 0 : Number(entry.failures ?? 0) + 1, last_runner: runner };
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * The job's own branches (`hb-<job>-…`) whose tip main does not hold. A job is
 * recorded ok only once its work is on main: the first spec-health run
 * (2026-10-08) pushed its review branch instead, recorded ok, and main never
 * had its verdicts. Read against origin/main as just fetched.
 */
export function unlanded(root, name) {
  const refs = git(root, ['for-each-ref', '--format=%(refname:short)', `refs/heads/hb-${name}-*`]).split('\n').map((s) => s.trim()).filter(Boolean);
  return refs.filter((b) => {
    try {
      git(root, ['merge-base', '--is-ancestor', b, 'origin/main']);
      return false;
    } catch {
      return true;
    }
  });
}

/**
 * Record one change to one entry, on top of main as it stands now, and push.
 * Built fresh on origin/main every time rather than merged: two sessions often
 * edit neighbouring entries, and a merge of adjacent JSON lines conflicts. The
 * checkout's HEAD is moved to main's tip (detached); nothing committed is
 * destroyed, and a run pushes its own work before it finishes. A rejected push
 * is not always a rival claim (her conversation saves to main after every
 * turn), so it retries on the new tip, re-checking for a claim each time.
 * Returns { result: pushed · claimed-elsewhere · unlanded · refused · failed, why }.
 * `summary`, when given, is the commit's body: a run's finish carries the
 * run's summary there, so git keeps each run's history (HBT-009).
 *
 * The run record goes to the state file (STATE_FILE), and any job file main
 * still holds with a record in its frontmatter is moved over in the same commit.
 * The registry is read from main's tip, never the disk: a commit the gate
 * refused left this run's own claim in the file, the checkout carried it onto
 * the new tip, and the retry read it as a rival's and stood down (2026-10-07).
 * A refused commit is not retried, since the gate refuses it again: the file
 * and the index go back to main's copy, the checkout is left clean, and the
 * gate's reason is returned.
 */
export function update(root, name, event, outcome, now = new Date(), summary = '', { byHand = false, runner = runnerName() } = {}) {
  // Several jobs in one commit (2026-11-05): each claim and finish is a commit through the whole
  // gate, about four minutes each, so a sweep of four jobs spent half an hour on its own
  // bookkeeping. `name` may be a list of { name, outcome } for jobs (never the run), claimed or
  // finished together; a claim takes those it can and leaves the rest (`skipped`).
  const items = Array.isArray(name) ? name : [{ name, outcome }];
  const names = items.map((i) => i.name);
  if (items.length > 1 && names.includes(RUN)) return { result: 'failed', why: 'the run is claimed and finished on its own' };
  const show = (rel) => git(root, ['show', `origin/main:${rel}`]);
  const showIf = (rel) => {
    try {
      return show(rel);
    } catch {
      return null;
    }
  };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const tips = {};
    let runTip;
    try {
      git(root, ['fetch', '-q', 'origin', 'main']);
      git(root, ['checkout', '-q', '--detach', 'origin/main']);
      runTip = show(relPath(RUN));
    } catch {
      return { result: 'failed', why: 'main could not be fetched or read' };
    }
    for (const n of names) {
      try {
        tips[n] = n === RUN ? runTip : show(relPath(n));
      } catch {
        return { result: 'failed', why: `no job named ${n}` };
      }
    }
    const order = jobsOf(parseFront(runTip).record);
    const unknown = names.find((n) => n !== RUN && !order.includes(n));
    if (unknown) return { result: 'failed', why: `no job named ${unknown}` };
    if (event === 'finish') {
      const stray = items.filter((i) => i.outcome === 'ok' && i.name !== RUN).flatMap((i) => unlanded(root, i.name));
      if (stray.length) return { result: 'unlanded', why: `${stray.join(', ')} not on main` };
    }
    const inline = names.find((n) => n !== RUN && parseFront(tips[n]).record?.inline);
    if (inline) return { result: 'failed', why: `${inline} is an inline job: the orchestrator runs it itself and it keeps no run record` };
    const stateTip = showIf(STATE_FILE);
    let saved;
    try {
      saved = parseState(stateTip);
    } catch (err) {
      return { result: 'failed', why: err.message };
    }
    // Any job file on main still carrying its run record gives it to the state
    // file in this same commit, and keeps only its prompt and settings.
    const files = Object.fromEntries([RUN, ...order].map((n) => [n, n in tips ? tips[n] : n === RUN ? runTip : showIf(relPath(n))]));
    const migrated = migrate(files, saved);
    const stripped = migrated.stripped;
    const state = withoutInline(migrated.state, files);
    const done = [];
    const skipped = [];
    for (const item of items) {
      const was = reconcile(parseFront(tips[item.name]).record, state[item.name]);
      if (event === 'claim' && (item.name === RUN ? !runFree(was, now.getTime()) : !claimable(was, now.getTime(), byHand))) { skipped.push(item.name); continue; }
      state[item.name] = recordOf(record(was, event, item.outcome, now, runner));
      done.push(item);
    }
    if (!done.length) return { result: 'claimed-elsewhere', skipped };
    const writes = [[STATE_FILE, writeState(state, order), stateTip], ...Object.entries(stripped).map(([n, text]) => [relPath(n), text, files[n]])];
    const paths = writes.map(([rel]) => rel);
    for (const [rel, text] of writes) writeFileSync(join(root, ...rel.split('/')), text);
    try {
      git(root, ['add', '--', ...paths]);
      const what = done.map((i) => `${i.name}${event === 'finish' && i.outcome ? ` ${i.outcome}` : ''}`).join(', ');
      const title = `chore(heartbeats): ${event} ${what} (${runner})`;
      git(root, ['commit', '-q', '-m', title, ...(summary.trim() ? ['-m', summary.trim()] : [])]);
    } catch (err) {
      for (const [rel, , before] of writes) {
        if (before === null) rmSync(join(root, ...rel.split('/')), { force: true });
        else writeFileSync(join(root, ...rel.split('/')), before);
      }
      git(root, ['reset', '-q', '--', ...paths]);
      // The gate noted the record as left staged; it is not, so the next claim or
      // finish must not be refused for carrying it (a heartbeat claim, 2026-10-10).
      forgetRefused(paths, root);
      return { result: 'refused', why: String(err.stderr || err.message).trim() };
    }
    try {
      git(root, ['push', '-q', 'origin', 'HEAD:main']);
      return { result: 'pushed', done: done.map((i) => i.name), skipped };
    } catch {
      /* main moved under us: go round again on its new tip */
    }
  }
  return { result: 'failed', why: 'main kept moving: three pushes rejected' };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const byHand = argv.includes('--by-hand');
  const [event, name, outcome, summaryFile] = argv.filter((a) => a !== '--by-hand');
  if (event === 'runner') {
    // Which runner this is, for a reminder's claim (A-177): cc-routine, baxter, cloud or by-hand.
    console.log(runnerName({ ...process.env }, { byHand }));
    process.exit(0);
  }
  if (event === 'sender') {
    // Only the runner .claude/heartbeats.json marks "sends": true runs the inline jobs, so
    // BAXTER and the routine never both send one reminder (HBT-002, HBT-010).
    const key = { 'cc-routine': 'claude-routine', baxter: 'baxter', cloud: 'cloud', 'by-hand': 'by-hand' }[runnerName()];
    // A-177: a runner marked "sends": "backup" prints "backup <minutes>": it sends only reminders
    // the usual sender has left that long, each claimed on main first, so none goes twice.
    let out = 'no';
    const top = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
    try {
      const r = JSON.parse(readFileSync(join(top, '.claude', 'heartbeats.json'), 'utf8')).runners?.[key];
      if (r?.sends === true) out = 'yes';
      else if (r?.sends === 'backup') out = `backup ${Number(r.backup_after_min) > 0 ? Number(r.backup_after_min) : 90}`;
    } catch { /* no manifest: never send */ }
    console.log(out);
    process.exit(0);
  }
  if (event === 'due') {
    // What the orchestrator starts (.claude/jobs/README.md): every job due now, missed ones included.
    const here = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
    const runner = runnerName();
    // Main's tip as last fetched (step 0 fetches first), so a lagging folder never
    // reads a job as due that main shows has run; the disk where there is no origin/main.
    let ref = '';
    try {
      git(here, ['rev-parse', '--verify', '-q', 'origin/main']);
      ref = 'origin/main';
    } catch { /* no remote main: the disk */ }
    const reg = readRegistry(here, ref);
    // HBT-011 design 3: the cloud stands down while BAXTER is running the heartbeat.
    if (runner === 'cloud' && !cloudMayRun(reg.run)) process.exit(0);
    // An inline job (reminders) is run by the orchestrator itself, first, every sweep (HBT-010 design 2).
    // An unreadable job is a broken step, said on stderr with exit 1, never an empty list.
    const { due: names, unreadable } = dueNow(reg, runner, Date.now(), { dev: existsSync(join(here, 'dev')) });
    for (const name of names) console.log(name);
    for (const u of unreadable) console.error(`unreadable: ${u.name}: ${u.why}`);
    process.exit(unreadable.length ? 1 : 0);
  }
  // Several jobs at once, in one commit (2026-11-05): `claim a,b,c`, `finish a=ok,b=failed`.
  const batch = Boolean(name) && /[,=]/.test(name);
  const items = batch ? name.split(',').map((p) => { const [n, o] = p.split('='); return { name: n.trim(), outcome: o?.trim() }; }) : null;
  const badBatch = batch && (items.some((i) => !i.name || i.name === RUN) || (event === 'finish' ? items.some((i) => !['ok', 'failed'].includes(i.outcome)) : items.some((i) => i.outcome !== undefined)));
  if (!['claim', 'finish'].includes(event) || !name || badBatch || (!batch && event === 'finish' && !['ok', 'failed'].includes(outcome))) {
    console.error('usage: heartbeats.mjs due | claim <job|run|job,job…> [--by-hand] | finish <job|run> ok|failed [summary file] | finish <job=ok|failed,…> [summary file]');
    process.exit(2);
  }
  const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
  // A developer's job is never claimed in a copy with no dev/, by hand or not (D17).
  const gatedOut = [];
  if (event === 'claim' && name !== RUN && !existsSync(join(root, 'dev'))) {
    for (const n of batch ? items.map((i) => i.name) : [name]) {
      let gated = false;
      try { gated = devOnly(parseFront(readFileSync(join(root, ...relPath(n).split('/')), 'utf8')).record); } catch { /* no such job: update() says so */ }
      if (gated) gatedOut.push(n);
    }
    if (gatedOut.length && (!batch || gatedOut.length === items.length)) {
      console.error(`heartbeats: ${gatedOut.join(', ')} ${gatedOut.length > 1 ? 'are' : 'is'} the developer's (gate: dev) and this copy has no dev/; standing down`);
      process.exit(3);
    }
  }
  if (git(root, ['status', '--porcelain']).trim()) {
    console.error('heartbeats: this checkout has uncommitted changes; commit and push the run first');
    process.exit(2);
  }
  let summary = '';
  const summaryPath = batch ? outcome : summaryFile;
  if (summaryPath) {
    try {
      summary = readFileSync(summaryPath, 'utf8');
    } catch {
      console.error(`heartbeats: no summary file at ${summaryPath}`);
      process.exit(2);
    }
  }
  const target = batch ? items.filter((i) => !gatedOut.includes(i.name)) : name;
  const { result, why, done, skipped } = update(root, target, event, batch ? undefined : outcome, new Date(), summary, { byHand: byHand && event === 'claim', runner: runnerName(process.env, { byHand }) });
  if (result === 'claimed-elsewhere') {
    // Another session has it, or it is not due (HBT-007): stand down.
    console.error(`heartbeats: ${name} is claimed elsewhere or not due; standing down`);
    process.exit(3);
  }
  if (result === 'unlanded') {
    // A job whose branch main does not hold has not landed (HBT-009): land it, or record it failed.
    console.error(`heartbeats: ${name} cannot be recorded ok: ${why}. Land it, or finish it failed.`);
    process.exit(4);
  }
  if (result === 'refused') {
    // The commit gate runs on a claim too: fix what it names, then claim again.
    console.error(`heartbeats: the commit gate refused the ${event}; the checkout is clean again, and nothing was pushed.\n${why}`);
    process.exit(1);
  }
  if (result !== 'pushed') {
    console.error(`heartbeats: ${name} could not be recorded on main (${why}); nothing was pushed`);
    process.exit(1);
  }
  if (batch) {
    // One line per job, so the orchestrator knows which it holds: "claimed <job>" or "skipped <job>".
    for (const n of done ?? []) console.log(`${event === 'claim' ? 'claimed' : 'finished'} ${n}`);
    for (const n of [...(skipped ?? []), ...gatedOut]) console.log(`skipped ${n}`);
  } else console.log(`heartbeats: ${event} ${name}${outcome ? ` ${outcome}` : ''}`);
}
