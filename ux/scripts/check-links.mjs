// ARC-014 / DAT-002: a cross-reference that points at nothing.
//
// ARC-014 is the one this enforces directly — "a move updates the index in the
// same change, leaves no pointer dangling" — and its rationale says why that is
// worth failing a build over: a dangling pointer is indistinguishable from a
// deletion to the session that follows it. DAT-002 is what it protects — anything
// written staying findable a year and a hundred files later.
//
// Cited here as REC-04 and HAR-02 until 2026-09-20. Both families were renumbered
// into ARC- and nothing caught it, because this script does not scan its own
// comments — the failure it exists to catch, in the file that catches it.
//
//   node scripts/check-links.mjs         (runs as part of `npm run build`)
//
// Why this exists, specifically:
//
// When the instruction file moved to named headings, around twenty pointers
// across the repo went on citing section numbers that had stopped existing.
// Nothing failed. Nothing warned. They sat dead for three weeks and were found
// by hand, one file at a time, because a session was asked an unrelated
// question. The same week, a spec moved from `specs/dashboard.md` into
// `specs/dashboard/dashboard.md` and four references to the old path survived.
//
// This is the failure mode the record is least able to absorb. Retrievability
// IS the product — a pointer that resolves is the whole mechanism by which she
// never re-explains who someone is. A broken one does not announce itself; it
// just quietly returns nothing, and the session moves on without the context.
//
// ── What it can and cannot do ───────────────────────────────────────────────
//
// It checks two things, both mechanical:
//
//   PATHS      A backticked `a/b.md` or a markdown link target must exist on
//              disk, resolved first against the repository root and then
//              against the directory of the file citing it.
//   SPEC IDS   A cited **ARC-003** / **MNT-003** must be defined in a file
//              under specs/. The specs were renumbered from two digits
//              to three within a day of being written, which broke every
//              citation of them elsewhere and, again, failed silently.
//
// It cannot check a heading reference ("see *Operating Procedures*"), which is
// the third form of the same bug. Those still need a person. What it removes is
// the part that is mechanical, and that part is most of them.
//
// Bare filenames (`now.md`, `INDEX.md`) are deliberately NOT checked. They are
// used throughout as shorthand for a file named fully elsewhere, and treating
// them as paths produces a flood of false reports — which makes a check nobody
// runs twice.
//
// ── What is exempt, and why ─────────────────────────────────────────────────
//
// Exemption is per CHECK, not per file, because the two fail differently. A path
// in a ledger may legitimately be gone. A spec ID never may: it is a citation,
// and the renumbering this script exists to catch is precisely what breaks one.
//
//   .claude/commands/   Both off. Operator procedures written to run against ANY
//                       repo — they name paths meant to be absent here, and any
//                       register they cite belongs to that repo.
//   The dated ledgers   Both off. data/state/proposals.md and
//                       knowledge/log.md are append-only records of what
//                       was true ON A DATE. A row naming a path since moved, or
//                       an ID since renumbered, is the ledger doing its job;
//                       rewriting it would falsify the record.
//   REVIEW.md       Paths off, IDs ON. Not a dated record — it is what is
//                       wrong RIGHT NOW, and its rows name absent paths because
//                       an absent path is frequently the finding. But it is the
//                       densest file here for spec citations, and a row citing a
//                       spec nobody can open is a row nobody can act on.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');

const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out', 'temp', '.vercel']);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.env')) continue;
    const full = join(dir, name);
    let stats;
    try {
      stats = statSync(full);
    } catch {
      continue;
    }
    if (stats.isDirectory()) walk(full, out);
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

// A backticked path, or a markdown link target. Both forms carry the same bug.
const BACKTICKED = /`([^`\s]+)`/g;
const LINKED = /\]\(([^)\s]+)\)/g;
const SPEC_ID = /\b([A-Z]{3})-(\d{2,3})\b/g;

// Written to run against another repository, so neither check means anything.
const foreign = (rel) => rel.startsWith('.claude/commands/');

// PATHS not checked — the ledgers, and both findings queues among them. The
// queue was split on 2026-09-21: findings whose fix lands inside specs/
// go to the REVIEW.md in that folder, everything else to .claude/REVIEW.md.
// Both carry the exemption for the same reason, so it is keyed to the name.
const PATHS_EXEMPT = new Set([
  'data/state/proposals.md',
  'knowledge/log.md',
  '.claude/REVIEW.md',
  'specs/REVIEW.md',
]);

// SPEC CITATIONS not checked — the DATED ledgers only. REVIEW.md is not one.
const IDS_EXEMPT = new Set(['data/state/proposals.md', 'knowledge/log.md']);

const pathsExempt = (rel) => PATHS_EXEMPT.has(rel) || foreign(rel);
const idsExempt = (rel) => IDS_EXEMPT.has(rel) || foreign(rel);

// Not a path in this repository, or not one that can be checked on disk.
function uncheckable(raw) {
  return (
    !raw.includes('/') || // bare filename — shorthand, see the header
    raw.startsWith('/') || // a route (/safety) or a slash command (/manage-harness)
    /^[a-z][a-z0-9+.-]*:/i.test(raw) || // scheme: http, mailto, data
    raw.startsWith('#') ||
    /[<>*?"|[\]]/.test(raw) || // <firstname>, dear-[user]/, *.md — a shape, not a file
    /\b(YYYY|MM|DD|HH)\b/.test(raw) || // dated placeholder
    /^[A-Za-z0-9.-]+\.(org|com|net|gov|uk|sg|io|ai|edu)(\/|$)/.test(raw) || // bare domain
    // Inside a folder the repository never tracks — temp/, .next/ — which
    // exists on a machine that has run something and nowhere else. Checked
    // against disk it passed where the check was written and failed in every
    // fresh clone, so it was answering "has this machine been used", not
    // "does this pointer resolve". Same set the walk above skips.
    SKIP_DIRS.has(raw.replace(/^\.?\//, '').split('/')[0])
  );
}

const files = walk(repoRoot).map((f) => ({ abs: f, rel: relative(repoRoot, f).replace(/\\/g, '/') }));

// Every spec ID the specs themselves define. A row defines its ID in the first
// cell; a citation elsewhere only mentions it. Reading definitions from the
// spec files alone is what makes a stale citation detectable at all.
const defined = new Set();
for (const { abs, rel } of files) {
  if (!rel.startsWith('specs/')) continue;
  for (const line of readFileSync(abs, 'utf8').split('\n')) {
    const m = /^\|\s*\*\*([A-Z]{3}-\d{2,3})\*\*\s*\|/.exec(line);
    if (m) defined.add(m[1]);
  }
}

// A backticked path or link target in `text` that resolves to nothing on disk.
function brokenPaths(text, here, rel) {
  const out = [];
  for (const pattern of [BACKTICKED, LINKED]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[1].replace(/\\/g, '/').split('#')[0];
      if (!raw || uncheckable(raw)) continue;

      const target = raw.replace(/\/$/, '');
      if (existsSync(resolve(repoRoot, target)) || existsSync(resolve(here, target))) continue;

      out.push({ from: rel, what: `points at ${safe(target)}, which does not exist` });
    }
  }
  return out;
}

// A cited spec ID that no spec defines.
function staleIds(text, rel) {
  const out = [];
  SPEC_ID.lastIndex = 0;
  let id;
  while ((id = SPEC_ID.exec(text)) !== null) {
    if (defined.has(id[0])) continue;
    // A prefix nothing defines is somebody else's vocabulary, not a stale
    // citation — only report an ID whose family exists and whose number doesn't.
    if (![...defined].some((d) => d.startsWith(`${id[1]}-`))) continue;
    out.push({ from: rel, what: `cites ${id[0]}, which no spec defines` });
  }
  return out;
}

const findings = [];

// The blank record template and the sandbox are copies of data/'s shape, and
// their relative links are written to resolve from there. So each is checked as
// the data/ file it stands in for: same folder to resolve from, same exemptions.
const asRecord = (rel) => rel.replace(/^(\.claude\/templates\/record|data-sandbox)\//, 'data/');

for (const { abs, rel } of files) {
  const text = readFileSync(abs, 'utf8');
  const stand = asRecord(rel);

  if (!pathsExempt(stand)) findings.push(...brokenPaths(text, dirname(join(repoRoot, stand)), rel));
  // Spec IDs are only meaningful once the specs define something — otherwise a
  // repo without specs would report every citation in it as broken.
  if (!idsExempt(stand) && defined.size > 0) findings.push(...staleIds(text, rel));
}

// A missing path under data/people/ is a name. Printing it would put personal
// content in a terminal, a CI log and a screenshot — which is the exact thing
// HAR-02 and PER-04 exist to prevent, and a privacy control that leaks while
// reporting a broken link is worse than the broken link.
function safe(target) {
  const parts = target.split('/');
  if (parts[0] !== 'data' || parts.length < 3) return target;
  return [...parts.slice(0, 2), '…'].join('/');
}

if (findings.length > 0) {
  const unique = new Map();
  for (const f of findings) unique.set(`${f.from}→${f.what}`, f);

  console.error('\n  LINK CHECK FAILED\n');
  for (const f of unique.values()) console.error(`  - ${f.from} ${f.what}`);
  console.error('\n  A pointer that resolves is how the record stays retrievable. Fix the');
  console.error('  reference, or the thing it should point at now. See ARC-014 in');
  console.error('  specs/system/ARCHITECTURE.md.\n');
  process.exit(1);
}

console.log(
  `link check: ${files.length} markdown files clean ` +
    `(${defined.size} spec IDs defined)`,
);
