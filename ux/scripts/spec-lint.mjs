// The form of a spec register, checked by machine.
//
//   node scripts/spec-lint.mjs            report, exit 1 on any fault
//   node scripts/spec-lint.mjs --json     the same findings as JSON
//   node scripts/spec-lint.mjs --notes    include the notes in the exit code
//   node scripts/spec-lint.mjs --counts   one line per register: prefix, count, path
//   node scripts/spec-lint.mjs --lengths  characters per row, against its file's median
//   node scripts/spec-lint.mjs --graph    the specs as nodes and edges, JSON (specGraph)
//   node scripts/spec-lint.mjs --only index-range,groups
//                                          only findings with these codes count
//   node scripts/spec-lint.mjs --lead "draft lead" ["another"]
//                                          count draft leads as the lead rule
//                                          does, before they go to the owner
//
// dev/specs/README.md states the form in prose: seven parts to a file, four parts
// to a row, numbers running continuous with no gaps, a tag written one way and
// its key listed once. Until this script existed, every one of those was held
// by a person reading carefully — which is how the tabs index came to claim
// MEM-001··009 for a register that had grown to fourteen rows, with nothing
// anywhere saying so.
//
// ── What it does not do ─────────────────────────────────────────────────────
//
// It reads shape, never meaning. It cannot tell a statement that smuggles in a
// mechanism from one that does not, cannot judge whether a rationale carries a
// real compliance test, and cannot know whether a row is true of the
// repository. Those are the spec-review and spec-audit skills, and
// this script exists to keep them off the work a regex settles in a second.
//
// It is deliberately NOT wired into `npm run check` whole. The agent edits dev/specs/ only
// on a person's instruction, so a fault here cannot be fixed by the session that
// finds it unasked; in the
// commit gate it would block every commit until a person cleared it. Findings
// go to the developer instead. Wire it into the gate on the day it runs clean
// and stays clean.
//
// Some of its rules are in the gate already, through --only: the index ranges
// and the row groups (`index-prefix`, `index-range`, `groups`), a parent's
// Coverage naming every child (`coverage`), and the sources note closing the
// register (`note-last`). Each goes stale the moment a row is added without
// the rest moving with it, and the commit adding the row is the one place that
// can move them (backlog, 2026-10-03: stale ranges found by hand, fixed in
// 7a34d0f; 2026-10-07: DES-008 landed below design.md's sources note and
// missing from both parents' Coverage, caught only by a reviewer).
//
// Banner exactness belongs to check-spec-banner.mjs and is not repeated here —
// this script checks only that a banner is present.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { walkFiles } from '../lib/walk-skip.mjs';
import { legacyRows, parseGroups, parseRows, rowText, specGraph, tableCells } from '../../.claude/hooks/lib/spec-rows.mjs';

const REPO = resolve(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const SPECS = join(REPO, SPECS_DIR);

// A lead's words as the lead rule counts them: split on spaces, so a dash or an
// ampersand standing alone is a word. Drafts are counted by this before they
// are shown: leads offered as ten went to the owner at eleven and needed a
// second yes, on 2026-10-07 and again for eight rows on 2026-10-15.
export const leadWords = (lead) => String(lead).split(/\s+/).filter(Boolean).length;
const LEAD_MIN = 8;
const LEAD_MAX = 10;

if (process.argv[2] === '--lead') {
  const drafts = process.argv.slice(3);
  if (!drafts.length) {
    console.error('spec lint: --lead takes one or more draft leads, each in quotes');
    process.exit(2);
  }
  let bad = 0;
  for (const d of drafts) {
    const lead = d.replace(/^\*\*|\*\*\s*[–:-]?\s*$/g, '').trim().replace(/[.:]$/, '');
    const n = leadWords(lead);
    const ok = n >= LEAD_MIN && n <= LEAD_MAX;
    if (!ok) bad += 1;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${n} words: ${lead}`);
  }
  process.exit(bad ? 1 : 0);
}

if (!existsSync(SPECS)) {
  console.log(`spec lint: no ${SPECS_DIR}/ in this copy (ARC-008), nothing to check`);
  process.exit(0);
}

const argv = process.argv.slice(2);
const args = new Set(argv);
const asJson = args.has('--json');
// --only a,b (or --only=a,b): keep the findings with these codes, drop the rest.
const onlyAt = argv.findIndex((a) => a === '--only' || a.startsWith('--only='));
const only = onlyAt === -1
  ? null
  : new Set((argv[onlyAt].includes('=') ? argv[onlyAt].split('=')[1] : argv[onlyAt + 1] ?? '').split(',').map((c) => c.trim()).filter(Boolean));
if (only && !only.size) {
  console.error('spec lint: --only names no finding codes, e.g. --only index-range,groups');
  process.exit(2);
}
const notesCount = args.has('--notes');
const countsOnly = args.has('--counts');
const lengthsOnly = args.has('--lengths');

/** @type {Map<string, {id:string, chars:number}[]>} */
const rowLengths = new Map();

/** @type {{file:string, level:'fault'|'note', code:string, message:string}[]} */
const findings = [];
const kept = (code) => !only || only.has(code);
const fault = (file, code, message) => kept(code) && findings.push({ file, level: 'fault', code, message });
const note = (file, code, message) => kept(code) && findings.push({ file, level: 'note', code, message });

const rel = (abs) => relative(REPO, abs).split(sep).join('/');

const files = walkFiles(SPECS, { names: new Set(), keep: (n) => n.endsWith('.md') }).sort();
const read = (abs) => readFileSync(abs, 'utf8');

// The tree the Parent lines draw, for anything that would picture it.
if (args.has('--graph')) {
  console.log(JSON.stringify(specGraph(files.map((abs) => ({ file: rel(abs), text: read(abs) }))), null, 1));
  process.exit(0);
}


// ── Per-file: anatomy, register, numbering, deletions ───────────────────────

/** @type {Map<string, {prefix:string, count:number, path:string}>} */
const registers = new Map();

for (const abs of files) {
  const name = rel(abs);
  const text = read(abs);
  const lines = text.split(/\r?\n/);
  const isIndex = /README\.md$/.test(name);
  const isReferences = /REFERENCES\.md$/.test(name);
  // An index describes the form and quotes its headings; only a spec file carries one.
  const hasRegister = !isIndex && /^#{1,2} Specifications Register/m.test(text);

  if (!/^> 🔒 \*\*/m.test(text)) {
    fault(name, 'banner', 'No 🔒 edit prohibition — part 3 of the seven, required in every file.');
  }
  if (!isIndex && !/^#{1,2} Purpose and Scope/m.test(text)) {
    fault(name, 'anatomy', 'No `# Purpose and Scope` — part 4 of the seven.');
  }

  if (!hasRegister) {
    if (!isIndex && !isReferences) {
      fault(name, 'anatomy', 'No `# Specifications Register` — a spec file without one binds nothing.');
    }
    continue;
  }

  const heading = text.match(/^# .+?\[([A-Z]{3})\]/m);
  if (!heading) {
    fault(name, 'anatomy', 'The `# Name [TAG]` heading carries no three-letter family prefix.');
  }
  const prefix = heading?.[1];

  const sourcesAt = text.search(/^> 📚 /m);
  if (sourcesAt < 0) {
    fault(name, 'anatomy', 'No 📚 sources note — part 7 of the seven, required whether or not any row carries a tag.');
  } else {
    // The note says "no row above carries a source tag": a row below it is
    // outside what it says, and reads as a register that ended and began again.
    const lastRow = [...text.matchAll(/^## \*\*([A-Z]{3}-\d{3})/gm)].pop();
    if (lastRow && lastRow.index > sourcesAt) {
      fault(name, 'note-last', `${lastRow[1]} sits below the 📚 sources note; the note closes the register, after its last row.`);
    }
  }
  // Rows are sections of their own, read by one parser (lib/spec-rows.mjs). A
  // row still written as a table line is no row at all, so it is refused rather
  // than left for every tool to skip in silence (README.md, FND-005).
  const parsed = parseRows(text);
  for (const { id, line } of legacyRows(text)) {
    fault(name, 'format', `Line ${line + 1}: ${id} is written as a table line; a row is a section of its own (## **${id} • …**).`);
  }
  if (!parsed.length) fault(name, 'anatomy', 'The register holds no rows.');

  // Where Recently deleted begins, live rows end.
  const deletedAt = lines.findIndex((l) => /^##+\s+Recently deleted/i.test(l));
  const numbers = [];
  let unled = 0;

  parsed.forEach((row) => {
    const i = row.line;
    const [rowPrefix, digits] = [row.prefix, row.num];
    const inDeleted = deletedAt !== -1 && i > deletedAt;
    if (digits.length !== 3) {
      fault(name, 'number', `Line ${i + 1}: ${rowPrefix}-${digits} is not three digits; an ID is a prefix and three zero-padded digits.`);
      return;
    }

    // The bold lead: eight to ten words naming the row's essence (README.md,
    // the Spec Statement). Registers gain theirs one at a time, so a missing
    // lead is counted once per file below, never a fault.
    if (!inDeleted && row.lead) {
      const words = leadWords(row.lead);
      if (words < LEAD_MIN || words > LEAD_MAX) fault(name, 'lead', `${row.id}'s bold lead runs ${words} word${words === 1 ? '' : 's'}; a lead names the row's essence in eight to ten.`);
      if (!/^[–:-]$/.test(row.leadMark)) fault(name, 'lead', `${row.id}'s bold lead ends ${row.leadMark ? `with "${row.leadMark}"` : 'with nothing after it'}; a lead is followed by a dash (–) or a colon.`);
    }
    if (!inDeleted && !row.lead && row.statement) unled += 1;

    if (inDeleted) {
      fault(
        name,
        'deleted-id',
        `Line ${i + 1}: **${rowPrefix}-${digits}** sits under Recently deleted as a live ID. A removed row writes its old number plainly — two rows defining one ID is what check-links.mjs fails on.`,
      );
      return;
    }
    if (prefix && rowPrefix !== prefix) {
      fault(name, 'prefix', `Line ${i + 1}: row ${rowPrefix}-${digits} carries a prefix this file does not own (${prefix}).`);
    }
    if (!row.statement || !row.rationale || !row.design) {
      fault(name, 'parts', `Line ${i + 1}: ${rowPrefix}-${digits} lacks its Spec Statement, its Spec Rationale or its Design Recommendations.`);
    }
    numbers.push(Number(digits));
    if (!rowLengths.has(name)) rowLengths.set(name, []);
    rowLengths.get(name).push({ id: `${rowPrefix}-${digits}`, chars: rowText(row).length });
  });
  if (unled) note(name, 'lead', `${unled} row${unled === 1 ? '' : 's'} open with no bold lead (eight to ten words naming the essence).`);

  // Row groups (README.md, part 6): optional, but where present every row sits
  // in exactly one, in order, with no gap and no overlap.
  const groups = parseGroups(text);
  if (groups.length) {
    let next = 1;
    for (const g of groups) {
      if (g.from !== next || g.to < g.from) {
        fault(name, 'groups', `Line ${g.line + 1}: group "${g.name}" runs ${g.from}–${g.to}; the next group must start at ${next}, and end at or after its start.`);
      }
      next = g.to + 1;
    }
    if (next - 1 !== numbers.length) {
      fault(name, 'groups', `The row groups end at ${next - 1}; the register has ${numbers.length} rows. Every row sits in exactly one group.`);
    }
  }

  if (prefix) registers.set(prefix, { prefix, count: numbers.length, path: name, groups: groups.map(({ from, to, name: n }) => ({ from, to, name: n })) });

  const seen = new Set();
  numbers.forEach((n, idx) => {
    if (seen.has(n)) fault(name, 'duplicate', `${prefix}-${String(n).padStart(3, '0')} is defined twice.`);
    seen.add(n);
    if (n !== idx + 1) {
      fault(
        name,
        'continuity',
        `Numbers do not run continuous: expected ${prefix}-${String(idx + 1).padStart(3, '0')} in position ${idx + 1}, found ${String(n).padStart(3, '0')}.`,
      );
    }
  });
}

// A row twice the length of its neighbours is unscannable in a register whose whole
// claim is that rows compare at a glance. The threshold is deliberately generous:
// this reports what a session would otherwise measure by hand and differently
// each time, and judging it is Review mode's, not the script's.
const medians = new Map();
for (const [file, rows] of rowLengths) {
  const sorted = rows.map((r) => r.chars).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
  medians.set(file, median);
  for (const row of rows) {
    if (median && row.chars > median * 1.8) {
      note(file, 'length', `${row.id} runs ${row.chars} characters against a median of ${median} in this file — around ${(row.chars / median).toFixed(1)}× its neighbours.`);
    }
  }
}

// ── The graph: one root, parent specs for every other row, no loops ────────
//
// README.md's anatomy: every row names one or more parent specs, the rows it
// exists because of, up to MSN-001, the mission statement in README.md, which
// alone names none. The first is the primary, and the primaries draw the tree;
// the rest cross-link it. A row with no parent, a parent that does not exist, a
// link that does not lead to the parent's heading, and a loop through any of the
// edges, primary or not, are faults.

const tree = new Map();
for (const abs of files) {
  for (const row of parseRows(read(abs))) {
    tree.set(row.id, { file: rel(abs), parents: row.parents, anchor: row.anchor, emojis: row.emojis, covers: row.covers, hasCoverage: row.coverage.length > 0 });
  }
}
const ROOT = 'MSN-001';
if (!tree.has(ROOT)) fault('dev/specs/README.md', 'root', `${ROOT}, the mission statement every row traces back to, is missing.`);
for (const [id, { file, parents }] of tree) {
  if (id === ROOT) {
    if (parents.length) fault(file, 'root', `${ROOT} is the root and names no parent spec; it names ${parents.map((p) => p.id).join(', ')}.`);
    continue;
  }
  if (/README\.md$/.test(file)) fault(file, 'root', `${id} sits in the README, which holds the root alone.`);
  if (!parents.length) fault(file, 'parent', `${id} names no parent spec; every row but ${ROOT} names at least one.`);
  // One primary and at most two more (the owner, 2026-10-04): a fourth is a sign the row is two rows.
  if (parents.length > 3) fault(file, 'parent-count', `${id} names ${parents.length} parent specs; a row names one primary and at most two more, and one that needs a fourth should split.`);
  for (const p of parents) {
    const target = tree.get(p.id);
    if (!target) {
      fault(file, 'parent', `${id} names ${p.id} as a parent spec, and no row is ${p.id}.`);
      continue;
    }
    // The link is relative to the row's own file; a bare anchor stays in it.
    const [path, anchor = ''] = p.href.split('#');
    const lands = path ? rel(resolve(REPO, dirname(file), path)) : file;
    // The anchor is the one the parent's heading actually gets (`#prd-001--`
    // once the heading carries its emojis), so the link lands in every viewer.
    if (lands !== target.file || anchor !== target.anchor) {
      const want = `${target.file === file ? '' : relative(dirname(file), target.file).split(sep).join('/')}#${target.anchor}`;
      fault(file, 'parent-link', `${id}'s link to ${p.id} reads (${p.href}); it should be (${want}).`);
    }
    // Emojis beside a parent's link are a copy of its heading's; a copy that
    // drifts names one row with another's face.
    if (p.emojis && p.emojis !== target.emojis) {
      fault(file, 'parent-emojis', `${id}'s parent ${p.id} carries ${p.emojis}; its heading carries ${target.emojis || 'none'}.`);
    }
    // A parent that lists its coverage lists every child that names it.
    if (target.hasCoverage && !target.covers.some((c) => c.id === id)) {
      fault(target.file, 'coverage', `${p.id}'s Spec Coverage leaves out ${id}, which names it as a parent.`);
    }
  }
}
// A ✅ in a coverage line claims the row named after it carries the clause as a
// child; a row that does not name this one as a parent is related, not a child,
// and is marked ⚠️ until it does (2026-10-04: CTX-002 and CON-009 were ✅ on
// PRD-001 while neither named it).
for (const [id, { file, covers, hasCoverage }] of tree) {
  if (!hasCoverage) continue;
  for (const c of covers) {
    if (!c.ticked) continue;
    const child = tree.get(c.id);
    if (child && !child.parents.some((p) => p.id === id)) {
      fault(file, 'coverage-mark', `${id}'s Spec Coverage marks ${c.id} ✅, but ${c.id} does not name ${id} as a parent; mark it ⚠️ or ↔️, or add the parent link.`);
    }
  }
}

// A loop through any edge: a depth-first walk that meets a row still on its own path.
{
  const state = new Map(); // id -> 'open' | 'done'
  const visit = (id, path) => {
    if (state.get(id) === 'done') return;
    if (state.get(id) === 'open') {
      const loop = path.slice(path.indexOf(id));
      fault(tree.get(id).file, 'parent', `The parent specs loop: ${[...loop, id].join(' → ')}; every chain ends at ${ROOT}.`);
      return;
    }
    state.set(id, 'open');
    for (const p of tree.get(id)?.parents ?? []) if (tree.has(p.id)) visit(p.id, [...path, id]);
    state.set(id, 'done');
  };
  for (const id of tree.keys()) visit(id, []);
}

// ── References: keys, limits, checked dates ─────────────────────────────────

const referencesPath = join(SPECS, 'REFERENCES.md');
const referenceKeys = new Map(); // key -> { cited: boolean }

// A missing sources file is a fault to report, never a crash. It was deleted by
// hand on 2026-09-26 and this script died with a stack trace, which is the worst
// of the three outcomes: a checker that crashes says nothing about the thing it
// checks, and the run looks like a tooling problem rather than a finding.
const referencesExist = existsSync(referencesPath);
if (!referencesExist) {
  fault(
    'dev/specs/REFERENCES.md',
    'missing',
    'The sources register is gone. Every [[KEY]] tag in every spec resolves to a row in this one file — README.md § Source tags: "every work is listed once in REFERENCES.md" — so while it is absent no tag has a home and no limit travels with any claim. Restore it: `git restore dev/specs/REFERENCES.md`.',
  );
}

if (referencesExist) {
  const text = read(referencesPath);
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\|\s*\[\[([^\]\s]+)[^\]]*\]\]\(/);
    if (!m) continue;
    const key = m[1];
    referenceKeys.set(key, { cited: false });
    const cells = tableCells(line);
    const checked = cells[cells.length - 1] ?? '';
    if (!/\d{4}-\d{2}-\d{2}/.test(checked)) {
      fault('dev/specs/REFERENCES.md', 'checked-date', `[[${key}]] carries no checked date. Nothing here verifies a source still says what was claimed; the date is what a reader weighs it against.`);
    }
    const limit = cells[3] ?? '';
    if (limit.length < 20) {
      fault('dev/specs/REFERENCES.md', 'limit', `[[${key}]] states no boundary past which it does not apply. If that line cannot be written, there is no source and the tag comes off.`);
    }
  }
}

// ── Source tags, wherever they are written ─────────────────────────────────

const TAG = /\[\[([^\]]+)\]\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
for (const abs of files) {
  const name = rel(abs);
  // REFERENCES defines the keys; an index teaches the form by writing specimen tags in prose.
  if (/REFERENCES\.md$/.test(name) || /README\.md$/.test(name)) continue;
  const text = read(abs);

  for (const m of text.matchAll(TAG)) {
    const key = m[1].split(/\s+/)[0];
    const title = m[3];
    if (!referenceKeys.has(key)) {
      fault(name, 'tag-key', `[[${key}]] is cited but has no row in REFERENCES.md. A key names one work, listed once.`);
    } else {
      referenceKeys.get(key).cited = true;
    }
    if (!title || title.trim() === '') {
      fault(name, 'tag-title', `[[${key}]] carries no link title. The limit is mandatory: the tag goes to the work, so a reader following it never passes through the limit unless the limit travels with them.`);
    }
  }
  for (const m of text.matchAll(/\[\[([^\]]+)\]\](?!\()/g)) {
    note(name, 'tag-form', `[[${m[1]}]] is written without a link. The house form is [[KEY]](url "where it stops applying").`);
  }
  for (const m of text.matchAll(/[.;]\s+\[\[([^\]]+)\]\]/g)) {
    note(name, 'tag-placement', `[[${m[1]}]] sits after the closing punctuation. A tag past the full stop has left the claim it corroborates.`);
  }
}

for (const [key, state] of referenceKeys) {
  if (!state.cited) note('dev/specs/REFERENCES.md', 'unused', `[[${key}]] is listed but cited by no register.`);
}

// ── Indexes: the ranges they claim against the rows that exist ─────────────

for (const indexPath of files.filter((f) => /README\.md$/.test(rel(f)))) {
  const name = rel(indexPath);
  const text = read(indexPath);
  for (const line of text.split(/\r?\n/)) {
    const range = line.match(/`([A-Z]{3})-(\d{3})··(\d{3})`/);
    if (!range) continue;
    const [, prefix, , last] = range;
    const known = registers.get(prefix);
    if (!known) {
      fault(name, 'index-prefix', `The index claims ${prefix}-…, and no register defines that family.`);
      continue;
    }
    if (Number(last) !== known.count) {
      fault(
        name,
        'index-range',
        `The index claims ${prefix} runs to ${last}; ${known.path} holds ${String(known.count).padStart(3, '0')}. An index that names the wrong range is read as the truth by whoever does not open the file.`,
      );
    }
  }
}

// The prefix table: one prefix per file, each pointing at a file that exists.
{
  const text = read(join(SPECS, 'README.md'));
  const table = text.split('## IDs')[1] ?? '';
  for (const line of table.split(/\r?\n/)) {
    const m = line.match(/^\|\s*`([A-Z]{3})`\s*\|\s*`([^`]+)`/);
    if (!m) continue;
    const [, prefix, claimedPath] = m;
    const known = registers.get(prefix);
    if (!known) {
      note('dev/specs/README.md', 'prefix-unused', `The prefix table reserves \`${prefix}\` for \`${claimedPath}\`, and no register defines a row with it.`);
      continue;
    }
    if (!known.path.endsWith(claimedPath.replace(/^specs\//, ''))) {
      fault('dev/specs/README.md', 'prefix-path', `\`${prefix}\` is claimed for \`${claimedPath}\`; its rows are in ${known.path}.`);
    }
  }
  for (const [prefix, known] of registers) {
    if (!new RegExp(`\\|\\s*\`${prefix}\``).test(table) && !known.path.includes('/tabs/')) {
      fault('dev/specs/README.md', 'prefix-missing', `${known.path} defines ${prefix}-… and the prefix table does not list it. An ID says where to look, or it says nothing.`);
    }
  }
}

// ── Report ─────────────────────────────────────────────────────────────────

const faults = findings.filter((f) => f.level === 'fault');
const notes = findings.filter((f) => f.level === 'note');

if (lengthsOnly) {
  for (const [file, rows] of rowLengths) {
    console.log(`
${file}  (median ${medians.get(file)})`);
    for (const r of rows) console.log(`  ${r.id}	${r.chars}`);
  }
} else if (countsOnly) {
  // The map in the spec skills' opening (spec-shared/opening.md) needs a count per register, not an aggregate.
  for (const r of [...registers.values()].sort((a, b) => a.path.localeCompare(b.path))) {
    console.log(`[${r.prefix}] · ${r.count}	${r.path}`);
    for (const g of r.groups) console.log(`    ${String(g.from).padStart(3, '0')}–${String(g.to).padStart(3, '0')} · ${g.name}`);
  }
} else if (asJson) {
  console.log(JSON.stringify({ registers: [...registers.values()], findings }, null, 2));
} else {
  const byFile = new Map();
  for (const f of findings) {
    if (!byFile.has(f.file)) byFile.set(f.file, []);
    byFile.get(f.file).push(f);
  }
  if (findings.length === 0) {
    console.log(`✅ ${registers.size} registers, ${[...registers.values()].reduce((n, r) => n + r.count, 0)} rows — the form holds.`);
  }
  for (const [file, list] of byFile) {
    console.log(`\n${file}`);
    for (const f of list) console.log(`  ${f.level === 'fault' ? '✖' : '·'} [${f.code}] ${f.message}`);
  }
  console.log(
    `\n${registers.size} registers · ${[...registers.values()].reduce((n, r) => n + r.count, 0)} rows · ${faults.length} fault${faults.length === 1 ? '' : 's'} · ${notes.length} note${notes.length === 1 ? '' : 's'}`,
  );
  if (faults.length)
    console.log('\nThe agent may not fix these: raise them with the developer.');
}

process.exit(faults.length || (notesCount && notes.length) ? 1 : 0);
