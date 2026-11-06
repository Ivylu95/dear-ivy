// Rule tests for lib/for-you.mjs: the parser behind the dev menu's "For you"
// lines and count, the for-you check (A-152, DEV-013, DEV-014), and the review
// ledger owed reviews are read from (DEV-020). Run by selftest.mjs.

import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseForYou, parseReviews, forYouMenu, overdue, owedReviews, owedReviewsRead, owedReviewsReadAsync, latestReview, reviewCovers, commitExists, isAncestor, HistoryUnreadable } from '../lib/for-you.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';

// 2026-11-02: with history past Node's 1 MiB output default, an awaited read never
// settled, Node exited with nothing printed and status 0, and the selftest read that
// as a pass. Ending before the report is a failure.
let reported = false;
process.on('exit', (code) => {
  if (!reported && code === 0) {
    console.error('test-for-you: ended before reporting its cases (an await that never settled)');
    process.exitCode = 1;
  }
});

// History that cannot be read: git pointed at a folder that is no repository
// (and kept from finding one above it or through the gate's own GIT_ vars).
function unreadHistory(fn) {
  const dir = makeTemp('for-you-nogit-');
  const saved = { ...process.env };
  for (const k of Object.keys(process.env)) if (/^GIT_(?!CONFIG_)/.test(k)) delete process.env[k];
  process.env.DEAR_GIT_ROOT = dir;
  process.env.GIT_CEILING_DIRECTORIES = dirname(dir);
  try {
    return fn();
  } catch (err) {
    return err;
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    rmSync(dir, { recursive: true, force: true });
  }
}
const unread = (v) => v instanceof HistoryUnreadable;

// History where a review IS owed: an invented repository with one chat's
// harness commit and no review, and one chat whose only commit is to a record
// (owes nothing). Against the live repository the async and sync reads agree
// trivially whenever nothing is owed, so they are compared here as well.
const OWED_CHAT = 'owedtest0001';
async function owedHistory(fn) {
  const dir = makeTemp('for-you-owed-');
  const saved = { ...process.env };
  for (const k of Object.keys(process.env)) if (/^GIT_(?!CONFIG_)/.test(k)) delete process.env[k];
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'ignore', windowsHide: true });
  const commit = (file, chat) => {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), `${chat}\n`);
    git('add', file);
    git('-c', 'user.name=test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '-m', 'work', '-m', `Claude-Session: https://claude.ai/code/session_${chat}`);
  };
  try {
    git('init', '-q');
    commit('.claude/owed.md', OWED_CHAT);
    commit('data/core/note.md', 'recordonly0001');
    process.env.DEAR_GIT_ROOT = dir;
    process.env.GIT_CEILING_DIRECTORIES = dirname(dir);
    return await fn();
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    rmSync(dir, { recursive: true, force: true });
  }
}
const owedBoth = await owedHistory(async () => ({ sync: owedReviewsRead(), async: await owedReviewsReadAsync() }));

// 2026-11-02: whether a review covers a chat's commits is asked of git in one batch, not one
// call per commit (about 30 s a read for a long chat's covered review). The batch must give
// the per-commit answer: covered, a commit past the review, a side branch, and many at once.
const coverCases = await owedHistory(async () => {
  const dir = process.env.DEAR_GIT_ROOT;
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true }).trim();
  const id = (...a) => git('-c', 'user.name=test', '-c', 'user.email=test@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'w', ...a) || git('rev-parse', 'HEAD');
  const base = git('rev-parse', 'HEAD');
  const run = [];
  for (let i = 0; i < 450; i += 1) run.push(id());
  const review = git('rev-parse', 'HEAD');
  const after = id();
  git('checkout', '-q', '-b', 'side', base);
  const side = id();
  const perCommit = (c, r) => reviewCovers(c, r, (a, b) => isAncestor(a, b));
  return [
    [run, review], [[...run, after], review], [[base, side], review], [[after], review], [[review], review],
  ].map(([c, r]) => [reviewCovers(c, r), perCommit(c, r)]);
});

// A repository with no commit yet (a new copy before its first commit) has no
// history: nothing is owed, and it is read, not unread.
async function unbornHistory(fn) {
  const dir = makeTemp('for-you-unborn-');
  const saved = { ...process.env };
  for (const k of Object.keys(process.env)) if (/^GIT_(?!CONFIG_)/.test(k)) delete process.env[k];
  try {
    execFileSync('git', ['init', '-q'], { cwd: dir, stdio: 'ignore', windowsHide: true });
    process.env.DEAR_GIT_ROOT = dir;
    process.env.GIT_CEILING_DIRECTORIES = dirname(dir);
    return await fn();
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
    rmSync(dir, { recursive: true, force: true });
  }
}
const unbornBoth = await unbornHistory(async () => ({ sync: owedReviewsRead(), async: await owedReviewsReadAsync() }));

const text = [
  '# For you',
  '',
  'A header line of prose is not an item.',
  '',
  '- for-you · Should the nudge go quiet on Sundays? · opened 2026-09-29 · chat cse_abc',
  '- for-you · Shall the spec graph fit a phone? · opened 2026-10-10 · chat none · pick yes · asked 2026-11-01',
].join('\n');
const { items, problems } = parseForYou(text);
const refused = (line) => parseForYou(`# For you\n\n${line}`).problems;
const menu = forYouMenu(items);

const cases = [
  ['reads every for-you line, with its pick and the day it was put to him', items.length === 2 && !problems.length && items[1].pick === 'yes' && items[1].asked === '2026-11-01'],
  ['refuses a task: it is done or dropped, never kept (A-178)', refused('- for-you · Pick up: the spec graph at phone width · opened 2026-10-10 · chat none').some((p) => /a task, not a question/.test(p))],
  ['refuses a line out of format', refused('- maybe · Loose line · chat x').length === 1],
  // A-152: there is no backlog, so the old kinds of line are refused by name.
  ['refuses a to-do line: work is finished or dropped, not kept', /no backlog/.test(refused('- to-do · A thing · opened 2026-09-29 · chat none')[0] ?? '')],
  ['refuses a done line: git history keeps what was done', /no backlog/.test(refused('- done 2026-09-30 · Finished · commit abc1234 · chat cse_abc')[0] ?? '')],
  ['refuses an in-progress line', refused('- in-progress · Half built · opened 2026-09-29 · chat none').length === 1],
  ['refuses the old waiting-on-you line until it is reworded', refused('- waiting-on-you · Another · opened 2026-09-29 · chat none').length === 1],
  ['refuses a for-you line with no chat', refused('- for-you · A question? · opened 2026-09-29').length === 1],
  ['the dev menu shows every item, in full', menu.length === 3 && items.every((i) => menu.some((l) => l.includes(i.what)))],
  ['the dev menu shows nothing when nothing waits', forYouMenu([]).length === 0],
  ['reads the review ledger', (() => {
    const r = parseReviews('# Session reviews\n\n- reviewed 2026-10-29 · commit abc1234 · chat cse_x\n- reviewed soon · commit · chat');
    return r.reviews.length === 1 && r.reviews[0].commit === 'abc1234' && r.problems.length === 1;
  })()],
  ['flags a question waiting over two weeks', overdue(items, new Date('2026-10-20')).length === 1],
  ['reads owed reviews from history without failing', Array.isArray(owedReviews())],
  // 2026-11-02: a month of history passed Node's 1 MiB output default and read as unreadable.
  // Read in a fresh process, as a hook reads it: this one's state hid the failure.
  ['this repository\'s whole history is read, never unreadable however long', execFileSync(process.execPath, ['--input-type=module', '-e', `import { owedReviewsRead } from ${JSON.stringify(new URL('../lib/for-you.mjs', import.meta.url).href)}; process.stdout.write(owedReviewsRead().unreadable || 'read');`], { encoding: 'utf8', timeout: 60000 }) === 'read'],
  // The admin view reads the async variant; it must never tell a different story.
  ['the async read gives the hooks\' answer', JSON.stringify(await owedReviewsReadAsync()) === JSON.stringify(owedReviewsRead())],
  // Its answers are kept per commit (2026-10-07, 5 s a load): a second read, served from them, says the same.
  ['a second async read, from the kept answers, still gives the hooks\' answer', JSON.stringify(await owedReviewsReadAsync()) === JSON.stringify(owedReviewsRead())],
  ['a review owed is found, and only the harness chat owes one', JSON.stringify(owedBoth.sync) === JSON.stringify({ chats: [OWED_CHAT], unreadable: '' })],
  ['the async read finds the same owed review', JSON.stringify(owedBoth.async) === JSON.stringify(owedBoth.sync)],
  ['a review\'s cover, asked in one batch, gives the per-commit answer in every case', JSON.stringify(coverCases) === JSON.stringify([[true, true], [false, false], [false, false], [false, false], [true, true]])],
  ['a repository with no commit yet owes nothing and is not unread', JSON.stringify(unbornBoth.sync) === JSON.stringify({ chats: [], unreadable: '' }) && JSON.stringify(unbornBoth.async) === JSON.stringify(unbornBoth.sync)],
  ['a line that would be skipped is a problem, not silence', refused('* a bullet of the wrong kind').length === 1],
  ['the same item listed twice is a warning', parseForYou('- for-you · A? · opened 2026-09-29 · chat none\n- for-you · A? · opened 2026-09-29 · chat none').warnings.length === 1],
  ['a question opened today is not stale', overdue(items, new Date('2026-09-29T12:00:00Z')).length === 0],
  ['the newest review wins whatever the line order', latestReview('cse_x', [
    { commit: 'c1', chat: 'cse_x' },
    { commit: 'c3', chat: 'session_x' },
  ], (a, b) => a <= b, () => true) === 'c3'],
  ['work after the review owes it again', !reviewCovers(['c4', 'c2'], 'c3', (a, b) => a <= b)],
  ['a review covering every commit clears it', reviewCovers(['c3', 'c2'], 'c3', (a, b) => a <= b)],
  ['a commit this repository lacks is "no", not unread', commitExists('0000000') === false],
  ['history unread is not "no review owed"', unread(unreadHistory(() => owedReviews()))],
  ['history unread is not "no such commit"', unread(unreadHistory(() => commitExists('abc1234')))],
  ['history unread is not "not covered"', unread(unreadHistory(() => isAncestor('abc1234', 'def5678')))],
  ['the view and the notices are told history was unread', (() => {
    const r = unreadHistory(() => owedReviewsRead());
    return r.chats?.length === 0 && /^git log (failed|gave no answer)/.test(r.unreadable);
  })()],
];
reported = true;
let failed = 0;
for (const [what, ok] of cases) {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
