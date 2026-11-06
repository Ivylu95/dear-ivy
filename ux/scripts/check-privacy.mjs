// ARC-004: everything personal lives in one folder at the root.
//
// It is also what keeps procedural memory free of personal content (PMM-001,
// design 1): a name from the record in a skill or command is refused here, in
// .claude/skills/ and .claude/commands/ like any other harness file; the test
// carries a skill naming a person on file.
// A procedure's tests are held to the same rule (PRL-001, design 2): the test
// plants a name in a skill's eval prompts.
//
//   node scripts/check-privacy.mjs       (runs as part of `npm run build`)
//
// The spec does not merely state this rule, it asks for this exact program:
// "A grep for personal content outside the record folder is the one privacy
// control that automates completely — build it, because review won't catch a
// leak on the hundredth file."
//
// It is now the hundredth file. The dashboard added around sixty of them.
//
// ── What it can and cannot do ───────────────────────────────────────────────
//
// It cannot know what "personal" means in general. It checks the two leaks that
// actually happen, both mechanical:
//
//   NAMES     Every person with a file in data/core/people/ has their name checked
//             (and a page named firstname-word.md, its first name alone too)
//             against every harness file. This is how a name reaches a code
//             comment, a test fixture, or a commit message.
//   COPIES    Any long line that appears verbatim in both data/ and a harness
//             file. This is how a quote reaches a sample, a screenshot caption,
//             or a doc "example".
//
// A clean run is not proof of privacy. A dirty run is proof of a leak, which is
// the direction that matters — and it is the half that review reliably misses.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { profileName } from '../../.claude/hooks/lib/profile-schema.mjs';
import { peopleSlugs } from '../../.claude/hooks/lib/people.mjs';
import { CORE_DATA } from '../../.claude/hooks/lib/modules.mjs';
import { wholeNameMatcher } from '../lib/name-match.mjs';
import { withoutEverydayNames } from '../lib/everyday-names.mjs';
import { walkFiles } from '../lib/walk-skip.mjs';

// Skipped wholesale: not authored here, or not text. temp/ is NOT among them — it
// is authored here, and ARC-004's test is every file outside the record rather than
// every tracked file. It was skipped until 2026-09-27, and what collected there
// unseen is the reason ARC-013 now carries a sweep.
// `worktrees` is other sessions' untracked working copies (.claude/worktrees/agent-…):
// nothing in them is committed from this tree, and scanning them nearly tripled
// the files read, so the end-of-turn run timed out and reported a leak that was
// only a timeout (2026-10-04).
// `data` is skipped at the root only (the walker's `top`). `data-sandbox` was skipped
// too until 2026-11-01, and a real name sat in it unseen: it is outside data/, so it
// is read like any harness file (A-155). Skipping by name until 2026-10-09
// also hid the spec group dev/specs/data/
// from this check, the review finding walk-skip.mjs records for the Harness view.
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'out', '.vercel', 'worktrees']);
const RECORD_TOP = new Set(['data']);
// Every kind of text a file outside data/ can carry (A-155): until 2026-11-01 only the
// first twelve were read, so a name in a .jsonl log, a .sh script, a .csv or a git hook
// sat unseen. A file with no extension (a git hook, LICENSE, .gitignore) is read too,
// and passed over if it holds a NUL byte, which no text file does. `.env` files are
// never read, being secrets, not text written here; `.env.example` is.
const TEXT = new Set([
  '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.css', '.json', '.jsonl', '.ndjson', '.md', '.txt', '.yml', '.yaml', '.toml', '.ini',
  '.html', '.svg', '.xml', '.csv', '.tsv', '.sh', '.bash', '.py', '.log',
]);
const isText = (name) => (name.startsWith('.env') ? name === '.env.example' : TEXT.has(extname(name)) || extname(name) === '' || name.endsWith('.env.example'));

const walk = (root) => walkFiles(root, { names: SKIP_DIRS, top: RECORD_TOP, keep: isText });

/** Every harness file this check reads: shared with check-example-names.mjs, so both read the same files. */
export const harnessFiles = walk;

// data/ is in SKIP_DIRS above, so the record needs its own walker rather than a
// flag threaded through the one that deliberately avoids it.
//
// `_claude/` is an old harness archived under data/archive/, renamed from
// `.claude/` so its skills stop loading as live ones. It is harness text, not
// record text, and the current harness sharing a line with it is not a leak.
const walkData = (dir) =>
  walkFiles(dir, { names: new Set(['_claude']), keep: (name) => !name.startsWith('.') && TEXT.has(extname(name)) });

// A quote or a list item is compared by its words, not its markers (2026-11-01, A-155):
// her exact words are kept in the record as "> " quotes and "- " items, and the dev
// Transcript quotes every remark with "> ", so a check that skipped marked lines on one
// side and kept the marker on the other could never match the likeliest leak of all.
// Shared with the commit-msg hook, which holds a commit message to the same rule.
export const words = (line) => line.trim().replace(/^(?:(?:>|[-*+]|\d+[.)])\s+)+/, '').trim();

/** Shorter than this, a line shared with the record is coincidence. */
export const MIN_COPY = 60;

// Capitalised words the record uses mid-sentence: its names and places.
const PROPER = /(?<=[\p{Ll},;:(."'’] )\p{Lu}\p{Ll}+/gu;

/**
 * The record's long lines, by their words, and the capitalised words it uses
 * mid-sentence: one walk of `dataDir`. Shared with the commit-msg hook.
 */
export function recordLines(dataDir) {
  const lines = new Set();
  const proper = new Set();
  for (const file of walkData(dataDir)) {
    const text = read(file);
    for (const [word] of text.matchAll(PROPER)) proper.add(word);
    for (const line of text.split('\n')) {
      const trimmed = words(line);
      // Structure is shared by design: headings, table rows and the templates' own
      // italic guidance all legitimately appear on both sides.
      if (trimmed.length < MIN_COPY) continue;
      if (/^[#|_]/.test(trimmed) || /^\*[^*]/.test(trimmed)) continue;
      lines.add(trimmed);
    }
  }
  return { lines, proper };
}

const isTemplateAt = (repoRoot, file) => relative(repoRoot, file).replace(/\\/g, '/').includes('/templates/');

/** A template's own lines, by their words: harness text the record was built from. */
export function templateLines(repoRoot, files = walk(join(repoRoot, 'modules'))) {
  const out = new Set();
  for (const file of files.filter((f) => isTemplateAt(repoRoot, f))) for (const line of read(file).split('\n')) out.add(words(line));
  return out;
}

/**
 * The 1-based numbers of the lines of `text` that repeat a line of the record at
 * `repoRoot` (data/), templates' lines aside: the copy rule, for text that is not
 * a file (a commit message). Never the lines themselves.
 */
export function copiedLines(repoRoot, text) {
  const dataDir = join(repoRoot, 'data');
  if (!existsSync(dataDir)) return [];
  const candidates = String(text).split('\n').map((line, i) => [words(line), i + 1]).filter(([w]) => w.length >= MIN_COPY);
  if (!candidates.length) return [];
  const { lines } = recordLines(dataDir);
  for (const line of templateLines(repoRoot)) lines.delete(line);
  return candidates.filter(([w]) => lines.has(w)).map(([, n]) => n);
}

// Another session can move or remove a file between the walk and the read. A
// file that is gone cannot leak, and a crash here reads at the stop hook as a
// failed privacy check, so it is skipped rather than thrown over.
// A file holding a NUL byte is not text (an extensionless binary): nothing in it to read.
function read(file) {
  try {
    const text = readFileSync(file, 'utf8');
    return text.includes('\0') ? '' : text;
  } catch {
    return '';
  }
}

/**
 * What leaks from the record at `root` into the files around it: each finding
 * one line, with the counts the report prints. Null when `root` has no data/.
 * Proven against a tree made for it by test-check-privacy.mjs (SFG-007 design 5).
 */
export function checkPrivacy(repoRoot) {
  const dataDir = join(repoRoot, 'data');
  if (!existsSync(dataDir)) return null;

  const harnessFiles = walk(repoRoot);
  const findings = [];

  // ── Names ───────────────────────────────────────────────────────────────────
  //
  // Two sources: the people in data/core/people/, named firstname.md or firstname/ by
  // convention, and HER OWN name from data/PROFILE.yaml.
  //
  // Her name used to be excluded here, because it was the project's own name — in
  // the repository name, the app title, the env vars and this very file. That
  // exclusion was the one hole in this check and it is now closed: the name lives
  // in the record and nowhere else, so the check can hold it to the same standard
  // as everyone else's. If this starts failing, the leak is real.
  // A page named firstname-word.md (two people of one name, or a role) is guarded by
  // the first name too: matched whole, a page `firstname-work.md` never matched the first name alone (T-330).
  const fromPeople = peopleSlugs(join(dataDir, CORE_DATA, 'people')).flatMap((slug) => [slug.toLowerCase(), slug.toLowerCase().split('-')[0]]);

  // Read with the parser every other reader uses (.claude/hooks/lib/profile-schema.mjs), rather than
  // a regex: a hand-rolled "name:" match would read a commented-out line, and this
  // check is only worth having if it cannot be fooled by the file it is checking.
  // A name is taken even from a profile that fails its other rules, and from one
  // still in the old flat shape: a broken file is no reason to stop looking for a
  // leak.
  const configName = (text) => profileName(text).toLowerCase();

  const configPath = join(dataDir, 'PROFILE.yaml');
  const ownName = existsSync(configPath) ? configName(readFileSync(configPath, 'utf8')) : '';

  const names = [...new Set([...fromPeople, ownName])].filter((n) => n && n.length > 2);

  // Whole words by Unicode-aware edges (ux/lib/name-match.mjs), not `\b`: `\b` knows
  // only ASCII letters, so a name ending in é or ë was never caught. The edges cost
  // more than `\b`, so a plain substring search goes first and the pattern runs
  // only where the name's letters already appear.
  const eachName = names.map((name) => [name, wholeNameMatcher(name)]);

  // A few everyday words are names too (a herb, a font, a colour): the
  // reviewed list in ux/lib/everyday-names.json hides those exact
  // contexts, and only those, from the match.
  for (const file of harnessFiles) {
    const raw = read(file);
    const text = raw.toLowerCase();
    const rel = relative(repoRoot, file).replace(/\\/g, '/');
    for (const [name, matcher] of eachName) {
      if (text.includes(name) && matcher.test(withoutEverydayNames(raw, name, rel))) {
        findings.push(`${relative(repoRoot, file)} names "${name}", who is named in the record`);
      }
    }
  }

  // ── Copies ──────────────────────────────────────────────────────────────────
  //
  // Long lines are the signal. Short ones collide by coincidence — every markdown
  // file in the repo contains "## Right now" — and a check that reports
  // coincidences is a check nobody runs twice.
  const { lines: dataLines, proper } = recordLines(dataDir);

  // Templates are exempt from the COPY check, and only from that one.
  //
  // A template is a blank shape copied into data/ when a new file is needed, so
  // its text appearing on both sides is the mechanism working, not a leak — the
  // first run of this check flagged three of them, all correct sightings of the
  // intended direction.
  //
  // They are NOT exempt from the name check above. A template is supposed to be
  // empty of content but it is still a file someone edits, and a name written into
  // one would be copied into every future record file made from it. That is the
  // leak worth catching here, and the copy exemption does not cover it.
  const isTemplate = (file) => isTemplateAt(repoRoot, file);

  // And a template's own lines are harness text, wherever else they turn up: the
  // record was built from them, and the invented record repeats them by design.
  for (const line of templateLines(repoRoot, harnessFiles)) dataLines.delete(line);

  for (const file of harnessFiles) {
    if (isTemplate(file)) continue;
    // Named by path and line only: a finding that printed the line would carry the
    // leak into every log and reply that shows it (A-155).
    read(file).split('\n').forEach((line, i) => {
      if (dataLines.has(words(line))) findings.push(`${relative(repoRoot, file)}:${i + 1} repeats a line verbatim from data/`);
    });
  }

  // ── FEEDBACK.md: a stricter tier ────────────────────────────────────────────
  //
  // CON-017. FEEDBACK.md is the one harness file written from her conversations,
  // and it is meant to be forwarded, so it is where a leak is likeliest. On top of
  // names and copies, its entries must be gists: two lines, Rule: and Why:, with no
  // quoted passage, no date, weekday, month or year, no number with a unit, and no
  // capitalised word the record uses as a name or place. A false alarm costs a
  // rewrite in more general words, which is the safe way round.
  const feedbackPath = join(repoRoot, 'FEEDBACK.md');
  if (existsSync(feedbackPath)) {
    const parts = read(feedbackPath).split(/^## Entries\s*$/m);
    if (parts.length !== 2) findings.push('FEEDBACK.md has no single "## Entries" heading, so its entries cannot be checked (CON-017)');
    const lines = (parts[1] ?? '').split('\n').filter((l) => l.trim());
    const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';
    const rules = [
      [/["“”‘’`][^"“”‘’`]*(\s\S+){3,}[^"“”‘’`]*["“”‘’`]|(^|\s)'[^']*(\s\S+){3,}[^']*'|^\s*>/, 'quotes a passage'],
      [new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}/\\d{1,2}\\b|\\b\\d{1,2}(st|nd|rd|th)?( of)?\\s+${MONTH}\\b|\\b${MONTH}\\s+\\d|\\b(in|on|since|last|next) ${MONTH}\\b|\\b(19|20)\\d{2}\\b`, 'i'), 'carries a date, month or year'],
      [/\b(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(day)?\b/i, 'names a weekday'],
      [/\$\s?\d|\d\s?(kg|g|mg|mcg|ml|l|km|m|cm|lb|%|am|pm|hours?|hrs?|mins?|minutes?|days?|nights?|weeks?|months?|years?)\b|\b\d{1,2}:\d{2}\b/i, 'carries a number with a unit or a time'],
    ];
    let expect = 'Rule';
    lines.forEach((line, i) => {
      const n = `FEEDBACK.md entry line ${i + 1}`;
      const kind = /^- Rule: \S/.test(line) ? 'Rule' : /^ {2}Why: \S/.test(line) ? 'Why' : null;
      if (kind !== expect) findings.push(`${n} should be ${expect === 'Rule' ? '"- Rule: …"' : '"  Why: …"'}: entries are two lines, a rule then its reason (CON-017)`);
      expect = (kind ?? expect) === 'Rule' ? 'Why' : 'Rule';
      for (const [re, what] of rules) if (re.test(line)) findings.push(`${n} ${what} (CON-017)`);
      // A sentence's first word is capitalised anyway, so like the record's own, it is
      // not read as a name: a rule should open with a verb, never a name.
      for (const [word] of line.replace(/^(- Rule:| {2}Why:) /, '').matchAll(PROPER)) {
        if (proper.has(word)) findings.push(`${n} uses "${word}", a name or place the record uses (CON-017)`);
      }
    });
    if (expect === 'Why') findings.push('FEEDBACK.md: its last rule has no "  Why:" line (CON-017)');
  }

  return { findings: [...new Set(findings)], files: harnessFiles.length, names: names.length, lines: dataLines.size };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1])) {
  // It scans the repository, never a file named on the command line: a page named
  // here once read as checked when it was not (4 Nov, twice). Say so and stop.
  if (process.argv.length > 2) {
    console.error(`privacy check: it scans the whole repository and takes no file; ${process.argv.slice(2).join(' ')} was not checked. Put the file inside the repository and run it with no arguments.`);
    process.exit(2);
  }
  const result = checkPrivacy(join(dirname(dirname(fileURLToPath(import.meta.url))), '..'));
  if (!result) {
    console.log('privacy check: no data/ directory — nothing to leak.');
    process.exit(0);
  }
  const { findings, files, names, lines } = result;
  if (findings.length > 0) {
    console.error('\n  PRIVACY CHECK FAILED\n');
    for (const f of findings) console.error(`  - ${f}`);
    console.error('\n  Everything personal lives in data/ and nowhere else. See ARC-004 in');
    console.error('  dev/specs/system/ARCHITECTURE.md.\n');
    process.exit(1);
  }

  console.log(
    `privacy check: ${files} harness files clean ` +
      `(${names} name${names === 1 ? '' : 's'} on file, ${lines} record lines compared)`,
  );
}
