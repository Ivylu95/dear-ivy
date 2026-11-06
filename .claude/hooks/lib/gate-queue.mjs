// One commit gate at a time on this machine (2026-11-03). The heartbeat sweep
// starts every job at once, each in its own worktree, and each job's commit runs
// the full gate, ~200 tests; run side by side on one small machine they time out
// and every commit is refused (.claude/memory/a-loaded-machine-times-out-the-gate.md:
// "one selftest at a time"). Raising the limits would loosen a check, so the full
// gate waits its turn instead: a lock folder in the system temp folder, which every
// worktree on the machine shares, made with mkdir (atomic). A holder that has died,
// or held it past STALE_MS, is taken over; a waiter past WAIT_MS goes ahead and says
// so, and the checks then decide as they always have.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const STALE_MS = 25 * 60 * 1000;
export const WAIT_MS = 40 * 60 * 1000;
const POLL_MS = 2000;

const pause = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};

/** Pure: whether a lock held by `owner` may be taken over at `now`. */
export function stale(owner, now = Date.now(), isAlive = alive) {
  if (!owner || !Number.isInteger(owner.pid) || !Number.isFinite(owner.at)) return true;
  return !isAlive(owner.pid) || now - owner.at > STALE_MS;
}

/**
 * Wait for the machine's one gate turn, then hold it. Returns { release, waitedMs, wentAhead }.
 * `lockDir` is for tests; the gate uses the shared default.
 */
export function waitTurn({ lockDir = join(tmpdir(), 'dear-me-gate.lock'), waitMs = WAIT_MS, poll = POLL_MS, now = Date.now } = {}) {
  const start = now();
  const ownerFile = join(lockDir, 'owner.json');
  for (;;) {
    try {
      mkdirSync(lockDir);
      writeFileSync(ownerFile, JSON.stringify({ pid: process.pid, at: now() }));
      const release = () => {
        try {
          const o = JSON.parse(readFileSync(ownerFile, 'utf8'));
          if (o.pid === process.pid) rmSync(lockDir, { recursive: true, force: true });
        } catch { /* already gone */ }
      };
      return { release, waitedMs: now() - start, wentAhead: false };
    } catch (e) {
      if (e.code !== 'EEXIST') return { release: () => {}, waitedMs: now() - start, wentAhead: true };
    }
    let owner = null;
    try { owner = JSON.parse(readFileSync(ownerFile, 'utf8')); } catch { /* being written, or left half-made */ }
    if (owner ? stale(owner, now()) : now() - start > poll * 5) {
      rmSync(lockDir, { recursive: true, force: true });
      continue;
    }
    if (now() - start > waitMs) return { release: () => {}, waitedMs: now() - start, wentAhead: true };
    pause(poll);
  }
}
