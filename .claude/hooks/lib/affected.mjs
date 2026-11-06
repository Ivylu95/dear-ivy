// Which tests a code change can break (A-164, "Checks scale with the change").
//
// The hooks selftest was two thirds of every commit's wait (104 of 151 s, 3 Nov),
// mostly rule tests the change could not reach. A commit that changes only code,
// outside the safety and privacy surfaces, runs the hook cases and rule tests
// whose files reach a changed one: by importing it, directly or through others,
// or, from a test file, by naming it (a test that spawns `save-record.mjs`
// names it), and so on through what that file imports. Anything else
// in the commit (a skill, a spec, settings, a Markdown or JSON file a test may
// read) runs the full set, as do the daily safeguard check and every release,
// so nothing is checked less often overall.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

const CODE = /\.(mjs|js)$/;
// Always the full set: safety and privacy (A-164), the safety core, the gates
// themselves, and this file, which decides what runs.
const FULL = [
  /^\.claude\/hooks\/safety\//,
  /^\.claude\/hooks\/privacy\//,
  /^\.claude\/hooks\/git\//,
  /^\.claude\/hooks\/selftest\.mjs$/,
  /^\.claude\/hooks\/lib\/affected\.mjs$/,
  /^\.claude\/hooks\/lib\/git-words\.mjs$/,
  /^ux\/lib\/safety\.mjs$/,
  /^ux\/lib\/checks\.mjs$/,
  /privacy/i,
  /safety/i,
  /crisis/i,
];
const ROOTS = ['.claude/hooks', 'ux/lib', 'ux/scripts', 'dev/skills'];

/** True when every staged file is code a test run can be narrowed for. */
export function narrowable(staged) {
  return staged.length > 0 && staged.every((f) => CODE.test(f) && !f.includes('node_modules') && !FULL.some((r) => r.test(f)));
}

function codeFiles(root) {
  const out = [];
  const walk = (dir) => {
    let names = [];
    try {
      names = readdirSync(join(root, dir));
    } catch {
      return;
    }
    for (const n of names) {
      if (n === 'node_modules' || n.startsWith('.git')) continue;
      const rel = `${dir}/${n}`;
      let st;
      try {
        st = statSync(join(root, rel));
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(rel);
      else if (CODE.test(n)) out.push(rel);
    }
  };
  for (const r of ROOTS) walk(r);
  return out;
}

/**
 * A reach function over the repository's code: reach(file) is every code file it
 * imports or names, transitively, itself included. A basename two files share
 * reaches both, so a name never narrows past a file it might mean.
 */
export function reacher(root) {
  const files = codeFiles(root);
  const byName = new Map();
  for (const f of files) (byName.get(basename(f)) ?? byName.set(basename(f), []).get(basename(f))).push(f);
  const direct = new Map();
  const refs = (f) => {
    if (direct.has(f)) return direct.get(f);
    const found = new Set();
    let text = '';
    try {
      text = readFileSync(join(root, f), 'utf8');
    } catch {
      direct.set(f, found);
      return found;
    }
    for (const m of text.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const to = relative(root, resolve(join(root, dirname(f)), m[1])).split('\\').join('/');
      if (existsSync(join(root, to))) found.add(to);
    }
    // A path to a script, from the root or this file (a hook that runs `ux/scripts/dialogue.mjs`).
    for (const m of text.matchAll(/['"`]((?:\.{1,2}\/)?[\w.-]+(?:\/[\w.-]+)+\.m?js)['"`]/g)) {
      for (const to of [m[1], relative(root, resolve(join(root, dirname(f)), m[1])).split('\\').join('/')]) if (existsSync(join(root, to))) found.add(to);
    }
    // A test names what it runs (a hook it spawns, a script it drives); a library's
    // mention of a file name is a message, and following those reached everything.
    if (/^test-|^selftest/.test(basename(f))) for (const m of text.matchAll(/['"`/]([\w.-]+\.m?js)\b/g)) for (const to of byName.get(m[1]) ?? []) found.add(to);
    direct.set(f, found);
    return found;
  };
  const memo = new Map();
  return (start) => {
    if (memo.has(start)) return memo.get(start);
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) for (const to of refs(queue.pop())) if (!seen.has(to)) (seen.add(to), queue.push(to));
    memo.set(start, seen);
    return seen;
  };
}

/** Of `files` (repository paths), those whose reach holds a staged file. */
export function affected(root, files, staged, reach = reacher(root)) {
  return files.filter((f) => staged.some((s) => reach(f).has(s)));
}
