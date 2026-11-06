// What a register row is, read in one place (FND-005, "Every fact has one
// authoritative home; everything else points to it."). Every tool that reads the
// registers (the spec lint, the link check, thresholds, design paths, the stress
// stamps, the row mover, the spec statements, dev mode, the Specs tab) asks this
// module, so no two of them can disagree about where a row starts or which part
// is its design.
//
// A row is a section of its own (dev/specs/README.md, Anatomy of a Spec Register).
// Since 2026-10-04 each part is a heading of its own:
//
//   ## **FND-005 • 🏠🔗📍**
//
//   > ---
//   >
//   > ### **(§) SPEC STATEMENT —**
//   >
//   > …
//   >
//   > ---
//
//   ### **(↑) SPEC PARENTS —**         (one or more; none for the root, MSN-001)
//   - **[ARC-001](path#arc-001--) • 🤖🧰👤** – why   (the first is the primary)
//   ### **(∵) SPEC RATIONALE —**
//   ### **(✓) SPEC VERIFICATION —**    (the test by which compliance is judged)
//   ### **(↓) SPEC COVERAGE —**        (the rows and designs that carry it, where any do)
//   ### **(#) DESIGN RECOMMENDATIONS —**
//   1. …                               (one item per design)
//   ### **(※) REMARKS —**              (optional)
//
// The shape before it is still read: `### FND-005`, a `> **Spec Statement**`
// callout, then `- **Spec Rationale:**`, `- **Parent Specs:**` and
// `- **Design Recommendations:**` bullets. There, a blank line may sit between
// parts and between list items; a wrapped line after a blank one is not carried
// on, so a stray paragraph still ends the row.
//
// The design's items are joined without their numbers, so every tool reads the
// same words however the part is laid out. The four-column table the registers
// were written in until 2026-10-03 is no longer a row: legacyRows() finds one, so
// the lint can refuse it.
//
// Pure: text in, rows out. Naming no path, it runs the same on a copy without
// dev/specs/ (ARC-008), where there is simply nothing to read.

const TABLE_ROW = /^\|\s*\*\*([A-Z]{3})-(\d{2,3})\*\*\s*\|/;
// The heading: `## **ID • emojis**` since 2026-10-04; before it `### ID`, once
// with a short name after a `·`. Group 1 the level, 2 the prefix, 3 the number,
// 4 whatever follows the separator.
const SECTION_ROW = /^(#{2,3})\s+(?:\*\*)?([A-Z]{3})-(\d{2,3})(?:\s+[·•]\s+(.+?))?(?:\*\*)?\s*$/;
// A part of the heading shape: `### **(↑) SPEC PARENTS —**`.
const PART_HEAD = /^###\s+\*\*\(([^)]*)\)\s+([A-Z][A-Z ]*?)\s*[—–:-]?\s*\*\*\s*$/;
const PART_KEY = {
  'SPEC PARENTS': 'parents',
  'SPEC RATIONALE': 'rationale',
  'SPEC VERIFICATION': 'verification',
  'SPEC COVERAGE': 'coverage',
  'DESIGN RECOMMENDATIONS': 'designs',
  'SPEC DESIGN': 'designs',
  REMARKS: 'remarks',
  'SPEC REMARKS': 'remarks',
};
// A parent in the heading shape: `- **[ID](href) • emojis** – why`.
const PARENT_LINE = /^\s*-\s+\*\*\[([A-Z]{3}-\d{2,3})\]\(([^)\s]*)\)(?:\s+[·•]\s+([^*]*?))?\s*\*\*\s*(?:[–—-]\s*(.*))?$/;
const TOP_ITEM = /^\d+\.\s+(.*)$/;
const LINK_ID = /\[\**([A-Z]{3}-\d{2,3})\**\]\(([^)\s]*)\)/g;
// A row ends at the next heading of its level or above, a rule, a callout or a
// table line; and at any line it cannot place, which is left for whatever
// follows rather than swallowed into the row. The one callout a row holds is its
// statement, directly under the heading, and is read before this test applies.
const SECTION_END = /^(#{1,3}\s|---\s*$|>|\|)/;
// The statement's label: `> **Spec Statement**`, or inside the box,
// `> ### **(§) SPEC STATEMENT —**`.
const CALLOUT = /^>\s*(?:#{1,6}\s+)?\*\*(?:\([^)]*\)\s*)?Spec Statement\s*[:—–-]?\s*\*\*\s*$/i;
const CALLOUT_LINE = /^>\s?(.*)$/;
const FIELD = /^-\s+\*\*(Spec Rationale|Parent Specs|Child Specs|Design Recommendations):\*\*\s*(.*)$/;
const FIELD_KEY = { 'Spec Rationale': 'rationale', 'Parent Specs': 'parents', 'Child Specs': 'children', 'Design Recommendations': 'designs' };
const CHILD = /^\s+-\s+(.*)$/;
const PARENT = /^\s*-\s+\[([A-Z]{3}-\d{2,3})\]\(([^)\s]*)\)\s*(?:·\s*(.*))?$/;
const ITEM = /^\s+\d+\.\s+(.*)$/;

/** True when `line` opens a row. */
export function isRowStart(line) {
  return SECTION_ROW.test(line);
}

/** The cells of a markdown table line, split on unescaped pipes, without the outer ones. */
export function tableCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((c) => c.trim());
}

/** [{ id, line }] for every row still written as a table line: no longer a row. */
export function legacyRows(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .flatMap((l, line) => {
      const m = TABLE_ROW.exec(l);
      return m ? [{ id: `${m[1]}-${m[2]}`, line }] : [];
    });
}

const join = (a, b) => `${a} ${b}`.trim();

/**
 * Every row in one register's text, in file order.
 *
 * Each row: { id, prefix, num, line, end, name, lead, statement, rationale, design,
 * designs, parents, parent, why, children }. `line` and `end` are the 0-based
 * first and last lines the row occupies. `designs` holds the numbered items,
 * `design` the same words joined; `parents` and `children` are [{ id, href, why }],
 * and `parent` and `why` are the first parent, the primary. A part the row lacks
 * comes back as '' or [].
 */
export function parseRows(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const rows = [];
  for (let i = 0; i < lines.length; i++) {
    const section = SECTION_ROW.exec(lines[i]);
    if (!section) continue;
    const after = section[4] ?? '';
    const emojiOnly = after && !/[\p{L}\p{N}]/u.test(after);
    const row = {
      id: `${section[2]}-${section[3]}`,
      prefix: section[2],
      num: section[3],
      line: i,
      end: i,
      name: emojiOnly ? '' : after,
      emojis: emojiOnly ? after.replace(/\s+/g, '') : '',
      anchor: headingSlug(lines[i].replace(/^#+\s+/, '')),
      lead: '',
      leadMark: '',
      statement: '',
      rationale: '',
      verification: '',
      design: '',
      designs: [],
      parents: [],
      parent: '',
      why: '',
      children: [],
      coverage: [],
      covers: [],
      remarks: [],
    };
    if (isHeadingShape(lines, i)) {
      readHeadingShape(lines, i, row);
      finish(row);
      rows.push(row);
      i = row.end;
      continue;
    }
    let field = null;
    let gap = false;
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      // The statement's callout: its label, then its lines, first under the heading.
      if (field === 'callout' && CALLOUT_LINE.test(l)) {
        row.statement = join(row.statement, CALLOUT_LINE.exec(l)[1].trim());
        row.end = j;
        continue;
      }
      if (!field && !row.statement && !row.rationale && CALLOUT.test(l)) {
        field = 'callout';
        row.end = j;
        continue;
      }
      if (SECTION_END.test(l)) break;
      if (!l.trim()) {
        if (field === 'callout') field = null;
        gap = true;
        continue;
      }
      const f = FIELD.exec(l);
      const p = field === 'parents' ? PARENT.exec(l) : null;
      const item = field === 'designs' ? ITEM.exec(l) : null;
      const child = field === 'children' ? CHILD.exec(l) : null;
      if (f) {
        field = FIELD_KEY[f[1]];
        if (field === 'rationale') row.rationale = f[2].trim();
      } else if (p) {
        row.parents.push({ id: p[1], href: p[2], why: (p[3] ?? '').trim() });
      } else if (item) {
        row.designs.push(item[1].trim());
      } else if (child) {
        // A linked row is a child; "None" says there are none.
        const c = PARENT.exec(l);
        if (c) row.children.push({ id: c[1], href: c[2], why: (c[3] ?? '').trim() });
      } else if (field && !gap && !/^-\s/.test(l)) {
        // A line wrapped under a part carries it on, indented or not.
        if (field === 'rationale') row.rationale = join(row.rationale, l.trim());
        else if (field === 'parents' && row.parents.length) row.parents.at(-1).why = join(row.parents.at(-1).why, l.trim());
        else if (field === 'designs' && row.designs.length) row.designs[row.designs.length - 1] = join(row.designs.at(-1), l.trim());
        else break;
      } else {
        break;
      }
      gap = false;
      row.end = j;
    }
    finish(row);
    rows.push(row);
    i = row.end;
  }
  return rows;
}

// A statement opens with a bold lead, eight to ten words naming its essence,
// then a dash (README.md, the anatomy's Spec Statement). The lead is read out on
// its own, with the mark after it (`leadMark`, '' where there is none), and the
// statement keeps its words without the bold marks, so a citation quotes it as
// written prose.
const LEAD = /^\*\*([^*]+?)\*\*\s*([–:-]?)\s*/;

function finish(row) {
  const lead = LEAD.exec(row.statement);
  if (lead) {
    row.lead = lead[1].trim().replace(/[.:]$/, '');
    row.leadMark = lead[2] || (/[.:]$/.test(lead[1].trim()) ? lead[1].trim().slice(-1) : '');
    row.statement = `${row.lead} ${lead[2] ? `${lead[2]} ` : ''}${row.statement.slice(lead[0].length)}`.trim();
  }
  row.design = row.designs.join(' ');
  row.parent = row.parents[0]?.id ?? '';
  row.why = row.parents[0]?.why ?? '';
}

/**
 * The anchor a heading gets, the way GitHub and VS Code make it: lower case,
 * every character that is not a letter, digit, space, hyphen or underscore
 * dropped, then each space a hyphen. `PRD-001 • 🌙⚡🎒` becomes `prd-001--`.
 */
export function headingSlug(text) {
  return String(text ?? '')
    .replace(/\*\*/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

/** True when the row under heading line `i` is in the heading shape. */
function isHeadingShape(lines, i) {
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    if (!l.trim()) continue;
    return /^>\s*-{3,}\s*$/.test(l) || PART_HEAD.test(l) || (CALLOUT.test(l) && /^>\s*#/.test(l));
  }
  return false;
}

/**
 * Read a row in the heading shape: the statement's box, then one `###` part
 * after another. It ends at the next row, at a heading of level one or two, or
 * at a rule outside the box.
 */
function readHeadingShape(lines, i, row) {
  let part = null;
  let last = null;
  for (let j = i + 1; j < lines.length; j++) {
    const l = lines[j];
    if (SECTION_ROW.test(l) || /^#{1,2}\s/.test(l) || /^---\s*$/.test(l)) break;
    if (/^>/.test(l)) {
      // A callout after the parts began is not the statement's box: it is
      // whatever follows the row, such as a register's 📚 sources note.
      if (part && part !== 'statement') break;
      if (CALLOUT.test(l)) part = 'statement';
      else if (part === 'statement') {
        const t = l.replace(/^>\s?/, '').trim();
        if (t && !/^-{3,}$/.test(t)) row.statement = join(row.statement, t);
      }
      row.end = j;
      continue;
    }
    const h = PART_HEAD.exec(l);
    if (h) {
      part = PART_KEY[h[2].trim().toUpperCase()] ?? 'other';
      last = null;
      row.end = j;
      continue;
    }
    if (/^#{3,6}\s/.test(l)) break;
    if (!l.trim()) continue;
    if (part === 'statement' || !part) break;
    row.end = j;
    if (part === 'parents') {
      const p = PARENT_LINE.exec(l) ?? PARENT.exec(l);
      if (p) {
        const why = (PARENT_LINE.test(l) ? p[4] : p[3]) ?? '';
        row.parents.push({ id: p[1], href: p[2], why: why.trim(), emojis: PARENT_LINE.test(l) ? (p[3] ?? '').trim() : '' });
      } else if (row.parents.length) row.parents.at(-1).why = join(row.parents.at(-1).why, l.trim());
    } else if (part === 'rationale') row.rationale = join(row.rationale, l.trim());
    else if (part === 'verification') row.verification = join(row.verification, l.trim());
    else if (part === 'designs') {
      const item = TOP_ITEM.exec(l);
      if (item) row.designs.push(item[1].trim());
      else if (row.designs.length) row.designs[row.designs.length - 1] = join(row.designs.at(-1), l.trim());
      else row.designs.push(l.trim());
    } else if (part === 'coverage') {
      row.coverage.push(l.trim());
      for (const m of l.matchAll(LINK_ID)) {
        // The mark that claims this link: the one between it and the separator before it.
        const before = l.slice(0, m.index);
        const from = Math.max(before.lastIndexOf(';'), before.lastIndexOf('→'));
        row.covers.push({ id: m[1], href: m[2], ticked: before.slice(from + 1).includes('✅') });
      }
    } else if (part === 'remarks') row.remarks.push(l.trim());
    last = part;
  }
  return last;
}

/**
 * A row's own words, whitespace collapsed: statement, rationale (with the
 * verification after it, the sentence it was split from) and design. The
 * stress stamps hash it, so a change in markup alone never resets a stamp.
 */
export function rowText(row) {
  const why = [row.rationale, row.verification ?? ''].join(' ');
  return [row.statement, why, row.design].map((s) => s.replace(/\s+/g, ' ').trim()).join(' | ');
}

// Row groups: an optional list between a register's ⚠️ note and its first row,
// one line per group, "- `004–009` · The places". Positions, not IDs: a group is
// the rows that sit in that range, and a reorder moves the ranges with them.
const GROUP = /^- `(\d{3})–(\d{3})` · (.+)$/;

/** [{ line, from, to, name }] for the register's row groups, or [] if it has none. */
export function parseGroups(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const start = lines.findIndex((l) => /^#{1,2} Specifications Register/.test(l));
  if (start === -1) return [];
  const groups = [];
  for (let i = start + 1; i < lines.length && !/^\|/.test(lines[i]) && !isRowStart(lines[i]); i++) {
    const m = lines[i].match(GROUP);
    if (m) groups.push({ line: i, from: Number(m[1]), to: Number(m[2]), name: m[3] });
  }
  return groups;
}

/**
 * The specs as a graph: every row a node, every parent spec an edge from the row
 * to the row it exists because of. Built from [{ file, text }], one entry per
 * register, so whatever reads it (the lint's --graph, the Specs tab, a drawing
 * of the tree) reads one shape. MSN-001 is the root: depth 0, no edge out.
 *
 * Returns { root, nodes: [{ id, name, file, statement, parent, why, parents,
 * depth }], edges: [{ from, to, why, primary }] }. A row's first parent is its
 * primary: `parent` and `why` name it, its edge is marked primary, and depth is
 * counted along primaries alone, so the primaries draw a tree and the rest
 * cross-link it. A depth is null where the primary chain never reaches the root.
 */
export function specGraph(entries) {
  const nodes = [];
  for (const { file, text } of entries) {
    for (const r of parseRows(text)) {
      nodes.push({
        id: r.id,
        name: r.name,
        emojis: r.emojis,
        file,
        lead: r.lead,
        statement: r.statement,
        verification: r.verification,
        coverage: r.coverage,
        parent: r.parent,
        why: r.why,
        parents: r.parents.map(({ id, why }) => ({ id, why })),
      });
    }
  }
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const ROOT = 'MSN-001';
  for (const n of nodes) {
    let depth = 0;
    const seen = new Set();
    for (let at = n; at && at.id !== ROOT; at = byId.get(at.parent)) {
      if (seen.has(at.id) || !at.parent) { depth = null; break; }
      seen.add(at.id);
      depth++;
    }
    n.depth = byId.has(ROOT) ? depth : null;
  }
  const edges = nodes.flatMap((n) =>
    n.parents.filter((p) => byId.has(p.id)).map((p, k) => ({ from: n.id, to: p.id, why: p.why, primary: p.id === n.parent && k === 0 })),
  );
  return { root: ROOT, nodes, edges };
}
