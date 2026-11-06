// The paths the registers' design columns name, read in one place for the two
// checks that hold the design and the repository to each other: every path a
// row names exists (check-spec-paths, WKB-007), and every piece of machinery is
// named by a row (check-claimed, FND-008).
//
// A path is a backticked token with a slash or a file extension, read from the
// repository root (the house rule for paths in prose). Placeholders (<…>, *, …),
// absolute routes and the record's paths are skipped: the record's shape is
// hers, and varies.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { walkFiles } from '../lib/walk-skip.mjs';
import { parseRows } from '../../.claude/hooks/lib/spec-rows.mjs';

// Her record and the test copy of it.
const RECORDS = ['data/', 'data-sandbox/'];
const PATH = /`([^`\s]+)`/g;
const looksLikePath = (t) => (t.includes('/') || /\.(mjs|js|json|jsonl|md|ya?ml|txt|tsv|css|tsx?|sh)$/.test(t)) && !/[<>*…{}$]|^https?:|^\.\.\.|^-/.test(t);

/** Every register file under the design folder. */
function registers(root) {
  const dir = join(root, SPECS_DIR);
  if (!existsSync(dir)) throw new Error(`no specs at ${dir}`);
  return walkFiles(dir, { names: new Set(), keep: (n) => n.endsWith('.md') });
}

/** [{ id, file, token }] for every backticked token in a design column. */
export function designTokens(root) {
  const out = [];
  for (const file of registers(root)) {
    for (const { id, design } of parseRows(readFileSync(file, 'utf8'))) {
      for (const [, token] of design.matchAll(PATH)) out.push({ id, file, token: token.replace(/[.,;:)]+$/, '').replace(/^\.\//, '') });
    }
  }
  return out;
}

/** [{ id, file, path }] for every path a design column names. */
export function designPaths(root) {
  return designTokens(root)
    .filter(({ token }) => looksLikePath(token) && !token.startsWith('/') && !RECORDS.some((d) => token.startsWith(d)))
    .map(({ id, file, token }) => ({ id, file, path: token }));
}
