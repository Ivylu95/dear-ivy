// The commit gate's checks side by side (T-841, "Yes to faster merges, build it").
//
// The gate ran its ~70 checks one after another, 190 to 360 s a commit, and main moves
// every few minutes, so a merge's push raced and retried. Each check is its own process
// reading the staged snapshot, and none but the hooks selftest writes where another reads
// (traced with strace, 2026-11-05), so they run up to one per processor at once. A check
// marked `alone` runs afterwards with nothing beside it, one at a time in the list's order,
// as before: the selftest, which writes state files into the snapshot and already keeps
// every processor busy with its own tests (111 s, 327 s of processor time), and the dialogue
// speed test, which times itself (it failed at 5 s against its 3 when run beside the
// selftest, trial 2026-11-05). Nothing else changes (T-822, "exact same functionality"):
// the same checks with the same inputs, each under its own time limit, each result read
// exactly as spawnSync's was, and reported in the list's order.
//
// `runOne` is spawnSync's result, asynchronously: { status, signal, stdout, stderr, error },
// killed with SIGTERM at `timeout` (error ETIMEDOUT) or past `maxBuffer` on either stream
// (error ENOBUFS, spawnSync's default of 1 MiB), with stdin closed and nothing written to it.
// Proven by lib/test-side-by-side.mjs; called by git/pre-commit.

import { spawn } from 'node:child_process';
import { availableParallelism } from 'node:os';

export const MAX_BUFFER = 1024 * 1024;

/** One process, settled as spawnSync would report it. */
export function runOne(file, args, { cwd, env, timeout, maxBuffer = MAX_BUFFER, encoding = 'utf8' } = {}) {
  return new Promise((resolve) => {
    const out = [];
    const err = [];
    const sizes = [0, 0];
    let error;
    let child;
    try {
      child = spawn(file, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      resolve({ status: null, signal: null, stdout: '', stderr: '', error: e });
      return;
    }
    const kill = (code) => {
      if (error) return;
      error = Object.assign(new Error(`spawn ${file} ${code}`), { code });
      child.kill('SIGTERM');
    };
    const timer = timeout > 0 ? setTimeout(() => kill('ETIMEDOUT'), timeout) : null;
    const collect = (chunks, i) => (chunk) => {
      if (sizes[i] >= maxBuffer) return;
      const room = maxBuffer - sizes[i];
      chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
      sizes[i] += Math.min(chunk.length, room);
      if (chunk.length > room) kill('ENOBUFS');
    };
    child.stdout.on('data', collect(out, 0));
    child.stderr.on('data', collect(err, 1));
    child.stdin.on('error', () => {});
    child.stdin.end();
    child.on('error', (e) => {
      if (!error) error = e;
    });
    child.on('close', (status, signal) => {
      if (timer) clearTimeout(timer);
      const text = (chunks) => {
        const buf = Buffer.concat(chunks);
        return encoding ? buf.toString(encoding) : buf;
      };
      resolve({ status, signal, stdout: text(out), stderr: text(err), ...(error && { error }) });
    });
  });
}

/**
 * Run `jobs` (each { file, args, cwd, env, timeout, alone }) at most `concurrency` at once,
 * the longest limit started first so the slowest check is not left till last; then each
 * job marked `alone`, one at a time in the order given, with nothing else running.
 * Returns their results in the order given, each with `started` and `ended` (ms).
 */
export async function runSideBySide(jobs, { concurrency = availableParallelism(), run = runOne } = {}) {
  const results = new Array(jobs.length);
  const one = async (i) => {
    const { file, args = [], alone: _alone, ...opts } = jobs[i];
    const started = Date.now();
    const result = await run(file, args, opts);
    results[i] = { ...result, started, ended: Date.now() };
  };
  const indexes = jobs.map((job, i) => i);
  const queue = indexes.filter((i) => !jobs[i].alone).sort((a, b) => (jobs[b].timeout ?? 0) - (jobs[a].timeout ?? 0) || a - b);
  const worker = async () => {
    for (let i = queue.shift(); i !== undefined; i = queue.shift()) await one(i);
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, queue.length)) }, worker));
  for (const i of indexes.filter((i) => jobs[i].alone)) await one(i);
  return results;
}
