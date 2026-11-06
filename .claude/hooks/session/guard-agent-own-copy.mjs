// PreToolUse(Bash) — a subagent commits from its own worktree, never from a checkout
// another session or agent is working in (DEV-017 design 6, 2026-11-04).
//
// On 3 Nov two of one chat's agents shared the main checkout: a live index.lock, a pull
// blocked by the other's half-written files, six stray .merge_file_* copies. Five later
// agents, each in its own worktree, never collided. lib/shared-tree.mjs says how a
// subagent and another writer are told apart, and why git's own gate cannot.
//
// Refused: a `git commit` from inside a subagent (the hook input carries `agent_id`),
// run in a checkout that is not a linked worktree, while another writer (another
// session, another agent, or the chat that started it) has written there in the last
// half hour. Never refused: the chat's own commits (no `agent_id`); her record's saves,
// a commit naming or staging only data/ (a save is never lost to this rule); anything in
// a linked worktree; a heartbeat or scheduled job running alone (no other writer); and
// any other git command. Never fails a call: what it cannot read, it passes.
// Proven by lib/test-agent-own-copy.mjs and the selftest's cases for this hook.

import { relative, resolve } from 'node:path';
import { pass, readHookInput, refuse } from '../lib/hook.mjs';
import { recordOnly, stagedNames } from '../lib/refused-staged.mjs';
import { checkoutOf, commitDir, isLinkedWorktree, namedPaths, otherWriters, readWriters } from '../lib/shared-tree.mjs';

const input = await readHookInput();
const agent = input?.agent_id;
if (!agent) pass();
const command = String(input?.tool_input?.command ?? '');
const cwd = input?.cwd || process.cwd();
const dir = commitDir(command, cwd);
if (!dir) pass();
const root = checkoutOf(dir);
if (!root || isLinkedWorktree(root)) pass();

// Her record's saves pass whatever else is true.
let carried = namedPaths(command).map((p) => relative(root, resolve(dir, p)).replace(/\\/g, '/'));
if (!carried.length) {
  try {
    carried = stagedNames(root);
  } catch {}
}
if (carried.length && recordOnly(carried)) pass();

const others = otherWriters({ session: input?.session_id, agent, root, writers: readWriters() });
if (!others.length) pass();

const who = others.map((w) => (w.session === input?.session_id ? (w.agent === 'main' ? 'the chat that started you' : 'another agent of your chat') : 'another session')).filter((w, i, a) => a.indexOf(w) === i);
refuse(
  'PreToolUse',
  `Refused: you are a subagent committing in the shared checkout ${root}, where ${who.join(' and ')} also wrote in the last half hour (DEV-017 design 6). ` +
    'Agents sharing one checkout collided three ways on 3 Nov: a live index.lock, a pull blocked by half-written files, stray .merge_file_* copies. ' +
    'Do not delete, stash or revert anything. Leave your files as they are and hand back naming each one, so the chat that started you commits them; ' +
    'or do the work again in your own worktree (`git worktree add <your scratchpad>/wt -b <name> origin/main`) and commit and push from there. ' +
    'Her record\'s saves (data/ only) are never refused.',
);
