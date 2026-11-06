// Rule test for session/guard-agent-own-copy.mjs and lib/shared-tree.mjs (DEV-017 design 6):
// a subagent commits from its own worktree, never from a checkout another writer is
// working in. On 3 Nov two of one chat's agents shared the main checkout and collided
// three ways (a live index.lock, a blocked pull, six stray .merge_file_* copies).
// Each case runs the hook as Claude Code does, a payload on stdin, against a scratch
// repository, a worktree of it, and a state folder of its own. Run by selftest.mjs.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from './temp-litter.mjs';
import { ACTIVE_MS, commitDir, namedPaths, otherWriters, readWriters } from './shared-tree.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const guard = join(here, '..', 'session', 'guard-agent-own-copy.mjs');
const tracker = join(here, '..', 'session', 'track-touched.mjs');

const dir = realpathSync(makeTemp('dear-agent-own-copy-'));
const git = (cwd, ...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', ...a], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const main = join(dir, 'main');
mkdirSync(join(main, 'data'), { recursive: true });
git(main, 'init', '-q', '-b', 'main');
git(main, 'config', 'core.hooksPath', '/dev/null');
writeFileSync(join(main, 'base.txt'), 'x\n');
git(main, 'add', 'base.txt');
git(main, 'commit', '-qm', 'base');
const wt = join(dir, 'wt');
git(main, 'worktree', 'add', '-q', '-b', 'side', wt);

// A state folder per case, so no case reads another's stamps.
let n = 0;
const project = (writers) => {
  n += 1;
  const proj = join(dir, `proj-${n}`);
  const state = join(proj, '.claude', 'hooks', 'state');
  mkdirSync(state, { recursive: true });
  writers.forEach((w, i) => writeFileSync(join(state, `writer-case${i}.json`), JSON.stringify({ session: w.session, agent: w.agent, roots: { [w.root]: w.at ?? Date.now() } })));
  return proj;
};
const run = (file, payload, proj) => {
  const r = spawnSync(process.execPath, [file], { input: JSON.stringify(payload), encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: proj, DEAR_HOOK_STRICT: '1' } });
  if (r.status !== 0) return `crashed: ${r.stderr}`;
  try {
    return JSON.parse(r.stdout).hookSpecificOutput?.permissionDecision ?? 'pass';
  } catch {
    return r.stdout.trim() ? `unreadable: ${r.stdout}` : 'pass';
  }
};

let failed = 0;
const check = (what, got, want) => {
  const ok = got === want;
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` (got ${got}, wanted ${want})`}`);
};

const S = 'chat-1';
const commit = (command, cwd, agent = 'agent-a') => ({ session_id: S, ...(agent && { agent_id: agent }), cwd, tool_name: 'Bash', tool_input: { command } });
const sibling = { session: S, agent: 'agent-b', root: main };
const ownChat = { session: S, agent: 'main', root: main };
const otherChat = { session: 'chat-2', agent: 'main', root: main };

// The incident: a second agent of the same chat is writing in the main checkout.
check('the incident: a subagent commit in the main checkout, another agent of its chat writing there, is refused', run(guard, commit('git commit -F msg -- dev/x.md', main), project([sibling])), 'deny');
check('so is one while the chat that started it is writing there', run(guard, commit('git commit -m x -- dev/x.md', main), project([ownChat])), 'deny');
check('and one while another session is writing there', run(guard, commit('git commit -m x', main), project([otherChat])), 'deny');
check('reached by cd from a worktree, still refused', run(guard, commit(`cd ${main} && git commit -m x -- dev/x.md`, wt), project([sibling])), 'deny');
check('reached by git -C, still refused', run(guard, commit(`git -C ${main} commit -m x`, wt), project([sibling])), 'deny');

// Never refused.
check("the main chat's own commit in its own checkout passes", run(guard, commit('git commit -m x -- dev/x.md', main, null), project([sibling, otherChat])), 'pass');
check("her record's save, named data/ paths, passes", run(guard, commit('git commit -m "record: update the timeline" -- data/core/timeline.md', main), project([sibling, otherChat])), 'pass');
writeFileSync(join(main, 'data', 'note.md'), 'x\n');
git(main, 'add', 'data/note.md');
check("her record's save, data/ only staged, passes", run(guard, commit('git commit -m "record: a journal entry"', main), project([sibling, otherChat])), 'pass');
git(main, 'reset', '-q');
check('a subagent commit in its own worktree passes, whoever writes elsewhere', run(guard, commit('git commit -F msg -- dev/x.md', wt), project([sibling, otherChat, { session: 'chat-3', agent: 'main', root: wt }])), 'pass');
check('a job running alone passes: only its own stamp', run(guard, commit('git commit -m x', main), project([{ session: S, agent: 'agent-a', root: main }])), 'pass');
check('a writer last seen past the half hour is not working there', run(guard, commit('git commit -m x', main), project([{ ...otherChat, at: Date.now() - ACTIVE_MS - 60000 }])), 'pass');
check('a writer in another checkout does not count', run(guard, commit('git commit -m x', main), project([{ ...otherChat, root: wt }])), 'pass');
check('another git command passes', run(guard, commit('git status && git log -1', main), project([sibling])), 'pass');
check('a message naming git commit is no commit', run(guard, commit('echo "then git commit it"', main), project([sibling])), 'pass');

// The signal: track-touched stamps each writer, per agent, in the checkout it wrote in.
{
  const proj = project([]);
  const state = join(proj, '.claude', 'hooks', 'state');
  run(tracker, { session_id: S, agent_id: 'agent-b', cwd: main, tool_name: 'Edit', tool_input: { file_path: join(main, 'base.txt') } }, proj);
  run(tracker, { session_id: S, cwd: wt, tool_name: 'Bash', tool_input: { command: 'touch base.txt' } }, proj);
  run(tracker, { session_id: S, agent_id: 'agent-c', cwd: main, tool_name: 'Bash', tool_input: { command: 'git status' } }, proj);
  const ws = readWriters(state);
  check('an agent\'s edit is stamped in its file\'s checkout', ws.some((w) => w.session === S && w.agent === 'agent-b' && w.root === main) ? 'yes' : 'no', 'yes');
  check('the chat\'s own writing command is stamped as main, in its checkout', ws.some((w) => w.agent === 'main' && w.root === wt) ? 'yes' : 'no', 'yes');
  check('a read-only command stamps nothing', ws.some((w) => w.agent === 'agent-c') ? 'yes' : 'no', 'no');
  check('and the stamps it made refuse a third agent there', run(guard, commit('git commit -m x', main, 'agent-d'), proj), 'deny');
}

// The pure parts.
check('commitDir finds no commit in a log', String(commitDir('git log --oneline', '/r')), 'null');
check('namedPaths reads the paths after --', namedPaths('git commit -F m -- a.md data/b.md && git push').join(','), 'a.md,data/b.md');
check('otherWriters leaves out the asking agent', otherWriters({ session: S, agent: 'agent-a', root: main, writers: [{ session: S, agent: 'agent-a', root: main, at: Date.now() }] }).length.toString(), '0');

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('agent own copy: a subagent commit in a checkout another writer works in is refused; the chat\'s own, her saves, a worktree and a job alone pass');
