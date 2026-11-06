// Rule test: data-sandbox/ is outside the record, so a commit touching it runs the
// privacy check (A-155, 2026-11-01). Until then the commit gate read a commit of
// data/ and data-sandbox/ alike as record-only and ran nothing, and the save hook
// committed the sandbox with her record each turn, so a real name typed into a test
// chat went into history unread. Proven in a throwaway repository with an invented
// record, the real commit gate and the real save hook:
//
//   - a commit of data/ alone still passes at once, whatever it holds;
//   - a sandbox commit naming a person on file is refused by the privacy check;
//   - a clean sandbox commit passes;
//   - at a turn's end her record is saved, and a sandbox holding a name is not:
//     left on disk and unstaged, and the turn told, never in the record's words.
//
// Run by the hook self-test.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyTree, makeTemp } from '../lib/temp-litter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dir = makeTemp('dear-sandbox-gate-');
const repo = join(dir, 'repo');
const bare = join(dir, 'remote.git');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(GIT_(?!CONFIG_)|CLAUDE_CODE_SESSION_ID$|CLAUDE_PROJECT_DIR$)/i.test(k)));
const git = (...args) => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const commit = (...paths) => spawnSync('git', ['commit', '-q', '-m', 'test: a commit', '--', ...paths], { cwd: repo, env, encoding: 'utf8' });
const put = (rel, text) => {
  mkdirSync(dirname(join(repo, rel)), { recursive: true });
  writeFileSync(join(repo, rel), text);
};

const FRIEND = ['Person', 'b'].join('');
const OWNER = ['Person', 'j'].join('');

let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` ${String(detail).slice(0, 400)}`}`);
};

try {
  // The harness the gate and the save need, and the two checks a sandbox commit runs.
  const skip = (s) => !/[\\/](node_modules|state|worktrees)$/.test(s);
  for (const part of ['.claude', 'modules']) copyTree(join(root, part), join(repo, part), { filter: skip });
  cpSync(join(root, 'ux', 'lib'), join(repo, 'ux', 'lib'), { recursive: true });
  for (const s of ['check-privacy.mjs', 'check-secrets.mjs']) cpSync(join(root, 'ux', 'scripts', s), join(repo, 'ux', 'scripts', s));
  // One-word invented names, built at run time: a hyphenated page also guards its
  // first part, the copied harness says "person" everywhere, and this file is copied too.
  put('data/PROFILE.yaml', `mandatory:\n  name:\n    value: ${OWNER}\n    status: answered\n`);
  put(`data/core/people/${FRIEND.toLowerCase()}.md`, `# ${FRIEND}\n\nA friend from the pottery class.\n`);
  put('data/core/journal/2026-01-02.md', '# A day\n\nAn invented line.\n');
  put('data-sandbox/PROFILE.yaml', 'mandatory:\n  name:\n    value: Person-Q\n    status: answered\n');
  put('data-sandbox/core/journal/2026-01-02.md', '# A test day\n\nAn invented line.\n');

  execFileSync('git', ['init', '-q', '--bare', bare], { env });
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('config', 'commit.gpgsign', 'false');
  git('remote', 'add', 'origin', bare);
  git('add', '-A');
  git('commit', '-q', '--no-verify', '-m', 'start');
  git('push', '-q', 'origin', 'main');
  git('config', 'core.hooksPath', '.claude/hooks/git');

  // Her record: never stopped, whatever it holds.
  put('data/core/journal/2026-01-03.md', `# Another day\n\n${FRIEND} rang.\n`);
  git('add', '--', 'data/');
  let r = commit('data/');
  check('a commit of data/ alone passes at once, names and all', r.status === 0, r.stderr);

  // The sandbox: held to the privacy check.
  put('data-sandbox/core/me/about_me.md', `# About\n\n- ${FRIEND}, told in a test chat.\n`);
  git('add', '--', 'data-sandbox/');
  r = commit('data-sandbox/');
  check('the incident: a sandbox commit naming a person on file is refused', r.status !== 0, r.stderr);
  check('and refused by the privacy check, naming the sandbox file', /privacy/i.test(r.stderr) && r.stderr.includes('data-sandbox/core/me/about_me.md'), r.stderr);
  r = commit('data-sandbox/');
  check('a second try is still refused, not let through', r.status !== 0, r.stderr);
  git('restore', '--staged', '--', 'data-sandbox/');
  rmSync(join(repo, 'data-sandbox', 'core', 'me', 'about_me.md'));
  put('data-sandbox/core/journal/2026-01-03.md', '# A test day\n\nAnother invented line.\n');
  git('add', '--', 'data-sandbox/');
  r = commit('data-sandbox/');
  check('a clean sandbox commit passes', r.status === 0, r.stderr);

  // At the turn's end: her words saved, the sandbox holding a name held back.
  put('data/core/journal/2026-01-04.md', '# A third day\n\nAn invented line, kept.\n');
  put('data-sandbox/core/me/about_me.md', `# About\n\n- ${FRIEND}, told in a test chat.\n`);
  r = spawnSync(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
    cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo, DEAR_SAVE_NET_MS: '5000' }, input: '{}', encoding: 'utf8', timeout: 170000,
  });
  const out = `${r.stdout}${r.stderr}`;
  const tracked = (p) => spawnSync('git', ['cat-file', '-e', `HEAD:${p}`], { cwd: repo, env }).status === 0;
  check('her record is saved at the turn\'s end', tracked('data/core/journal/2026-01-04.md'), out);
  check('and pushed', git('rev-parse', 'HEAD') === git('rev-parse', 'origin/main'), out);
  check('the sandbox file holding a name is not committed', !tracked('data-sandbox/core/me/about_me.md'), out);
  check('it is left on disk, and unstaged', existsSync(join(repo, 'data-sandbox', 'core', 'me', 'about_me.md')) && git('diff', '--cached', '--name-only').trim() === '', out);
  check('the turn is told the sandbox was not saved, never that her record was not', /"decision":\s*"block"/.test(r.stdout) && /data-sandbox\/ was not saved/.test(out) && !/Her record could not be saved/.test(out), out);
  check('the telling never names the person', !out.toLowerCase().includes(FRIEND.toLowerCase()), out);
  check('no failure note is left for her record', !existsSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md')), out);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.log(`\n${failed} failing`);
  process.exit(1);
}
console.log('sandbox gate test: all passed');
