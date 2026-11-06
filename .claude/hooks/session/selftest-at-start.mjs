// SessionStart — every safeguard is seen to refuse, without holding the session.
//
// SFG-013, "Nothing counts as a safeguard until it has been seen to refuse what
// it exists to refuse." The commit gate runs the hook selftest on every harness
// commit; this runs it from session start too, so a safeguard that died between
// commits (a clone that dropped an executable bit, a folder that moved) is named.
// The commit-message name check sat dead for days on 2026-09-27 to 2026-09-29
// with nothing saying so.
//
// SFG-013 design 3, "At session start it runs in the background, never holding
// the session, and the next session names any safeguard its last run found
// dead, or says when no run has finished in a day." It ran in the foreground
// under a 45 s limit, and a whole run takes about 90 s, so every session waited
// 45 s and then said "unchecked" (design audit, 2026-10-08). Now the hook
// reports the last finished run, starts the next one detached (`--run`, this
// same file), and returns at once. The run writes its result to
// .claude/hooks/state/selftest-last.json, never data/ (ARC-014).
//
// Silent when the last run passed within a day. The notes go to the developer
// only: an everyday chat never hears about hooks (CON-013). Skipped under the
// selftest itself (DEAR_RECORD_READONLY), which would otherwise run itself.

import { spawn, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const STATE = 'selftest-last.json';
const DAY_MS = 24 * 3600e3;
// A run marked running longer than this died; the next session starts another.
const RUN_CAP_MS = 10 * 60e3;

/**
 * What to tell the developer about the last run, or null for nothing.
 * `last` is the state file's content: { status: running|passed|failed,
 * started, finished, failing[] }, or null when no run was ever recorded.
 */
export function summarize(state, now = Date.now()) {
  // A run still going carries the one before it, so a failure is never hidden
  // behind the run that may confirm it.
  const last = state?.status === 'running' ? (state.previous ?? null) : state;
  const header = 'FOR THE DEVELOPER ONLY — do not raise in an everyday chat.';
  const run = 'Run: node .claude/hooks/selftest.mjs';
  if (last?.status === 'failed') {
    return [header, 'WARNING: the hook selftest failed on its last run (SFG-013), so a safeguard may be dead:', ...(last.failing ?? []).map((l) => `  ${l}`), run].join('\n');
  }
  const finished = Date.parse(last?.finished ?? '');
  if (Number.isNaN(finished) || now - finished > DAY_MS) {
    return [header, 'NOTE: no hook selftest has finished in the last day, so the safeguards are unchecked (SFG-013). One is starting in the background now; the next session reports it.', run].join('\n');
  }
  return null;
}

/** Whether a new run should start: none is going, or the one marked going died. */
export function shouldStart(last, now = Date.now()) {
  if (last?.status !== 'running') return true;
  const started = Date.parse(last.started ?? '');
  // A run marked going from a time still to come died under a skewed clock: it once
  // held every later run off while the note said one was "starting now" (round 3, B9).
  return Number.isNaN(started) || now - started > RUN_CAP_MS || started > now;
}

const main = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (main) {
  const { context, pass, repoRoot, markerRead, markerWrite } = await import('../lib/hook.mjs');
  if (process.env.DEAR_RECORD_READONLY === '1') pass();
  const read = () => {
    try {
      return JSON.parse(markerRead(STATE) || 'null');
    } catch {
      return null;
    }
  };
  const write = (o) => markerWrite(STATE, `${JSON.stringify(o)}\n`);

  if (process.argv.includes('--run')) {
    // The detached run: the selftest, then its result for the next session.
    const started = new Date().toISOString();
    const r = spawnSync(process.execPath, [join(repoRoot, '.claude', 'hooks', 'selftest.mjs')], {
      cwd: repoRoot,
      encoding: 'utf8',
      timeout: RUN_CAP_MS,
      windowsHide: true,
    });
    const timedOut = r.error?.code === 'ETIMEDOUT' || Boolean(r.signal);
    const failing = timedOut
      ? [`did not finish within ${RUN_CAP_MS / 60e3} minutes`]
      : String([r.stdout, r.stderr].filter(Boolean).join('\n'))
          .split('\n')
          .map((l) => l.trim())
          // A passing case can have "failing" in its name: only lines that are not ok.
          .filter((l) => !/^ok\b/.test(l) && /FAIL|MISSING CASE|failing/.test(l))
          .slice(0, 12);
    write({ status: r.status === 0 ? 'passed' : 'failed', started, finished: new Date().toISOString(), failing });
    process.exit(0);
  }

  const last = read();
  const note = summarize(last);
  if (shouldStart(last)) {
    const previous = last?.status === 'running' ? (last.previous ?? null) : last;
    write({ status: 'running', started: new Date().toISOString(), previous });
    spawn(process.execPath, [fileURLToPath(import.meta.url), '--run'], {
      cwd: repoRoot,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      env: { ...process.env, CLAUDE_PROJECT_DIR: repoRoot },
    }).unref();
  }
  if (note) context('SessionStart', note);
  pass();
}
