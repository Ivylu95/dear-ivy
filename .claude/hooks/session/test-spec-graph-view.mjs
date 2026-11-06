// Rule test for the spec graph's working parts (dev/ui/lib/spec-graph-model.mjs):
// SPC-007, "From any row, the graph shows what it serves, what carries it, and
// which of its clauses nothing carries yet.", and SPC-008, "Any gap the graph
// shows becomes a request the developer can hand to a development chat in one
// step." Replayed on made-up rows, then on the real registers: every clause a
// Coverage marks ❌ or ⚠️ must come out as a gap. Skipped in a copy without dev/
// (ARC-008). Run by selftest.mjs.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { specGraph } from '../lib/spec-rows.mjs';
import { SPECS_DIR } from '../lib/paths.mjs';
import { walkFiles } from '../../../ux/lib/walk-skip.mjs';

const model = fileURLToPath(new URL('../../../dev/ui/lib/spec-graph-model.mjs', import.meta.url));
const specs = fileURLToPath(new URL(`../../../${SPECS_DIR}/`, import.meta.url));
if (!existsSync(model) || !existsSync(specs)) {
  console.log('spec graph view: no dev/ in this copy (ARC-008), nothing to check');
  process.exit(0);
}
const { CARD, LEVEL, carriedShare, carriedTotal, clampView, focusSet, gapOrder, gapsOf, layered, minZoom, pathTo, requestFor, unfolded } = await import(pathToFileURL(model).href);

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

// The view held inside the tree's edges (SPC-007, design 7).
{
  const tree = { x0: 0, x1: 1000, y0: 0, y1: 2000 };
  const box = { w: 500, h: 400 };
  const m = 40;
  const still = { x: -100, y: -300, k: 1 };
  check('a view inside the edges comes back as the same object', clampView(still, tree, box, m) === still);
  const up = clampView({ x: -100, y: -9000, k: 1 }, tree, box, m);
  check('dragged up past the last row, the last row stops a margin above the bottom edge', up.y + tree.y1 * up.k === box.h - m);
  const left = clampView({ x: 900, y: 0, k: 1 }, tree, box, m);
  check('dragged right past the first column, it stops a margin from the left edge', left.x + tree.x0 * left.k === m);
  const out = clampView({ x: 0, y: 0, k: 0.01 }, tree, box, m);
  check('zooming out stops once the whole tree fits', out.k === minZoom(tree, box, m) && (tree.y1 - tree.y0) * out.k <= box.h - 2 * m);
  const small = { x0: 0, x1: 100, y0: 0, y1: 50 };
  const kept = clampView({ x: 480, y: -200, k: 1 }, small, box, m);
  check('a tree smaller than the box stays wholly inside it', kept.x + small.x1 >= 0 && kept.x + small.x1 <= box.w - m && kept.y + small.y0 >= m);
  check('a small tree is never forced above life size', minZoom(small, box, m) === 1);
}

// Coverage read into gaps, the worst mark deciding the colour.
const cov = gapsOf([
  '1. _At once_ → ⚠️ [**CTX-002**](x.md#ctx-002--) – not yet a child; ✅ **Design #1**',
  '2. _Whenever_ → ❌ – mitigated by [**SAF-002**](y.md#saf-002)',
  '3. _Wherever_ → ✅ [**DEP-003**](z.md#dep-003--)',
  '4. _Being there_ → ↔️ [**PRD-010**](#prd-010--) – sibling',
]);
check('every marked clause is read', cov.clauses.length === 4);
check('❌ and ⚠️ are gaps, ✅ and ↔️ are not', cov.gaps.map((g) => g.clause).join('|') === 'At once|Whenever');
check('the worst mark decides the colour', cov.worst === 'missing' && gapsOf(['1. _A_ → ⚠️ x']).worst === 'partial');
check('a row with no Coverage reads as nothing naming it', gapsOf([]).worst === 'none');
check('a partial gap keeps its note', cov.gaps[0].note === 'not yet a child');
// The review's finding, 2026-10-05: a clause with several marks took the whole
// tail of the line as its note, links and other marks included.
const mixed = gapsOf(['1. _Ready_ → ✅ [**WKB-008**](#wkb-008--); 🔧 **Design #1**; ⚠️ [**SPC-007**](a.md#spc-007--) – the graph, not built yet']);
check('a clause with several marks takes its worst, and only that segment\'s note', mixed.gaps[0]?.mark === 'partial' && mixed.gaps[0].note === 'the graph, not built yet');
check('a note carries no markdown link', !/\]\(/.test(gapsOf(['1. _A_ → ⚠️ x – see [**SAF-002**](y.md#saf-002)']).gaps[0].note));
// And a Coverage written as a plain list, with no clause, still decides the colour.
check('a list-form Coverage is read for its marks, never as nothing', gapsOf(['- ✅ [**KNW-003**](k.md#knw-003--) – carries it']).worst === 'covered' && gapsOf(['- ❌ nothing yet']).worst === 'missing');

// The layered tree: one level per generation, a parent centred over its children.
const kids = new Map([['R', ['A', 'B']], ['A', ['A1', 'A2']]]);
const depth = { R: 0, A: 1, B: 1, A1: 2, A2: 2 };
const at = layered('R', kids, (id) => depth[id]);
check('each generation sits one level lower', at.get('A1').y === 2 * LEVEL && at.get('R').y === 0);
check('a parent is centred over its children', at.get('A').x === (at.get('A1').x + at.get('A2').x) / 2);
check('a row counts every row below it', at.get('R').below === 4);

// Folding (SPC-007 design 4): a closed row is a leaf of the drawing, and cards
// laid out side by side never overlap.
const folded = unfolded('R', kids, new Set(['R']));
check('the graph opens folded: only the root\'s children are laid out', [...folded.keys()].sort().join() === 'A,B,R' && folded.get('A').length === 0);
check('unfolding a row lays out its children', [...unfolded('R', kids, new Set(['R', 'A'])).keys()].length === 5);
const cards = layered('R', unfolded('R', kids, new Set(['R', 'A'])), (id) => depth[id], { slot: CARD.slot, level: CARD.level });
const leaves = ['A1', 'A2', 'B'].map((id) => cards.get(id).x).sort((a, b) => a - b);
check('rows stacked beneath one another never overlap', leaves.every((x, i) => i === 0 || x - leaves[i - 1] >= CARD.h));
check('a row and the rows it carries never overlap side to side', CARD.level >= CARD.w);

// The carried share (SPC-007 design 6): a ring per row, a total, the next gap.
check('a row\'s share counts its carried clauses', JSON.stringify(carriedShare(cov)) === JSON.stringify({ done: 2, of: 4 }));
check('a row nothing names yet has no ring', carriedShare(gapsOf([])) === null);
check('the total adds every row\'s share', JSON.stringify(carriedTotal([cov, gapsOf([]), gapsOf(['- ✅ x'])])) === JSON.stringify({ done: 3, of: 5 }));
const queue = gapOrder([
  { id: 'B-002', depth: 2, gaps: [{ clause: 'b' }], noVerify: false },
  { id: 'A-001', depth: 1, gaps: [], noVerify: true },
  { id: 'C-003', depth: 1, gaps: [{ clause: 'c' }], noVerify: true },
]);
check('"Next gap" goes nearest the mission first, a missing Verification after a row\'s clauses', queue.map((q) => `${q.id}:${q.gap.clause ?? q.gap}`).join() === 'A-001:verification,C-003:c,C-003:verification,B-002:b');

// Focus: the row, everything above it by any parent, and its children to a depth.
const byId = new Map(['R', 'A', 'B', 'A1', 'A2'].map((id) => [id, { id, parents: [] }]));
byId.get('A').parents = [{ id: 'R' }];
byId.get('B').parents = [{ id: 'R' }];
byId.get('A1').parents = [{ id: 'A' }, { id: 'B' }];
const f = focusSet('A1', byId, kids, 1);
check('focus keeps every row above, by cross-links too', ['A1', 'A', 'B', 'R'].every((id) => f.has(id)) && !f.has('A2'));
byId.get('A').parent = 'R';
byId.get('A1').parent = 'A';
check('a row found by search is reached by unfolding its path from the root', pathTo('A1', byId).join() === 'R,A,A1');
check('focus keeps children only to the chosen depth', focusSet('R', byId, kids, 1).has('A') && !focusSet('R', byId, kids, 1).has('A1') && focusSet('R', byId, kids, 2).has('A1'));

// The request a gap becomes: the row's own words, the gap and the ask.
const row = { id: 'PRD-001', statement: 'The person finds the space ready.', file: 'PRODUCT.md' };
const req = requestFor(row, cov.gaps[1]);
check('a request names the row, its statement and its file', req.includes('PRD-001') && req.includes('"The person finds the space ready."') && req.includes(`${SPECS_DIR}/PRODUCT.md`));
check('a request names the clause and asks for a child row', req.includes('"Whenever"') && /child row/.test(req));
check('a row with no Verification asks for one', /Verification/.test(requestFor(row, 'verification')));

// The real registers: no ❌ or ⚠️ clause is lost between the file and the graph.
const entries = walkFiles(specs, { names: new Set(), keep: (n) => n.endsWith('.md') }).map((full) => ({ file: relative(specs, full).split(sep).join('/'), text: readFileSync(full, 'utf8') }));
const { nodes } = specGraph(entries);
const read = nodes.map((r) => ({ r, g: gapsOf(r.coverage) }));
// Counted without gapsOf's own reading: a clause line holding ❌ or ⚠️ anywhere.
const marked = nodes.reduce((n, r) => n + r.coverage.filter((l) => /_.+?_\s*→/.test(l) && /❌|⚠️/.test(l)).length, 0);
const shown = read.reduce((n, { g }) => n + g.gaps.length, 0);
check(`every ❌ or ⚠️ clause in the registers is a gap on the graph (${shown} of ${marked})`, marked > 0 && shown === marked);
check('every row with Coverage is coloured by it, never as nothing naming it', read.every(({ r, g }) => !r.coverage.length || g.worst !== 'none'));
check('a row whose Coverage holds ❌ anywhere is coloured missing', read.every(({ r, g }) => !r.coverage.some((l) => l.includes('❌')) || g.worst === 'missing'));
check('no note on the graph carries a link or another mark', read.every(({ g }) => g.clauses.every((c) => !/\]\(|❌|⚠️|✅/.test(c.note))));

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('spec graph view: layout, view edges, gaps, focus and requests hold');
