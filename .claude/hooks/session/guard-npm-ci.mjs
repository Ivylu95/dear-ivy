// PreToolUse(Bash) — never `npm ci` over the packages of the tree her
// conversation saves from (HBT-007 design 3).
//
// `npm ci` empties node_modules before it installs. In the main tree a running
// dev server holds some of those files open, so on Windows it stops with EPERM
// halfway, the folder already emptied: the dashboard, the build, lint and the
// commit gate's checks all fail until someone repairs it. It happened twice:
// install-deps.mjs at session start (2026-10-09, fixed there), and the
// heartbeat orchestrator's install step run from the repository root rather
// than its own checkout (2026-10-10, 22:31).
//
// Refused only where it does harm: the main tree's ux/ while its packages are
// installed. A checkout's own ux/ (temp/hb-run/ux), a fresh tree with nothing
// installed, and `npm install`, which repairs in place, all pass. The target is
// worked out from the command's own `cd` steps and `--prefix`, from the
// session's working folder.
// Proven by the selftest's cases for this hook, the first a replay of 22:31.

import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pass, readHookInput, refuse, repoRoot } from '../lib/hook.mjs';

// npm's names for a clean install.
const CLEAN = new Set(['ci', 'clean-install', 'ic', 'install-clean', 'isntall-clean']);

// Git Bash writes C:\x as /c/x; resolve() on Windows reads that as \c\x.
const native = (p) => String(p).replace(/^\/([a-zA-Z])(?=\/|$)/, '$1:').replace(/^(["'])(.*)\1$/, '$2');
const same = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

const input = await readHookInput();
const command = input?.tool_input?.command ?? '';
if (!/\bnpm/.test(command)) pass();

const mainUx = join(repoRoot, 'ux');
if (!existsSync(join(mainUx, 'node_modules'))) pass();

let cwd = native(input?.cwd || repoRoot);
for (const part of command.split(/&&|\|\||;|\|/)) {
  const cd = part.match(/^\s*(?:cd|pushd)\s+(\S+)\s*$/);
  if (cd) {
    cwd = resolve(cwd, native(cd[1]));
    continue;
  }
  const npm = part.match(/(?:^|[\s/\\])npm(?:\.cmd)?\s+(.*)$/s);
  if (!npm) continue;
  const words = npm[1].trim().split(/\s+/);
  let prefix = null;
  let verb = null;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === '--prefix' || w === '-C') prefix = words[++i];
    else if (w.startsWith('--prefix=')) prefix = w.slice('--prefix='.length);
    else if (!w.startsWith('-') && verb === null) verb = w;
  }
  if (!CLEAN.has(verb)) continue;
  const target = prefix ? resolve(cwd, native(prefix)) : cwd;
  if (same(target, mainUx)) {
    refuse(
      'PreToolUse',
      "`npm ci` would empty ux/node_modules in the tree her conversation saves from, and a running dev server's open files stop it halfway (HBT-007 design 3). " +
        'To repair packages here, run `npm install` from ux/, which fills in without deleting. ' +
        "A heartbeat installs into its own checkout: `npm --prefix temp/hb-run/ux ci`. A clean reinstall here is the developer's, by hand.",
    );
  }
}
pass();
