// SessionStart — the ux/ packages are installed, so the full check can run.
//
// A cloud session starts from a fresh clone with no ux/node_modules, and
// `npm run check` then dies on its first import (js-yaml, 2026-09-29): every
// check it carries was skipped, session after session, with nothing saying so.
//
// Installs in the background from the lockfile, detached, so the session
// opens without waiting on it: `npm ci` when there is no node_modules at all,
// `npm install` over a half one. `npm ci` deletes node_modules before it
// installs, and a file a running dev server holds open (Next's compiler
// binary) stops it partway, the folder already emptied. On 2026-10-09 every
// heartbeat session found that half install and ran `npm ci` over it again,
// hourly, leaving 7 of 287 packages; `npm install` repairs in place. Never reports: a session opening with
// housekeeping is noise, and a failed install shows itself the moment the
// check is run.
//
// Does nothing when the install is whole, which is not the same as the folder
// being there: node_modules was found half-installed on 2026-10-03 (a package
// missing, an empty .bin) and this hook, which then only asked whether the
// folder existed, would never have repaired it. Whole means npm's own record
// of what it installed (node_modules/.package-lock.json, written once an
// install finishes) is there, and every package and command it lists is too,
// each package with the entry file its package.json names. One without it is
// removed before the repair, since npm would otherwise keep it as it is.
//
// One install at a time: two sessions opening together both found the folder
// missing and ran `npm ci` over each other. The first takes a lock in the
// scratch folder (temp/), held by the detached install and removed when it
// ends; a lock older than LOCK_STALE_MS is from an install that died, and is
// taken over.
//
// Skipped under the hook selftest (DEAR_RECORD_READONLY), which must stay fast
// and touch nothing. Falls short in that a check run in the first minute can
// still find the install unfinished, and an install run by hand is not locked.
// test-install-deps.mjs.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pass, repoRoot } from '../lib/hook.mjs';
import { scratchDir } from '../lib/scratch.mjs';

const ux = join(repoRoot, 'ux');
const lock = join(scratchDir(repoRoot), 'install-deps.lock');
// Far longer than a cold `npm ci` here (about a minute, 2026-10-05).
const LOCK_STALE_MS = 15 * 60 * 1000;

/**
 * The packages whose package.json is there but whose entry file is not: the
 * folder looks installed, so npm, trusting its own record, never refills it.
 * On 2026-10-18 and again 2026-10-30 lint died on such a package here (its
 * dist/ left with only the .d.ts files), and this hook, reading package.json
 * alone, called the install whole. Only a package naming a `main` is judged.
 */
export function brokenPackages(dir) {
  let record;
  try {
    record = JSON.parse(readFileSync(join(dir, 'node_modules', '.package-lock.json'), 'utf8'));
  } catch {
    return [];
  }
  return Object.keys(record.packages ?? {}).filter((path) => {
    if (!path) return false;
    let main;
    try {
      main = JSON.parse(readFileSync(join(dir, path, 'package.json'), 'utf8')).main;
    } catch {
      return false; // no package.json: installWhole's own case
    }
    if (typeof main !== 'string' || !main.trim()) return false;
    const at = join(dir, path, main);
    return !['', '.js', '.json', '.cjs', '.mjs', '/index.js', '/index.json'].some((ext) => existsSync(at + ext));
  });
}

/** Whether every package and command npm says it installed is on disk, each with its entry file. */
function installWhole(dir) {
  const modules = join(dir, 'node_modules');
  let record;
  try {
    record = JSON.parse(readFileSync(join(modules, '.package-lock.json'), 'utf8'));
  } catch {
    return false;
  }
  return Object.entries(record.packages ?? {}).every(([path, pkg]) =>
    !path || (existsSync(join(dir, path, 'package.json')) && Object.keys(pkg.bin ?? {}).every((name) => existsSync(join(modules, '.bin', name))))) &&
    brokenPackages(dir).length === 0;
}

// The detached half: run the install, then let the next session try again.
if (process.argv[2] === '--install') {
  const verb = process.argv[3] === 'install' ? 'install' : 'ci';
  // Windows: Node refuses to spawn npm.cmd without a shell (EINVAL, since
  // 20.12.2). The command is fixed, so the shell sees nothing from outside;
  // one string, since an argument list with a shell is deprecated (DEP0190).
  const win = process.platform === 'win32';
  const args = [verb, '--no-audit', '--no-fund', '--silent'];
  try {
    // A package missing its entry file goes first, so npm sees it missing and
    // fetches it whole; left in place, `npm install` would trust it as it is.
    if (verb === 'install') for (const path of brokenPackages(ux)) rmSync(join(ux, path), { recursive: true, force: true });
    spawnSync(win ? `npm ${args.join(' ')}` : 'npm', win ? [] : args, { cwd: ux, shell: win, stdio: 'ignore', windowsHide: true });
  } finally {
    rmSync(lock, { force: true });
  }
  process.exit(0);
}

const takeLock = () => {
  mkdirSync(scratchDir(repoRoot), { recursive: true });
  try {
    if (Date.now() - statSync(lock).mtimeMs < LOCK_STALE_MS) return false;
    rmSync(lock, { force: true });
  } catch {
    /* no lock: free */
  }
  try {
    writeFileSync(lock, `${process.pid} ${new Date().toISOString()}\n`, { flag: 'wx' });
    return true;
  } catch {
    return false; // another session took it between the two steps
  }
};

if (process.env.DEAR_RECORD_READONLY === '1') pass();
if (!existsSync(join(ux, 'package-lock.json')) || installWhole(ux) || !takeLock()) pass();

// The install runs in a node of its own, detached, so this hook returns at
// once and the lock is released only when npm has finished.
try {
  const verb = existsSync(join(ux, 'node_modules')) ? 'install' : 'ci';
  spawn(process.execPath, [fileURLToPath(import.meta.url), '--install', verb], {
    cwd: ux,
    env: { ...process.env, CLAUDE_PROJECT_DIR: repoRoot },
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  }).unref();
} catch {
  rmSync(lock, { force: true }); // nothing started: leave it free
}
pass();
