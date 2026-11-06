// The end-of-session review's state (DEV-020), read from pushed history.
//
// A development session that changed the harness owes a review before it
// closes: what it learnt becomes checks and, with the developer's yes, spec
// rows (the retrospective skill). Until the review is done, every development
// reply names it; once it is done, the next reply confirms everything is
// settled and the chat can close. Work that reaches the harness after the
// review makes it owed again.
//
// Judged from what is pushed, not from this machine: the chat's own harness
// commits (their Claude-Session trailer) and the review's line in the review
// ledger (dev/session-reviews.md), which names the commit it was made at. A marker on this machine was
// lost with the machine and grew with every path a merge named, so a finished
// review read as owed again (2026-09-30). Only the one-time "all settled"
// announcement is remembered locally. Uncommitted harness edits by this chat
// still count, so a review is owed before they are committed too.
//
// Run directly, `node .claude/hooks/lib/dev-review.mjs done` records the
// review as done: it adds the review's line to the ledger (commit and push it).
// `done <chat id>` records a review run here for an earlier chat's commits.

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { markerRead, markerWrite, repoRoot } from './hook.mjs';
import { SESSION_REVIEWS, normChat, harnessCommitsByChat, latestReview, isAncestor, HistoryUnreadable } from './for-you.mjs';
import { sessionId } from './sandbox.mjs';
import { touchedBy, touchedAt, inRecord } from './touched.mjs';

const marker = (input) => `dev-review-${String(sessionId(input) || 'unknown').replace(/[^\w-]/g, '')}`;

const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};
const chatOf = (input) => normChat(sessionId(input));

/** This chat's harness commits, newest first: one reading of history, shared with owedReviews. */
export function harnessCommits(input) {
  return harnessCommitsByChat().get(chatOf(input)) ?? [];
}

/**
 * Whether any modified path is this chat's own unsaved change, pure for the
 * tests. A path counts when this chat touched it (or a folder above it) after
 * the path's last commit: once this chat's edit is committed, a later change
 * there is another chat's sharing the tree, not this one's (2026-10-03, a
 * review read as owed for another chat's edit). A touch with no time (recorded
 * before times were kept) still counts, the safe direction. committedAt gives
 * a path's last commit in ms, 0 when it has none.
 *
 * An untracked path is claimed by a touch of itself or of anything inside it,
 * or by a touch of the folder it sits in made within WRITE_WINDOW_MS after the
 * path was last written: the command that put it there. A shell command
 * records every word that names a path, reads included, so "dev" in a grep
 * and an ls of dev/specs each claimed another chat's new files there
 * (2026-10-06, a review owed again after it was done). A modified tracked
 * file still counts under any folder. modifiedAt gives a path's mtime in ms.
 */
const WRITE_WINDOW_MS = 60_000;

export function ownUncommitted({ dirty, untracked = new Set(), touched, touchedAt = new Map(), committedAt, modifiedAt = () => 0 }) {
  return dirty.some((p) => {
    if (inRecord(p)) return false;
    const parent = p.replace(/\/?[^/]+$/, '');
    const putThere = (t) => {
      const at = touchedAt.get(t);
      if (typeof at !== 'number') return true;
      const written = modifiedAt(p);
      return written <= at && at - written < WRITE_WINDOW_MS;
    };
    const claims = (t) =>
      p === t ||
      (untracked.has(p) ? t.startsWith(`${p}/`) || (t === parent && putThere(t)) : p.startsWith(`${t}/`));
    const by = [...touched].filter(claims);
    if (!by.length) return false;
    const times = by.map((t) => touchedAt.get(t));
    if (times.some((ms) => typeof ms !== 'number')) return true;
    return Math.max(...times) > committedAt(p);
  });
}

/** This chat's uncommitted harness edits: touched here, after their last commit, and still modified. */
function uncommittedHarness(input) {
  // The touched list is keyed by the hook payload's session id (the local one),
  // not the remote chat id sessionId() prefers: read it by the same key.
  const session = input?.session_id || process.env.CLAUDE_CODE_SESSION_ID || '';
  const lines = git(['status', '--porcelain']).split('\n').filter((l) => l.trim());
  // An untracked folder is listed with a trailing slash; drop it so it compares as a path.
  const path = (l) => l.slice(3).trim().replace(/\/$/, '');
  const dirty = lines.map(path);
  const untracked = new Set(lines.filter((l) => l.startsWith('??')).map(path));
  // git dates a commit to the second: the commit counts as the end of its second,
  // so a touch in the same second as the commit is read as before it.
  const committedAt = (p) => {
    const s = Number(git(['log', '-1', '--format=%ct', '--', p]).trim());
    return s ? (s + 1) * 1000 - 1 : 0;
  };
  const modifiedAt = (p) => {
    try {
      return statSync(join(repoRoot, p)).mtimeMs;
    } catch {
      return 0;
    }
  };
  return ownUncommitted({ dirty, untracked, touched: touchedBy(session), touchedAt: touchedAt(session), committedAt, modifiedAt });
}

const reviewedAt = (input) => latestReview(chatOf(input));

/**
 * The decision, pure for the tests: 'none' (nothing to review) · 'owed' ·
 * 'confirm' (done, not yet announced) · 'settled'. reviewState() adds
 * 'unreadable' when git history could not be read.
 */
export function decide({ commits, reviewed, coveredBy, uncommitted, confirmed }) {
  if (!commits.length && !uncommitted) return 'none';
  if (!reviewed || uncommitted || commits.some((c) => !coveredBy(c, reviewed))) return 'owed';
  return confirmed ? 'settled' : 'confirm';
}

export function reviewState(input) {
  let local = {};
  try {
    local = JSON.parse(markerRead(marker(input)) || '{}');
  } catch {
    local = {};
  }
  // History that could not be read is its own state, never 'none' or 'settled'.
  try {
    const reviewed = reviewedAt(input);
    return decide({
      commits: harnessCommits(input),
      reviewed,
      coveredBy: isAncestor,
      uncommitted: uncommittedHarness(input),
      confirmed: Boolean(local.confirmed && local.reviewed === reviewed),
    });
  } catch (err) {
    if (err instanceof HistoryUnreadable) return 'unreadable';
    throw err;
  }
}

/** Adds the review's line to the review ledger, made at this chat's current commit. */
export function reviewDone(input, chat = '') {
  const head = git(['rev-parse', '--short', 'HEAD']).trim();
  // A review run here for an earlier chat's commits is recorded under that chat,
  // or its owed review never clears.
  const id = chat || sessionId(input);
  const line = `- reviewed ${new Date().toISOString().slice(0, 10)} · commit ${head} · chat ${id}`;
  const text = readFileSync(SESSION_REVIEWS, 'utf8');
  writeFileSync(SESSION_REVIEWS, `${text.replace(/\n*$/, '\n')}${line}\n`);
  if (!chat) markerWrite(marker(input), JSON.stringify({ reviewed: head, confirmed: false }));
  return line;
}

export function reviewConfirmed(input) {
  markerWrite(marker(input), JSON.stringify({ reviewed: reviewedAt(input), confirmed: true }));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv[2] === 'owed') {
    const { owedReviewsRead } = await import('./for-you.mjs');
    const { chats, unreadable } = owedReviewsRead({ exclude: sessionId({}) });
    console.log(unreadable ? `reviews owed: unknown, history unreadable (${unreadable})` : chats.join('\n') || 'reviews owed: none');
    process.exit(0);
  }
  if (process.argv[2] !== 'done') {
    console.log(`end-of-session review: ${reviewState({})}`);
    process.exit(0);
  }
  if (!sessionId({})) {
    console.error('dev-review: no session id in the environment, so nothing was recorded.');
    process.exit(1);
  }
  const line = reviewDone({}, process.argv[3] ?? '');
  console.log(`recorded in the review ledger: ${line}\ncommit and push dev/session-reviews.md so the review counts everywhere`);
}
