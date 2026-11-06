// Rule test for the spec-writer's row template (dev/skills/spec-writer/references/
// row-template.md): its parts are the README anatomy's parts, in the anatomy's
// order, and it reads as one whole row through lib/spec-rows.mjs. The template
// holds the shape only and the anatomy holds the rules (FND-005), so a template
// that drifts from the anatomy would teach every new row the old shape. Skipped
// only in a copy without the specs (ARC-008); a copy with them and no template
// fails. Run by selftest.mjs.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseRows } from '../lib/spec-rows.mjs';
import { SKILLS_DIR, SPECS_DIR } from '../lib/paths.mjs';

const readme = fileURLToPath(new URL(`../../../${SPECS_DIR}/README.md`, import.meta.url));
const template = fileURLToPath(new URL(`../../../${SKILLS_DIR}/spec-writer/references/row-template.md`, import.meta.url));
if (!existsSync(readme)) {
  console.log(`row template: no ${SPECS_DIR}/ in this copy (ARC-008), nothing to check`);
  process.exit(0);
}

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

check('the template exists beside the specs it copies', existsSync(template));
if (!existsSync(template)) {
  console.error('1 failing');
  process.exit(1);
}

// "(§) SPEC STATEMENT", one per part, in the order each source gives them.
const norm = (icon, label) => `(${icon}) ${label.trim().toUpperCase()}`;
const anatomyParts = (text) => {
  const section = text.split(/^## Anatomy of a Spec Register\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  return [...section.matchAll(/^\|\s*\*\*\(([^)]+)\)\s+([^*]+?)\*\*\s*\|/gm)].map((m) => norm(m[1], m[2]));
};
const templateParts = (text) => [...text.matchAll(/^(?:>\s*)?###\s+\*\*\(([^)]+)\)\s+([A-Z ]+?)\s*—\*\*\s*$/gm)].map((m) => norm(m[1], m[2]));
const same = (a, b) => a.length > 0 && JSON.stringify(a) === JSON.stringify(b);

const readmeText = readFileSync(readme, 'utf8');
const templateText = readFileSync(template, 'utf8');
const want = anatomyParts(readmeText);
const have = templateParts(templateText);

check(`the anatomy names its parts (${want.length})`, want.length >= 5);
check("the template has the anatomy's parts, in its order", same(want, have));

// The incident it exists for, replayed on the real text: the anatomy moves on
// and the template does not, or the template's own parts are shuffled.
const verification = /^### \*\*\(✓\) SPEC VERIFICATION —\*\*\s*$/m;
const rationale = /^### \*\*\(∵\) SPEC RATIONALE —\*\*\s*$/m;
const swapped = templateText.replace(rationale, '@@R@@').replace(verification, '### **(∵) SPEC RATIONALE —**').replace('@@R@@', '### **(✓) SPEC VERIFICATION —**');
check('a template with two parts swapped is caught', swapped !== templateText && !same(want, templateParts(swapped)));
const renamed = readmeText.replace('**(✓) Spec Verification**', '**(✓) Spec Evidence**');
check('an anatomy that renames a part is caught', renamed !== readmeText && !same(anatomyParts(renamed), have));

const rows = parseRows(templateText);
const row = rows[0];
check('the template reads as exactly one row', rows.length === 1 && row.id === 'XXX-000');
check(
  'every part of it is read: statement, parent, rationale, verification, coverage, design, remarks',
  Boolean(row?.statement && row.parents.length && row.rationale && row.verification && row.coverage.length && row.designs.length && row.remarks.length),
);

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('row template: in step with the anatomy');
