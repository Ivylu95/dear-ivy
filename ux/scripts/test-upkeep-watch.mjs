// Rule test for upkeep-watch.mjs (HYG-006): an upkeep commit the watch cannot
// take out alone is recorded unverifiable and named in the run's output, and a
// merge commit carrying the trailer never crashes the sweep. Runs the real watch
// in a throwaway repository, with the behaviour lock stubbed by one file's text.

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const here = dirname(fileURLToPath(import.meta.url));
let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

// What the app "does" is f.txt's text: a commit that changes it moves an output.
const STUB = `import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const record = () => ({ f: { hash: readFileSync(join(root, 'f.txt'), 'utf8') } });
export const stableDifferences = (a, b) => ({ moved: Object.keys(a).filter((k) => a[k].hash !== b[k].hash), unstable: [] });
`;

function repo(build) {
  const dir = makeTemp('dear-watch-test-');
  const config = join(dir, '..', `${dir.split('/').pop()}.gitconfig`);
  writeFileSync(config, '[user]\n\tname = t\n\temail = t@t\n[commit]\n\tgpgsign = false\n[core]\n\thooksPath = /dev/null\n');
  const env = { ...process.env, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: '1' };
  const git = (...a) => {
    const r = spawnSync('git', a, { cwd: dir, env, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`git ${a.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const put = (file, text) => writeFileSync(join(dir, file), text);
  mkdirSync(join(dir, 'ux', 'scripts'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'jobs'), { recursive: true });
  copyFileSync(join(here, 'upkeep-watch.mjs'), join(dir, 'ux', 'scripts', 'upkeep-watch.mjs'));
  // The watch makes its throwaway folders with the one helper, so the copy carries it too.
  mkdirSync(join(dir, '.claude', 'hooks', 'lib'), { recursive: true });
  copyFileSync(join(here, '..', '..', '.claude', 'hooks', 'lib', 'temp-litter.mjs'), join(dir, '.claude', 'hooks', 'lib', 'temp-litter.mjs'));
  put('ux/scripts/behaviour-snapshot.mjs', STUB);
  put('.claude/jobs/.keep', '');
  git('init', '-q', '-b', 'main');
  put('f.txt', 'one\n');
  git('add', '.');
  git('commit', '-qm', 'base');
  const target = build({ git, put });
  const run = () => spawnSync(process.execPath, ['ux/scripts/upkeep-watch.mjs'], { cwd: dir, env, encoding: 'utf8' });
  const ledger = () => (existsSync(join(dir, '.claude/jobs/code-maintenance-snapshot.json')) ? JSON.parse(readFileSync(join(dir, '.claude/jobs/code-maintenance-snapshot.json'), 'utf8')) : null);
  return { dir, config, target, run, ledger };
}

const done = (r) => {
  rmSync(r.dir, { recursive: true, force: true });
  rmSync(r.config, { force: true });
};

// An edge-case run of 2026-10-29: a commit later work had changed was recorded unverifiable in silence.
{
  const r = repo(({ git, put }) => {
    put('f.txt', 'two\n');
    git('commit', '-qam', 'chore(upkeep): tidy\n\nUpkeep: HYG-006');
    const c = git('rev-parse', 'HEAD');
    put('f.txt', 'three\n');
    git('commit', '-qam', 'later work');
    return c;
  });
  try {
    const out = r.run();
    check('a commit later work changed is named unverifiable in the run output', out.stdout.includes(`upkeep watch: ${r.target.slice(0, 8)} unverifiable, later work changed the same lines`));
    check('and recorded unverifiable in the ledger', r.ledger()?.unverifiable.some((u) => u.commit === r.target) === true);
  } finally {
    done(r);
  }
}

// An edge-case run of 2026-10-29: a merge carrying the trailer crashed the watch, its ledger never written.
{
  const r = repo(({ git, put }) => {
    git('checkout', '-qb', 'side');
    put('f.txt', 'two\n');
    git('commit', '-qam', 'side work');
    git('checkout', '-q', 'main');
    put('g.txt', 'other\n');
    git('add', '.');
    git('commit', '-qm', 'main work');
    git('merge', '-q', '--no-ff', 'side', '-m', 'merge side\n\nUpkeep: HYG-006');
    return git('rev-parse', 'HEAD');
  });
  try {
    const out = r.run();
    check('a merge commit with the trailer does not crash the watch', out.status === 0);
    check('it is named unverifiable in the run output', out.stdout.includes(`upkeep watch: ${r.target.slice(0, 8)} unverifiable, a merge commit is checked through its parents`));
    check('and recorded unverifiable with its reason', r.ledger()?.unverifiable.some((u) => u.commit === r.target && /merge commit is checked through its parents/.test(u.why)) === true);
    const again = r.run();
    check('the next sweep finds nothing waiting', again.status === 0 && again.stdout.includes('nothing landed since the last check'));
  } finally {
    done(r);
  }
}

// Round 40: the watch run in a folder another chat shares. Its clean-checkout check runs
// before the snapshots, which take minutes; a cherry-pick that chat stopped meanwhile, with
// her words staged beside it, made the watch's revert fail, and the watch's
// `git revert --abort` undid that pick, which was not its own, wiping her staged words
// with it. The stub's last snapshot stands in for the other chat, in that window.
{
  const count = join(makeTemp('dear-watch-test-'), 'calls');
  const RACE = `import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const at = ${JSON.stringify(count)};
export const record = () => {
  const n = (existsSync(at) ? Number(readFileSync(at, 'utf8')) : 0) + 1;
  writeFileSync(at, String(n));
  const out = { f: { hash: readFileSync(join(root, 'f.txt'), 'utf8') } };
  if (n === 3) {
    spawnSync('git', ['cherry-pick', 'other'], { cwd: root });
    appendFileSync(join(root, 'data', 'now.md'), 'An invented evening.\\n');
    spawnSync('git', ['add', '--', 'data/now.md'], { cwd: root });
  }
  return out;
};
export const stableDifferences = (a, b) => ({ moved: Object.keys(a).filter((k) => a[k].hash !== b[k].hash), unstable: [] });
`;
  const r = repo(({ git, put }) => {
    put('ux/scripts/behaviour-snapshot.mjs', RACE);
    mkdirSync(join(git('rev-parse', '--show-toplevel'), 'data'), { recursive: true });
    put('data/now.md', 'An invented week.\n');
    put('g.txt', 'g\n');
    git('add', '.');
    git('commit', '-qm', 'pages');
    git('checkout', '-qb', 'other');
    put('g.txt', 'other\n');
    git('commit', '-qam', 'other');
    git('checkout', '-q', 'main');
    put('g.txt', 'main\n');
    git('commit', '-qam', 'main');
    put('f.txt', 'two\n');
    git('commit', '-qam', 'chore(upkeep): tidy\n\nUpkeep: HYG-006');
    return git('rev-parse', 'HEAD');
  });
  try {
    const out = r.run();
    const now = readFileSync(join(r.dir, 'data', 'now.md'), 'utf8');
    check('another chat\'s cherry-pick stopped in the same folder is not undone by the watch', existsSync(join(r.dir, '.git', 'CHERRY_PICK_HEAD')));
    check('her words staged beside it are kept', now.includes('An invented evening.'));
    check('and the watch says it did not check the commit', out.status !== 0 || !r.ledger()?.reverted.some((x) => x.commit === r.target));
  } finally {
    done(r);
  }
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
