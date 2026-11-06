// What the harness's own tests and eval runs leave in the system temp folder,
// and the sweep that clears it (A-147, T-467: "is there anything that is left
// unbounded… check the temp folder").
//
// Every test makes a throwaway folder in the system temp folder, named by a prefix,
// and many never remove it, or remove it only when they pass; the selftest runs
// them on every harness commit and at every session start. Seen 2026-10-30: 4.1 GB
// and about 8,000 folders in twelve days. Each eval run also leaves the chat
// Claude Code keeps for its throwaway copy, under ~/.claude/projects/ (676 folders).
//
// Only names the harness makes are touched: a known prefix followed by mkdtemp's
// six characters (and the `.remote.git` / `.origin` siblings a persona copy
// keeps). A day is the margin: longer than any test or eval run, so nothing in
// use is reached. The kept live chats (`dear-evals-private`) are never touched.
// `test-temp-litter.mjs` reads every mkdtempSync in the repository and fails on a
// prefix missing here, so the list cannot fall behind the code.

import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** The one parent folder every throwaway folder of the harness is made in (T-485). */
export const TEMP_ROOT = join(tmpdir(), 'dear-me');

const made = new Set();
let hooked = false;
/**
 * A fresh throwaway folder, `<TEMP_ROOT>/<name>XXXXXX`, removed when this process
 * exits, passing or failing; whatever a killed process leaves, the sweep clears
 * once a day old. The only way the harness makes one: a test refuses a bare
 * mkdtempSync on the system temp folder anywhere else.
 */
export function makeTemp(name = 'tmp-') {
  mkdirSync(TEMP_ROOT, { recursive: true });
  const dir = mkdtempSync(join(TEMP_ROOT, name));
  made.add(dir);
  if (!hooked) {
    hooked = true;
    process.on('exit', clearMade);
    // A run stopped from outside never reaches 'exit': on 2 Nov a behaviour lock
    // stopped by a time limit left 613 MB for a day (T-643). So a stop clears the
    // folders too, then is passed on, so the process still ends as it was told to.
    // A forced kill cannot be caught; the day-old sweep stays the backstop.
    for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP']) {
      const onStop = () => {
        clearMade();
        process.removeListener(sig, onStop);
        if (process.listenerCount(sig) === 0) process.kill(process.pid, sig);
      };
      process.on(sig, onStop);
    }
  }
  return dir;
}

function clearMade() {
  for (const d of made) {
    try { rmSync(d, { recursive: true, force: true }); } catch { /* left for the sweep */ }
    for (const sib of [`${d}.remote.git`, `${d}.origin`]) { try { rmSync(sib, { recursive: true, force: true }); } catch { /* the same */ } }
  }
  made.clear();
}

/** Names made before TEMP_ROOT existed (to 2026-10-30), straight in the system temp folder; swept until none are left. */
export const LITTER_PREFIXES = [
  'dear-', 'reminders-', 'check-ins-', 'brief-record-', 'cal-guard-', 'crisis-plan-', 'detached-',
  'dev-backlog-', 'dev-reply-plan-', 'fitness-', 'gcal-', 'harness-lock-', 'home-', 'loops-',
  'precursor-', 'reconcile-test-', 'restore-drill-test-', 'retrieval-', 'tl-', 'tz-',
];
const KEPT = /^dear-evals-private$/;
const escape = (s) => s.replace(/[-]/g, '\\-');
const NAME = new RegExp(`^(?:${LITTER_PREFIXES.map(escape).join('|')})[A-Za-z0-9-]*?[A-Za-z0-9]{6}(?:\\.remote\\.git|\\.origin)?$`);

/** A name in the system temp folder that one of the harness's own runs made. */
export const isLitter = (name) => !KEPT.test(name) && NAME.test(name);

/** The folder Claude Code keeps for a chat run in `dir`, under ~/.claude/projects/. */
export const projectSlug = (dir) => dir.replace(/[^a-zA-Z0-9]/g, '-');

/**
 * Remove litter older than `maxAgeMs` from `dir`, and the chats Claude Code kept for
 * runs in it from `projects`. Returns how many entries went. Never throws.
 */
export function sweepLitter({ dir = tmpdir(), projects = join(homedir(), '.claude', 'projects'), maxAgeMs = 86_400_000, now = Date.now() } = {}) {
  let removed = 0;
  const old = (path) => {
    try { return now - statSync(path).mtimeMs > maxAgeMs; } catch { return false; }
  };
  const drop = (path) => {
    try { rmSync(path, { recursive: true, force: true }); removed += 1; } catch { /* locked: left for the next run */ }
  };
  const list = (d) => { try { return readdirSync(d); } catch { return []; } };
  const root = join(dir, 'dear-me');
  for (const name of list(root)) if (old(join(root, name))) drop(join(root, name));
  for (const name of list(dir)) if (isLitter(name) && old(join(dir, name))) drop(join(dir, name));
  const legacy = projectSlug(join(dir, '/'));
  const central = projectSlug(join(root, '/'));
  for (const name of list(projects)) {
    const p = join(projects, name);
    if (name.startsWith(central) ? old(p) : name.startsWith(legacy) && isLitter(name.slice(legacy.length)) && old(p)) drop(p);
  }
  return removed;
}

/**
 * Litter still in the system temp folder, by count and megabytes. Only what is
 * older than `minAgeMs` counts: a run under way (the session-start selftest) holds
 * hundreds of MB that it clears itself, and counting it read as a leak (T-643).
 */
export function litterLeft(dir = tmpdir(), { minAgeMs = 3_600_000, now = Date.now() } = {}) {
  let count = 0;
  let bytes = 0;
  const settled = (p) => {
    try { return now - statSync(p).mtimeMs >= minAgeMs; } catch { return false; }
  };
  const size = (p) => {
    let st;
    // The link, never what it points to: a test copy links the app's node_modules,
    // and following it counted 660 MB that is not litter (T-643).
    try { st = lstatSync(p); } catch { return; }
    if (!st.isDirectory()) { bytes += st.size; return; }
    let names;
    try { names = readdirSync(p); } catch { return; }
    for (const n of names) size(join(p, n));
  };
  let names;
  try { names = readdirSync(dir); } catch { names = []; }
  for (const name of names) if (isLitter(name) && settled(join(dir, name))) { count += 1; size(join(dir, name)); }
  let inside;
  try { inside = readdirSync(join(dir, 'dear-me')); } catch { inside = []; }
  for (const name of inside) if (settled(join(dir, 'dear-me', name))) { count += 1; size(join(dir, 'dear-me', name)); }
  return { count, mb: Math.round(bytes / 1e6) };
}

// The backstop (code upkeep's daily run): `node .claude/hooks/lib/temp-litter.mjs`.
// Sweeps, then says what is left; exits 1 past LITTER_CEILING_MB so the run reports it.
export const LITTER_CEILING_MB = 1000;
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const removed = sweepLitter();
  const left = litterLeft();
  const over = left.mb > LITTER_CEILING_MB;
  console.log(`temp litter: removed ${removed}; ${left.count} left over an hour old, ${left.mb} MB${over ? ` — over the ${LITTER_CEILING_MB} MB ceiling, though everything left is under a day old: something makes litter faster than it ages` : ''}`);
  process.exit(over ? 1 : 0);
}

/**
 * The per-chat markers in .claude/hooks/state/ (`<what>-<chat id>`, e.g. `touched-<id>.json`):
 * one set per chat, never removed, so the folder grew with every chat ever held (A-147).
 * A marker untouched for `maxAgeDays` belongs to a chat long over; the owed-review look-back
 * reads thirty days, so this waits longer. The standing files have short names and are kept.
 */
export function pruneMarkers(stateDir, { maxAgeDays = 45, now = Date.now() } = {}) {
  let removed = 0;
  let names;
  try { names = readdirSync(stateDir); } catch { return 0; }
  for (const name of names) {
    if (!/^[a-z][a-z-]*?-[A-Za-z0-9_-]{20,}(?:\.json)?$/.test(name)) continue;
    const p = join(stateDir, name);
    try {
      if (now - statSync(p).mtimeMs > maxAgeDays * 86_400_000) { rmSync(p, { force: true }); removed += 1; }
    } catch { /* left for the next run */ }
  }
  return removed;
}

/**
 * A scratch file kept fresh by appends (the jobs' `temp/reminders-sent.txt`, written
 * hourly) never ages out of the seven-day sweep, so it grew without end. One over
 * `maxBytes` keeps only its newest lines up to half that size (A-147).
 */
export function trimScratch(dir, { maxBytes = 1_000_000 } = {}) {
  let trimmed = 0;
  let names;
  try { names = readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
  for (const e of names) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { trimmed += trimScratch(p, { maxBytes }); continue; }
    try {
      if (statSync(p).size <= maxBytes) continue;
      const text = readFileSync(p, 'utf8');
      let keep = text.slice(-Math.floor(maxBytes / 2));
      keep = keep.slice(keep.indexOf('\n') + 1);
      writeFileSync(p, keep);
      trimmed += 1;
    } catch { /* left for the next run */ }
  }
  return trimmed;
}

/*
 * A copy of a live folder into a test's throwaway folder (2026-11-05). cpSync copies a folder whole
 * and throws when a file it listed is gone a moment later; the selftest runs its tests side by side,
 * so one test's copy of .claude met a session state file another had just removed (ENOENT, a
 * heartbeat claim refused). This copies file by file, with the same filter, and skips only a file
 * that vanished between listing and copying; anything else still throws.
 */
const gone = (err) => err?.code === 'ENOENT';

/** Copy `src` (a folder or one file) to `dst`, as cpSync's recursive copy with `filter` would. */
export function copyTree(src, dst, { filter = () => true } = {}) {
  if (!filter(src, dst)) return;
  let st;
  try {
    st = lstatSync(src);
  } catch (err) {
    if (gone(err)) return;
    throw err;
  }
  if (st.isDirectory()) {
    mkdirSync(dst, { recursive: true });
    let names;
    try {
      names = readdirSync(src);
    } catch (err) {
      if (gone(err)) return;
      throw err;
    }
    for (const name of names) copyTree(join(src, name), join(dst, name), { filter });
    return;
  }
  mkdirSync(dirname(dst), { recursive: true });
  try {
    if (st.isSymbolicLink()) symlinkSync(readlinkSync(src), dst);
    else copyFileSync(src, dst);
  } catch (err) {
    if (!gone(err)) throw err;
  }
}
