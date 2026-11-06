// Every path a record could be hiding in, and a check that none was dropped.
//
//   node inventory.mjs <source-dir> [--exclude <dir>]...                      manifest Inventory rows
//   node inventory.mjs <source-dir> [--exclude <dir>]... --check <manifest>   exit 1 on anything unmapped
//   node inventory.mjs <source-dir> --secrets                                    credentials in history, no line printed
//
// Paths only, never content: the output lands in a terminal and a transcript.
// --exclude takes a folder relative to the source, and repeats. Sweeping this
// repository, the record itself and the scratch folder are the destination and
// the disposable, not the source — without it the check would demand a row for
// the manifest it is checking.
//
// The check also demands the rows the script cannot generate, so a manifest
// missing them fails instead of passing on what the script happened to see:
// `agent-memory` always, and `git:messages`, `git:edits`, `git:stash` when the
// source is a git repository. A row is still owed when nothing was found there —
// class it `harness`, and say so.
//
// Origins: `tracked`, `untracked`, `ignored` (git working tree), `file` (no git),
// and `history @<commit>` for a path that exists only in git history — deleted,
// or on another branch. Read it with `git show <commit>:<path>`. A file the tree
// holds that an unmerged branch changed gets a second row, `branch:<name>:<path>`,
// origin `branch @<commit>`, read the same way.
//
// Dependency and build folders are skipped and counted on stderr. They hold
// copies of something else, not the record; a build folder can hold rendered
// copies of it, which is why the count is printed rather than hidden.

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const SKIP = new Set(['.git', 'node_modules', '.next', '.venv', 'venv', '__pycache__']);
const ARCHIVE = /\.(zip|tar|tgz|tbz2?|txz|tar\.gz|tar\.bz2|tar\.xz|tar\.zst|gz|bz2|xz|zst|7z|rar)$/i;
const PERSONAL = new Set(['personal', 'mixed', 'unsure']);
// `secret` is a credential: never copied, never personal (PRV-003).
const CLASSES = new Set([...PERSONAL, 'harness', 'secret']);

const usage = () => {
  console.error('usage: node inventory.mjs <source-dir> [--exclude <dir>]... [--check <manifest.md>]');
  process.exit(2);
};
const [sourceArg, ...rest] = process.argv.slice(2);
const excludes = [];
let manifestArg = null;
let secretsMode = false;
for (let i = 0; i < rest.length; i += 2) {
  if (rest[i] === '--secrets') {
    secretsMode = true;
    i -= 1;
    continue;
  }
  const [opt, val] = [rest[i], rest[i + 1]];
  if (!val) usage();
  if (opt === '--exclude') excludes.push(val.replace(/\\/g, '/').replace(/\/+$/, '') + '/');
  else if (opt === '--check') manifestArg = val;
  else usage();
}
if (!sourceArg) usage();
const source = resolve(sourceArg);
const excluded = (p) => excludes.some((e) => (p + '/').startsWith(e));
if (!existsSync(source) || !statSync(source).isDirectory()) {
  console.error(`not a directory: ${source}`);
  process.exit(2);
}

const posix = (p) => p.split(sep).join('/');

function git(...args) {
  try {
    // quotePath off, or a non-ASCII path comes back escaped, matches nothing, and is dropped.
    return execFileSync('git', ['-C', source, '-c', 'core.quotePath=false', ...args], {
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

// A source copied inside another repository (a scratch folder, say) is not a
// repository of its own: git would answer for the outer one, calling every row
// `ignored` and offering the outer history as the source's.
const top = git('rev-parse', '--show-toplevel')?.trim();
const same = (a, b) => (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
const ownRepo = !!top && same(resolve(top), source);

// --secrets: import.md step 2's look before a bundle, over every commit on every
// ref. A word grep printed its lines, and an older copy of this harness names
// tokens all through its own text (a stand-in: 187 lines, 3 of them the record's),
// so it decided nothing and showed her words. This prints no line: each line in a
// credential's shape by commit and path, and the word matches counted by path, for
// a person to judge by name. Exit 1 when a shape is found: then no bundle.
// Only the source's own history: inside another repository it read the outer
// one's and printed its paths, and a plain folder made git throw (2026-10-29).
// Either way exit 2: no history of its own here, so nothing to bundle from it.
if (secretsMode) {
  if (!ownRepo) {
    console.error(top
      ? 'not a repository of its own: no history of its own to look in (a .bundle beside it: run this on a clone of that)'
      : 'not a git repository: no history to look in, and nothing to bundle');
    process.exit(2);
  }
  const { TOKEN } = await import('../../../hooks/lib/update/secrets.mjs');
  const WORDS = /api[_-]?key|secret|token|password|PRIVATE KEY/i;
  const SHAPE = new RegExp(`${TOKEN.source}|-----BEGIN [A-Z ]*PRIVATE KEY-----`);
  // Each commit's message too, binary files read as text, and a merge's own
  // changes (--cc): a key in any of the three once went unseen (round 2,
  // 2026-10-29, C24). A NUL opens each commit, which no message can hold, so a
  // message line reading "commit …" is never taken for the next commit.
  // Read as it streams, line by line: held whole, a long history (this
  // repository's own runs to 700 MB) passed the longest string Node can hold, and
  // the crash exited 1, which reads as a credential found (round 3, C23).
  const child = spawn('git', ['-C', source, '-c', 'core.quotePath=false', 'log', '--all', '-p', '--text', '--cc', '--format=%x00commit %h%n%B%x00end'], { stdio: ['ignore', 'pipe', 'ignore'] });
  const closed = new Promise((done) => {
    child.on('error', () => done(-1));
    child.on('close', (code) => done(code));
  });
  const shapes = new Set();
  const words = new Map();
  const MESSAGE = '(message)';
  let commit = '';
  let file = '';
  let inMessage = false;
  let combined = false;
  const take = (line) => {
    if (line.startsWith('\0commit ')) {
      commit = line.slice(8);
      inMessage = true;
    } else if (inMessage) {
      const end = line.indexOf('\0end');
      const text = end < 0 ? line : line.slice(0, end);
      if (end >= 0) inMessage = false;
      if (SHAPE.test(text)) shapes.add(`${commit} ${MESSAGE}`);
      if (WORDS.test(text)) words.set(MESSAGE, (words.get(MESSAGE) ?? 0) + 1);
    } else if (line.startsWith('diff --')) {
      combined = line.startsWith('diff --cc ');
    } else if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      const named = line.slice(4).replace(/^[ab]\//, '');
      if (named !== '/dev/null') file = named;
    } else if (combined ? /^[ +-]{2}/.test(line) && /^.?[+-]/.test(line) : /^[+-]/.test(line)) {
      if (SHAPE.test(line)) shapes.add(`${commit} ${file}`);
      if (WORDS.test(line)) words.set(file, (words.get(file) ?? 0) + 1);
    }
  };
  let read = true;
  try {
    child.stdout.setEncoding('utf8');
    let rest = '';
    for await (const chunk of child.stdout) {
      const parts = (rest + chunk).split('\n');
      rest = parts.pop();
      for (const line of parts) take(line);
    }
    if (rest) take(rest);
  } catch {
    read = false;
  }
  if (!read || (await closed) !== 0) {
    // Exit 2, never 1: nothing was found, and nothing is known either.
    console.error('could not read the whole history here, so nothing was decided: no bundle until it can be read (`git fsck` names what is broken)');
    process.exit(2);
  }
  console.log(`in a credential's shape: ${shapes.size} place(s)${shapes.size ? "; no bundle, and each is its owner's to revoke" : ''}`);
  for (const at of shapes) console.log(`  ${at}`);
  console.log(`naming a credential word, by path (lines not shown): ${words.size} path(s)`);
  for (const [f, n] of [...words].sort()) console.log(`  ${f}: ${n}`);
  process.exit(shapes.size ? 1 : 0);
}
// NUL-separated (-z): a filename can hold a newline, and a newline-split list
// breaks it in two and matches neither half.
const paths = (out) => (out ?? '').split('\0').map((l) => l.replace(/^\n+/, '')).filter(Boolean);

// A path as it is written in a manifest cell. A newline or a pipe in a filename
// would otherwise break the table row, and the path would never match.
const cell = (p) => p.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\|/g, '\\|');

function walk(dir, skipped, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '.git' || excluded(posix(relative(source, full)))) continue;
      if (SKIP.has(entry.name)) skipped.set(posix(relative(source, full)), true);
      else walk(full, skipped, out);
    } else if (entry.isFile() && !excluded(posix(relative(source, full)))) {
      out.push(posix(relative(source, full)));
    }
  }
  return out;
}

function inventory() {
  const skipped = new Map();
  const tree = walk(source, skipped);
  const isRepo = ownRepo;
  const rows = new Map();
  if (top && !isRepo) console.error(`not a repository of its own (inside ${top}): origins are \`file\`, and no history is read`);
  for (const p of tree) {
    if (p.endsWith('.bundle')) console.error(`history in a bundle: ${p} — clone it to scratch and run this on the clone for the history rows`);
    // An archive is one row, and nothing inside it is read (2026-10-29).
    else if (ARCHIVE.test(p)) console.error(`an archive: ${p} — unpack it into scratch and inventory that as its own source; the archive itself is copied as a file`);
  }

  if (!isRepo) {
    for (const p of tree) rows.set(p, 'file');
  } else {
    const ignored = new Set(paths(git('ls-files', '-z', '--others', '--ignored', '--exclude-standard')));
    const untracked = new Set(paths(git('ls-files', '-z', '--others', '--exclude-standard')));
    for (const p of tree) rows.set(p, ignored.has(p) ? 'ignored' : untracked.has(p) ? 'untracked' : 'tracked');

    // Every path ever committed on any ref, minus what is on disk now.
    const ever = new Set(paths(git('log', '-z', '--all', '--format=', '--name-only')));
    for (const p of ever) {
      if (rows.has(p) || excluded(p) || p.split('/').some((part) => SKIP.has(part))) continue;
      const last = git('rev-list', '--all', '-1', '--', p)?.trim();
      if (!last) continue;
      // The last commit touching a deleted path is the deletion; its parent holds the file.
      const at = git('cat-file', '-e', `${last}:${p}`) === null ? `${last}^` : last;
      rows.set(p, `history @${at.slice(0, 12)}${at.endsWith('^') ? '^' : ''}`);
    }

    // A branch HEAD lacks can change a file the tree also holds (a stranded phone save
    // to the timeline): that version is neither on disk nor history-only, so it gets a
    // row of its own, `branch:<name>:<path>` (rehearsal 2026-10-27).
    const seen = new Set();
    for (const ref of (git('for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes') ?? '').split('\n').filter(Boolean)) {
      const tip = git('rev-parse', ref)?.trim();
      if (!tip || ref.endsWith('/HEAD') || git('merge-base', '--is-ancestor', tip, 'HEAD') !== null) continue;
      const base = git('merge-base', 'HEAD', tip)?.trim();
      for (const p of base ? paths(git('diff', '-z', '--name-only', '--diff-filter=AM', base, tip)) : []) {
        if (!rows.has(p) || rows.get(p).startsWith('history') || excluded(p) || seen.has(`${tip}:${p}`)) continue;
        seen.add(`${tip}:${p}`);
        rows.set(`branch:${ref.replace(/^refs\/(heads|remotes)\//, '')}:${p}`, `branch @${tip.slice(0, 12)}`);
      }
    }
  }

  for (const dir of skipped.keys()) console.error(`skipped: ${dir}/`);
  return { isRepo, rows: [...rows].sort(([a], [b]) => a.localeCompare(b)) };
}

// Rows of the markdown table under `## <heading>`, as arrays of trimmed cells.
function table(md, heading) {
  const start = md.search(new RegExp(`^## ${heading}\\s*$`, 'm'));
  if (start < 0) return null;
  const rest = md.slice(start).split('\n').slice(1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end < 0 ? rest : rest.slice(0, end))
    .filter((l) => l.trim().startsWith('|') && !/^\|[\s|:-]+\|?\s*$/.test(l.trim()))
    .slice(1) // header row
    .map((l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/^`|`$/g, '')))
    .filter((cells) => cells[0]);
}

const { isRepo, rows } = inventory();

if (!manifestArg) {
  for (const [path, origin] of rows) console.log(`| \`${cell(path)}\` | ${origin} | |`);
  console.error(`${rows.length} paths`);
  process.exit(0);
}

const md = readFileSync(resolve(manifestArg), 'utf8');
const inv = table(md, 'Inventory');
const map = table(md, 'Map');
if (!inv || !map) {
  console.error('manifest has no "## Inventory" or "## Map" table — copy it from modules/core/templates/import-data/manifest.md');
  process.exit(2);
}

const problems = [];
const classOf = new Map(inv.map(([path, , cls]) => [path, (cls ?? '').toLowerCase()]));
for (const [path] of rows) if (!classOf.has(cell(path))) problems.push(`not in Inventory: ${cell(path)}`);
for (const [path, cls] of classOf) if (!CLASSES.has(cls)) problems.push(`no class (${[...CLASSES].join('|')}): ${path}`);
const handRows = ['agent-memory', ...(isRepo ? ['git:messages', 'git:edits', 'git:stash'] : [])];
for (const r of handRows) if (!classOf.has(r)) problems.push(`hand row missing from Inventory: ${r}`);

const mapped = new Set(map.filter(([, dest, reason]) => dest || reason).map(([path]) => path));
for (const [path, cls] of classOf) {
  if (PERSONAL.has(cls) && !mapped.has(path)) problems.push(`${cls}, but no destination or reason in Map: ${path}`);
}

for (const p of problems) console.log(p);
console.log(problems.length ? `${problems.length} problem(s)` : `ok — ${rows.length} paths, every one accounted for`);
process.exit(problems.length ? 1 : 0);
