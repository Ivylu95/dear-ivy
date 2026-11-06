#!/usr/bin/env node
// The speed check (HYG-006, "Code is kept current without changing what it does",
// design 5). Code maintenance may make the code faster, never slower, and "faster"
// is measured, never believed: the probes the behaviour lock runs are timed on the
// last commit and on the working tree, in turns, and compared.
//
//   node ux/scripts/speed-check.mjs                    time the probes nearest the changed files
//   node ux/scripts/speed-check.mjs --probe <name>     time that probe (repeatable)
//   node ux/scripts/speed-check.mjs --expect-faster    and refuse unless each one is faster
//   node ux/scripts/speed-check.mjs --slowest <snap>   the slowest probes in a lock baseline
//   node ux/scripts/speed-check.mjs --profile <name>   where that probe spends its time, in this repository's code
//
// A probe is slower, or faster, only when every timed run of one side is beyond every
// run of the other and the medians differ by the margin: a busy machine slows both
// sides alike, so overlapping runs are "no change", never a verdict. Exit 1: slower,
// or not shown faster with --expect-faster. Exit 2: it could not run.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { threshold } from '../../.claude/hooks/lib/thresholds.mjs';
import { probes } from './behaviour-snapshot.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const MARGIN = (threshold('maintenance.speedMargin', 'percent') ?? NaN) / 100;
const ROUNDS = threshold('maintenance.speedRounds', 'rounds');

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

/** One probe's verdict from its timings on each side: 'faster', 'slower' or 'same'. */
export function verdict(before, after, margin = MARGIN) {
  const b = median(before);
  const a = median(after);
  if (Math.max(...after) < Math.min(...before) && a <= b * (1 - margin)) return 'faster';
  if (Math.min(...after) > Math.max(...before) && a >= b * (1 + margin)) return 'slower';
  return 'same';
}

/** The probes nearest a set of changed files: each one's own rule test, and the suite of its folder. */
export function nearest(files, names) {
  const want = new Set();
  for (const f of files) {
    const test = `rule test ${dirname(f)}/test-${basename(f)}`;
    if (names.includes(test)) want.add(test);
    if (f.startsWith('ux/')) want.add('dashboard readers').add('unit tests');
    if (f.startsWith('.claude/hooks/')) want.add('hook decisions');
    if (f.startsWith('dev/ui/')) want.add('admin unit tests');
  }
  return [...want].filter((n) => names.includes(n));
}

/** Where a set of V8 CPU profiles spent their time, in files under `under`: the top `n` by self time. */
export function hotspots(profiles, under, n = 10) {
  const self = new Map();
  for (const p of profiles) {
    const byId = new Map(p.nodes.map((x) => [x.id, x]));
    p.samples.forEach((id, i) => {
      const f = byId.get(id)?.callFrame;
      if (!f?.url?.includes(under)) return;
      const at = `${f.url.slice(f.url.indexOf(under) + under.length + 1)}:${f.lineNumber + 1} ${f.functionName || '(anonymous)'}`;
      self.set(at, (self.get(at) ?? 0) + (p.timeDeltas[i] ?? 0) / 1000);
    });
  }
  return [...self].sort((a, b) => b[1] - a[1]).slice(0, n).map(([at, ms]) => ({ at, ms: Math.round(ms) }));
}

const time = (p, env) => {
  const t0 = performance.now();
  spawnSync(p.cmd[0], p.cmd.slice(1), { cwd: p.cwd, env, stdio: 'ignore', timeout: 600e3 });
  return performance.now() - t0;
};

function compare(names, expectFaster) {
  if (!MARGIN || !ROUNDS) {
    console.error('speed check: NOT RUN: its thresholds in .claude/thresholds.json do not read');
    return 2;
  }
  const dir = makeTemp('dear-speed-');
  const base = join(dir, 'base');
  try {
    execFileSync('git', ['worktree', 'add', '-q', '--detach', base, 'HEAD'], { cwd: root, stdio: 'ignore' });
    // The last commit runs on the same installed packages, so only the code differs.
    for (const m of ['ux/node_modules', 'dev/ui/node_modules']) if (existsSync(join(root, m))) symlinkSync(join(root, m), join(base, m));
    const env = { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' };
    const now = probes(root);
    const then = probes(base);
    let bad = 0;
    for (const name of names) {
      const a = now.find((p) => p.name === name);
      const b = then.find((p) => p.name === name);
      if (!a || !b) {
        console.log(`  ${name}: not a probe on both sides, not timed`);
        if (expectFaster) bad += 1;
        continue;
      }
      const before = [];
      const after = [];
      // In turns, the order swapped each round, so a machine growing busier weighs on both alike.
      for (let i = 0; i < ROUNDS; i += 1) {
        if (i % 2) { after.push(time(a, env)); before.push(time(b, env)); } else { before.push(time(b, env)); after.push(time(a, env)); }
      }
      const v = verdict(before, after);
      const [mb, ma] = [median(before), median(after)].map(Math.round);
      console.log(`  ${name}: ${mb} ms → ${ma} ms (${ma >= mb ? '+' : '−'}${Math.round((Math.abs(ma - mb) / mb) * 100)}%), ${v === 'same' ? 'no change beyond noise' : v}`);
      if (v === 'slower' || (expectFaster && v !== 'faster')) bad += 1;
    }
    return bad ? 1 : 0;
  } finally {
    spawnSync('git', ['worktree', 'remove', '--force', base], { cwd: root, stdio: 'ignore' });
    rmSync(dir, { recursive: true, force: true });
  }
}

function profile(name) {
  const p = probes(root).find((x) => x.name === name);
  if (!p) {
    console.error(`speed check: no probe named "${name}"`);
    return 2;
  }
  const dir = makeTemp('dear-prof-');
  try {
    // Through NODE_OPTIONS, so every process the probe starts is profiled too.
    const env = { ...process.env, NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --cpu-prof --cpu-prof-dir=${dir}`.trim() };
    spawnSync(p.cmd[0], p.cmd.slice(1), { cwd: p.cwd, env, stdio: 'ignore', timeout: 600e3 });
    const profiles = readdirSync(dir).filter((f) => f.endsWith('.cpuprofile')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')));
    const hot = hotspots(profiles, pathToFileURL(root).href);
    console.log(`speed check: where "${name}" spends its time (${profiles.length} process(es)), self time in this repository's code:`);
    for (const h of hot) console.log(`  ${String(h.ms).padStart(6)} ms  ${h.at}`);
    return 0;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const args = process.argv.slice(2);
  const after = (flag) => args.flatMap((a, i) => (a === flag && args[i + 1] ? [args[i + 1]] : []));
  if (args[0] === '--slowest' && args[1]) {
    const snap = JSON.parse(readFileSync(args[1], 'utf8'));
    const rows = Object.entries(snap).filter(([k, v]) => !k.startsWith('@') && typeof v.ms === 'number').sort((a, b) => b[1].ms - a[1].ms).slice(0, 10);
    for (const [k, v] of rows) console.log(`  ${String(v.ms).padStart(7)} ms  ${k}`);
    process.exit(0);
  }
  if (args[0] === '--profile' && args[1]) process.exit(profile(args[1]));
  let names = after('--probe');
  if (!names.length) {
    const changed = execFileSync('git', ['diff', '--name-only', 'HEAD'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
    names = nearest(changed, probes(root).map((p) => p.name));
  }
  if (!names.length) {
    console.log('speed check: no probe runs near the changed files; nothing to time');
    process.exit(args.includes('--expect-faster') ? 1 : 0);
  }
  console.log(`speed check: ${names.length} probe(s), ${ROUNDS} rounds each side, margin ${Math.round(MARGIN * 100)}%`);
  process.exit(compare(names, args.includes('--expect-faster')));
}
