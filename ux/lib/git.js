import { execFile as execFileCb } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { cache } from 'react';
import { HARNESS } from '@/lib/harness-dir';
import { harnessHref, specsHref } from '@/lib/harness';
import { routeForFile } from '@/lib/views';

// The repository's own history, read out of git.
//
// The second window in this app onto something that is not her record. lib/
// harness.js shows what the agent is told to do; this shows what CHANGED, and
// when, and to which half of the repository.
//
// It exists because CLAUDE.md makes one promise about the harness that nothing
// here could check: it is "yours to amend, one traceable change at a time". The
// trace is the git log, and until now the only way to read it was a terminal —
// which meant "when did this rule appear, and what else moved with it?" was
// answerable only by someone already at a prompt in the right folder.
//
// ── Why it never opens a diff ───────────────────────────────────────────────
//
// This module asks git for three things: the message, the paths, and the line
// counts. It never asks for content. That is not a feature left for later; it is
// the boundary that makes this page safe to have at all.
//
// A diff of `data/` is her journal, rendered on a page whose whole subject is the
// machine — the one blurring of the two halves CLAUDE.md says this app cannot
// have. Paths and counts say everything a change log needs to say ("the timeline
// and two people's files moved together") without reproducing a line of what she
// wrote. Commit messages are safe from the other direction and for the same
// reason: CLAUDE.md already requires them to name the file and never the content.
//
// ── Why it can be absent, and why that is fine ──────────────────────────────
//
// `git log` needs a `.git` directory at request time. That is there under `npm
// run dev` and in any checkout, and it is NOT there in a serverless deployment,
// where the build ships traced files rather than a working tree. So `ok: false`
// with a reason is an ordinary outcome here, not an error — the view says the
// history is not readable from where it is running, and every other tab carries
// on. A change log that took the crisis numbers down with it when it could not
// find git would be a poor trade for a change log.

// The repository root, derived from the harness rather than resolved again.
//
// `.claude/` sits at the root by definition, so its parent is the root — and
// deriving it means this module cannot disagree with the folder lib/harness.js
// already found. A fourth resolver with its own three candidates is a fourth
// thing to keep in step.
const ROOT = dirname(HARNESS);

// Field, body and record separators, borrowed from ASCII's own. Nothing in a
// commit message contains them, which is the whole reason to use them rather
// than a delimiter somebody could type.
const FIELD = '\x1f';
const BODY = '\x1d';
const RECORD = '\x1e';

// The record separator LEADS the format rather than closing it. With --numstat,
// git prints the formatted commit and then its file lines, so a trailing
// separator would leave every commit's paths attached to the front of the next
// one. Leading it means one split yields one commit and everything belonging to
// it.
const FORMAT = '%x1e%H%x1f%h%x1f%aI%x1f%an%x1f%s%x1f%b%x1d';

// Where a changed path belongs. First match wins, so the catch-all sits last.
//
// The split is the one the whole repository is built on — hers, and the
// machinery around it — because that is the distinction worth seeing at a glance
// in a list of changes. A week of commits that never touched `data/` is a week
// of work on the machine; one that touched only `data/` is her talking.
//
// `pathspec` is the same rule said in git's own language, so filtering the list
// by area can be git's work rather than this module's — see readHistory below
// for why that matters to paging. `repo` is the catch-all in both directions:
// everything the four named folders do not hold, which git spells as exclusions.
// The folder is written once and both rules are derived from it. They were
// written out separately — a `test` predicate and a `pathspec` array per row —
// which is the same fact stated twice in two languages, and the failure mode is
// the quiet one: rename a folder, update the half you are looking at, and the
// list goes on filtering correctly while the rows are labelled wrong.
const NAMED = [
  { key: 'record', label: 'Record', folder: 'data' },
  { key: 'harness', label: 'Harness', folder: '.claude' },
  { key: 'specs', label: 'Specs', folder: 'specs' },
  { key: 'dashboard', label: 'Dashboard', folder: 'ux' },
  { key: 'sample', label: 'Sample', folder: 'samples' },
];

const AREAS = [
  ...NAMED.map((area) => ({
    ...area,
    test: (path) => path.startsWith(`${area.folder}/`),
    pathspec: [area.folder],
  })),
  // The catch-all, in both directions: everything the named folders do not
  // hold, which git spells as exclusions.
  {
    key: 'repo',
    label: 'Repo',
    test: () => true,
    pathspec: NAMED.map((a) => `:(exclude)${a.folder}`),
  },
];

export const AREA_KEYS = AREAS.map((area) => area.key);
export const AREA_LABEL = Object.fromEntries(AREAS.map((area) => [area.key, area.label]));

// Conventional Commits, which this repository uses everywhere — `type(scope):
// summary`. The gloss is what the type means here rather than a dictionary
// definition, and `tone` picks one of the three tag colours globals.css already
// defines, so nothing new is introduced to the palette.
//
// This map is the other half of .claude/skills/commit/SKILL.md, which is what
// tells a session which types exist. A type used in the log but missing here
// renders as a row with no tag — not broken, but unmarked in the one column the
// list is scanned by — so a new type is two edits, and the skill says so.
const TYPES = {
  feat: { gloss: 'Something new', tone: 'accent' },
  fix: { gloss: 'Something that was wrong', tone: 'warn' },
  refactor: { gloss: 'The same behaviour, said better', tone: null },
  perf: { gloss: 'The same behaviour, faster', tone: null },
  docs: { gloss: 'Prose about the thing, not the thing', tone: null },
  research: { gloss: 'What was looked up, and what it said', tone: null },
  style: { gloss: 'How it looks', tone: null },
  test: { gloss: 'Something checked', tone: null },
  ci: { gloss: 'The build', tone: null },
  chore: { gloss: 'Housekeeping', tone: null },
  record: { gloss: 'The record, written by the agent', tone: 'ok' },
};

export function typeMeta(type) {
  return TYPES[type] ?? null;
}

// Trailers are addressed to git, not to a reader. Co-authorship and the
// generated-with line are true and already visible in the commit itself;
// repeating them under every message here would make them the most repeated
// text on the page and the least informative.
const execFile = promisify(execFileCb);

const TRAILER = /^(co-authored-by|signed-off-by|reviewed-by|refs|closes|fixes):/i;
const GENERATED = /Generated with \[Claude Code\]/i;

// ── Reading ─────────────────────────────────────────────────────────────────

/**
 * `git log`, run once — or null if it cannot be run.
 *
 * execFile rather than exec: the arguments are a fixed list handed straight to
 * the binary, so there is no shell to quote for and nothing here that could be
 * read as a command. None of these arguments comes from a URL today, and this
 * way none of them could matter if one ever did.
 *
 * And async rather than Sync. A synchronous spawn inside a server component does
 * not just make this route wait — it holds the event loop for the whole call, so
 * every other request the server is handling stops until git returns. With the
 * timeout below that is up to five seconds of a process that answers nobody.
 */
async function run(args) {
  try {
    const { stdout } = await execFile('git', ['-C', ROOT, ...args], {
      encoding: 'utf8',
      timeout: 5000,
      // Far above the whole log of this repository and far below anything that
      // would trouble the process. A history that outgrows it fails the read
      // rather than exhausting memory, and the view says so.
      maxBuffer: 24 * 1024 * 1024,
      windowsHide: true,
    });
    return stdout;
  } catch {
    // No git on PATH, not a repository, a timeout, or output past maxBuffer.
    // Which of those it was is not something the view can act on differently.
    return null;
  }
}

/**
 * Which commit HEAD points at, read off the filesystem rather than asked for.
 *
 * The version stamp for everything in this file that caches between requests.
 * `git log` is a pure function of the history, so an answer stays good until a
 * new commit lands — and a new commit is a new oid. That is the whole of the
 * invalidation, and it is the same argument lib/file-cache.js makes with an
 * mtime.
 *
 * ── Why not ask git ─────────────────────────────────────────────────────────
 *
 * Because the point is to not spawn anything. `git rev-parse HEAD` measured
 * 61ms on this repository and `git status --porcelain=v2` — which is where the
 * history cache already gets its oid, and correctly, since that page pays for a
 * status anyway — measured 56–67ms. Reading the two files git would read costs
 * 0.12ms. A cache whose key costs half of what the miss costs is not a cache.
 *
 * ── The three shapes `.git/HEAD` comes in ───────────────────────────────────
 *
 *   ref: refs/heads/main   on a branch, the usual case. The oid is in that file.
 *   <40 hex>               detached — a bisect, a checked-out tag. Already it.
 *   ref, no such file      the ref is packed. `.git/packed-refs` has it.
 *
 * Anything else — a worktree, where `.git` is a file rather than a folder, a
 * repository mid-write, no repository at all — returns null. The caller then
 * does the uncached read, which is exactly what it did before this existed. A
 * version stamp that cannot be established is a reason to skip the cache, never
 * a reason to fail the page.
 */
function headOid() {
  try {
    const head = readFileSync(join(ROOT, '.git', 'HEAD'), 'utf8').trim();
    if (!head.startsWith('ref: ')) return /^[0-9a-f]{40}$/.test(head) ? head : null;

    const ref = head.slice(5).trim();
    try {
      return readFileSync(join(ROOT, '.git', ref), 'utf8').trim() || null;
    } catch {
      // Packed. One line per ref, `<oid> <refname>`, and the `^` lines under an
      // annotated tag are not refs — matching on the trailing name skips them.
      const packed = readFileSync(join(ROOT, '.git', 'packed-refs'), 'utf8');
      const line = packed.split('\n').find((l) => l.endsWith(` ${ref}`));
      return line?.split(' ')[0] ?? null;
    }
  } catch {
    return null;
  }
}

function areaOf(path) {
  return AREAS.find((area) => area.test(path)).key;
}

/**
 * The route in this app that opens a changed file — or null.
 *
 * A list of paths is a receipt; a list of paths you can follow is navigation,
 * and the difference is the whole value of an opened commit. Both maps already
 * exist and are reused rather than restated: harnessHref() for `.claude/`, which
 * has a page per path, and routeForFile() for `data/`, which is the same
 * function the timeline uses to follow its own pointers.
 *
 * This links OUT of the change log; it never renders her record INTO it. That
 * distinction is the whole of why this page is allowed to name `data/` paths at
 * all — the row says a file moved, the link goes to the view that already exists
 * for reading it, and nothing of what she wrote is reproduced here.
 *
 * Null for `ux/` and the repository root, which have no view of their own, and
 * null for a rename, whose `old => new` is not a path that ever existed. The
 * caller then shows plain text, which is still information.
 */
function hrefForPath(path) {
  if (path.includes(' => ')) return null;
  if (path.startsWith('.claude/')) return harnessHref(path.slice('.claude/'.length));
  if (path.startsWith('specs/')) return specsHref(path.slice('specs/'.length));
  if (path.startsWith('data/')) return routeForFile(path);
  return null;
}

/** `12\t3\tux/lib/git.js` — or `-\t-\t<path>` where the file is binary. */
function parseFiles(block) {
  return String(block)
    .split('\n')
    .map((line) => /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line.trim()))
    .filter(Boolean)
    .map((m) => ({
      // A rename arrives as `old => new`, or with the common prefix collapsed.
      // Kept whole rather than trimmed to the new name: half a rename is a path
      // that never existed.
      path: m[3],
      href: hrefForPath(m[3]),
      added: m[1] === '-' ? null : Number(m[1]),
      removed: m[2] === '-' ? null : Number(m[2]),
      area: areaOf(m[3]),
      binary: m[1] === '-',
    }));
}

function parseSubject(subject) {
  const text = String(subject ?? '').trim();
  const m = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/.exec(text);
  // An unparsed subject is shown whole rather than forced into the shape. A
  // commit that does not follow the convention is a fact about the history, and
  // inventing a type for it would hide the one thing worth noticing.
  if (!m || !TYPES[m[1]]) return { type: null, scope: null, breaking: false, summary: text };
  return { type: m[1], scope: m[2] ?? null, breaking: Boolean(m[3]), summary: m[4] };
}

/** The message body, as paragraphs, with the trailers taken off. */
function parseBody(body) {
  return String(body ?? '')
    .split(/\n\s*\n/)
    .map((para) =>
      para
        .split('\n')
        .filter((line) => !TRAILER.test(line.trim()) && !GENERATED.test(line.trim()))
        .join('\n')
        .trim(),
    )
    .filter(Boolean);
}

function parseCommit(chunk) {
  const [head, fileBlock = ''] = chunk.split(BODY);
  const parts = head.split(FIELD);
  if (parts.length < 6) return null;

  const [hash, short, when, author, subject, body] = parts;
  // The author's own offset, not the server's. `%aI` already carries it, so
  // slicing the string keeps a commit stamped with the clock it was made on
  // rather than re-projected into whatever zone the process happens to run in —
  // which is how a late-night commit ends up filed under the next morning.
  const files = parseFiles(fileBlock);

  return {
    hash,
    short,
    when,
    day: when.slice(0, 10),
    time: when.slice(11, 16),
    author,
    ...parseSubject(subject),
    body: parseBody(body),
    files,
    added: files.reduce((n, f) => n + (f.added ?? 0), 0),
    removed: files.reduce((n, f) => n + (f.removed ?? 0), 0),
    // In the order AREAS declares them, so two commits touching the same halves
    // list them the same way round.
    areas: AREA_KEYS.filter((key) => files.some((f) => f.area === key)),
  };
}

// ── What the view asks for ──────────────────────────────────────────────────

// How many commits a page shows before it offers to go further.
//
// The number is a cost, not a taste. Every commit on the page is a <details>
// carrying its whole message and every path it touched, rendered whether or not
// anybody opens it — and each one costs twice, once as markup and again in the
// payload React ships beside it to hydrate the same tree. At the whole history
// of this repository that was 824 KB and five thousand nodes for a list where
// seven tenths of the weight was behind a triangle nobody had clicked. It also
// costs on the server: --numstat makes git diff every commit it prints against
// its parent, so the read grows with the page.
//
// Twenty, which is about a sitting's work — enough that the top of the list
// answers "what has been happening" without a click, and the step below doubles
// it for anybody who wants to keep reading.
//
// It was forty, and forty was already the cheap answer: 399 KB of HTML, 2,104
// elements and a 251 KB hydration payload on every visit, measured, to show a
// list most visits read the top of. The cost is linear in the page, so halving
// the page halves it, and the doubling link means nothing is further than one
// click it was not already.
export const PAGE = 20;
const MAX = 2000;

/**
 * What this request is asking the log for: how much, matching what, where.
 *
 * Read from the URL rather than defaulted per caller, because the page and its
 * rail render independently and cannot hand each other anything. Both read the
 * same query string through this, so both ask git the same question — and
 * getHistory's cache sees one call rather than two.
 *
 * `limit` is clamped at both ends. The ceiling is not a guard against a hostile
 * URL — there is a login in front of this — it is a guard against a slip in one
 * turning a page into a stall.
 *
 * `q` is passed to `git log --grep`, which is a regular expression, so it is
 * length-capped and otherwise left alone: git does the matching, in C, over the
 * commits rather than over anything this process holds. `area` is checked
 * against the known keys, so the pathspec below is only ever one this file
 * wrote.
 */
export function queryFrom(searchParams) {
  const asked = Number.parseInt(searchParams?.n ?? '', 10);
  const area = String(searchParams?.area ?? '');
  return {
    limit: Number.isFinite(asked) ? Math.max(1, Math.min(MAX, asked)) : PAGE,
    q: String(searchParams?.q ?? '')
      .trim()
      .slice(0, 120),
    area: AREA_KEYS.includes(area) ? area : null,
  };
}

/** The query as a query string, for a link that keeps everything but one part. */
export function queryHref({ limit, q, area } = {}, changes = {}) {
  const next = { limit, q, area, ...changes };
  const params = new URLSearchParams();
  if (next.q) params.set('q', next.q);
  if (next.area) params.set('area', next.area);
  if (next.limit && next.limit !== PAGE) params.set('n', String(next.limit));
  const query = params.toString();
  return query ? `/changes?${query}` : '/changes';
}

/**
 * Whether the work is actually saved.
 *
 * The one question this view can answer that nothing else in the app can, and
 * the highest-stakes one in the repository. ARD-012 says a material write has to
 * survive the machine without her doing anything, and CLAUDE.md says the reason
 * plainly: the session runs on a disposable box, and "a silent failure to save is
 * the one failure she can't see". A page that lists forty saved commits and says
 * nothing about the work that is not saved is showing the half of that which was
 * never in doubt.
 *
 * One spawn answers all of it. `--porcelain=v2 --branch` carries the branch name,
 * how far ahead of its upstream HEAD is — which is exactly "committed but not
 * pushed" — and a line per changed file. `-uall` lists untracked files
 * individually rather than collapsing a new directory to one entry, which matters
 * here because a new journal entry IS an untracked file and collapsing it would
 * undercount the thing most worth counting.
 *
 * It also supplies the branch name, so the view needs no read of its own for it.
 * (headOid reads `.git/HEAD` for a different reason: a cache key that has to
 * cost nothing, which a spawn cannot.)
 */
export const getSaveState = cache(async function getSaveState() {
  if (!existsSync(join(ROOT, '.git'))) return null;

  const out = await run(['status', '--porcelain=v2', '--branch', '-uall']);
  if (out == null) return null;

  const lines = out.split('\n');
  const header = (key) =>
    lines.find((line) => line.startsWith(`# ${key} `))?.slice(key.length + 3) ?? null;

  // `+A -B` against the upstream. Absent when the branch has no upstream at all,
  // which is a different thing from being in step with one: nothing has been
  // pushed anywhere, and `ahead: null` is how the view says so rather than
  // reporting a reassuring zero.
  const ab = /^\+(\d+) -(\d+)$/.exec(header('branch.ab') ?? '');

  // `1`/`2` are tracked changes and `u` is a conflict; `2` is a rename, whose
  // path field is `<new>\t<old>`. `?` is untracked. The path is the last field
  // in every case, which is why the split is bounded rather than greedy.
  const changed = lines
    .map((line) => {
      if (line.startsWith('? ')) return line.slice(2);
      if (/^[12u] /.test(line)) return line.split(' ').slice(line[0] === '2' ? 9 : 8).join(' ');
      return null;
    })
    .filter(Boolean)
    .map((path) => path.split('\t')[0]);

  return {
    branch: header('branch.head') || null,
    tracking: Boolean(header('branch.upstream')),
    ahead: ab ? Number(ab[1]) : null,
    behind: ab ? Number(ab[2]) : null,
    dirty: changed.length,
    // Her record, counted apart from everything else. An uncommitted file under
    // `ux/` is somebody mid-edit; an uncommitted file under `data/` is her record
    // sitting on a disk that gets reclaimed without warning, which is the case
    // ARD-012 is actually about.
    dirtyRecord: changed.filter((path) => path.startsWith('data/')).length,
  };
});

/**
 * The history, newest first.
 *
 * Asks git for one more commit than the page wants, and reports whether it got
 * it. That is how `more` is known without a second `git rev-list --count` — one
 * extra row costs nothing, and a spawn costs a fifth of a second on a repository
 * sitting in a synced folder.
 *
 * Filtering and searching are git's work, not this module's, and that is not
 * only about speed. `--max-count` is applied by git AFTER `--grep` and the
 * pathspec, so a filtered page holds forty matching rows; filtering an
 * already-fetched forty here would show three and call it a page.
 *
 * The cost of handing the pathspec to git is that --numstat is scoped by it too,
 * so a filtered row's paths and counts describe that commit's effect on THAT
 * area rather than the whole commit. That is the more useful reading of a
 * filtered list — and the view says which it is showing rather than leaving the
 * numbers to be read as the commit's own.
 *
 * `--no-merges`: a merge commit has no --numstat output of its own, so it would
 * render as a row that changed nothing, which is worse than not rendering it.
 */
async function readHistory(limit, q, area) {
  if (!existsSync(join(ROOT, '.git'))) return { ok: false, reason: 'no-git', commits: [] };

  const want = Math.max(1, Math.min(MAX, limit));
  const pathspec = AREAS.find((a) => a.key === area)?.pathspec ?? [];

  const out = await run([
    'log',
    `--max-count=${want + 1}`,
    '--no-merges',
    '--date=iso-strict',
    '--numstat',
    `--format=${FORMAT}`,
    ...(q ? ['--regexp-ignore-case', `--grep=${q}`] : []),
    ...(pathspec.length ? ['--', ...pathspec] : []),
  ]);
  if (out == null) return { ok: false, reason: 'unreadable', commits: [] };

  const all = out.split(RECORD).slice(1).map(parseCommit).filter(Boolean);
  return {
    ok: true,
    reason: null,
    limit: want,
    more: all.length > want,
    commits: all.slice(0, want),
  };
}

/**
 * The same, deduped for the length of one render pass.
 *
 * React's cache() compares each argument with Object.is, so it dedupes on
 * PRIMITIVES and never on a freshly-built options object — two routes passing
 * `{ limit: 40 }` are two different objects and would be two spawns. Hence the
 * unpacking: callers pass the query object they already have, and the cached
 * function underneath only ever sees three primitives.
 */
const perRequest = cache(readHistory);

// ── Between requests, keyed on the commit HEAD is on ────────────────────────
//
// The same idea as lib/file-cache.js, with the commit standing in for the
// modification time. History is immutable: for a given HEAD, `git log` returns
// the same answer for the same question until a new commit lands. So the answer
// can be kept, and the only thing needed to know whether it is still good is
// which commit HEAD points at.
//
// That is read off disk by headOid(), in 0.12ms, and a hit removes the
// expensive half: `git log --numstat` has to diff every commit it prints
// against its parent, which is about 180ms for forty and rises with the page.
//
// This does NOT weaken force-dynamic. The route is dynamic so that a commit made
// a moment ago shows up, and that still holds exactly: a new commit is a new
// HEAD, a new key, and a fresh read. What is reused is only an answer that
// cannot have changed.
//
// Uncommitted work does not move HEAD, and correctly does not invalidate this —
// the log does not describe the working tree. The save state does, and it is not
// cached here.
//
// Unlike lib/file-cache.js this runs in development too. The reason that one
// stays off is that its answer is built by a DIFFERENT module (lib/markdown.js),
// so editing the renderer leaves a stale value behind a key that did not change.
// Everything cached here is produced by this file, which Next re-evaluates on
// edit — taking the Map with it.
const remembered = new Map();

// Enough for a reader moving between the areas and expanding a page or two;
// small enough that a long session cannot grow it without bound. Oldest out
// first, which for a Map is insertion order.
const REMEMBER = 16;

async function rememberedHistory(limit, q, area) {
  // Off disk, not out of `git status`.
  //
  // It used to be `(await getSaveState())?.oid`, on the argument that the page
  // runs a status anyway so the key was free. That was true of the key and not
  // of the page: it put a 56–67ms spawn in front of every history read, so the
  // log and the status the page awaits beside it ran one after the other, not
  // side by side — the two independent reads CHG-003 asks for were not
  // independent. A warm log now answers in a file read, and the page waits on
  // the status alone.
  const oid = headOid();
  // No repository, or a HEAD that would not parse. Fall through and let the
  // read report the problem rather than caching a failure under a null key.
  if (!oid) return perRequest(limit, q, area);

  const key = `${oid}|${limit}|${q}|${area ?? ''}`;
  const hit = remembered.get(key);
  if (hit) return hit;

  const result = await perRequest(limit, q, area);
  // A failed read is not worth keeping: the next request should try again
  // rather than be told for the life of the process that git is unreadable.
  if (!result.ok) return result;

  remembered.set(key, result);
  if (remembered.size > REMEMBER) remembered.delete(remembered.keys().next().value);
  return result;
}

export function getHistory({ limit = PAGE, q = '', area = null } = {}) {
  return rememberedHistory(limit, q, area);
}

/**
 * The same commits, gathered into the days they were made on.
 *
 * A day rather than a week or a month: this repository is worked on in sittings,
 * and a sitting is what a reader is after when they ask what changed — "the
 * evening the reading surface was reworked", not "week 38".
 */
export function byDay(commits) {
  const days = new Map();
  for (const commit of commits ?? []) {
    if (!days.has(commit.day)) days.set(commit.day, []);
    days.get(commit.day).push(commit);
  }
  return [...days].map(([day, entries]) => ({ day, commits: entries }));
}

// ── When a file last changed ────────────────────────────────────────────────
//
// The one fact about a harness file that nothing else on the page can answer:
// is this instruction current, or is it a rule somebody wrote and forgot.
//
// From git rather than from the filesystem. lib/content-read.js already refuses
// mtime for the record, and the reason holds here: a clone, a checkout or a sync
// rewrites it, so a page rendered on a fresh deploy would claim every file in
// the harness changed today. A date that lies is worse than no date.
//
// ── One call for the whole folder, not one per file ─────────────────────────
//
// `git log --name-only` walks the history once and names every path each commit
// touched, so a single spawn dates every file under `.claude/`. Asking per file
// would be a process per row — forty of them on the harness overview — and that
// is how a page that reads files starts taking seconds.
//
// ── Kept between requests, keyed on HEAD ───────────────────────────────────
//
// Per request was not enough. This runs in the rail of EVERY page under
// /harness — the overview and every folder and file below it — so a reader
// moving through the specs paid for the spawn on every click: 127–139ms
// measured, for a log that had not changed between any two of them. The page
// itself, walk and link graph and render, was a third of that.
//
// Same argument as rememberedHistory below, and the same shape: the log is a
// function of the history, so the answer holds until a commit lands. What
// differs is where the oid comes from. That one takes it out of the `git
// status` its page runs anyway; nothing on a harness page runs one, and adding
// it would have swapped a 130ms spawn for a 60ms spawn rather than removing it.
// headOid() reads the same answer off disk in 0.12ms.
//
// One entry, not a Map of them, because there is only ever one question here:
// what is every date under `.claude/`. A new commit replaces it.
//
// The Map handed back is shared by every request that hits this key, and both
// callers only read it — a `.get()` in the file rail, a `.values()` in the
// folder one. Nothing may mutate it.
//
// One entry per folder tab, keyed by the folder: `.claude` and `specs` are
// dated separately, so neither tab pays for the other's log.
const folderDates = new Map();

// Cached per request as well, so the two rails that ask during one render share
// the call rather than racing to fill the entry above.
export const getFolderDates = cache(async function getFolderDates(folder) {
  const oid = headOid();
  const kept = folderDates.get(folder);
  if (oid && kept?.oid === oid) return kept.dates;

  // %x00 as the record mark: a commit date, then the paths it touched, then a
  // blank line. Nothing in a path can be a NUL, which is the property a
  // separator needs and neither a newline nor a tab has.
  const out = await run([
    'log',
    // %cs, not %cI: a calendar date in the committer's own zone, which is what
    // every label downstream parses and all any of them says. The full stamp
    // read `2026-09-21T00:39:26+08:00`, which parseISO does not match — so the
    // date helpers fell through to their "print it as given" branch and the rail
    // showed the raw ISO string where a date should be.
    '--format=%x00%cs',
    '--name-only',
    '--no-renames',
    '--',
    folder,
  ]);
  if (!out) return new Map();

  const dates = new Map();
  for (const record of out.split('\0')) {
    const lines = record.split('\n').filter(Boolean);
    if (!lines.length) continue;
    const [when, ...paths] = lines;
    for (const path of paths) {
      if (!path.startsWith(`${folder}/`)) continue;
      const rel = path.slice(folder.length + 1);
      // The log is newest first, so the first date a path is seen with is the
      // last time it changed. Later ones are its earlier history.
      if (!dates.has(rel)) dates.set(rel, when);
    }
  }

  // Only under a stamp. With no oid to key on — a worktree, a repository mid-
  // write — the answer is still correct for this request and simply is not kept,
  // which is what the code did before there was anywhere to keep it.
  if (oid) folderDates.set(folder, { oid, dates });
  return dates;
});
