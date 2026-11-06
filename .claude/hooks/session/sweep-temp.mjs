#!/usr/bin/env node
// Sweeps the scratch folder by age, at session start.
//
// ARC-013, "All scratch output goes to one disposable location.", whose test is
// that the folder can be emptied without anything breaking or being lost. The
// row's design names this sweep: anything whose last modification is more than
// seven days old goes.
//
// SEVEN DAYS IS THE WHOLE SAFETY ARGUMENT. It is longer than any session, so
// work in progress is never reached — a file written this turn cannot be old
// enough to sweep. systemd's tmpfiles takes a shared lock on each directory it
// descends into and skips one already held; that discipline does not reach a
// folder swept on Windows, so the margin is what stands in for it. Narrowing it
// removes the only protection this has.
//
// It never reports success. A session opening with news about housekeeping is
// noise; only a removal, or a failure that leaves the folder growing, says
// anything worth reading.
//
// Nothing durable may name a path inside the folder (ARC-013) and state the
// harness keeps between sessions lives elsewhere (ARC-014, .claude/hooks/state/),
// which together are why this can run unattended.

import { readdirSync, statSync, rmSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { scratchDir, scratchMaxAgeDays } from '../lib/scratch.mjs';
import { pruneMarkers, sweepLitter, trimScratch } from '../lib/temp-litter.mjs';

const repoRoot = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const scratch = scratchDir(repoRoot);

// ARC-013 states the age; an unreadable threshold removes nothing (lib/thresholds.mjs).
const MAX_AGE_DAYS = scratchMaxAgeDays();
if (!MAX_AGE_DAYS) {
  console.log('scratch sweep: the age threshold could not be read, so nothing was removed (ARC-013, FND-009)');
  process.exit(0);
}
const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

let removed = 0;
let skipped = 0;

// Depth-first, so a directory is considered only once its children are gone.
const sweep = (dir) => {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return false; // unreadable: leave it entirely alone
  }

  // A folder holding a .git is a working folder or a history, never scratch by
  // age: an aged heartbeat worktree with an unpushed commit was swept (round 3,
  // B17), and a stopped new-copy run lost the history it was making (B10). Left
  // whole; their own tools clear them (clearFinished, new-copy's rerun).
  if (dir !== scratch && entries.some((e) => e.name === '.git')) return false;
  if (dir === join(scratch, 'new-copy')) return false;

  let emptied = true;
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!sweep(path)) emptied = false;
      continue;
    }
    let mtime;
    try {
      mtime = statSync(path).mtimeMs;
    } catch {
      emptied = false;
      continue;
    }
    if (mtime >= cutoff) {
      emptied = false; // still inside the margin
      continue;
    }
    try {
      rmSync(path, { force: true });
      removed += 1;
    } catch {
      // Locked by another process, or read-only. Left for the next run rather
      // than retried: a sweep that fights for a file is a sweep that hangs.
      skipped += 1;
      emptied = false;
    }
  }

  if (!emptied || dir === scratch) return emptied;
  try {
    rmdirSync(dir);
  } catch {
    return false;
  }
  return true;
};

// The system temp folder: what the harness's own tests and eval runs left there,
// older than a day (A-147; lib/temp-litter.mjs). Separate from temp/ and its margin.
// Silent: like the rest of this sweep, it never reports success.
sweepLitter();
// And the per-chat markers of chats long over (A-147).
pruneMarkers(join(repoRoot, '.claude', 'hooks', 'state'));

try {
  statSync(scratch);
} catch {
  process.exit(0); // no scratch folder yet, nothing owed
}

sweep(scratch);
// A file kept fresh by appends never ages out above; it keeps only its newest lines (A-147).
trimScratch(scratch);

if (removed > 0) {
  const plural = removed === 1 ? '' : 's';
  console.log(`scratch sweep: removed ${removed} file${plural} older than ${MAX_AGE_DAYS} days from temp/`);
}
if (skipped > 0) {
  console.log(`scratch sweep: ${skipped} file(s) could not be removed and stay for the next run`);
}

process.exit(0);
