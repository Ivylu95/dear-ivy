// Rule tests for lib/pull-at-start.mjs (A-165, "Each of my messages starts from the
// latest work"): two copies of one invented repository. One saves; the other, at its
// next message, must bring that in by fast-forward and name only what bears on it;
// stay out of the way of its own unsaved changes; and do nothing at all on a crisis.
//
//   node .claude/hooks/lib/test-pull-at-start.mjs

import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { incomingNote, relevantIncoming } from './pull-at-start.mjs';
import { makeTemp } from './temp-litter.mjs';

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

// The pure part: which incoming files bear on a chat.
const incoming = ['CLAUDE.md', 'ux/app/page.jsx', 'data/core/timeline.md', 'dev/specs/system/dev.md'];
check('CLAUDE.md always bears on a chat', relevantIncoming(incoming, [], { dev: true }).includes('CLAUDE.md'));
check('a file this chat touched bears on it', relevantIncoming(incoming, ['dev/specs/system/dev.md'], { dev: true }).includes('dev/specs/system/dev.md'));
check('a file nobody here touched does not', !relevantIncoming(incoming, ['dev/specs/system/dev.md'], { dev: true }).includes('ux/app/page.jsx'));
check('a touched folder never claims everything under it', !relevantIncoming(['dev/specs/system/dev.md'], ['dev/specs'], { dev: true }).length);
// The first live run listed 39 files, nearly all rewritten by every chat and read by none.
const churn = ['dev/dialogue/transcript/2026-11-2.md', 'dev/dialogue/index/README.md', 'dev/evals/history/2026-11-03.jsonl', 'dev/dialogue/agreements.md'];
check('other chats\' remarks and generated files are left out, even when this chat touched them', relevantIncoming(churn, churn, { dev: true }).join() === 'dev/dialogue/agreements.md');
check('her record bears on her chat', relevantIncoming(incoming, [], { dev: false }).includes('data/core/timeline.md'));
check('and not on a development chat', !relevantIncoming(incoming, [], { dev: true }).includes('data/core/timeline.md'));
check('nothing relevant means nothing said', incomingNote({ commits: 5, relevant: [], merged: true, dev: true }) === '');
check('her chat\'s note tells the agent to say nothing of it to her', /say nothing about this to her/.test(incomingNote({ commits: 1, relevant: ['data/core/now.md'], merged: true, dev: false })));
check('a long list is cut, the rest counted', /and 4 more/.test(incomingNote({ commits: 9, relevant: Array.from({ length: 10 }, (_, i) => `f${i}.md`), merged: true, dev: true })));

// The real part: two copies of one repository, through a bare origin.
const dir = makeTemp('dear-pull-');
const quiet = ['-c', 'core.hooksPath=/dev/null', '-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false'];
const g = (cwd, ...args) => execFileSync('git', [...quiet, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const lib = pathToFileURL(join(import.meta.dirname, 'pull-at-start.mjs')).href;
const pull = (cwd, opts) => execFileSync(process.execPath, ['--input-type=module', '-e', `import { pullAtStart } from ${JSON.stringify(lib)}; process.stdout.write(pullAtStart(${JSON.stringify(opts)}));`], {
  cwd, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: cwd, DEAR_PULL_TEST: '1' }, timeout: 30000,
});
try {
  const origin = join(dir, 'origin.git');
  const a = join(dir, 'a');
  const b = join(dir, 'b');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  g(dir, 'clone', '-q', origin, a);
  g(a, 'checkout', '-q', '-b', 'main');
  writeFileSync(join(a, 'CLAUDE.md'), 'rules v1\n');
  writeFileSync(join(a, 'notes.md'), 'n1\n');
  g(a, 'add', '-A');
  g(a, 'commit', '-q', '-m', 'start');
  g(a, 'push', '-q', '-u', 'origin', 'main');
  g(dir, 'clone', '-q', origin, b);

  check('nothing came in: nothing said', pull(a, { dev: true }) === '');

  writeFileSync(join(b, 'CLAUDE.md'), 'rules v2\n');
  writeFileSync(join(b, 'other.md'), 'unrelated\n');
  g(b, 'add', '-A');
  g(b, 'commit', '-q', '-m', 'another chat');
  g(b, 'push', '-q');

  check('a crisis message skips it: nothing fetched or said', pull(a, { dev: true, crisis: true }) === '' && g(a, 'rev-parse', 'HEAD') !== g(b, 'rev-parse', 'HEAD'));

  writeFileSync(join(a, 'CLAUDE.md'), 'my own unsaved edit\n');
  const blocked = pull(a, { dev: true });
  check('its own unsaved change in the way: not merged, and said so', /NOT merged yet/.test(blocked) && /CLAUDE\.md/.test(blocked));
  g(a, 'checkout', '-q', '--', 'CLAUDE.md');

  const note = pull(a, { dev: true });
  check('the other chat\'s work is brought in by fast-forward', g(a, 'rev-parse', 'HEAD') === g(b, 'rev-parse', 'HEAD'));
  check('and the note names what bears on this chat', /CAME IN \(A-165\): 1 commit/.test(note) && /CLAUDE\.md/.test(note) && /now in this copy/.test(note));
  check('and leaves out what does not', !/other\.md/.test(note));

  writeFileSync(join(b, 'other.md'), 'still unrelated\n');
  g(b, 'commit', '-q', '-am', 'unrelated only');
  g(b, 'push', '-q');
  check('only unrelated work came in: brought in, nothing said', pull(a, { dev: true }) === '' && g(a, 'rev-parse', 'HEAD') === g(b, 'rev-parse', 'HEAD'));

  mkdirSync(join(b, 'data', 'core'), { recursive: true });
  writeFileSync(join(b, 'data', 'core', 'now.md'), 'changed elsewhere\n');
  g(b, 'add', '-A');
  g(b, 'commit', '-q', '-m', 'record: update now');
  g(b, 'push', '-q');
  check('her record changed in another chat: her chat is told, quietly', /say nothing about this to her/.test(pull(a, { dev: false })));

  // One deadline over the whole pull (T-681): out of time, nothing is fetched or moved.
  writeFileSync(join(b, 'CLAUDE.md'), 'rules v3\n');
  g(b, 'commit', '-q', '-am', 'rules again');
  g(b, 'push', '-q');
  const beforeLate = g(a, 'rev-parse', 'HEAD');
  const late = execFileSync(process.execPath, ['--input-type=module', '-e', `import { pullAtStart } from ${JSON.stringify(lib)}; process.stdout.write(pullAtStart({ dev: true }));`], {
    cwd: a, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: a, DEAR_PULL_TEST: '1', DEAR_PULL_MS: '1' }, timeout: 30000,
  });
  check('past its deadline it stops where it is: nothing said, nothing moved', late === '' && g(a, 'rev-parse', 'HEAD') === beforeLate);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// Side by side, as the harness runs them (T-681): the Transcript hook pulls and then
// writes his remark while the reply-shape hook runs at the same moment. Another chat
// has just added a remark to the same month's file. Both remarks must be kept, his
// numbered after the other chat's, and the copy brought up to date first.
const hooks = join(import.meta.dirname, '..');
const run2 = (file, cwd, prompt) => new Promise((done) => {
  const child = spawn(process.execPath, [join(hooks, 'session', file)], {
    cwd, env: { ...cleanEnv, CLAUDE_PROJECT_DIR: cwd, DEAR_PULL_TEST: '1' }, stdio: ['pipe', 'pipe', 'ignore'],
  });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.on('close', () => done(out));
  child.stdin.end(JSON.stringify({ session_id: 'pull-race', prompt }));
});
const cleanEnv = { ...process.env };
for (const k of ['CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_REMOTE_SESSION_ID', 'DEAR_HOOK_STRICT']) delete cleanEnv[k];
const race = makeTemp('dear-pull-race-');
try {
  const origin = join(race, 'origin.git');
  const a = join(race, 'a');
  const b = join(race, 'b');
  const month = new Date().toISOString().slice(0, 7);
  const rel = join('dev', 'dialogue', 'transcript', `${month}.md`);
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  g(race, 'clone', '-q', origin, a);
  g(a, 'checkout', '-q', '-b', 'main');
  mkdirSync(join(a, 'dev', 'dialogue', 'transcript'), { recursive: true });
  writeFileSync(join(a, rel), '# Transcript\n\n### T-100 · 2026-01-01 · 💭 want\n> first\n');
  writeFileSync(join(a, 'CLAUDE.md'), 'rules\n');
  writeFileSync(join(a, '.gitignore'), '.claude/hooks/state/\n');
  g(a, 'add', '-A');
  g(a, 'commit', '-q', '-m', 'start');
  g(a, 'push', '-q', '-u', 'origin', 'main');
  g(race, 'clone', '-q', origin, b);
  writeFileSync(join(b, rel), '# Transcript\n\n### T-100 · 2026-01-01 · 💭 want\n> first\n\n### T-101 · 2026-01-01 · 💭 want\n> from another chat\n');
  writeFileSync(join(b, 'CLAUDE.md'), 'rules, changed\n');
  g(b, 'commit', '-q', '-am', 'another chat');
  g(b, 'push', '-q');
  mkdirSync(join(a, '.claude', 'hooks', 'state'), { recursive: true });
  writeFileSync(join(a, '.claude', 'hooks', 'state', 'dev-mode-pull-race'), 'on');
  const [said] = await Promise.all([run2('dialogue-record.mjs', a, 'my remark, written while the other hook runs'), run2('dev-reply-shape.mjs', a, 'my remark, written while the other hook runs')]);
  const text = readFileSync(join(a, rel), 'utf8');
  check('side by side: the other chat\'s remark is kept', text.includes('> from another chat'));
  check('and his remark is kept, numbered after it', /### T-102 · [^\n]*\n> my remark, written while/.test(text));
  check('and the copy was brought up to date before the write', g(a, 'rev-parse', 'HEAD') === g(b, 'rev-parse', 'HEAD'));
  check('and the note names the changed rules', /CAME IN \(A-165\)/.test(said) && /CLAUDE\.md/.test(said));
} finally {
  rmSync(race, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
