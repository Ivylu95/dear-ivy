// What waits on the developer (A-152, DEV-013, DEV-014), parsed, and the
// end-of-session reviews (DEV-020) read beside it.
//
// There is no backlog. A development chat finishes or drops its own work, and a
// nightly job fixes what it finds or drops it; only what needs the developer is
// kept, in dev/for-you.md, one line per item:
//
//   - for-you · <one plain question> · opened YYYY-MM-DD · chat <id | none>[ · pick <the agent's pick>][ · asked YYYY-MM-DD][ · gate]
//
// A-178: a question only, never a task ("Pick up: …" is refused: a task is done or dropped), and
// never one another line already asks. Once a week the oldest few are put to him with the agent's
// pick (`asked`); one still here a week after that is settled on its pick, unless it is at a gate
// (`gate`: safety, privacy, money or what cannot be undone), which waits for him however long.
//
// Any other item line is a problem: a `to-do`, an `in-progress` or a `done` line
// is work that should have been finished or dropped, not kept. The chat is the
// session the question came from. Read by the reply-shape hook (the dev menu and
// the "For you" count) and checked by ux/scripts/check-for-you.mjs.
//
// Reviews are bookkeeping, not waiting work, so they live in their own ledger,
// dev/session-reviews.md, one line each:
//
//   - reviewed YYYY-MM-DD · commit <hash> · chat <id>

import { execFile, execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { read, repoRoot } from './hook.mjs';
import { DEV_DIR, FOR_YOU_FILE, SESSION_REVIEWS_FILE } from './paths.mjs';
import { threshold } from './thresholds.mjs';

export const FOR_YOU = join(repoRoot, FOR_YOU_FILE);
export const SESSION_REVIEWS = join(repoRoot, SESSION_REVIEWS_FILE);
const ITEM_RE = /^- for-you · (.+?) · opened (\d{4}-\d{2}-\d{2}) · chat (\S+?)((?: · (?:pick [^·]+?|asked \d{4}-\d{2}-\d{2}|gate))*)$/;
const REVIEW_RE = /^- reviewed (\d{4}-\d{2}-\d{2}) · commit ([0-9a-f]{7,40}) · chat (\S+)$/;
// DEV-014 states it (FND-009). Unreadable, nothing is flagged for age.
const STALE_DAYS = threshold('forYou.staleAge', 'days');

/**
 * { items, problems, warnings } from the list's text. Every line opening "- " is
 * an item and must be in the for-you format; a line that would be skipped is a
 * problem, never silence, since a skipped question is one the developer never
 * sees. Prose (the header) is any line not opening "- ".
 */
export function parseForYou(text = read(FOR_YOU) ?? '') {
  const items = [];
  const problems = [];
  const warnings = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!/^\s*[-*+] /.test(line)) continue;
    const m = line.match(ITEM_RE);
    if (!m) {
      const kind = line.match(/^- (to-do|in-progress|waiting-on-you|done)\b/)?.[1];
      problems.push(kind
        ? `a "${kind}" line: there is no backlog (A-152); finish or drop it, or ask the developer as a for-you line: ${line.slice(0, 80)}`
        : `not in the for-you format: ${line.slice(0, 80)}`);
      continue;
    }
    if (!m[1].trim()) problems.push(`a for-you line with nothing asked: ${line.slice(0, 80)}`);
    if (/^pick up\b/i.test(m[1].trim())) problems.push(`a task, not a question (A-178): do it or drop it: ${line.slice(0, 80)}`);
    const extra = m[4] ?? '';
    items.push({
      what: m[1], opened: m[2], chat: m[3], line,
      pick: (extra.match(/ · pick ([^·]+?)(?= · |$)/) ?? [])[1] ?? null,
      asked: (extra.match(/ · asked (\d{4}-\d{2}-\d{2})/) ?? [])[1] ?? null,
      gate: / · gate(?= · |$)/.test(extra),
    });
  }
  const whats = items.map((i) => i.what.toLowerCase());
  for (const w of new Set(whats.filter((w, i) => whats.indexOf(w) !== i))) warnings.push(`listed twice: ${w.slice(0, 70)}`);
  // A-178: a question another line already asks, in nearly the same words, is a problem.
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    if (whats[i] !== whats[j] && sameQuestion(items[i].what, items[j].what)) problems.push(`asked twice (A-178): keep one: ${items[j].what.slice(0, 70)}`);
  }
  return { items, problems, warnings };
}

const STOP = new Set('a an and are as at be by do for from has have i if in is it its me my of on or shall should so that the this to was we what when will with you your'.split(' '));
const wordsOf = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
/** Two questions in nearly the same words (A-178): most of the shorter one's words in the other. */
export function sameQuestion(a, b) {
  // A row, card or eval named differently is a different question (SAF-004 is not SAF-014).
  const ids = (t) => [...String(t).matchAll(/\b[A-Z]{1,4}-\d{2,4}\b/g)].map((m) => m[0]).sort().join();
  if (ids(a) !== ids(b)) return false;
  const [x, y] = [wordsOf(a), wordsOf(b)];
  const small = x.size <= y.size ? x : y;
  const big = small === x ? y : x;
  if (small.size < 5) return false;
  let shared = 0;
  for (const w of small) if (big.has(w)) shared += 1;
  return shared / small.size >= 0.85;
}

/** The review ledger: { reviews: [{ date, commit, chat }], problems }. */
export function parseReviews(text = read(SESSION_REVIEWS) ?? '') {
  const reviews = [];
  const problems = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!/^\s*[-*+] /.test(line)) continue;
    const m = line.match(REVIEW_RE);
    if (!m) problems.push(`not in the review format: ${line.slice(0, 80)}`);
    else reviews.push({ date: m[1], commit: m[2], chat: m[3] });
  }
  return { reviews, problems };
}

/** Items waiting longer than the stale limit: a question left unanswered is said, not trusted. */
export function overdue(items, today = new Date()) {
  const day = 86400000;
  return items.filter((i) => STALE_DAYS && today - new Date(i.opened) > STALE_DAYS * day);
}

/** The dev menu's "For you" lines (A-152): every item, in full, oldest first, until he answers it. */
export function forYouMenu(items) {
  if (!items.length) return [];
  return [
    `For you · ${items.length} waiting on the developer (${FOR_YOU_FILE}), each shown until he answers it:`,
    ...[...items].sort((a, b) => a.opened.localeCompare(b.opened)).map((i) => `  - ${i.what} (since ${i.opened})`),
  ];
}

// DEV-020 began on this day; chats before it had no review to owe.
export const REVIEW_RULE_SINCE = '2026-09-30';

/** A chat's id with its link and cse_/session_ prefix removed, so all three forms compare. */
export const normChat = (id) => String(id).replace(/^.*\/(session_|cse_)?/, '').replace(/^(session_|cse_)/, '');

// The commit gate runs its checks in a copy of the staged tree with no .git,
// and names the real repository in DEAR_GIT_ROOT: history is read there.
const gitRoot = () => process.env.DEAR_GIT_ROOT || repoRoot;

// A git call that fails, or gives no answer in time, is history unread, never
// "no review owed" or "no such commit": read as false, a broken git would clear
// every owed review without anyone seeing it, and a hung one would hold the
// hook or the page with no end. The limit matches lib/hook.mjs's git().
const GIT_TIMEOUT_MS = 15000;
// Node's default output limit is 1 MB; the review history passed it on
// 2026-11-02 and every read failed with ENOBUFS, so the brief said "history
// could not be read" and the gate's selftest failed. The commit gate's own git
// reads use the same 64 MB.
const GIT_MAX_BUFFER = 64 * 1024 * 1024;

/** Thrown when git cannot be read; callers say "history could not be read". */
export class HistoryUnreadable extends Error {
  constructor(args, err) {
    super(`git ${args[0]} ${err?.code === 'ETIMEDOUT' ? `gave no answer in ${GIT_TIMEOUT_MS / 1000}s` : 'failed'}`);
    this.name = 'HistoryUnreadable';
  }
}

/**
 * git's output, or its exit code when that code is one of `answers` (git's way
 * of saying "no"). Any other failure, or the timeout, throws HistoryUnreadable.
 */
function run(args, answers = []) {
  try {
    return { code: 0, out: execFileSync('git', args, { cwd: gitRoot(), encoding: 'utf8', timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }) };
  } catch (err) {
    if (answers.includes(err?.status)) return { code: err.status, out: '' };
    throw new HistoryUnreadable(args, err);
  }
}

// run() without holding the event loop, for the admin server: there the
// synchronous calls froze every view while the dashboard's list read history (3 to
// 4.5 s, measured 2026-10-06). Same answers and limit; a kill is the timeout.
// At most GIT_POOL run at once: every chat's calls started together were dozens
// of git processes on Windows, and any one passing the timeout made the whole
// answer "unreadable", which the one-at-a-time sync read never did. The gate
// is around the git call itself, so nested reads cannot multiply it, and a
// call's timeout starts only once it runs.
const GIT_POOL = 4;
let gitRunning = 0;
const gitWaiting = [];

async function runAsync(args, answers = []) {
  if (gitRunning >= GIT_POOL) await new Promise((go) => gitWaiting.push(go));
  else gitRunning += 1;
  try {
    return await gitOnce(args, answers);
  } finally {
    // A waiting call takes this slot directly, so the count never dips below the queue.
    const go = gitWaiting.shift();
    if (go) go();
    else gitRunning -= 1;
  }
}

function gitOnce(args, answers) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: gitRoot(), encoding: 'utf8', timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_MAX_BUFFER, windowsHide: true }, (err, out) => {
      if (!err) return resolve({ code: 0, out });
      if (answers.includes(err.code)) return resolve({ code: err.code, out: '' });
      reject(new HistoryUnreadable(args, err.killed ? { code: 'ETIMEDOUT' } : err));
    });
  });
}

/** True when commit `a` is `b` or an ancestor of it. Exit 1 is "no"; anything else is unread. */
export function isAncestor(a, b) {
  return run(['merge-base', '--is-ancestor', a, b], [1]).code === 0;
}

/** True when `hash` names a commit this repository holds. --quiet exits 1 for "no such commit". */
export function commitExists(hash) {
  return run(['rev-parse', '--verify', '--quiet', `${hash}^{commit}`], [1]).code === 0;
}

// Work that owes a review: anything outside a record, except the bookkeeping
// files: the for-you list, the review ledger, and the list's name before A-152,
// which older commits recording a review still name (recording a review, or a
// question for the developer, is not new work).
const BOOKKEEPING = new Set([FOR_YOU_FILE, SESSION_REVIEWS_FILE, `${DEV_DIR}/backlog.md`]);
const isHarnessWork = (f) => !/^(data|data-sandbox|data-sample)\//.test(f) && !BOOKKEEPING.has(f);

/**
 * Each chat's harness commits since DEV-020 began, newest first, keyed by the
 * normalised chat id from the commit's "Claude-Session:" trailer. Merges are
 * left out: a merge carries others' work, not the chat's own. A bare --since
 * date is read by git as that date at the current time of day, dropping every
 * commit made earlier that day, so it is pinned to midnight UTC.
 */
export function harnessCommitsByChat({ days = 30 } = {}) {
  try {
    return byChatFromLog(run(historyArgs(days)).out);
  } catch (err) {
    if (err instanceof HistoryUnreadable && unbornHead(run)) return new Map();
    throw err;
  }
}

// A repository with no commit yet, a new copy before its first (new-copy.mjs),
// has no history to owe a review from: `git log` fails there, and that is "none
// yet", not "unread". Asked only once the log has failed, and only exit 1 of
// --verify means it; a folder that is no repository fails with 128 and the log's
// own failure stands.
const unbornHead = (git) => {
  try {
    return git(['rev-parse', '--verify', '--quiet', 'HEAD'], [1]).code === 1;
  } catch {
    return false;
  }
};
const unbornHeadAsync = async () => {
  try {
    return (await runAsync(['rev-parse', '--verify', '--quiet', 'HEAD'], [1])).code === 1;
  } catch {
    return false;
  }
};

function historyArgs(days) {
  const since = [REVIEW_RULE_SINCE, new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)].sort().pop();
  return ['log', '--no-merges', `--since=${since}T00:00:00Z`, '--format=%x00%H%x01%(trailers:key=Claude-Session,valueonly)', '--name-only'];
}

function byChatFromLog(log) {
  const byChat = new Map();
  for (const chunk of log.split('\0').slice(1)) {
    const [head, ...files] = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    const [hash, trailer = ''] = (head ?? '').split('\x01');
    if (!/claude\.ai/.test(trailer) || !files.some(isHarnessWork)) continue;
    const id = normChat(trailer);
    if (!byChat.has(id)) byChat.set(id, []);
    byChat.get(id).push(hash);
  }
  return byChat;
}

/**
 * The commit a chat's latest review was made at: of its lines in the review
 * ledger, the one every other is an ancestor of, whatever order the lines sit
 * in. A line naming a commit this repository lacks is ignored.
 */
export function latestReview(chat, reviews = parseReviews().reviews, ancestor = isAncestor, exists = commitExists) {
  const me = normChat(chat);
  const at = reviews.filter((d) => normChat(d.chat) === me).map((d) => d.commit).filter(exists);
  return at.find((c) => at.every((o) => ancestor(o, c))) ?? at[0] ?? '';
}

// Whether every commit is an ancestor of `reviewed` (or is it), asked of git in a few calls:
// `rev-list <commits> ^<reviewed>` lists what reaches past the review, so nothing listed
// is the same answer as one `merge-base --is-ancestor` per commit. One call each made a
// covered chat of several hundred commits cost about 30 s a read, and the self-test, which
// reads it five times, passed its limit (2026-11-02, a long chat's review recorded).
const COVER_BATCH = 400;
const coverArgs = (part, reviewed) => ['rev-list', '--max-count=1', ...part, `^${reviewed}`];
function allCovered(commits, reviewed) {
  for (let i = 0; i < commits.length; i += COVER_BATCH) {
    if (run(coverArgs(commits.slice(i, i + COVER_BATCH), reviewed)).out.trim()) return false;
  }
  return true;
}
async function allCoveredAsync(commits, reviewed) {
  for (let i = 0; i < commits.length; i += COVER_BATCH) {
    if ((await runAsync(coverArgs(commits.slice(i, i + COVER_BATCH), reviewed))).out.trim()) return false;
  }
  return true;
}

/** Whether a chat's harness commits are all covered by its latest review. */
export function reviewCovers(commits, reviewed, ancestor = isAncestor) {
  if (!reviewed) return false;
  return ancestor === isAncestor ? allCovered(commits, reviewed) : commits.every((c) => ancestor(c, reviewed));
}

/**
 * Chats that committed to the harness and whose end-of-session review never
 * landed, or landed before later work (DEV-020): read from pushed history, so
 * a chat reclaimed before its review is still found. The chat asking is left out.
 * Throws HistoryUnreadable when git cannot be read; owedReviewsRead() says so.
 */
export function owedReviews({ days = 30, exclude = '' } = {}) {
  const self = normChat(exclude);
  const { reviews } = parseReviews();
  return [...harnessCommitsByChat({ days })]
    .filter(([id]) => id && id !== self)
    .filter(([id, commits]) => !reviewCovers(commits, latestReview(id, reviews)))
    .map(([id]) => id);
}

/**
 * owedReviews() for a view or a notice: { chats, unreadable }, where unreadable
 * is why history could not be read ('' when it was), so "none owed" and "could
 * not tell" never look alike.
 */
export function owedReviewsRead(options) {
  try {
    return { chats: owedReviews(options), unreadable: '' };
  } catch (err) {
    if (err instanceof HistoryUnreadable) return { chats: [], unreadable: err.message };
    throw err;
  }
}

// The same answer as owedReviews(), each git call awaited instead of blocking,
// for a server that must keep answering while history is read. Chats are read
// side by side, their git calls a few at a time (runAsync's pool); within one, calls stay in order so the first "no" still ends it.
async function everyAsync(items, test) {
  for (const item of items) if (!(await test(item))) return false;
  return true;
}

// Kept per commit rather than per HEAD (2026-10-07: about 5 s of these calls on the
// dashboard list's first load after every commit, which other chats make often). Whether one
// commit is an ancestor of another never changes once both are named by their full hash, and
// a commit once found stays held, so only those answers are kept, for the server's life; a
// name not yet found is asked again each time, so a fetch that brings it in is seen.
const FULL = /^[0-9a-f]{40}$/;
const ancestry = new Map();
const fullOf = new Map();
const isAncestorAsync = async (a, b) => {
  const key = `${a}..${b}`;
  if (ancestry.has(key)) return ancestry.get(key);
  const yes = (await runAsync(['merge-base', '--is-ancestor', a, b], [1])).code === 0;
  if (FULL.test(a) && FULL.test(b)) ancestry.set(key, yes);
  return yes;
};
/** The full hash `hash` names, or '' when this repository holds no such commit. */
const commitFullAsync = async (hash) => {
  if (fullOf.has(hash)) return fullOf.get(hash);
  const { code, out } = await runAsync(['rev-parse', '--verify', '--quiet', `${hash}^{commit}`], [1]);
  const full = code === 0 ? out.trim() : '';
  if (FULL.test(full)) fullOf.set(hash, full);
  return full;
};

async function latestReviewAsync(chat, reviews) {
  const me = normChat(chat);
  const named = reviews.filter((d) => normChat(d.chat) === me).map((d) => d.commit);
  const full = await Promise.all(named.map(commitFullAsync));
  const at = full.filter(Boolean);
  for (const c of at) if (await everyAsync(at, (o) => isAncestorAsync(o, c))) return c;
  return at[0] ?? '';
}

/** owedReviewsRead() without blocking: resolves to { chats, unreadable }. */
export async function owedReviewsReadAsync({ days = 30, exclude = '' } = {}) {
  try {
    const self = normChat(exclude);
    const { reviews } = parseReviews();
    const history = await runAsync(historyArgs(days)).then(
      ({ out }) => out,
      async (err) => {
        if (err instanceof HistoryUnreadable && (await unbornHeadAsync())) return '';
        throw err;
      },
    );
    const chats = [...byChatFromLog(history)].filter(([id]) => id && id !== self);
    const owed = await Promise.all(
      chats.map(async ([id, commits]) => {
        const reviewed = await latestReviewAsync(id, reviews);
        return !reviewed || !(await allCoveredAsync(commits, reviewed));
      }),
    );
    return { chats: chats.filter((_, i) => owed[i]).map(([id]) => id), unreadable: '' };
  } catch (err) {
    if (err instanceof HistoryUnreadable) return { chats: [], unreadable: err.message };
    throw err;
  }
}
