// A retired name never lingers (DEV-020): every term listed in
// .claude/retired-terms.md is searched for across the harness, and any file
// still using one fails the check, with the term that replaces it.
//
//   node ux/scripts/check-retired-terms.mjs      (runs in `npm run check`)

import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIP_DIRS as WALK_SKIP, walkFiles } from '../lib/walk-skip.mjs';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const list = join(repoRoot, '.claude', 'retired-terms.md');
// Split on either line ending: a Windows checkout writes CRLF, and with '\n'
// alone every line kept its '\r', no term matched, and the check passed on
// nothing (2026-10-03).
const lines = readFileSync(list, 'utf8').split(/\r?\n/);
const terms = lines
  .map((l) => l.match(/^- (.+?) · replaced by (.+?) · (\d{4}-\d{2}-\d{2})$/))
  .filter(Boolean)
  .map(([, term, now, date]) => ({ term, now, date }));
// A dated row of a table (`| YYYY-MM-DD | …`, as the hazard log in
// policies/SAFETY_POLICY.md keeps) dated before the term was retired is the
// record of that day, which names the thing as it was then: rewriting it would
// falsify the record (ux/lib/spec-edit.mjs keeps dated hazard rows for the same
// reason). A row dated on or after the retirement still fails.
const DATED_ROW = /^\| (\d{4}-\d{2}-\d{2}) \|/;
const live = (text, { term, date }) => text.split(/\r?\n/).some((l) => l.includes(term) && !((l.match(DATED_ROW)?.[1] ?? '9999') < date));
// A list that names terms but parses none is a broken check, not a clean one.
if (lines.some((l) => l.startsWith('- ')) && !terms.length) {
  console.error('retired-terms check: the list has entries but none parsed; the check would pass on nothing');
  process.exit(1);
}

// The harness: everything outside the record, its samples and machine output.
// The shared list (lib/walk-skip.mjs) keeps out an agent's worktree copy of the
// repository, which is no part of the harness.
const SKIP = new Set([...WALK_SKIP, 'data', 'data-sample', 'data-sandbox', 'state']);
const TEXT = /\.(md|mjs|js|jsx|ts|tsx|json|yaml|yml|txt|css)$/;
const files = walkFiles(repoRoot, {
  names: SKIP,
  keep: (name) => !SKIP.has(name) && TEXT.test(name) && !/^test-.*\.mjs$/.test(name),
}).filter((path) => path !== list);

const found = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const t of terms) {
    if (text.includes(t.term) && live(text, t)) found.push(`${relative(repoRoot, file)} still says "${t.term}" (now "${t.now}")`);
  }
}
if (found.length) {
  console.error(`\n  RETIRED TERMS CHECK FAILED\n\n${found.map((f) => `  - ${f}`).join('\n')}\n\n  Bring each up to date; the replacements are in .claude/retired-terms.md.\n`);
  process.exit(1);
}
console.log(`retired-terms check: ${terms.length} retired terms, none left in ${files.length} harness files`);
