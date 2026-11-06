#!/usr/bin/env node
// The restore drill (DAT-003, "Nothing in the record is lost or changed without trace",
// design 5): her record is saved to GitHub every turn, and this proves the saved copy
// comes back whole. It clones the repository fresh, as a new device would, and checks the
// record it gets: every standing file each module names is there, every file the record's
// own index links to exists, the timeline is in date order and each line's pointer
// resolves, the profile passes its rules, and the reminders and check-ins files read.
//
// It reads shapes, dates and links, never what she wrote, and it names a folder and a
// count, never a file: a file under people/ carries a person's name.
//
//   node ux/scripts/restore-drill.mjs                 clone origin into the system's temp folder, check, remove
//   node ux/scripts/restore-drill.mjs --record <dir>  check a record folder already on disk (a test)
//
// Exit 0: the record restores whole. Exit 1: each fault on its own line. Exit 2: no clone.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readModules } from '../../.claude/hooks/lib/modules.mjs';
import { readProfile } from '../../.claude/hooks/lib/profile-schema.mjs';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Where a fault is, said safely: its folder under data/, never the file's own name. */
const where = (rel) => posix.dirname(rel).split('/').slice(0, 2).join('/') || '.';

/** Every fault in the record folder `data`, as plain lines; the modules' shapes come from `repo`. */
export function drill(data, repo = ROOT) {
  const faults = [];
  const counted = new Map();
  const fault = (kind, rel) => counted.set(`${kind} in ${where(rel)}`, (counted.get(`${kind} in ${where(rel)}`) ?? 0) + 1);
  if (!existsSync(data)) return ['no record folder at all'];

  // 1. Every standing file a module names.
  // A shape may be a folder (core's is): then every file inside it is one.
  for (const mod of readModules(repo)) {
    for (const [from, to] of mod.shapes) {
      const src = join(repo, from);
      const files = existsSync(src) && statSync(src).isDirectory()
        ? readdirSync(src, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => posix.join(to, relative(src, join(e.parentPath ?? e.path, e.name)).split(sep).join('/')))
        : [to];
      for (const rel of files) if (!existsSync(join(data, rel))) fault('a standing file missing', rel);
    }
  }

  // 2. Every file the record's index links to.
  const index = join(data, 'README.md');
  if (existsSync(index)) {
    for (const [, target] of readFileSync(index, 'utf8').matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^[a-z]+:/i.test(target)) continue;
      const rel = posix.normalize(decodeURI(target));
      if (!existsSync(join(data, rel))) fault('a link in the index to nothing', rel);
    }
  }

  // 3. The timeline: in date order, each pointer resolving.
  const timeline = join(data, 'core', 'timeline.md');
  if (existsSync(timeline)) {
    let last = '';
    for (const line of readFileSync(timeline, 'utf8').split('\n')) {
      // A line `YYYY-MM-DD · …`, or a table row `| YYYY-MM-DD | … |`.
      const m = /^\|?\s*(\d{4}-\d{2}-\d{2})\s*(?:·|\|)/.exec(line);
      if (!m) continue;
      if (m[1] < last) fault('a timeline line out of date order', 'core/timeline.md');
      last = m[1] > last ? m[1] : last;
      const to = /→\s*(?:data\/)?(\S+\.md)/.exec(line)?.[1];
      if (to && !existsSync(join(data, to))) fault('a timeline pointer to nothing', 'core/timeline.md');
    }
  }

  // 4. The profile passes its own rules.
  const profile = join(data, 'PROFILE.yaml');
  if (existsSync(profile)) {
    try {
      if (readProfile(readFileSync(profile, 'utf8')).errors.length) faults.push('the profile breaks its rules');
    } catch {
      faults.push('the profile does not read');
    }
  }

  // 5. The files machines send from read as JSON.
  for (const rel of ['core/calendar/reminders.json', 'core/calendar/check-ins.json']) {
    const file = join(data, rel);
    if (!existsSync(file)) continue;
    try { JSON.parse(readFileSync(file, 'utf8')); } catch { fault('a schedule file that does not read', rel); }
  }

  return [...faults, ...[...counted].map(([what, n]) => (n > 1 ? `${n} × ${what}` : what))];
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const at = process.argv.indexOf('--record');
  let data;
  let clone = null;
  if (at > -1) data = process.argv[at + 1];
  else {
    clone = makeTemp('dear-restore-');
    try {
      const url = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' }).trim();
      execFileSync('git', ['clone', '-q', '--depth', '1', '--branch', 'main', url, join(clone, 'copy')], { stdio: 'ignore' });
    } catch {
      rmSync(clone, { recursive: true, force: true });
      console.log('restore drill: NOT RUN: the repository could not be cloned from GitHub');
      process.exit(2);
    }
    data = join(clone, 'copy', 'data');
  }
  const faults = drill(data, clone ? join(clone, 'copy') : ROOT);
  if (clone) rmSync(clone, { recursive: true, force: true });
  if (faults.length) {
    console.log(`restore drill: the record does not come back whole\n${faults.map((f) => `  - ${f}`).join('\n')}`);
    process.exit(1);
  }
  console.log(clone ? 'restore drill: a fresh copy from GitHub has the whole record, and is removed' : 'restore drill: the record folder is whole');
}
