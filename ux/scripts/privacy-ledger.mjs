#!/usr/bin/env node
// Which files outside data/ the twice-daily privacy read has read, as they are now
// (ARC-004 design 4; A-155, T-562: "Okay do it, and let me know what u did").
//
// The read used to take "what changed since my last run", which proves nothing about
// a file no run happened to cover, or a run that stopped early. The ledger,
// dev/privacy-ledger/, holds for each file the git blob id of the content that
// was read, and the day: { "<path>": { "blob": "<id>", "read": "YYYY-MM-DD" } }.
// It is one part per top folder (`dev.json`, `ux.json`, `.claude.json`; files at
// the root in `_root.json`), one entry a line, so each part stays under the
// one-read line (E-031; T-682: "Yes do it"). A folder's part that would pass
// PART_LINES goes on in `dev-2.json`, `dev-3.json`… cut between entries in path
// order (lib/one-read.mjs, T-768), so a top folder that keeps growing never outgrows it.
// Only paths, blob ids and dates, never anything read. A file is read when its blob
// at HEAD is the one the ledger holds; any commit that changes it makes it unread
// again, with nothing to remember.
//
// It compares against HEAD, not the working tree or the index: HEAD is what a share
// copy or a release is made from (share.mjs, release.mjs), so it is what has to have
// been read. For the same reason `mark` refuses a file with uncommitted changes:
// what is on disk is not what would be marked.
//
//   node ux/scripts/privacy-ledger.mjs status [--json] [--check]   read / unread / gone; --check exits 1 while any is unread
//   node ux/scripts/privacy-ledger.mjs next [n]                     the next n unread paths, the longest-waiting first
//   node ux/scripts/privacy-ledger.mjs slices [n]                   the same paths cut into slices one reader can read whole
//   node ux/scripts/privacy-ledger.mjs mark <path>…                 record each file's HEAD content as read today
//   node ux/scripts/privacy-ledger.mjs prune                        drop entries for files no longer tracked
//
// n defaults to `privacy.filesPerRun` in .claude/thresholds.json. One reader cannot
// read a few megabytes whole (2026-11-01: 168 files, about 2.9 MB, waited and one
// session read 15), so `slices` cuts the list by size, `privacy.sliceBytes` each, a
// file bigger than that alone in its own, for the run to hand one to each reader. Files under
// data-sample/ and dev/skills/safety-eval/ are invented, but they are outside data/,
// so they are listed too: the read decides what counts as a finding, not this.
// In a copy without dev/ (ARC-008) there is no ledger; it says so, and the read
// falls back to what changed since its last run. Dependency-free. Exit 2: could not run.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DEV_DIR } from '../../.claude/hooks/lib/paths.mjs';
import { threshold } from '../../.claude/hooks/lib/thresholds.mjs';
import { packParts, partPath } from '../../.claude/hooks/lib/one-read.mjs';

export const LEDGER = `${DEV_DIR}/privacy-ledger`;
/** The ledger's part file a path's entry lives in: its top folder, or `_root` for a file at the root. */
export const ledgerPart = (path) => `${path.includes('/') ? path.slice(0, path.indexOf('/')) : '_root'}.json`;
/** Whether `path` is the ledger itself, any of its parts. */
export const isLedger = (path) => path === LEDGER || path.startsWith(`${LEDGER}/`);
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const git = (root, args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });

/** Whether `path` (repository-relative, forward slashes) is hers: data/ and below. */
export const isRecord = (path) => path === 'data' || path.startsWith('data/');

/** Whether this copy keeps a ledger at all: only where the developer's dev/ is. */
export const hasLedgerHome = (root) => existsSync(join(root, DEV_DIR));

/** path → blob id of every file HEAD tracks outside data/, the ledger itself left out. */
export function trackedBlobs(root) {
  const out = new Map();
  let text = '';
  try {
    text = git(root, ['ls-tree', '-r', '-z', '--full-tree', 'HEAD']);
  } catch {
    return out; // no commit yet: nothing is shared, nothing to read
  }
  for (const entry of text.split('\0')) {
    const m = entry.match(/^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/s);
    if (!m || m[2] !== 'blob') continue; // a submodule is not a file to read
    const path = m[4];
    if (isRecord(path) || isLedger(path)) continue;
    out.set(path, m[3]);
  }
  return out;
}

/** The ledger at `root`, every part merged; `{}` when there is none, and a part that cannot be read adds nothing (nothing proven read). */
export function readLedger(root) {
  const dir = join(root, LEDGER);
  const out = {};
  let names = [];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json')).sort();
  } catch {
    return out;
  }
  for (const name of names) {
    try {
      const parsed = JSON.parse(readFileSync(join(dir, name), 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) Object.assign(out, parsed);
    } catch {
      // unreadable part: its files stay unread
    }
  }
  return out;
}

/** Pure: one part's text, sorted by path, one entry a line, so a run's change to it is a readable diff. */
export function partText(entries) {
  const keys = Object.keys(entries).sort();
  if (!keys.length) return '{}\n';
  const lines = keys.map((k) => `${JSON.stringify(k)}: ${JSON.stringify({ blob: entries[k].blob, read: entries[k].read })}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

/**
 * Pure: the part files for a ledger, { name: entries }: each top folder's entries in its own
 * part, and past PART_LINES on in `<folder>-2.json` and on, cut between entries in path order.
 */
export function ledgerParts(ledger, limit) {
  const byFolder = new Map();
  for (const [path, entry] of Object.entries(ledger)) {
    const name = ledgerPart(path);
    if (!byFolder.has(name)) byFolder.set(name, {});
    byFolder.get(name)[path] = entry;
  }
  const out = {};
  for (const [name, entries] of byFolder) {
    const pick = (keys) => Object.fromEntries(keys.map((k) => [k, entries[k]]));
    for (const [n, keys] of packParts(Object.keys(entries).sort(), (_, keys) => partText(pick(keys)), limit)) out[partPath(name, n)] = pick(keys);
  }
  return out;
}

/** Write it, each entry to its top folder's part (ledgerParts); a part left with no entry is written empty, never deleted. */
export function writeLedger(root, ledger) {
  const dir = join(root, LEDGER);
  mkdirSync(dir, { recursive: true });
  const parts = new Map();
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) parts.set(name, {});
  for (const [name, entries] of Object.entries(ledgerParts(ledger))) parts.set(name, entries);
  for (const [name, entries] of parts) {
    const text = partText(entries);
    const file = join(dir, name);
    if (!existsSync(file) || readFileSync(file, 'utf8') !== text) writeFileSync(file, text);
  }
}

/**
 * The Agreements pages and the Transcript's index are built by `dialogue.mjs build`
 * from the Transcript, the eval cards, the specs and the trace, and rebuilt on every
 * remark, so another chat sorting its remarks made them unread faster than a read
 * could clear them (2026-11-06: 47 of 48 unread were these pages, three rounds running).
 * The developer's ruling that day: they count as read once what they are built from
 * is read. Two conditions, both needed: every source is read as it is, and the pages
 * are exactly what the build makes from those sources (`generatedMatch`).
 */
export const isGenerated = (path) =>
  path === `${DEV_DIR}/dialogue/agreements.md` || path.startsWith(`${DEV_DIR}/dialogue/agreements/`) || path.startsWith(`${DEV_DIR}/dialogue/index/`);
export const isGeneratedSource = (path) =>
  path.startsWith(`${DEV_DIR}/dialogue/transcript/`) || path === `${DEV_DIR}/dialogue/trace.md` || path.startsWith(`${DEV_DIR}/evals/cards/`) || path.startsWith(`${DEV_DIR}/specs/`);

/**
 * Whether the generated pages at `root` are exactly what the build makes from the
 * sources, as committed: none of them or their sources differs from HEAD, and the
 * dialogue check finds the pages match. False when either cannot be shown.
 */
export function generatedMatch(root) {
  try {
    const dirty = git(root, ['status', '--porcelain', '--', `${DEV_DIR}/dialogue`, `${DEV_DIR}/evals/cards`, `${DEV_DIR}/specs`]).trim();
    if (dirty) return false;
    const out = execFileSync(process.execPath, [join(root, 'ux', 'scripts', 'dialogue.mjs'), 'check'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000 });
    return /agreements\.md, its parts and index\/ match the Transcript/.test(out);
  } catch {
    return false;
  }
}

/**
 * Pure: which tracked files are read as they are, which are not, and which entries name
 * files gone. With `pagesMatch` true, a generated page counts as read when every
 * source it is built from is (see `isGenerated`).
 */
export function ledgerStatus(tracked, ledger, { pagesMatch = false } = {}) {
  const read = [];
  const unread = [];
  const isRead = (path, blob) => ledger[path]?.blob === blob;
  const sourcesRead = pagesMatch && [...tracked].every(([p, b]) => !isGeneratedSource(p) || isRead(p, b));
  for (const [path, blob] of tracked) (isRead(path, blob) || (sourcesRead && isGenerated(path)) ? read : unread).push(path);
  const gone = Object.keys(ledger).filter((p) => !tracked.has(p));
  return { read: read.sort(), unread: unread.sort(), gone: gone.sort() };
}

/** path → the commit time (seconds) of its last change at HEAD, for the paths asked. One pass over the log. */
export function lastChanged(root, paths) {
  const want = new Set(paths);
  const out = new Map();
  if (!want.size) return out;
  let text = '';
  try {
    text = git(root, ['-c', 'core.quotePath=false', 'log', '--format=%x01%ct', '--name-only', 'HEAD', '--', '.', ':(exclude)data']);
  } catch {
    return out;
  }
  let when = 0;
  for (const line of text.split('\n')) {
    if (line.startsWith('\x01')) when = Number(line.slice(1));
    else if (line && want.has(line) && !out.has(line)) out.set(line, when);
  }
  return out;
}

/** Pure: unread paths, the one whose last change is oldest first (it has waited longest), then by path. */
export function orderUnread(unread, times) {
  return [...unread].sort((a, b) => (times.get(a) ?? 0) - (times.get(b) ?? 0) || a.localeCompare(b));
}

/** The ordered unread list at `root`. */
export function unreadInOrder(root, tracked = trackedBlobs(root), ledger = readLedger(root)) {
  const { unread } = ledgerStatus(tracked, ledger, { pagesMatch: generatedMatch(root) });
  return orderUnread(unread, lastChanged(root, unread));
}

/** Pure: `paths` in order, cut into slices of at most `max` bytes; a file bigger than `max` is a slice alone. */
export function cutSlices(paths, sizes, max) {
  const out = [];
  let cur = [];
  let used = 0;
  for (const p of paths) {
    const n = sizes.get(p) ?? 0;
    if (cur.length && used + n > max) {
      out.push(cur);
      cur = [];
      used = 0;
    }
    cur.push(p);
    used += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

/** path → size in bytes at HEAD, for the paths asked. */
export function blobSizes(root, paths) {
  const out = new Map();
  if (!paths.length) return out;
  const text = git(root, ['ls-tree', '-r', '-l', '-z', '--full-tree', 'HEAD']);
  const want = new Set(paths);
  for (const entry of text.split('\0')) {
    const m = entry.match(/^\d+ blob [0-9a-f]+ +(\d+)\t(.+)$/s);
    if (m && want.has(m[2])) out.set(m[2], Number(m[1]));
  }
  return out;
}

/** How many bytes one reader is given, from the row that states it. */
export const sliceBytes = () => threshold('privacy.sliceBytes', 'bytes');

/** How many files one run reads, from the row that states it; null when the file does not say. */
export const perRun = () => threshold('privacy.filesPerRun', 'files');

/** Repository-relative, forward slashes, for a path given from the command line. */
export function repoPath(root, given, cwd = process.cwd()) {
  const abs = isAbsolute(given) ? given : resolve(cwd, given);
  return relative(root, abs).split('\\').join('/');
}

/** Why `path` may not be marked read, or ''. */
export function markProblem(root, path, tracked = trackedBlobs(root)) {
  if (!path || path.startsWith('..')) return 'is outside the repository';
  if (isRecord(path)) return 'is in data/, which is hers and never in the ledger';
  if (isLedger(path)) return 'is the ledger itself';
  if (!tracked.has(path)) return 'is not in the last commit (untracked, or added but not committed): commit it, read it, then mark it';
  const changed = git(root, ['status', '--porcelain=v1', '-z', '--', path]);
  if (changed) return 'has uncommitted changes, so what is on disk is not what would be marked: commit them first, then read it as committed';
  return '';
}

const today = (now = new Date()) => now.toISOString().slice(0, 10);

/**
 * Mark each path's HEAD content read on `day`. Every path that passes is marked;
 * the ones that do not are returned with why, and nothing is written for them.
 */
export function mark(root, paths, day = today()) {
  const tracked = trackedBlobs(root);
  const ledger = readLedger(root);
  const refused = [];
  let marked = 0;
  for (const path of paths) {
    const why = markProblem(root, path, tracked);
    if (why) {
      refused.push({ path, why });
      continue;
    }
    ledger[path] = { blob: tracked.get(path), read: day };
    marked++;
  }
  if (marked) writeLedger(root, ledger);
  return { marked, refused };
}

/** Drop the entries for files no longer tracked; returns the paths dropped. */
export function prune(root) {
  const tracked = trackedBlobs(root);
  const ledger = readLedger(root);
  const gone = ledgerStatus(tracked, ledger).gone;
  for (const p of gone) delete ledger[p];
  if (gone.length) writeLedger(root, ledger);
  return gone;
}

/**
 * Why nothing may leave (a share copy, a release) because the read has not read
 * every file as it now is, or '' when it has. Paths are harness, so the first few
 * are named; the count is what matters.
 */
export function ledgerProblem(root, n = perRun()) {
  const tracked = trackedBlobs(root);
  const { unread } = ledgerStatus(tracked, readLedger(root), { pagesMatch: generatedMatch(root) });
  if (!unread.length) return '';
  const first = orderUnread(unread, lastChanged(root, unread)).slice(0, 3);
  const pace = n ? `, up to ${n} a run, twice a day,` : '';
  return `${unread.length} of ${tracked.size} files outside data/ have not been read by the privacy read as they now are (first: ${first.join(', ')}${unread.length > 3 ? ', …' : ''}); the twice-daily read is working through them${pace} so try again once \`node ux/scripts/privacy-ledger.mjs status --check\` passes`;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const flags = new Set(rest.filter((a) => a.startsWith('--')));
  const args = rest.filter((a) => !a.startsWith('--'));
  const root = repoRoot;
  if (!hasLedgerHome(root)) {
    console.log(`privacy ledger: this copy has no ${DEV_DIR}/, so no ledger; the privacy read takes what changed since its last run`);
    return 0;
  }
  if (cmd === 'status') {
    const tracked = trackedBlobs(root);
    const ledger = readLedger(root);
    const s = ledgerStatus(tracked, ledger, { pagesMatch: generatedMatch(root) });
    const order = orderUnread(s.unread, lastChanged(root, s.unread));
    if (flags.has('--json')) {
      console.log(JSON.stringify({ total: tracked.size, read: s.read.length, unread: s.unread.length, gone: s.gone.length, perRun: perRun(), unreadPaths: order, gonePaths: s.gone }, null, 2));
    } else {
      console.log(`privacy ledger: ${tracked.size} files outside data/: ${s.read.length} read, ${s.unread.length} unread, ${s.gone.length} gone`);
      for (const p of order) console.log(`  ${p}`);
      if (s.gone.length) console.log(`  (${s.gone.length} ledger entries name files no longer tracked: run prune)`);
    }
    return flags.has('--check') && s.unread.length ? 1 : 0;
  }
  if (cmd === 'next') {
    const n = args[0] ? Number(args[0]) : perRun();
    if (!Number.isInteger(n) || n < 1) {
      console.error('privacy ledger: give how many, e.g. next 150 (.claude/thresholds.json states no privacy.filesPerRun)');
      return 2;
    }
    for (const p of unreadInOrder(root).slice(0, n)) console.log(p);
    return 0;
  }
  if (cmd === 'slices') {
    const n = args[0] ? Number(args[0]) : perRun();
    const max = sliceBytes();
    if (!Number.isInteger(n) || n < 1 || !max) {
      console.error('privacy ledger: slices needs privacy.filesPerRun and privacy.sliceBytes in .claude/thresholds.json');
      return 2;
    }
    const paths = unreadInOrder(root).slice(0, n);
    const most = threshold('privacy.slicesPerRun', 'slices');
    const cut = cutSlices(paths, blobSizes(root, paths), max).slice(0, most || undefined);
    if (flags.has('--json')) console.log(JSON.stringify(cut));
    else cut.forEach((slice, i) => console.log(`slice ${i + 1}: ${slice.join(' ')}`));
    return 0;
  }
  if (cmd === 'mark') {
    if (!args.length) {
      console.error('privacy ledger: name the files read, e.g. mark ux/app.mjs');
      return 2;
    }
    const { marked, refused } = mark(root, args.map((a) => repoPath(root, a)));
    console.log(`privacy ledger: ${marked} marked read`);
    for (const { path, why } of refused) console.error(`  refused: ${path} ${why}`);
    return refused.length ? 1 : 0;
  }
  if (cmd === 'prune') {
    const gone = prune(root);
    console.log(`privacy ledger: ${gone.length} entries for files no longer tracked dropped`);
    return 0;
  }
  console.error('usage: privacy-ledger.mjs status [--json] [--check] | next [n] | slices [n] [--json] | mark <path>… | prune');
  return 2;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (e) {
    console.error(`privacy ledger: could not run: ${e.message}`);
    process.exitCode = 2;
  }
}
