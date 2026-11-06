// Rule test: install-deps.mjs launches npm when ux/ has no whole install, and
// never twice at once.
//
// On Windows, Node (since 20.12.2) refuses to spawn a .cmd file without a
// shell and throws EINVAL; the hook's catch swallowed it, so the packages were
// never installed and `npm run check` died on its first import (2026-10-03).
// The same day node_modules was found half-installed, which the hook, asking
// only whether the folder existed, would never have repaired. Each case runs
// against a throwaway folder with a fake npm first on PATH that only leaves a
// marker, so nothing is installed and the test stays fast. Exits non-zero on
// any failure. Run by selftest.mjs.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'install-deps.mjs');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// node_modules as npm leaves it: its record of what it installed, and each package and command.
// `entry`: the tool names a main file, there (true) or not (false); left out, it names none.
const modules = (dir, { record = true, pkg = true, bin = true, entry } = {}) => {
  const nm = join(dir, 'ux', 'node_modules');
  mkdirSync(join(nm, '.bin'), { recursive: true });
  if (record) writeFileSync(join(nm, '.package-lock.json'), JSON.stringify({ packages: { 'node_modules/tool': { version: '1.0.0', bin: { tool: 'cli.js' } } } }));
  if (pkg) {
    mkdirSync(join(nm, 'tool', 'dist'), { recursive: true });
    writeFileSync(join(nm, 'tool', 'package.json'), entry === undefined ? '{}' : JSON.stringify({ main: 'dist/index.js' }));
    writeFileSync(join(nm, 'tool', 'dist', 'index.d.ts'), '');
    if (entry) writeFileSync(join(nm, 'tool', 'dist', 'index.js'), '');
  }
  if (bin) writeFileSync(join(nm, '.bin', 'tool'), '');
};
const lockAt = (dir, ageMs) => {
  mkdirSync(join(dir, 'temp'), { recursive: true });
  const lock = join(dir, 'temp', 'install-deps.lock');
  writeFileSync(lock, 'another session\n');
  const at = (Date.now() - ageMs) / 1000;
  utimesSync(lock, at, at);
};

// The verb npm is run with: `ci` only where there is nothing to delete. Over a
// half install it is `install`, which repairs in place (2026-10-09: `npm ci`
// emptied node_modules hourly, stopped by a file a dev server held).
const CASES = [
  ['launches npm ci when ux/node_modules is missing', () => {}, 'ci'],
  ['repairs a half install with npm install: a command missing from .bin', (d) => modules(d, { bin: false }), 'install'],
  ['repairs a half install with npm install: a package missing', (d) => modules(d, { pkg: false }), 'install'],
  ['repairs an install npm never finished with npm install (no record of it)', (d) => modules(d, { record: false }), 'install'],
  ['repairs a package whose entry file is gone with npm install, removing it first (2026-10-30)', (d) => modules(d, { entry: false }), 'install', (d) => !existsSync(join(d, 'ux', 'node_modules', 'tool'))],
  ['leaves a whole install alone', (d) => modules(d), false],
  ['leaves a whole install alone: the entry file its package names is there', (d) => modules(d, { entry: true }), false],
  ['waits while another session is installing (a fresh lock)', (d) => lockAt(d, 60 * 1000), false],
  ['takes over a lock left by an install that died', (d) => lockAt(d, 60 * 60 * 1000), 'ci'],
];

let failed = 0;
for (const [what, arrange, launches, after] of CASES) {
  const dir = makeTemp('dear-deps-');
  const marker = join(dir, 'npm-ran');
  const lock = join(dir, 'temp', 'install-deps.lock');
  let ok = false;
  let detail = '';
  try {
    const bin = join(dir, 'bin');
    mkdirSync(join(dir, 'ux'), { recursive: true });
    mkdirSync(bin);
    writeFileSync(join(dir, 'ux', 'package-lock.json'), '{}');
    if (process.platform === 'win32') writeFileSync(join(bin, 'npm.cmd'), `@echo off\r\necho %1> "${marker}"\r\n`);
    else writeFileSync(join(bin, 'npm'), `#!/bin/sh\necho "$1" > "${marker}"\n`, { mode: 0o755 });
    arrange(dir);

    const env = { ...process.env, CLAUDE_PROJECT_DIR: dir, PATH: bin + delimiter + process.env.PATH };
    delete env.DEAR_RECORD_READONLY;
    const run = spawnSync(process.execPath, [hook], { env, input: '{}', encoding: 'utf8', timeout: 10000 });
    if (run.status !== 0) detail = `hook exited ${run.status}: ${(run.stderr || '').trim()}`;

    // The hook detaches the install and returns at once: give the fake a
    // moment to run, and the install a moment to let go of its lock.
    const until = Date.now() + (launches ? 10000 : 1500);
    while (!existsSync(marker) && Date.now() < until) await wait(100);
    if (launches) {
      while (existsSync(lock) && Date.now() < until) await wait(100);
      const verb = existsSync(marker) ? readFileSync(marker, 'utf8').trim() : '';
      ok = verb === launches && !existsSync(lock) && (!after || after(dir));
      if (!ok) detail ||= !verb ? 'npm never ran' : verb !== launches ? `npm ${verb}, not npm ${launches}` : existsSync(lock) ? 'the lock was not released' : 'the broken package was left in place';
    } else {
      ok = !existsSync(marker);
      if (!ok) detail ||= 'npm ran';
    }
  } finally {
    // The detached fake can still hold its folder as it exits (EBUSY on Windows,
    // 2026-10-04): a throwaway left in the OS temp folder is no failure of the rule.
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch {
      /* left for the OS to clear */
    }
  }
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok || !detail ? '' : ` (${detail})`}`);
}
process.exit(failed ? 1 : 0);
