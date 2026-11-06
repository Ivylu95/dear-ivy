// FND-006 / DAT-002: a cross-reference that points at nothing.
//
// FND-006 is the one this enforces directly — "a move updates the index in the
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
// question. The same week, a spec moved from `dev/specs/dashboard.md` into
// `dev/specs/dashboard/dashboard.md` and four references to the old path survived.
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
//   SPEC IDS   A cited **ARC-004** / **MNT-003** must be defined in a file
//              under dev/specs/. The specs were renumbered from two digits
//              to three within a day of being written, which broke every
//              citation of them elsewhere and, again, failed silently.
//
// It cannot check a heading reference ("see *Operating Procedures*"), which is
// the third form of the same bug. Those still need a person. What it removes is
// the part that is mechanical, and that part is most of them.
//
// Bare filenames (`now.md`, `README.md`) are deliberately NOT checked. They are
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
//   (and dev/skills/manage-harness.md, one of them moved into the core)
//                       repo — they name paths meant to be absent here, and any
//                       register they cite belongs to that repo.
//   The dated ledgers   Both off. data/core/state/proposals.md and
//                       modules/core/knowledge/log.md are append-only records of what
//                       was true ON A DATE. A row naming a path since moved, or
//                       an ID since renumbered, is the ledger doing its job;
//                       rewriting it would falsify the record.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readModules } from '../../.claude/hooks/lib/modules.mjs';
import { DEV_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { parseRows } from '../../.claude/hooks/lib/spec-rows.mjs';
import { SKIP_DIRS, walkFiles } from '../lib/walk-skip.mjs';

// The shared walker and its list (lib/walk-skip.mjs), so an agent's worktree
// copy of the repository is never read as the repository itself.
const walk = (root) => walkFiles(root, { keep: (name) => !name.startsWith('.env') && name.endsWith('.md') });

// A backticked path, or a markdown link target. Both forms carry the same bug.
const BACKTICKED = /`([^`\s]+)`/g;
const LINKED = /\]\(([^)\s]+)\)/g;
const SPEC_ID = /\b([A-Z]{3})-(\d{2,3})\b/g;

// Written to run against another repository, so neither check means anything.
const foreign = (rel) => rel.startsWith('.claude/commands/') || rel === 'dev/skills/manage-harness.md';

// PATHS not checked — the dated ledgers.
const PATHS_EXEMPT = new Set([
  'data/core/state/proposals.md',
  'modules/core/knowledge/log.md',
]);

// SPEC CITATIONS not checked — the dated ledgers too.
const IDS_EXEMPT = new Set([
  'data/core/state/proposals.md',
  'modules/core/knowledge/log.md',
]);

// An archive is a sealed copy of what something said, and its pointers were
// written to resolve where it came from — another folder, another repository,
// another numbering. Retargeting them would edit the record of what was there,
// which is the one thing an archive exists not to do, and `data/archive/` is
// refused by the guard hook for exactly that reason: a finding inside one is a
// finding nobody may act on.
//
// Learned when `data/archive/` took a record imported from an older repository, which brought about sixty pointers
// into a layout that no longer exists. None is broken — each is correct about
// a place that is gone. The sandbox and the sample are records of the same
// shape, so their archives are sealed the same way.
const sealed = (rel) => /^(data|data-sandbox|data-sample)\/archive\//.test(rel);

// An import manifest (data/core/state/imports/) names every path as it was in the
// SOURCE — another repository's layout — because that is what it records. Its
// paths are not pointers into this one; the first real import put a thousand
// of them in one file. Spec citations in it are still checked.
const manifest = (rel) => rel.startsWith('data/core/state/imports/');

const pathsExempt = (rel) => PATHS_EXEMPT.has(rel) || sealed(rel) || foreign(rel) || manifest(rel);
const idsExempt = (rel) => IDS_EXEMPT.has(rel) || sealed(rel) || foreign(rel);

// Not a path in this repository, or not one that can be checked on disk.
// `isLink` is what makes the bare-filename rule safe to narrow. A backticked
// `now.md` is usually a NAME — CLAUDE.md says "what she wants → what_i_want.md"
// and means the file called that, wherever it lives; 212 such mentions resolve
// nowhere and all of them are fine. A markdown link target is a POINTER by
// construction: somebody will click it. So a bare name is skipped in prose and
// checked in a link.
//
// Written after four links in dev/specs/README.md and dev/specs/PRODUCT.md went on
// naming a retired findings file for five days, and this check could not see
// them because a bare filename has no slash in it. Nothing in the repository is
// broken by the narrowed rule today.
function uncheckable(raw, isLink = false) {
  return (
    (!raw.includes('/') && !isLink) || // bare filename in prose — a name, not a path
    raw.startsWith('/') || // a route (/safety) or a slash command (/manage-harness)
    /^[a-z][a-z0-9+.-]*:/i.test(raw) || // scheme: http, mailto, data
    raw.startsWith('#') ||
    /[<>*?"|[\]…]/.test(raw) || // <firstname>, dear-[user]/, *.md, claude/… — a shape, not a file
    /\b(YYYY|MM|DD|HH)\b/.test(raw) || // dated placeholder
    // A branch namespace, not a folder: `claude/` (a chat's branch) and `rescue/`
    // (a refused save) name git branches, and no folder in the repository has
    // either name. Read as pointers three times in one chat, 2026-10-01.
    /^(claude|rescue)\/$/.test(raw) ||
    /^[A-Za-z0-9.-]+\.(org|com|net|gov|uk|sg|io|ai|edu)(\/|$)/.test(raw) || // bare domain
    // Inside a folder the repository never tracks — temp/, .next/ — which
    // exists on a machine that has run something and nowhere else. Checked
    // against disk it passed where the check was written and failed in every
    // fresh clone, so it was answering "has this machine been used", not
    // "does this pointer resolve". Same set the walk above skips.
    SKIP_DIRS.has(raw.replace(/^\.?\//, '').split('/')[0])
  );
}

// Set only for the length of findBrokenLinksIn, which is synchronous.
let ONLY = null;

/** findBrokenLinks, reading only the files in `only` (rel paths): the after-write hook (SFG-005). */
export function findBrokenLinksIn(repoRoot, only) {
  ONLY = only;
  try {
    return findBrokenLinks(repoRoot);
  } finally {
    ONLY = null;
  }
}

/**
 * Every pointer under `root` that resolves to nothing, as { from, what }, with
 * the counts the report prints. Proven against a tree made for it by
 * test-check-links.mjs (SFG-007 design 5).
 */
export function findBrokenLinks(repoRoot) {
  // What a copy of the harness may lack without anything being lost: the design,
  // kept back from every copy (ARC-008), with the development tools whose bodies
  // live in it; the developer's own backlog; the test record, built on demand;
  // archive kept on one machine only; and the workflows, which a release never
  // carries because a copy's are set up once, from a computer. A pointer into
  // one of these is checked where it exists and passed where it does not.
  // data/archive/check-in-questions.md is made on the check-in's first use (check-in.md), and
  // .claude/jobs/state.json on a copy's first heartbeat run, so a new copy has neither yet.
  const WITHHELD = [DEV_DIR, '.claude/commands', 'data-sandbox', 'data/archive-local', 'data/archive/check-in-questions.md', '.claude/jobs/state.json', '.github'].map((p) => join(repoRoot, p));
  const withheld = (abs) => WITHHELD.some((dir) => (abs === dir || abs.startsWith(`${dir}${sep}`)) && !existsSync(dir));

  const files = walk(repoRoot).map((f) => ({ abs: f, rel: relative(repoRoot, f).replace(/\\/g, '/') }));

  // Every spec ID the specs themselves define. A row defines its ID where it
  // opens, in its first cell or its heading; a citation elsewhere only mentions it. Reading definitions from the
  // spec files alone is what makes a stale citation detectable at all.
  const defined = new Set();
  for (const { abs, rel } of files) {
    if (!rel.startsWith('dev/specs/')) continue;
    for (const { id } of parseRows(readFileSync(abs, 'utf8'))) defined.add(id);
  }

  // A backticked path or link target in `text` that resolves to nothing on disk.
  // `bases` are the folders a relative target may resolve from, besides the root.
  function brokenPaths(text, bases, rel) {
    const out = [];
    for (const pattern of [BACKTICKED, LINKED]) {
      const isLink = pattern === LINKED;
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const [raw, fragment] = match[1].replace(/\\/g, '/').split('#');
        if (!raw || uncheckable(raw, isLink)) continue;

        const target = raw.replace(/\/$/, '');
        const found = [repoRoot, ...bases].map((base) => resolve(base, target)).find((abs) => existsSync(abs));
        if (found) {
          // An anchor into a page that names its anchors (`<a id="a-067">`, as the Agreements'
          // pages do, T-768) must be one of them: a card's link that lands nowhere is broken too.
          if (isLink && fragment && /\.md$/.test(found)) {
            let page = '';
            try { page = readFileSync(found, 'utf8'); } catch { /* a folder, or unreadable: the path is enough */ }
            if (page.includes('<a id="') && !page.includes(`<a id="${fragment}">`)) out.push({ from: rel, what: `points at ${safe(target)}#${fragment}, an anchor that page does not have`, target });
          }
          continue;
        }
        // A pointer into something a copy may lawfully lack names something
        // withheld, not something lost (ARC-008 and WITHHELD above).
        if ([repoRoot, ...bases].some((base) => withheld(resolve(base, target)))) continue;

        // `what` is what is printed, a record path cut to its folder; `target`
        // is the path as written, for code only (the eval runner's stand-ins).
        out.push({ from: rel, what: `points at ${safe(target)}, which does not exist`, target });
      }
    }
    return out;
  }

  // A dated entry in a ledger records what happened under the numbers of that day,
  // and is left as written. Rewriting one to satisfy a
  // renumber edits the record of what was decided, which is the one thing a ledger
  // exists not to do — so an ID inside a dated blockquote entry is not chased. The
  // live findings in the same file are tables, not blockquotes, so their citations
  // are still checked.
  //
  // Found on 2026-09-26, when the retired specs queue was deleted: its drafted rows
  // matched the pattern that collects DEFINED ids, so SAF-016 counted as a real row
  // for as long as that file existed, and two historical entries citing it passed.
  // A queue silently defining ids is the more interesting half of that.
  const datedEntry = /^>\s*\*\*\d{4}-\d{2}-\d{2}\b/;
  const withoutDatedEntries = (text) =>
    text
      .split('\n')
      .filter((line) => !datedEntry.test(line))
      .join('\n');

  // A dated row of the hazard log (policies/SAFETY_POLICY.md) is a ledger entry too:
  // it records a change under the paths and numbers of its day, and the spec-writer's
  // renumber rule restores them rather than rewrite history. On 2026-10-17 check-ups
  // were removed and their row retired, and three such rows then named files and a
  // number that no longer exist. Only the dated rows inside "## The hazard log" are
  // set aside; the rest of the file, and every other table, is still checked.
  const HAZARD_FILE = 'policies/SAFETY_POLICY.md';
  const withoutHazardRows = (text, rel) => {
    if (rel !== HAZARD_FILE) return text;
    let inLog = false;
    return text
      .split('\n')
      .filter((line) => {
        if (/^## /.test(line)) inLog = /^## The hazard log\s*$/.test(line);
        return !(inLog && /^\| \d{4}-\d{2}-\d{2} \|/.test(line));
      })
      .join('\n');
  };

  // A cited spec ID that no spec defines.
  function staleIds(rawText, rel) {
    const out = [];
    const text = withoutDatedEntries(rawText);
    SPEC_ID.lastIndex = 0;
    let id;
    while ((id = SPEC_ID.exec(text)) !== null) {
      if (defined.has(id[0])) continue;
      // A prefix nothing defines is somebody else's vocabulary, not a stale
      // citation — only report an ID whose family exists and whose number doesn't.
      if (![...defined].some((d) => d.startsWith(`${id[1]}-`))) continue;
      // A number past the family's last row is usually a draft's guess at the
      // next ID, and the remedy is named: drafts of new SKL rows written as
      // SKL-009…SKL-018 were refused and rewritten by trial (2026-10-14).
      const n = Number(id[0].slice(id[1].length + 1));
      const last = Math.max(...[...defined].filter((d) => d.startsWith(`${id[1]}-`)).map((d) => Number(d.slice(id[1].length + 1)) || 0));
      const hint = n > last ? `; a draft row not yet approved is written "new ${id[1]} (${n})", never with an ID` : '';
      out.push({ from: rel, what: `cites ${id[0]}, which no spec defines${hint}` });
    }
    return out;
  }

  const findings = [];

  // A module's standing templates and the sandbox are copies of data/'s shape, and
  // their relative links are written to resolve from there. So each is checked as
  // the data/ file it stands in for: same folder to resolve from, same exemptions.
  // A standing entry is a file or a whole folder (core's maps templates/blank-record/
  // onto the record's root).
  const SANDBOX_DIR = 'data-sandbox/';
  const standing = readModules(repoRoot).flatMap((m) => m.shapes.map(([from, to]) => [from, posix.join('data', to)]));
  const asRecord = (rel) => {
    for (const [src, dst] of standing) {
      if (rel === src) return dst;
      if (rel.startsWith(`${src}/`)) return dst + rel.slice(src.length);
    }
    return rel.startsWith(SANDBOX_DIR) ? `data/${rel.slice(SANDBOX_DIR.length)}` : rel;
  };

  // `only`: the files just written (SFG-005 design 1), so the after-write hook
  // reads those and nothing else; the spec rows above are still read in full.
  for (const { abs, rel } of files) {
    if (ONLY && !ONLY.has(rel)) continue;
    const text = withoutHazardRows(readFileSync(abs, 'utf8'), rel);
    const stand = asRecord(rel);

    // A sandbox file may also point at what exists only in the sandbox: a person
    // or an entry the test conversation created, which data/ never has. So it
    // resolves from its own folder and the sandbox root too, as its twin in data/
    // would from data/.
    const bases = [dirname(join(repoRoot, stand))];
    if (rel.startsWith(SANDBOX_DIR)) bases.push(dirname(abs), join(repoRoot, SANDBOX_DIR));
    if (!pathsExempt(stand)) findings.push(...brokenPaths(text, bases, rel));
    // Spec IDs are only meaningful once the specs define something — otherwise a
    // repo without specs would report every citation in it as broken.
    if (!idsExempt(stand) && defined.size > 0) findings.push(...staleIds(text, rel));
  }

  // A missing path under data/core/people/ is a name. Printing it would put personal
  // content in a terminal, a CI log and a screenshot — which is the exact thing
  // HAR-02 and PER-04 exist to prevent, and a privacy control that leaks while
  // reporting a broken link is worse than the broken link.
  function safe(target) {
    const parts = target.split('/');
    if (parts[0] !== 'data' || parts.length < 3) return target;
    return [...parts.slice(0, 2), '…'].join('/');
  }

  // FND-010: the instruction file sits at the root, where Claude Code loads it,
  // and AGENTS.md beside it is only a pointer to it, for every other tool. A
  // second copy back in .claude/ would be loaded too, and a stub that grows
  // rules of its own is a second copy that drifts.
  if (ONLY) return { findings, files: files.length, defined: defined.size };
  {
    const AGENTS_MAX_LINES = 12;
    if (!existsSync(join(repoRoot, 'CLAUDE.md'))) findings.push({ from: '(root)', what: 'has no CLAUDE.md (FND-010)' });
    if (existsSync(join(repoRoot, '.claude', 'CLAUDE.md'))) findings.push({ from: '.claude/CLAUDE.md', what: 'is back: Claude Code would load it beside the root CLAUDE.md (FND-010)' });
    const agents = join(repoRoot, 'AGENTS.md');
    if (!existsSync(agents)) findings.push({ from: '(root)', what: 'has no AGENTS.md stub (FND-010)' });
    else {
      const text = readFileSync(agents, 'utf8');
      if (!/\]\(CLAUDE\.md\)/.test(text)) findings.push({ from: 'AGENTS.md', what: 'does not link to CLAUDE.md (FND-010)' });
      if (text.trim().split('\n').length > AGENTS_MAX_LINES) findings.push({ from: 'AGENTS.md', what: `runs past ${AGENTS_MAX_LINES} lines: a stub points, it holds no rules (FND-010)` });
    }
  }

  return { findings, files: files.length, defined: defined.size };
}

const KNOWN_PATH = join(dirname(fileURLToPath(import.meta.url)), 'check-links.known.txt');
// A record path can carry a name, so a record entry is listed by its hash.
const knownKey = (k) => (k.startsWith('data/') ? `sha1:${createHash('sha1').update(k).digest('hex').slice(0, 16)}` : k);

/**
 * The findings not on the ratchet's list (check-links.known.txt): what the
 * commit-time run fails on, and what the after-write hook reports (SFG-005).
 */
export function freshFindings(findings) {
  const known = new Set(
    (existsSync(KNOWN_PATH) ? readFileSync(KNOWN_PATH, 'utf8') : '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );
  return findings.filter((f) => !known.has(knownKey(`${f.from} ${f.what}`)));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) {
  const result = findBrokenLinks(join(dirname(dirname(fileURLToPath(import.meta.url))), '..'));
  const { findings, files, defined } = result;
  // A ratchet, not an amnesty (WKB-004): the broken pointers known on the day the
  // check started blocking are listed in check-links.known.txt, and only a pointer
  // not on that list fails. A listed one that now resolves is named, so the list
  // only shrinks.
  const knownPath = join(dirname(fileURLToPath(import.meta.url)), 'check-links.known.txt');
  const known = new Set(
    (existsSync(knownPath) ? readFileSync(knownPath, 'utf8') : '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#')),
  );
  {
    // A record path can carry a name, so a record entry is listed by its hash.
    const key = (k) => (k.startsWith('data/') ? `sha1:${createHash('sha1').update(k).digest('hex').slice(0, 16)}` : k);
    const all = new Map();
    for (const f of findings) all.set(key(`${f.from} ${f.what}`), f);
    const fixed = [...known].filter((k) => !all.has(k));
    for (const k of fixed) console.warn(`  link check: fixed, remove from check-links.known.txt — ${k}`);
    const fresh = [...all.entries()].filter(([k]) => !known.has(k)).map(([, f]) => f);
    if (!fresh.length && findings.length) {
      console.log(`link check: ${files} markdown files, no new broken pointer (${all.size} known, listed in check-links.known.txt)`);
      process.exit(0);
    }
    findings.length = 0;
    findings.push(...fresh);
  }

  if (findings.length > 0) {
    const unique = new Map();
    for (const f of findings) unique.set(`${f.from}→${f.what}`, f);

    console.error('\n  LINK CHECK FAILED\n');
    for (const f of unique.values()) console.error(`  - ${f.from} ${f.what}`);
    console.error('\n  A pointer that resolves is how the record stays retrievable. Fix the');
    console.error('  reference, or the thing it should point at now. See FND-006 in');
    console.error('  dev/specs/system/findability.md.\n');
    process.exit(1);
  }

  console.log(
    `link check: ${files} markdown files clean ` +
      `(${defined} spec IDs defined)`,
  );
}
