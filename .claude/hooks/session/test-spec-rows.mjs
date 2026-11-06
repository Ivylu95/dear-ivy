// Rule tests for lib/spec-rows.mjs: the one reader of register rows, a section
// of its own each, and the table line that is no longer a row (FND-005). Run by
// selftest.mjs.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { legacyRows, parseRows, parseGroups, rowText, isRowStart, specGraph } from '../lib/spec-rows.mjs';
import { SPECS_DIR } from '../lib/paths.mjs';
import { walkFiles } from '../../../ux/lib/walk-skip.mjs';

const table = [
  '## Specifications Register',
  '',
  '| ID | SPEC STATEMENT | SPEC RATIONALE | DESIGN RECOMMENDATION |',
  '| --- | --- | --- | --- |',
  '| **ARC-001** | One home per fact. | Copies drift. | Ledgers. |',
  '| **ARC-002** | Another. | Why. | How. |',
].join('\n');

const section = [
  '## Specifications Register',
  '',
  '- `001–002` · Homes',
  '',
  '### ARC-001',
  '',
  '> **Spec Statement**',
  '> One home per fact.',
  '',
  '- **Spec Rationale:** Copies drift.',
  '- **Parent Specs:**',
  '  - [MSN-001](README.md#msn-001) · the root',
  '- **Design Recommendations:**',
  '  1. A ledger per kind (`a/b.md`), `threshold x.y = 3 days`.',
  '',
  '### ARC-002',
  '',
  '> **Spec Statement**',
  '> A row with two parents,',
  '> its statement wrapped.',
  '',
  '- **Spec Rationale:** Starts here',
  '  and carries on.',
  '- **Parent Specs:**',
  '  - [MSN-001](README.md#msn-001) · the primary',
  '  - [ARC-001](#arc-001) · a second reason',
  '- **Design Recommendations:**',
  '  1. One design. Its second sentence.',
  '  2. Another design,',
  '     wrapped.',
  '  3. Falls short: where it stops.',
  '',
  '---',
  '',
  '## Recently deleted',
].join('\n');

const s = parseRows(section);

// The live registers, if this copy has them (ARC-008): every row heading is
// read as a row, with a statement and a design.
const HEADING = { test: (l) => isRowStart(l) };
let live = { ok: true, rows: 0 };
try {
  const dir = fileURLToPath(new URL(`../../../${SPECS_DIR}/`, import.meta.url));
  const files = walkFiles(dir, { names: new Set(), keep: (n) => n.endsWith('.md') });
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const headings = text.split(/\r?\n/).filter((l) => HEADING.test(l)).length;
    const rows = parseRows(text);
    live.rows += rows.length;
    if (rows.length !== headings || rows.some((r) => !r.statement || !r.design)) live.ok = false;
  }
} catch {
  // No registers in this copy: nothing to compare.
}

const row = (statement, rest = '') => `### ARC-001\n\n> **Spec Statement**\n> ${statement}\n\n- **Spec Rationale:** R.\n- **Design Recommendations:**\n  1. D.${rest}`;

const cases = [
  ['a table line is no longer a row, and is found as a legacy one', parseRows(table).length === 0 && legacyRows(table).map((r) => r.id).join() === 'ARC-001,ARC-002'],
  ['reads section rows with their parts, the heading carrying no name', s.length === 2 && s[0].name === '' && s[0].statement === 'One home per fact.' && s[0].rationale === 'Copies drift.' && s[0].design.includes('`a/b.md`')],
  ['the statement is read from the callout under the heading, wrapped over its lines', s[1].statement === 'A row with two parents, its statement wrapped.'],
  ['a field carried onto the next line keeps its words', s[1].rationale === 'Starts here and carries on.'],
  ['every parent spec is read, the first the primary', s[1].parents.length === 2 && s[1].parent === 'MSN-001' && s[1].why === 'the primary' && s[1].parents[1].id === 'ARC-001' && s[1].parents[1].href === '#arc-001' && s[1].parents[1].why === 'a second reason'],
  ['the numbered designs join without their numbers', s[1].designs.length === 3 && s[1].designs[1] === 'Another design, wrapped.' && s[1].design === 'One design. Its second sentence. Another design, wrapped. Falls short: where it stops.'],
  ['a section row ends before the rule and the next heading', s[1].end === 30 && s[0].end === 13],
  ["a row's text is its three parts", rowText(s[0]) === 'One home per fact. | Copies drift. | A ledger per kind (`a/b.md`), `threshold x.y = 3 days`.'],
  ['row groups read', parseGroups(section).length === 1 && parseGroups(section)[0].to === 2],
  ['a row start is a row heading, never a table line or a plain heading', isRowStart('### SAF-010') && isRowStart('### SAF-010 · Name') && !isRowStart('| **SAF-010** | x |') && !isRowStart('### Notes')],
  ['a section row stops at a later callout or a table line after it', (() => {
    const text = `${row('S.')}\n> 📚 note\n| **ARC-002** | s | r | d |`;
    const r = parseRows(text);
    return r.length === 1 && r[0].end === 7 && r[0].statement === 'S.' && legacyRows(text)[0]?.id === 'ARC-002';
  })()],
  ['a callout that is not the statement is no statement', parseRows('### ARC-001\n\n> A note.\n\n- **Spec Rationale:** R.').at(0).statement === ''],
  ['a line the row cannot place ends it, rather than being swallowed', (() => {
    const r = parseRows('### ARC-001\n\n> **Spec Statement**\n> S.\n\nA stray paragraph.\n\n- **Spec Rationale:** R.');
    return r[0].end === 3 && r[0].statement === 'S.' && r[0].rationale === '';
  })()],
  ['the graph has a node per row and an edge per parent spec, the primary marked, depths along primaries', (() => {
    const g = specGraph([{ file: 'README.md', text: '### MSN-001\n\n> **Spec Statement**\n> R.' }, { file: 'x.md', text: section }]);
    const two = g.edges.filter((e) => e.from === 'ARC-002');
    return g.root === 'MSN-001' && g.nodes.length === 3 && g.edges.length === 3
      && two.length === 2 && two.find((e) => e.to === 'MSN-001').primary === true && two.find((e) => e.to === 'ARC-001').primary === false
      && g.nodes.find((n) => n.id === 'ARC-002').depth === 1 && g.nodes.find((n) => n.id === 'ARC-002').parents.length === 2;
  })()],
  ['a row whose primary chain misses the root has no depth', (() => {
    const g = specGraph([{ file: 'README.md', text: '### MSN-001\n\n> **Spec Statement**\n> R.' }, { file: 'x.md', text: row('S.') }]);
    return g.nodes.find((n) => n.id === 'ARC-001').depth === null && g.edges.length === 0;
  })()],
  ['the trial shape reads whole: a colon on the label, blank lines between parts and designs, Child Specs', (() => {
    const r = parseRows([
      '### PRD-001', '', '> **Spec Statement:**', '> S.', '',
      '- **Spec Rationale:** R.', '',
      '- **Parent Specs:**', '  - [MSN-001](README.md#msn-001) · the root', '',
      '- **Child Specs:**', '  - None', '',
      '- **Design Recommendations:**', '  1. One.', '', '  2. Falls short: two.', '', '---',
    ].join('\n'))[0];
    return r.statement === 'S.' && r.rationale === 'R.' && r.parent === 'MSN-001' && r.children.length === 0
      && r.designs.length === 2 && r.end === 16;
  })()],
  ['a linked child spec is read', parseRows(`${row('S.')}\n- **Child Specs:**\n  - [ARC-002](#arc-002) · why`)[0].children[0]?.id === 'ARC-002'],
  ['a wrapped line after a blank one is not carried on', (() => {
    const r = parseRows(`${row('S.')}\n\nA stray paragraph.`)[0];
    return r.design === 'D.' && r.end === 7;
  })()],
  ['the heading shape reads every part, the anchor made as GitHub and VS Code make it', (() => {
    const r = parseRows([
      '## **ARC-002 • 🧠🧰📦**', '', '> ---', '>', '> ### **(§) SPEC STATEMENT —**', '>', '> S one,', '> wrapped.', '>', '> ---', '',
      '### **(↑) SPEC PARENTS —**', '', '- **[MSN-001](README.md#msn-001--) • 🌱📏🌍** – Why one.', '- [ARC-001](#arc-001) · why two', '',
      '### **(∵) SPEC RATIONALE —**', '', 'R first.', '', '1. _Clause_ → why.', '',
      '### **(✓) SPEC VERIFICATION —**', '', 'Compliance is judged by V.', '',
      '### **(↓) SPEC COVERAGE —**', '', '1. _Clause_ → ✅ [**DEP-002**](x.md#dep-002--)', '',
      '### **(#) DESIGN RECOMMENDATIONS —**', '', '1. **One** – D one,', '   wrapped.', '', '2. Falls short: two.', '',
      '### **(※) REMARKS —**', '', '- a note', '', '---', '', '## Recently deleted',
    ].join('\n'))[0];
    return r.id === 'ARC-002' && r.emojis === '🧠🧰📦' && r.name === '' && r.anchor === 'arc-002--'
      && r.statement === 'S one, wrapped.' && r.parents.length === 2 && r.parent === 'MSN-001' && r.why === 'Why one.'
      && r.parents[0].emojis === '🌱📏🌍' && r.parents[1].why === 'why two'
      && r.rationale === 'R first. 1. _Clause_ → why.' && r.verification === 'Compliance is judged by V.'
      && r.covers[0]?.id === 'DEP-002' && r.covers[0].ticked === true && r.designs.length === 2 && r.designs[0] === '**One** – D one, wrapped.'
      && r.remarks[0] === '- a note' && r.end === 39 && rowText(r).includes('why. Compliance is judged by V. |');
  })()],
  ['a coverage link is ticked only by the ✅ that claims it, not by one before a separator', (() => {
    const r = parseRows(['## **ARC-003 • 🧠🧰📦**', '', '> ---', '>', '> ### **(§) SPEC STATEMENT —**', '>', '> S.', '>', '> ---', '',
      '### **(↓) SPEC COVERAGE —**', '', '1. _A_ → ✅ [**ARC-004**](#arc-004--); ⚠️ [**ARC-005**](#arc-005--) – partly', '',
      '### **(#) DESIGN RECOMMENDATIONS —**', '', '1. D.'].join('\n'))[0];
    return r.covers.length === 2 && r.covers[0].ticked === true && r.covers[1].ticked === false;
  })()],
  ['a heading-shape row and its old shape give the same row text', (() => {
    const old = parseRows(row('S.', '\n  2. Falls short: E.').replace('- **Spec Rationale:** R.', '- **Spec Rationale:** R. Compliance is judged by T.'))[0];
    const neu = parseRows(['## **ARC-001 • 🧠🧰📦**', '', '> ---', '>', '> ### **(§) SPEC STATEMENT —**', '>', '> S.', '>', '> ---', '',
      '### **(∵) SPEC RATIONALE —**', '', 'R.', '', '### **(✓) SPEC VERIFICATION —**', '', 'Compliance is judged by T.', '',
      '### **(#) DESIGN RECOMMENDATIONS —**', '', '1. D.', '', '2. Falls short: E.'].join('\n'))[0];
    return rowText(old) === rowText(neu);
  })()],
  // 2026-10-05: the design pass rewrote 35 files' closing 📚 notes into their last row.
  ['a heading-shape row ends at a callout after its parts, leaving the note outside it', (() => {
    const r = parseRows(['## **ARC-001 • 🧠🧰📦**', '', '> ---', '>', '> ### **(§) SPEC STATEMENT —**', '>', '> S.', '>', '> ---', '',
      '### **(#) DESIGN RECOMMENDATIONS —**', '', '1. D.', '', '> 📚 a note', '> carried on.'].join('\n'))[0];
    return r.end === 12 && r.design === 'D.' && !r.remarks?.some((l) => l.includes('📚'));
  })()],
  ['every live row heading is read as a row, with a statement and a design', live.ok],
];
let failed = 0;
for (const [what, ok] of cases) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
