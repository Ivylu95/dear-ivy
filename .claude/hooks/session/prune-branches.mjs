#!/usr/bin/env node
// Brings this copy and GitHub into agreement, at session start.
//
// DEP-011, "Main is the only branch that lasts: every other is cleared once its work
// is in main, on the remote and on every machine." This is that, every time a
// session opens, wherever it opens (a desk, an editor, the web, a phone): main
// caught up and pushed, chat and record branches on GitHub merged into main, idle
// run and detached-rescue branches retired into it, a person's own branch listed
// and removed, finished local branches and worktrees cleared. The rules, and why
// none of it can lose a commit, are in lib/branches.mjs (reconcile, shared with
// the end of every turn and the on-demand step, WKB-015). The GitHub workflow
// (.github/workflows/merge-sessions.yml) does the same on the remote when Actions
// run, and is no longer what this depends on: it stopped on 2026-10-13.
//
// Git is never the person's concern. Whatever is fixed is fixed silently; only
// what needs a judgement (a conflict) is handed to the agent, for it to settle
// in this session without asking anyone, and in one of her chats without a
// word about it (CON-013).
//
// Under the hook selftest (DEAR_RECORD_READONLY) it touches only this machine's
// finished branches, never GitHub: the selftest runs on the live repository.

import { clearFinished, mergeSigned, reconcile, runner, stillHalfDone } from '../lib/branches.mjs';
import { context, dataDir, pass, repoRoot } from '../lib/hook.mjs';
import { CORE_DATA } from '../lib/modules.mjs';
import { relative } from 'node:path';

if (process.env.DEAR_RECORD_READONLY === '1') {
  clearFinished(runner(repoRoot));
  pass();
}

let result;
try {
  result = reconcile(repoRoot, { budgetMs: 240000 }); // inside the 300s timeout settings.json gives this hook
} catch {
  pass(); // A session that cannot start is worse than an untidy one; the next turn tries again.
}

const toSettle = result.left.filter((l) => !l.quiet);

// DEP-006, "A failure to save is never silent.": a session or rescue branch on
// GitHub still outside main after the pass (GitHub would not take a push to
// main from here, or the pass ran out of time) holds saves no later session
// reads. Checked on the refs the pass just fetched, so a branch it merged is
// never named. One that conflicts is already in toSettle.
const g = runner(repoRoot);
const current = g.out(['rev-parse', '--abbrev-ref', 'HEAD']).trim();

// The session brief merged main into this chat's branch before the pass above landed other
// branches into main, and those are no longer named below once they are in main: the chat
// read a record without another chat's saved words until its first turn's save brought main
// in, and was never told (round 49). So main, as the pass left it, is merged in here too, the
// session brief's way (its own merge undone if it stops), and the chat told to read again.
const caughtUp = [];
if (current.startsWith('claude/') && !stillHalfDone(g, repoRoot) && g.ok(['rev-parse', '-q', '--verify', 'origin/main']) && !g.ok(['merge-base', '--is-ancestor', 'origin/main', 'HEAD'])) {
  const before = g.out(['rev-parse', 'HEAD']).trim();
  // The record this chat reads: in the sandbox, data-sandbox/, never hers (round 50: a
  // resumed test chat was sent to read data/core/state/now.md, her real snapshot).
  const rec = relative(repoRoot, dataDir).replace(/\\/g, '/');
  const ident = g.out(['config', 'user.email']).trim() ? [] : ['-c', 'user.name=dear', '-c', 'user.email=dear@localhost'];
  if (mergeSigned(g, repoRoot, [...ident, 'merge', '-q', '--no-edit', '-m', 'merge: main into this session', 'origin/main'], 'origin/main')) {
    if (g.out(['diff', '--name-only', before, 'HEAD', '--', `${rec}/`]).trim()) {
      caughtUp.push(`Saves made in another chat reached main during this start, after the snapshot above was read, and are now in this copy: read ${rec}/${CORE_DATA}/state/now.md and the newest lines of the timeline again before replying, and keep to them.`);
    }
  } else {
    caughtUp.push(`Main could not be merged into this chat's branch, so saves made in other chats may be missing here; the save at this turn's end tries again. Until then, read them with \`git log HEAD..origin/main -- ${rec}/\` if the record seems to lack something.`);
  }
}
// Never the branch this folder is on while its GitHub copy is already here; one
// behind it lacks words saved from elsewhere, and is named (review, 2026-10-16;
// a chat's own branch too, round 29).
const hereAlready = (b) => b === current && g.ok(['merge-base', '--is-ancestor', `origin/${b}`, 'HEAD']);
const stranded = g
  .out(['branch', '-r', '--no-merged', 'origin/main', '--format=%(refname:short)', '--list', 'origin/claude/*', 'origin/rescue/main-*', 'origin/rescue/claude-*'])
  .split(/\r?\n/)
  .filter((r) => r && !hereAlready(r.replace(/^origin\//, '')) && !toSettle.some((l) => l.what.includes(r.replace(/^origin\//, ''))));
// Her words on a branch beside someone's unfinished harness work: saved on
// GitHub, not yet in main, and landed only with that work (review, 2026-10-16).
for (const l of result.left) if (l.savesOff && !hereAlready(l.savesOff) && !stranded.includes(`origin/${l.savesOff}`)) stranded.push(`origin/${l.savesOff}`);

if (!toSettle.length && !stranded.length && !caughtUp.length) pass();
context(
  'SessionStart',
  [
    'GIT, FOR THE AGENT ONLY — never raise it in her chat, never ask the developer about it. Git is yours to keep in order (main is the only branch; merge, never rebase or force).',
    // Round 54 (2026-11-02): a sent-log conflict settled by taking main's copy whole dropped the
    // other side's sent marks. The rule is repair.md's, said where the conflict is handed over.
    ...(toSettle.length ? ['Settle each of these now, silently, then run `npm --prefix ux run git:reconcile` to finish. A conflict inside her record is settled by merging and keeping both sides (every line or entry from each, as .claude/memory/settling-a-record-merge-without-reading-history.md says), never by taking one side whole; `PUSH_FAILED.md` takes main\'s side; any other conflict: `git merge --abort`, and leave it as a note for the developer.', ...toSettle.map((l) => `  - ${l.what}: ${l.why}. Settle: ${l.command}`)] : []),
    ...caughtUp,
    ...(stranded.length
      ? [`Not yet in main, so what was saved there is missing here until it is: ${stranded.join(', ')}. A chat's or rescue's are merged as soon as GitHub takes a push to main from a session; one beside unfinished harness work lands with that work. Read them with \`git log origin/main..<branch>\` if the record seems to lack something.`]
      : []),
  ].join('\n'),
);
