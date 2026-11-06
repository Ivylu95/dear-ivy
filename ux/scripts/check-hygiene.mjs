// The repository's growth, measured the same way every run (dev/specs/system/hygiene.md).
//
// HYG-001, "The repository's growth is measured, never judged by eye."
// HYG-002, "Every file stays small enough for an agent to read whole in one pass."
// HYG-003, "Repetition is found by a machine."
//
//   node ux/scripts/check-hygiene.mjs           print the summary
//   node ux/scripts/check-hygiene.mjs --json    the same, as JSON
//   node ux/scripts/check-hygiene.mjs --log     also append to the growth log
//   (--log=<path> writes the log somewhere else, for a trial run)
//
// Every finding is a warning that starts a proposal, never a block (the spec's
// purpose provision 3, and HYG-005): the exit code is 0 whatever it finds, and
// it is not part of `npm run check`.
//
// PRIVACY. data/ and data-sandbox/ are measured as aggregates only: a file name
// there can name a person, so no path under them is printed, logged or kept in
// the JSON. Over-size files there are a count per second-level folder
// (`data/core`), and repetition inside them is out of scope here entirely — it is
// reported inside data/ (HYG-005).
//
// THE LOG. HYG-001 places it in "the harness's persistent state (ARC-014)", but
// ARC-014's folder, .claude/hooks/state/, is untracked and must be safe to
// delete, while HYG-001 is judged by reading back any month's line. On a
// disposable machine only git keeps a line that long, so the log sits tracked
// beside the other run state the heartbeats commit, .claude/jobs/.
// One dated JSON line per top-level folder per run; it names folders only.
// One more line counts leftover working state (worktrees, stashes, local
// branches beside main): DEP-011 clears what is finished, this counts what
// survives. Counts only, never names: a stash message can say anything.

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { appendPart } from './append-part.mjs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HYGIENE_LOG_FILE, SPECS_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { threshold } from '../../.claude/hooks/lib/thresholds.mjs';

// ── Lines (HYG-002). Each is half of the limit it derives from, read 2026-10-02.
// Claude Code's Read tool returns at most 2,000 lines in one call.
const MAX_LINES = 1000;
// The same tool refuses a single read past 25,000 tokens; estimated as chars / 4.
const MAX_TOKENS = 12_500;
const CHARS_PER_TOKEN = 4;
// GitHub warns on any pushed file over 50 MB (and refuses one over 100 MB).
const MAX_BYTES = 50 * 1024 * 1024;

// ── Repetition thresholds (HYG-003 states them; FND-009).
const MIN_PARA_WORDS = threshold('hygiene.minParagraphWords', 'words'); // shorter is a shared phrase, not a copy
const SHINGLE = 8; // words per overlapping run
const JACCARD = threshold('hygiene.similarity', 'ratio'); // paragraphs this similar are near-duplicates
const MIN_CODE_LINES = threshold('hygiene.minCodeLines', 'lines'); // normalised non-blank lines in a repeated window
// A check never runs against a guessed line: unreadable, it says so and fails.
if (!MIN_PARA_WORDS || !JACCARD || !MIN_CODE_LINES) {
  console.error('HYGIENE CHECK FAILED: its thresholds cannot be read from .claude/thresholds.json (FND-009). Run: node ux/scripts/thresholds.mjs');
  process.exit(1);
}

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const PRIVATE = new Set(['data', 'data-sandbox']);
const ALLOW_FILE = process.env.HYGIENE_ALLOW_FILE ? resolve(process.env.HYGIENE_ALLOW_FILE) : join(repoRoot, 'ux', 'scripts', 'check-hygiene.allow.txt');
const LOG_FILE = join(repoRoot, HYGIENE_LOG_FILE);

const args = process.argv.slice(2);
const asJson = args.includes('--json');
const logArg = args.find((a) => a === '--log' || a.startsWith('--log='));
const logPath = logArg ? (logArg.includes('=') ? resolve(logArg.slice(6)) : LOG_FILE) : null;

const started = Date.now();
const topOf = (p) => (p.includes('/') ? p.slice(0, p.indexOf('/')) : '(root)');
const isPrivate = (p) => PRIVATE.has(topOf(p));

const files = execFileSync('git', ['ls-files', '-z'], { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\0')
  .filter(Boolean)
  .filter((p) => existsSync(join(repoRoot, p)));

// The allow list (check-hygiene.allow.txt). `text:` and `path:` are HYG-003's;
// `whole:` names one tracked file that only code reads, written by a tool or
// imported byte for byte from its source, which HYG-002 leaves out: no agent
// answers from it as if it had read it all, and splitting it would break its
// tool or its provenance. Exact files only, never a folder, and still listed
// in the report as kept whole, so nothing over the line goes unseen. A lockfile
// is built in, as it is for the repetition pass.
const allow = { text: [], path: [], whole: [] };
if (existsSync(ALLOW_FILE)) {
  for (const raw of readFileSync(ALLOW_FILE, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(text|path|whole):\s*(.+)$/.exec(line);
    if (m) allow[m[1]].push(m[1] === 'text' ? norm(m[2]) : m[2].trim());
  }
}
const LOCKFILE = /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/;
const keptWhole = (p) => LOCKFILE.test(p) || allow.whole.includes(p);
const wholeFaults = allow.whole.filter((p) => !files.includes(p)).map((p) => `whole: ${p} is not a tracked file`);
const leftWhole = []; // { path, lines, tokens } over the line, but kept whole

// ── HYG-001 and HYG-002: one pass over every tracked file.
const folders = new Map(); // top → { bytes, files, largest, largestPath }
const oversize = []; // { path, lines, tokens, bytes, why[] } outside data
const oversizePrivate = new Map(); // 'data/core' → count
const texts = new Map(); // path → text, for the repetition pass

const isText = (buf) => !buf.subarray(0, 8192).includes(0);

for (const path of files) {
  const abs = join(repoRoot, path);
  let size;
  try {
    size = statSync(abs).size;
  } catch {
    continue;
  }
  const top = topOf(path);
  const f = folders.get(top) ?? { bytes: 0, files: 0, largest: 0, largestPath: null };
  f.bytes += size;
  f.files += 1;
  if (size > f.largest) Object.assign(f, { largest: size, largestPath: isPrivate(path) ? null : path });
  folders.set(top, f);

  const why = [];
  if (size > MAX_BYTES) why.push('bytes');
  let lines = 0;
  let tokens = 0;
  if (size <= MAX_BYTES * 2) {
    const buf = readFileSync(abs);
    if (isText(buf)) {
      const text = buf.toString('utf8');
      lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
      tokens = Math.round(text.length / CHARS_PER_TOKEN);
      if (lines > MAX_LINES) why.push('lines');
      if (tokens > MAX_TOKENS) why.push('tokens');
      if (!isPrivate(path)) texts.set(path, text);
    }
  }
  if (!why.length) continue;
  if (isPrivate(path)) {
    const parts = path.split('/');
    const key = parts.length > 2 ? `${parts[0]}/${parts[1]}` : `${parts[0]}/`;
    oversizePrivate.set(key, (oversizePrivate.get(key) ?? 0) + 1);
  } else if (keptWhole(path) && !why.includes('bytes')) {
    leftWhole.push({ path, lines, tokens });
  } else {
    oversize.push({ path, lines, tokens, bytes: size, why });
  }
}

// ── HYG-003: repetition, outside the record only.

function norm(s) {
  return s
    .toLowerCase()
    .replace(/[*_`>#|[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const excluded = (p) =>
  isPrivate(p) ||
  /(^|\/)(node_modules|archive|temp)\//.test(p) ||
  /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml)$/.test(p) ||
  /\.generated\.|\.min\./.test(p) ||
  allow.path.some((a) => p === a || p.startsWith(a.endsWith('/') ? a : `${a}/`));

// Markdown: paragraphs split on blank lines, a table split into its rows (one
// spec row is one unit of meaning), fenced code skipped.
function paragraphs(text) {
  const out = [];
  let block = [];
  let start = 0;
  let fenced = false;
  const flush = () => {
    if (!block.length) return;
    if (block.every((l) => l.trim().startsWith('|'))) {
      block.forEach((l, k) => out.push({ text: l, line: start + k }));
    } else out.push({ text: block.join(' '), line: start });
    block = [];
  };
  text.split('\n').forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) {
      flush();
      fenced = !fenced;
      return;
    }
    if (fenced) return;
    if (!l.trim()) return flush();
    if (!block.length) start = i + 1;
    block.push(l);
  });
  flush();
  return out;
}

const isBanner = (path, t) => path.startsWith(`${SPECS_DIR}/`) && t.startsWith('🔒');

const paras = []; // { path, line, set }
for (const [path, text] of texts) {
  if (!path.endsWith('.md') || excluded(path)) continue;
  for (const p of paragraphs(text)) {
    const t = norm(p.text);
    const words = t.split(' ').filter((w) => /\w/.test(w));
    if (words.length < MIN_PARA_WORDS) continue;
    const lead = t.replace(/^\d+\s+/, ''); // a numbered table row matches by its text
    if (isBanner(path, t) || allow.text.some((a) => lead.startsWith(a))) continue;
    const set = new Set();
    for (let i = 0; i + SHINGLE <= words.length; i++) set.add(words.slice(i, i + SHINGLE).join(' '));
    paras.push({ path, line: p.line, set });
  }
}

const proseDupes = [];
{
  const postings = new Map();
  paras.forEach((p, id) => {
    for (const s of p.set) {
      const list = postings.get(s);
      if (list) list.push(id);
      else postings.set(s, [id]);
    }
  });
  const shared = new Map(); // "a,b" → count
  for (const list of postings.values()) {
    if (list.length < 2 || list.length > 200) continue;
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        if (list[i] === list[j]) continue;
        const k = `${list[i]},${list[j]}`;
        shared.set(k, (shared.get(k) ?? 0) + 1);
      }
  }
  for (const [k, n] of shared) {
    const [a, b] = k.split(',').map(Number);
    const A = paras[a];
    const B = paras[b];
    const jac = n / (A.set.size + B.set.size - n);
    if (jac >= JACCARD) proseDupes.push({ a: `${A.path}:${A.line}`, b: `${B.path}:${B.line}`, similarity: Number(jac.toFixed(2)) });
  }
}

// Code: windows of MIN_CODE_LINES normalised non-blank lines, hashed; a window
// in two places is a clone, and consecutive matching windows merge into one.
const codeDupes = [];
{
  const units = []; // per file: { path, lines: [{ n, text }] }
  for (const [path, text] of texts) {
    if (!/\.(mjs|js)$/.test(path) || excluded(path)) continue;
    const lines = [];
    text.split('\n').forEach((l, i) => {
      const t = l.trim().replace(/\s+/g, ' ');
      if (t) lines.push({ n: i + 1, text: t });
    });
    units.push({ path, lines });
  }
  const seen = new Map(); // window → [[file, idx]]
  units.forEach((u, f) => {
    for (let i = 0; i + MIN_CODE_LINES <= u.lines.length; i++) {
      const key = u.lines.slice(i, i + MIN_CODE_LINES).map((l) => l.text).join('\n');
      const list = seen.get(key);
      if (list) list.push([f, i]);
      else seen.set(key, [[f, i]]);
    }
  });
  const hits = new Map(); // "fa,fb,offset" → sorted starts in fa
  for (const list of seen.values()) {
    if (list.length < 2) continue;
    for (let x = 0; x < list.length; x++)
      for (let y = x + 1; y < list.length; y++) {
        const [fa, ia] = list[x];
        const [fb, ib] = list[y];
        if (fa === fb && Math.abs(ia - ib) < MIN_CODE_LINES) continue; // overlaps itself
        const k = `${fa},${fb},${ib - ia}`;
        (hits.get(k) ?? hits.set(k, []).get(k)).push(ia);
      }
  }
  for (const [k, starts] of hits) {
    const [fa, fb, off] = k.split(',').map(Number);
    starts.sort((m, n) => m - n);
    let runStart = starts[0];
    let prev = starts[0];
    const emit = (s, e) => {
      const A = units[fa];
      const B = units[fb];
      codeDupes.push({
        a: `${A.path}:${A.lines[s].n}`,
        b: `${B.path}:${B.lines[s + off].n}`,
        lines: e - s + MIN_CODE_LINES,
      });
    };
    for (const s of starts.slice(1)) {
      if (s === prev + 1) {
        prev = s;
        continue;
      }
      emit(runStart, prev);
      runStart = prev = s;
    }
    emit(runStart, prev);
  }
  codeDupes.sort((m, n) => n.lines - m.lines);
}
proseDupes.sort((m, n) => n.similarity - m.similarity);

// Repetition score per folder: duplicate pairs touching it (a pair across two
// folders counts in each). The record's folders have none here (null): their
// repetition is measured inside data/.
const score = new Map();
for (const d of [...proseDupes, ...codeDupes]) {
  for (const top of new Set([topOf(d.a), topOf(d.b)])) score.set(top, (score.get(top) ?? 0) + 1);
}

// ── Output.
const date = new Date().toISOString().slice(0, 10);
const folderRows = [...folders.entries()]
  .sort((a, b) => b[1].bytes - a[1].bytes)
  .map(([folder, f]) => ({
    date,
    folder,
    bytes: f.bytes,
    files: f.files,
    largest: f.largest,
    repetition: PRIVATE.has(folder) ? null : (score.get(folder) ?? 0),
  }));

// HYG-001: leftover working state, read-only git, by count. A git read that
// fails still writes the line, marked, so the series shows the gap.
const gitLines = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).split('\n').filter(Boolean);
let leftover;
try {
  leftover = {
    date,
    folder: 'leftover:git',
    worktrees: gitLines(['worktree', 'list', '--porcelain']).filter((l) => l.startsWith('worktree ')).length - 1,
    stashes: gitLines(['stash', 'list']).length,
    branches: gitLines(['for-each-ref', '--format=%(refname:short)', 'refs/heads']).filter((b) => b !== 'main').length,
  };
} catch {
  leftover = { date, folder: 'leftover:git', error: true };
}

// FND-009: threshold debt. A constant named as a limit whose value is a literal
// number was read from no row. Each one is debt unless the allow list names it,
// with a reason. Harness code only; the record holds no code. Top-level
// `const` only: an indented or `let` number is a local, not a setting.
const LIMIT_NAME = /(^|_)(SECONDS|MINUTES|HOURS|DAYS|WEEKS|MONTHS|MS|TTL|AGE|MB|KB|BYTES|LINES|WORDS|CHARS|TOKENS|LIMIT|MAX|MIN|MAXIMUM|MINIMUM|CEILING|THRESHOLD|TIMEOUT)(_|$)/;
// A literal number, or an environment override whose fallback is one.
const CONST = /^(?:export )?const ([A-Z][A-Z0-9_]*) = (?:[0-9]|Number\([^)]*\) \|\| [0-9])/;
const DEBT_ROOTS = ['.claude/hooks/', '.claude/skills/', 'ux/scripts/', 'ux/lib/', 'ux/config/', 'ux/app/', 'ux/theme/', 'dev/ui/'];
const allowFile = join(repoRoot, 'ux', 'scripts', 'threshold-debt.allow.txt');
const ALLOW_LINE = /^(\S+)\s+(\S+)\s+·\s+(.+)$/;
const allowed = new Map(); // "path NAME" → still matched this run
const allowFaults = [];
for (const l of (existsSync(allowFile) ? readFileSync(allowFile, 'utf8') : '').split(/\r?\n/)) {
  if (!l.trim() || l.startsWith('#')) continue;
  const m = l.trim().match(ALLOW_LINE);
  if (m) allowed.set(`${m[1]} ${m[2]}`, false);
  else allowFaults.push(`no reason given: ${l.trim()}`);
}
const debt = [];
const exempt = [];
for (const p of files) {
  if (!DEBT_ROOTS.some((r) => p.startsWith(r)) || !/\.(mjs|js)$/.test(p) || /(^|\/)test-/.test(p)) continue;
  (texts.get(p) ?? readFileSync(join(repoRoot, p), 'utf8')).split(/\r?\n/).forEach((line, i) => {
    const name = line.match(CONST)?.[1];
    if (!name || !LIMIT_NAME.test(name)) return;
    const key = `${p} ${name}`;
    if (allowed.has(key)) allowed.set(key, true);
    (allowed.has(key) ? exempt : debt).push(`${p}:${i + 1} ${name}`);
  });
}
for (const [key, seen] of allowed) if (!seen) allowFaults.push(`listed but no longer found: ${key}`);
const thresholdDebt = { date, folder: 'debt:thresholds', owed: debt.length, exempt: exempt.length };

const report = {
  date,
  limits: { lines: MAX_LINES, tokens: MAX_TOKENS, bytes: MAX_BYTES, minParaWords: MIN_PARA_WORDS, jaccard: JACCARD, minCodeLines: MIN_CODE_LINES },
  folders: folderRows.map((r) => ({ ...r, largestPath: folders.get(r.folder).largestPath })),
  oversize,
  leftWhole,
  wholeFaults,
  oversizeRecord: Object.fromEntries([...oversizePrivate].sort()),
  repetition: { prose: proseDupes, code: codeDupes },
  leftover,
  thresholdDebt: { ...thresholdDebt, owedAt: debt },
  ms: Date.now() - started,
};

// The log cuts itself before the one-read line: hygiene-log-2.jsonl and on (append-part.mjs, T-768).
if (logPath) appendPart(logPath, [...folderRows, leftover, thresholdDebt].map((r) => JSON.stringify(r)));

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);
  console.log(`hygiene (${date}) — warnings only, never a block\n`);
  console.log('  HYG-001 growth, per top-level folder');
  for (const r of report.folders) {
    const largest = r.largestPath ? ` (${r.largestPath})` : '';
    const rep = r.repetition === null ? 'n/a here' : r.repetition;
    console.log(`    ${r.folder.padEnd(16)} ${kb(r.bytes).padStart(9)}  ${String(r.files).padStart(4)} files  largest ${kb(r.largest)}${largest}  repetition ${rep}`);
  }
  if (leftover.error) console.log(`    ${'leftover'.padEnd(16)} could not be counted (git failed)`);
  else console.log(`    ${'leftover'.padEnd(16)} ${leftover.worktrees} worktree(s) beside this one, ${leftover.stashes} stash(es), ${leftover.branches} branch(es) beside main`);
  console.log(`\n  FND-009 threshold debt: ${debt.length} constant(s) read from no row, ${exempt.length} exempt (threshold-debt.allow.txt)`);
  for (const d of debt) console.log(`    ${d}`);
  for (const f of allowFaults) console.log(`    allow list: ${f}`);
  console.log(`\n  HYG-002 one-pass size (over ${MAX_LINES} lines, ~${MAX_TOKENS} tokens, or ${kb(MAX_BYTES)})`);
  if (!oversize.length && !oversizePrivate.size) console.log('    none');
  for (const o of oversize.sort((a, b) => b.tokens - a.tokens)) {
    console.log(`    ${o.path} — ${o.lines} lines, ~${o.tokens} tokens${o.why.includes('bytes') ? `, ${kb(o.bytes)}` : ''}`);
  }
  for (const [k, n] of oversizePrivate) console.log(`    ${k}: ${n} file${n === 1 ? '' : 's'} over`);
  if (leftWhole.length) console.log(`    kept whole, read only by code (lockfiles, and whole: in check-hygiene.allow.txt): ${leftWhole.map((o) => o.path).join(', ')}`);
  for (const f of wholeFaults) console.log(`    allow list: ${f}`);
  const TOP = 10;
  console.log(`\n  HYG-003 repetition outside the record (${proseDupes.length} prose pairs, ${codeDupes.length} code blocks)`);
  for (const d of proseDupes.slice(0, TOP)) console.log(`    prose ${d.similarity}  ${d.a}  ≈  ${d.b}`);
  if (proseDupes.length > TOP) console.log(`    … ${proseDupes.length - TOP} more prose pairs (--json lists all)`);
  for (const d of codeDupes.slice(0, TOP)) console.log(`    code ${d.lines} lines  ${d.a}  =  ${d.b}`);
  if (codeDupes.length > TOP) console.log(`    … ${codeDupes.length - TOP} more code blocks (--json lists all)`);
  console.log(`\n  ${report.ms} ms${logPath ? ` · ${folderRows.length + 2} lines appended to the growth log` : ''}`);
}
process.exit(0);
