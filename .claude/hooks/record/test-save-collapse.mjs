// Rule test: a record page that collapses to almost nothing is never saved over its
// last version.
//
// On 2026-10-16 the standing snapshot was cut to a few bytes at a turn's end and the
// save committed it (ce844111). save-record.mjs now holds back a tracked page of 256
// bytes or more that would be saved under 64, keeps it on disk, and says why; a page
// emptied in the same save that writes data/archive/ is saved as usual, and an ordinary
// edit is saved as before. Checked against a throwaway repository with an invented
// record and a local bare remote, never this repository: the hook reads
// CLAUDE_PROJECT_DIR, set to the copy, and no inherited GIT_* variable is passed on.
// Run by selftest.mjs.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyTree, makeTemp } from '../lib/temp-litter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dir = makeTemp('dear-save-collapse-');
const repo = join(dir, 'repo');
const bare = join(dir, 'remote.git');
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k)));
const git = (...args) => execFileSync('git', args, { cwd: repo, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const save = () => spawnSync(process.execPath, [join(repo, '.claude', 'hooks', 'record', 'save-record.mjs')], {
  cwd: repo, env: { ...env, CLAUDE_PROJECT_DIR: repo, DEAR_SAVE_NET_MS: '5000' }, input: '{}', encoding: 'utf8', timeout: 90000,
});
const committed = (p) => git('show', `HEAD:${p}`);

let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` ${String(detail).slice(0, 300)}`}`);
};

const NOW = 'data/core/state/now.md';
const page = `# Now\n\n${'An invented line about an invented week, long enough to be a real page.\n'.repeat(8)}`;

try {
  for (const part of ['.claude', 'modules']) copyTree(join(root, part), join(repo, part), { filter: (s) => !/[\\/](node_modules|state)$/.test(s) });
  mkdirSync(join(repo, 'data', 'core', 'state'), { recursive: true });
  writeFileSync(join(repo, NOW), page);
  execFileSync('git', ['init', '-q', '--bare', bare], { env });
  git('init', '-q', '-b', 'main');
  git('config', 'core.hooksPath', '/dev/null');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  git('remote', 'add', 'origin', bare);
  git('add', '-A');
  git('commit', '-qm', 'start');
  git('push', '-q', 'origin', 'main');

  // The incident: the page cut to two characters at a turn's end.
  writeFileSync(join(repo, NOW), 'x\n');
  let r = save();
  check('the incident: a page cut to almost nothing is not committed', committed(NOW) === page);
  check('and is still on disk as it was left', readFileSync(join(repo, NOW), 'utf8') === 'x\n');
  check('and the turn is told why, naming the page', /shrank to almost nothing/.test(`${r.stdout}${r.stderr}`) && `${r.stdout}${r.stderr}`.includes(NOW), `${r.stdout}${r.stderr}`);

  // Put back, its failure note cleared; an ordinary edit saves as before.
  writeFileSync(join(repo, NOW), `${page}One more invented line.\n`);
  rmSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md'), { force: true });
  r = save();
  check('an ordinary edit to the page is saved', committed(NOW).endsWith('One more invented line.\n'), `${r.stdout}${r.stderr}`);

  // Cut down in the same turn another page is written (round 28): a commit limited to
  // data/ takes every tracked file from disk, staged or not, so the cut page rode in
  // beside the other one.
  const OTHER = 'data/core/state/open_loops.md';
  writeFileSync(join(repo, OTHER), '# Open loops\n\nAn invented loop.\n');
  git('add', '--', OTHER);
  git('commit', '-qm', 'another page');
  git('push', '-q', 'origin', 'main');
  const before = committed(NOW);
  writeFileSync(join(repo, NOW), 'x\n');
  writeFileSync(join(repo, OTHER), '# Open loops\n\nAn invented loop.\nA second invented loop.\n');
  rmSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md'), { force: true });
  r = save();
  check('a page cut down beside another page written is not committed', committed(NOW) === before, committed(NOW));
  check('while the other page is saved', committed(OTHER).includes('A second invented loop.'), `${r.stdout}${r.stderr}`);
  check('and the cut page is still on disk as it was left', readFileSync(join(repo, NOW), 'utf8') === 'x\n');
  check('and the turn is told why', /shrank to almost nothing/.test(`${r.stdout}${r.stderr}`), `${r.stdout}${r.stderr}`);
  // Round 29: the other page was committed but never pushed, since the held-back page
  // stopped the hook before its push; a machine reclaimed then lost it.
  const onMain = (p) => {
    try {
      return git('--git-dir', bare, 'show', `main:${p}`);
    } catch {
      return '';
    }
  };
  check('and the other page reaches GitHub\'s main that same turn', onMain(OTHER).includes('A second invented loop.'), `${r.stdout}${r.stderr}`);
  check('while GitHub\'s main keeps the cut page\'s last version', onMain(NOW) === before);
  check('and the failure note stays, since the cut page is still unsaved', existsSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md')));
  writeFileSync(join(repo, NOW), before);
  rmSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md'), { force: true });

  // Round 30: the second pass, for a record file still new after the first, added the
  // whole record again, cut page and all. When the first add had failed outright (here
  // a test chat folder holding a repository with no commit, which fails any add naming
  // it; another git's lock held through the first add does the same), the cut page was
  // never looked at, and the second pass committed it.
  const JOURNAL = 'data/core/journal/2020-01-01.md';
  const nested = join(repo, 'data-sandbox', 'inner');
  mkdirSync(nested, { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: nested, env });
  writeFileSync(join(nested, 'note.md'), 'An invented test chat.\n');
  const keep = committed(NOW);
  writeFileSync(join(repo, NOW), 'x\n');
  mkdirSync(join(repo, 'data', 'core', 'journal'), { recursive: true });
  writeFileSync(join(repo, JOURNAL), 'An invented entry.\n');
  rmSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md'), { force: true });
  r = save();
  check('a cut page is not committed by the second pass when the first add failed (round 30)', committed(NOW) === keep, committed(NOW));
  check('while the new entry beside it is saved', git('ls-files', '--', JOURNAL).trim() === JOURNAL, `${r.stdout}${r.stderr}`);
  check('and the turn is told why', /shrank to almost nothing/.test(`${r.stdout}${r.stderr}`), `${r.stdout}${r.stderr}`);
  rmSync(join(repo, 'data-sandbox'), { recursive: true, force: true });
  writeFileSync(join(repo, NOW), keep);
  rmSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md'), { force: true });
  save();

  // Round 30: a record file written by a Stop hook beside this one, after the first add
  // (here by a hook after the record commit), is taken by the second pass; the cut page
  // it re-staged stayed staged, which refused the merge of a moved main, so the save
  // missed main, and the next commit made by hand would take the cut page.
  const hooks = join(dir, 'githooks');
  mkdirSync(hooks, { recursive: true });
  writeFileSync(join(hooks, 'post-commit'), `#!/bin/sh\n[ -e data/core/journal/late.md ] || echo 'An invented late entry.' >> data/core/journal/late.md\n`, { mode: 0o755 });
  git('checkout', '-q', '-b', 'claude/invented-chat');
  const moved = git('--git-dir', bare, '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', 'commit-tree', 'main^{tree}', '-p', 'main', '-m', 'main moves on').trim();
  git('--git-dir', bare, 'update-ref', 'refs/heads/main', moved);
  git('config', 'core.hooksPath', hooks);
  const kept2 = committed(NOW);
  writeFileSync(join(repo, NOW), 'x\n');
  writeFileSync(join(repo, OTHER), '# Open loops\n\nAn invented loop.\nA third invented loop.\n');
  r = save();
  git('config', 'core.hooksPath', '/dev/null');
  check('the late entry is saved (round 30)', git('ls-files', '--', 'data/core/journal/late.md').trim() !== '', `${r.stdout}${r.stderr}`);
  check('the cut page is left unstaged after the second pass', git('diff', '--cached', '--name-only').trim() === '', git('diff', '--cached', '--name-only'));
  check('and is not committed', committed(NOW) === kept2);
  check('what was committed reaches GitHub\'s main though main had moved on', onMain(OTHER).includes('A third invented loop.') && onMain('data/core/journal/late.md') !== '', `${r.stdout}${r.stderr}`);
  check('while GitHub\'s main keeps the cut page\'s last version', onMain(NOW) === kept2);
  writeFileSync(join(repo, NOW), kept2);
  rmSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md'), { force: true });
  save();

  // Round 35: the note and the turn were told to run `git commit -- data/` "to see why",
  // and following it committed the very page held back. Followed here as printed, with
  // an editor that writes a message, as a turn would supply one.
  const kept3 = committed(NOW);
  writeFileSync(join(repo, NOW), 'x\n');
  writeFileSync(join(repo, OTHER), '# Open loops\n\nAn invented loop.\nA fourth invented loop.\n');
  rmSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md'), { force: true });
  r = save();
  const heldNote = readFileSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md'), 'utf8');
  const printed = (heldNote.match(/^Run: (.+?) {3}to see why/m) ?? [])[1] ?? '';
  check('the note prints a command to see why (round 35)', printed.startsWith('git '), heldNote);
  check('and the turn is told the same command', printed !== '' && `${r.stdout}${r.stderr}`.includes(JSON.stringify(printed).slice(1, -1)), `${r.stdout}${r.stderr}`);
  writeFileSync(join(repo, OTHER), '# Open loops\n\nAn invented loop.\nA fifth invented loop.\n');
  const editor = join(dir, 'editor.sh');
  writeFileSync(editor, '#!/bin/sh\necho "record: by hand" > "$1"\n', { mode: 0o755 });
  spawnSync('sh', ['-c', printed], { cwd: repo, env: { ...env, GIT_EDITOR: editor }, encoding: 'utf8' });
  check('following the printed command never commits the held-back page', committed(NOW) === kept3, committed(NOW));
  check('and the cut page is still on disk as it was left', readFileSync(join(repo, NOW), 'utf8') === 'x\n');
  writeFileSync(join(repo, NOW), kept3);
  rmSync(join(repo, 'data', 'core', 'state', 'PUSH_FAILED.md'), { force: true });
  save();

  // Emptied on purpose: what it held moves to the archive in the same save.
  mkdirSync(join(repo, 'data', 'archive'), { recursive: true });
  writeFileSync(join(repo, 'data', 'archive', 'now-before.md'), committed(NOW));
  writeFileSync(join(repo, NOW), '# Now\n');
  r = save();
  check('a page emptied beside its archived copy is saved', committed(NOW) === '# Now\n', `${r.stdout}${r.stderr}`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('save collapse test: all passed');
