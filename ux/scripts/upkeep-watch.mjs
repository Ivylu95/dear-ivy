#!/usr/bin/env node
// The watch on code maintenance (HYG-006, "Code is kept current without changing what
// it does", design 3). Each upkeep commit carries the trailer `Upkeep: HYG-006`.
// Every sweep, on main's tip, each one not yet checked is taken out of the
// working tree and the behaviour snapshot recorded with and without it: the same
// output, and it is verified; any difference, and it is reverted by a commit of
// its own that says which outputs moved (MNT-005, "A change that makes things
// worse is reverted, and the reversal recorded"). Run by the orchestrator in its
// own checkout, after landing and before its one push.
//
//   node ux/scripts/upkeep-watch.mjs             check each landed upkeep commit not yet checked
//   node ux/scripts/upkeep-watch.mjs --pending   print how many wait, change nothing
//
// The record of what was checked is .claude/jobs/code-maintenance-snapshot.json.

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { record, stableDifferences } from './behaviour-snapshot.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LEDGER = join(root, '.claude', 'jobs', 'code-maintenance-snapshot.json');
const git = (args, input) => spawnSync('git', args, { cwd: root, encoding: 'utf8', input, maxBuffer: 64 << 20 });

const ledger = existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, 'utf8')) : { verified: [], reverted: [], unverifiable: [] };
const seen = new Set([...ledger.verified, ...ledger.reverted.map((r) => r.commit), ...ledger.unverifiable.map((r) => r.commit)]);
// --pending only counts, and is asked from whatever folder a session started in, whose
// HEAD may be an old branch: it reads main's tip, origin/main where there is one (an
// edge-case review, T-330). The check itself runs on the orchestrator's checkout of main.
const pending = process.argv.includes('--pending');
const tip = pending && git(['rev-parse', '--verify', '-q', 'origin/main']).status === 0 ? ['origin/main'] : [];
const todo = git(['log', '--format=%H', '--grep=^Upkeep: HYG-006$', ...tip]).stdout.split('\n').filter((c) => c && !seen.has(c));

if (pending) {
  if (todo.length) console.log(`${todo.length} upkeep commit(s) wait for the watch`);
  process.exit(0);
}
if (!todo.length) {
  console.log('upkeep watch: nothing landed since the last check');
  process.exit(0);
}
if (git(['status', '--porcelain']).stdout.trim()) {
  console.error('upkeep watch: the checkout has uncommitted changes; nothing checked');
  process.exit(1);
}

const dir = makeTemp('dear-watch-');
let changed = false;
try {
  let now = record(join(dir, 'now.json'));
  // Unverifiable is recorded and said, so the run summary names it (an edge-case run of 2026-10-29).
  const unverifiable = (c, why, said) => {
    ledger.unverifiable.push({ commit: c, why });
    console.log(`upkeep watch: ${c.slice(0, 8)} unverifiable, ${said}`);
    changed = true;
  };
  for (const c of todo) {
    const subject = git(['log', '-1', '--format=%s', c]).stdout.trim();
    // A merge cannot be reverted alone, and once crashed every later sweep (2026-10-29).
    if (git(['rev-list', '--parents', '-n', '1', c]).stdout.trim().split(/\s+/).length > 2) {
      unverifiable(c, 'a merge commit is checked through its parents', 'a merge commit is checked through its parents');
      continue;
    }
    const patch = git(['diff', '--binary', `${c}^`, c]).stdout;
    if (git(['apply', '-R', '--check'], patch).status !== 0) {
      unverifiable(c, 'later work changed the same lines, so it cannot be taken out alone', 'later work changed the same lines');
      continue;
    }
    git(['apply', '-R'], patch);
    const without = record(join(dir, 'without.json'));
    git(['apply'], patch);
    if (git(['status', '--porcelain']).stdout.trim()) throw new Error(`the checkout did not return to HEAD after testing ${c}`);
    const again = record(join(dir, 'again.json'));
    const { moved, unstable } = stableDifferences(without, now, again);
    for (const n of unstable) console.log(`upkeep watch: noise, set aside: ${n} (its output differs run to run)`);
    if (!moved.length) {
      ledger.verified.push(c);
      console.log(`upkeep watch: ${c.slice(0, 8)} verified, nothing the app does changed`);
    } else {
      // The snapshots take minutes, and a folder another chat shares can change meanwhile:
      // a cherry-pick it stopped there made this revert fail, and the abort below undid that
      // pick, not this one, her words staged beside it with it (round 40). So the folder is
      // looked at again first, and only a revert of this commit is ever aborted.
      if (git(['status', '--porcelain']).stdout.trim()) throw new Error(`the checkout changed while testing ${c}; nothing reverted`);
      const undo = git(['revert', '--no-commit', c]);
      if (undo.status !== 0) {
        const own = git(['rev-parse', '-q', '--verify', 'REVERT_HEAD']).stdout.trim() === c;
        if (!own) throw new Error(`could not revert ${c}, and the revert under way here is not its own: ${(undo.stderr || undo.stdout).trim().split('\n')[0]}`);
        git(['revert', '--abort']);
        unverifiable(c, `its revert failed: ${(undo.stderr || undo.stdout).trim().split('\n')[0]}`, 'its revert failed');
        continue;
      }
      const msg = `revert(upkeep): undo "${subject}" (HYG-006)\n\nThe watch found that this upkeep commit changed what the app does, so it is\nundone. Outputs that moved:\n${moved.map((m) => `- ${m}`).join('\n')}\n`;
      const done = git(['commit', '-q', '-F', '-'], msg);
      if (done.status !== 0) throw new Error(`could not commit the revert of ${c}: ${done.stderr || done.stdout}`);
      ledger.reverted.push({ commit: c, moved });
      console.log(`upkeep watch: ${c.slice(0, 8)} reverted, ${moved.length} output(s) moved`);
      now = record(join(dir, 'now.json'));
    }
    changed = true;
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (changed) {
  writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
  git(['add', LEDGER]);
  const done = git(['commit', '-q', '-m', 'chore(upkeep): record what the watch checked (HYG-006)']);
  if (done.status !== 0) {
    console.error(`upkeep watch: could not commit its ledger: ${done.stderr || done.stdout}`);
    process.exit(1);
  }
}
