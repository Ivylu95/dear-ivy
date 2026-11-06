#!/usr/bin/env node
// The behaviour lock (HYG-006, "Code is kept current without changing what it
// does", design 2). Code maintenance lands with no one approving it, so "nothing the
// app does has changed" is shown, never believed: what the app does is recorded
// before and after a change, and any differing byte stops it.
//
//   node ux/scripts/behaviour-snapshot.mjs record <file>     what the app does now
//   node ux/scripts/behaviour-snapshot.mjs compare <a> <b>   exit 1 if any probe differs
//   node ux/scripts/behaviour-snapshot.mjs lock <before>     the whole lock on the working tree:
//        record again under coverage, compare with <before>, and refuse any changed
//        line (git diff against HEAD) that no probe ran
//
// The probes: every hook's decision on the selftest's cases, every rule test and
// unit test (their output, not only their verdict), and every dashboard reader
// run on the invented record in data-sample/ at a fixed date, never hers. A probe
// that cannot run records its failure, the same on both sides. Code no probe
// reaches (a page's JSX, a script nothing tests) is never covered, so a change to
// it never lands here: it goes to the developer. That is the lock failing closed.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';
import { walkFiles } from '../lib/walk-skip.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// A fixed day, so a reader's "in three days" reads the same on both sides.
const DAY = '2026-01-15';
const READERS = `
import { inRecord, RECORDS } from '@/lib/data-dir';
import * as r from '@/lib/content-read';
const now = typeof r.getToday() === 'string' ? ${JSON.stringify(DAY)} : r.getToday();
const out = {};
const take = (name, fn) => { try { out[name] = fn(); } catch (e) { out[name] = 'threw: ' + e.message; } };
inRecord(RECORDS.sample, () => {
  for (const name of ['getIndex', 'getLastSession', 'getNavCounts', 'getJournal', 'getOpenLoops', 'getMe', 'getTherapy', 'getPeople', 'getSettings', 'getIdentity', 'getPronouns', 'getSafetyPlan', 'getTimeline'])
    take(name, () => r[name]());
  take('getHome', () => r.getHome(now));
  take('getCalendar', () => r.getCalendar(now));
  const people = Array.isArray(out.getPeople) ? out.getPeople : out.getPeople?.people ?? [];
  for (const p of people) if (p?.slug) take('getPerson:' + p.slug, () => r.getPerson(p.slug));
});
console.log(JSON.stringify(out, null, 1));
`;

/** Every rule test beside a hook or a script: pure, no git, no network. */
function ruleTests(at = root) {
  const found = [];
  for (const dir of ['.claude/hooks', 'ux/scripts']) {
    if (!existsSync(join(at, dir))) throw new Error(`no ${dir} under ${at}`);
    for (const full of walkFiles(join(at, dir), { names: new Set(), keep: (n) => /^test-.*\.mjs$/.test(n) })) {
      const rel = relative(at, full).replace(/\\/g, '/');
      if (rel !== 'ux/scripts/test-behaviour-snapshot.mjs') found.push(rel);
    }
  }
  return found.sort();
}

/** The probes, run in the checkout at `at`: this one, or another commit's (the speed check's). */
export function probes(at = root) {
  const ux = join(at, 'ux');
  return [
    // The selftest runs its rule tests side by side, so its lines arrive in any order.
    { name: 'hook decisions', cmd: [process.execPath, '.claude/hooks/selftest.mjs'], cwd: at, unordered: true },
    { name: 'dashboard readers', cmd: [process.execPath, '--import', './test/register.mjs', '--input-type=module', '-e', READERS], cwd: ux },
    { name: 'unit tests', cmd: [process.execPath, 'test/run.mjs'], cwd: ux },
    ...(existsSync(join(at, 'dev/ui/scripts/test.mjs')) ? [{ name: 'admin unit tests', cmd: [process.execPath, 'scripts/test.mjs'], cwd: join(at, 'dev/ui') }] : []),
    ...ruleTests(at).map((t) => ({ name: `rule test ${t}`, cmd: [process.execPath, t], cwd: at, unordered: true })),
  ];
}

/**
 * A probe that runs its parts side by side prints them in any order, and its
 * runner puts a timing prefix on whichever line of a test comes first: so the
 * prefix comes off and the lines are sorted. Found 2026-10-26, when one rule
 * test's two cases swapping places read as a changed hook decision. Only the
 * timing comes off: the verdict and the test's name stay, on a line of their
 * own, so a test that went ok to FAIL while another went FAIL to ok still shows
 * (an edge-case run of 2026-10-29).
 */
export function unorder(text) {
  return text
    .split('\n')
    .flatMap((l) => {
      const m = /^ ?(ok|FAIL) <n>ms (\S+) (.*)$/.exec(l);
      return m ? [`${m[1]} ${m[2]}`, ` ${m[3]}`] : [l];
    })
    .sort()
    .join('\n');
}

/** What differs only by when or where it ran, never by what the code did. */
export function normalise(text) {
  return text
    .split(root).join('<root>')
    .split(tmpdir()).join('<tmp>')
    .replace(/<tmp>\/[\w.-]+/g, '<tmp>/x')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '<time>')
    .replace(/\b\d+(\.\d+)?\s?(ms|s)\b/g, '<n>ms')
    .replace(/^ℹ duration_ms .*$/gm, 'ℹ duration_ms <n>')
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trimEnd())
    .join('\n');
}

// Every process a probe starts sees its clock begin at the same pinned instant,
// then run on at the real rate, so a wait on the clock still ends. Without it a
// job falls due between two recordings and the hooks' decisions differ by the
// hour, not by the code (2026-10-19, the second end-to-end run).
const CLOCK = `const T = Number(process.env.DEAR_SNAPSHOT_NOW); if (T) { const R = Date; const start = R.now();
  const now = () => T + (R.now() - start);
  class D extends R { constructor(...a) { super(...(a.length ? a : [now()])); } static now() { return now(); } }
  globalThis.Date = D; }`;

let pinned;
/**
 * One instant for every recording this process makes, so they compare; `at`
 * reuses a baseline's instant, recorded by an earlier process (`@clock`).
 */
function clockEnv(at) {
  pinned ??= (() => {
    const dir = makeTemp('dear-clock-');
    writeFileSync(join(dir, 'clock.mjs'), CLOCK);
    return { file: join(dir, 'clock.mjs'), at: String(at ?? Date.now()) };
  })();
  const opts = `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(pinned.file).href}`.trim();
  return { NODE_OPTIONS: opts, DEAR_SNAPSHOT_NOW: pinned.at };
}

export function record(file, { coverageDir, at } = {}) {
  const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', ...clockEnv(at) };
  if (coverageDir) env.NODE_V8_COVERAGE = coverageDir;
  const out = {};
  for (const p of probes()) {
    const t0 = performance.now();
    const r = spawnSync(p.cmd[0], p.cmd.slice(1), { cwd: p.cwd, env, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 600e3 });
    const ms = Math.round(performance.now() - t0);
    let text = normalise(`exit ${r.status}\n${r.stdout ?? ''}\n${r.stderr ?? ''}`);
    if (p.unordered) text = unorder(text);
    // `ms` is how long it took, for finding what is slow: never compared, so it never refuses.
    out[p.name] = { hash: createHash('sha256').update(text).digest('hex'), text, ms };
  }
  // The commit both sides ran on: a checkout that moved between them compares two codebases.
  out['@head'] = { hash: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim() };
  out['@clock'] = { hash: env.DEAR_SNAPSHOT_NOW };
  writeFileSync(file, JSON.stringify(out, null, 1));
  return out;
}

/** The probes whose output differs between two snapshots. */
export function differences(a, b) {
  const names = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...names].filter((n) => !n.startsWith('@') && a[n]?.hash !== b[n]?.hash).sort();
}

/**
 * A probe whose output differs between two runs of the same code is noise, not
 * behaviour: it is set aside and named, never counted as a change. Found on the
 * first end-to-end run, 2026-10-19, when a rule test that prints a different line
 * run to run had a same-value rewrite reverted.
 */
export function stableDifferences(before, after, again) {
  const unstable = differences(after, again);
  return { moved: differences(before, after).filter((n) => !unstable.includes(n)), unstable };
}

/** Added or changed lines in the working tree against HEAD: { file: [line, …] }. */
export function changedLines(diffText) {
  const out = {};
  let file = null;
  for (const line of diffText.split('\n')) {
    const f = /^\+\+\+ b\/(.+)$/.exec(line);
    if (f) { file = f[1]; continue; }
    if (line.startsWith('+++ /dev/null')) { file = null; continue; }
    const h = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (h && file) {
      const start = Number(h[1]);
      const count = h[2] === undefined ? 1 : Number(h[2]);
      for (let i = 0; i < count; i += 1) (out[file] ??= []).push(start + i);
    }
  }
  return out;
}

/**
 * Whether V8 ran each line, from NODE_V8_COVERAGE's files: a line is run when
 * the innermost range holding its first character has a count above zero in
 * any process. A blank or comment-only line carries no behaviour and passes.
 */
export function unrunLines(changed, coverage, readSource) {
  const byUrl = new Map();
  for (const c of coverage) for (const s of c.result ?? []) {
    const list = byUrl.get(s.url) ?? [];
    for (const fn of s.functions ?? []) list.push(...fn.ranges);
    byUrl.set(s.url, list);
  }
  const out = [];
  for (const [file, lines] of Object.entries(changed)) {
    const src = readSource(file);
    if (src === null) continue;
    const starts = [0];
    for (let i = 0; i < src.length; i += 1) if (src[i] === '\n') starts.push(i + 1);
    const ranges = byUrl.get(pathToFileURL(join(root, file)).href);
    for (const n of lines) {
      const text = src.slice(starts[n - 1], starts[n] ?? src.length);
      const lead = text.search(/\S/);
      if (lead < 0 || /^\s*(\/\/|\/\*|\*)/.test(text)) continue;
      if (!ranges) { out.push(`${file}:${n}`); continue; }
      const at = starts[n - 1] + lead;
      let best = null;
      for (const r of ranges) if (r.startOffset <= at && at < r.endOffset && (!best || r.endOffset - r.startOffset < best.endOffset - best.startOffset)) best = r;
      if (!best || best.count === 0) out.push(`${file}:${n}`);
    }
  }
  return out;
}

function lock(beforeFile) {
  const before = JSON.parse(readFileSync(beforeFile, 'utf8'));
  const dir = makeTemp('dear-lock-');
  try {
    const at = Number(before['@clock']?.hash) || undefined;
    const after = record(join(dir, 'after.json'), { coverageDir: join(dir, 'cov'), at });
    const again = record(join(dir, 'again.json'), { at });
    if (before['@head']?.hash !== after['@head']?.hash) {
      console.error('BEHAVIOUR LOCK REFUSED (HYG-006)\n\n  - HEAD moved between the two snapshots; record the baseline again on this commit');
      return 1;
    }
    const { moved: differ, unstable } = stableDifferences(before, after, again);
    for (const n of unstable) console.log(`  noise, set aside: ${n} (its output differs run to run)`);
    const diff = spawnSync('git', ['diff', '-U0', 'HEAD', '--', '.'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }).stdout;
    const code = Object.fromEntries(Object.entries(changedLines(diff)).filter(([f]) => /\.(m?js|cjs|jsx?|tsx?)$/.test(f)));
    const covDir = join(dir, 'cov');
    const coverage = existsSync(covDir) ? readdirSync(covDir).map((f) => JSON.parse(readFileSync(join(covDir, f), 'utf8'))) : [];
    const unrun = unrunLines(code, coverage, (f) => (existsSync(join(root, f)) ? readFileSync(join(root, f), 'utf8') : null));
    if (!differ.length && !unrun.length) {
      console.log(`behaviour lock: every probe's output is byte-identical, and every changed line ran (${Object.keys(code).length} file(s))`);
      return 0;
    }
    console.error('BEHAVIOUR LOCK REFUSED (HYG-006)\n');
    for (const n of differ) console.error(`  - output changed: ${n}`);
    for (const l of unrun.slice(0, 40)) console.error(`  - no probe runs ${l}`);
    console.error('\n  Not proven unchanged: undo it, and leave it for the developer as a proposal.');
    return 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'record' && a) {
    const out = record(a);
    console.log(`behaviour snapshot: ${Object.keys(out).filter((k) => !k.startsWith('@')).length} probes recorded to ${relative(process.cwd(), a)}`);
  } else if (cmd === 'compare' && a && b) {
    const differ = differences(JSON.parse(readFileSync(a, 'utf8')), JSON.parse(readFileSync(b, 'utf8')));
    if (differ.length) {
      console.error(`behaviour snapshot: ${differ.length} probe(s) differ\n  - ${differ.join('\n  - ')}`);
      process.exit(1);
    }
    console.log('behaviour snapshot: every probe matches');
  } else if (cmd === 'lock' && a) {
    process.exit(lock(a));
  } else {
    console.error('usage: behaviour-snapshot.mjs record <file> | compare <a> <b> | lock <before>');
    process.exit(2);
  }
}
