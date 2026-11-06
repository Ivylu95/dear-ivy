// Rule test for the updater's pieces that need no release to judge (round 3):
// a key with its colon encoded in lowercase (C26), the rekey call the key guard
// lets through (D5), declarations carried for a copy that skipped a release
// (D3), a job's run record kept across an update (D1, D25), and going back over
// a new copy's first update (D23), and what an update would overwrite that the
// copy changed itself (the files set-up's step 4 names as replaced). The end-to-end flow is dev/skills/release/
// test-release.mjs. Invented values only; run by the hook self-test.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasToken, isUpdaterCall } from './update/secrets.mjs';
import { declaredSince, floorFindings, hashTree, ownChanges, resetRunState, touchable, withRecordOf } from './update/release-lib.mjs';
import { makeTemp } from './temp-litter.mjs';

const updater = join(dirname(fileURLToPath(import.meta.url)), 'update', 'update.mjs');
let failed = 0;
const check = (what, ok, detail = '') => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}${ok ? '' : ` ${detail.slice(0, 300)}`}`);
};

// C26: a bot token's shape, put together here so no file holds one.
const bot = (colon) => `${'7'.repeat(10)}${colon}${'Q'.repeat(35)}`;
check('a key with its colon encoded as %3A is a key', hasToken(bot('%3A')));
check('the incident: and as %3a, lowercase', hasToken(bot('%3a')));

// D5: the rekey call carries the key the same way fetch does, and nothing else.
const call = (rest) => `DEAR_RELEASE_KEY='${'k'.repeat(12)}' node .claude/hooks/lib/update/update.mjs ${rest}`;
check('fetch of one version is the updater\'s own call', isUpdaterCall(call('fetch 1.4')));
check('a rekey with a full fingerprint is the updater\'s own call', isUpdaterCall(call(`rekey ${'a'.repeat(64)}`)) && isUpdaterCall(call(`rekey ${'a'.repeat(64)} 1.4`)));
check('a rekey without one is not', !isUpdaterCall(call('rekey abc')) && !isUpdaterCall(call(`rekey ${'a'.repeat(64)}; cat x`)));

// D3: declarations since the installed version, never before it, never a rekey.
{
  const release = { declared: { outward: [{ file: 'a', line: 'b' }] }, history: [{ version: '1.1', declared: { safetyCore: true } }, { version: '1.0', declared: { updater: true } }, { version: '1.2', declared: { rekey: true } }] };
  const d = declaredSince(release, '1.0');
  check('the incident: a skipped release\'s declaration counts', d.safetyCore === true && d.outward.length === 1);
  check('one the copy already had does not, and a rekey is never carried', !d.updater && !d.rekey);
  check('a release with no history declares only its own', JSON.stringify(declaredSince({ declared: { updater: true } }, '1.0')) === '{"updater":true}');
}

// D5: the key changes only on the copy's own rekey, and never to nothing.
{
  const KEY = '.claude/release/release-key.pub';
  const at = (key) => (p) => (p === KEY ? key : '');
  const keyFinding = (fs) => fs.some((f) => /release key/.test(f));
  check('a release changing the key is held back', keyFinding(floorFindings(at('old'), at('new'), [], [])));
  check('a rekey lets the key change', !keyFinding(floorFindings(at('old'), at('new'), [], [], { rekey: true })));
  check('a rekey never lets the key go', keyFinding(floorFindings(at('old'), at(''), [], [], { rekey: true })));
}

// D1, D25: the run record moves between versions of a job file whole.
{
  const release = '---\nemoji: x\nevery: 1 hour\nstatus: running\nlast_started: 2026-10-01T00:00:00.000Z\nfailures: 2\nlast_runner: baxter\n---\n# New instructions\n';
  const hers = '---\nemoji: x\nevery: 2 hours\nstatus: ok\nlast_started: 2026-10-20T00:00:00.000Z\nlast_finished: 2026-10-20T00:01:00.000Z\nfailures: 0\n---\n# Old instructions\n';
  const kept = withRecordOf(release, hers);
  check('an update writes the instructions and keeps her run record', kept.includes('every: 1 hour') && kept.includes('# New instructions') && kept.includes('status: ok') && kept.includes('last_finished: 2026-10-20T00:01:00.000Z') && !kept.includes('baxter') && !kept.includes('running'));
  const shipped = resetRunState(release);
  check('the incident: a release ships a job never run, with no run record of the developer\'s', /status: never/.test(shipped) && /failures: 0/.test(shipped) && !/last_|running|baxter/.test(shipped) && shipped.includes('every: 1 hour'));
  check('a file with no run record is shipped as it is', resetRunState('---\nemoji: x\n---\nbody\n') === '---\nemoji: x\n---\nbody\n' && resetRunState('no front matter\n') === 'no front matter\n');
}

// D23: a copy made by new-copy before it recorded installed.json: its first
// update made installed.json, and going back over it read as a first install.
{
  const dir = makeTemp('dear-update-lib-');
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/i.test(k)));
  const git = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: dir, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (p, t) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), t);
  };
  const rollback = () => spawnSync(process.execPath, [updater, 'rollback'], { cwd: dir, encoding: 'utf8', env: { ...env, CLAUDE_PROJECT_DIR: dir } });
  try {
    git('init', '-q');
    put('.claude/hooks/lib/update/update.mjs', '// the updater, as the download had it\n');
    put('README.md', 'as downloaded\n');
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'a new copy');
    put('README.md', 'as v1.1 has it\n');
    put('.claude/release/installed.json', '{"version":"1.1"}\n');
    git('add', '-A');
    git('commit', '-q', '--no-verify', '-m', 'harness: update to v1.1');
    let r = rollback();
    check('the incident: a new copy\'s first update is undone, as any update', r.status === 0 && /UNDONE/.test(r.stdout) && readFileSync(join(dir, 'README.md'), 'utf8') === 'as downloaded\n', r.stdout + r.stderr);

    // A real first install brings the updater itself: still never undone.
    git('init', '-q', '--', join(dir, 'first'));
    const first = join(dir, 'first');
    const g2 = (...a) => execFileSync('git', ['-c', 'user.email=t@local', '-c', 'user.name=t', ...a], { cwd: first, encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
    writeFileSync(join(first, 'README.md'), 'an old copy\n');
    g2('add', '-A');
    g2('commit', '-q', '--no-verify', '-m', 'an old copy');
    mkdirSync(join(first, '.claude/hooks/lib/update'), { recursive: true });
    mkdirSync(join(first, '.claude/release'), { recursive: true });
    writeFileSync(join(first, '.claude/hooks/lib/update/update.mjs'), '// the updater\n');
    writeFileSync(join(first, '.claude/release/installed.json'), '{"version":"1.1"}\n');
    g2('add', '-A');
    g2('commit', '-q', '--no-verify', '-m', 'harness: update to v1.1');
    r = spawnSync(process.execPath, [updater, 'rollback'], { cwd: first, encoding: 'utf8', env: { ...env, CLAUDE_PROJECT_DIR: first } });
    check('a first install, which brought the updater, is still never undone', r.status === 1 && /first install/.test(r.stderr), r.stdout + r.stderr);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Set-up's update step 4 names the copy's own changes an update replaces; it
// rested on reading the copy's log by hand. ownChanges reads them off the
// installed manifest.
{
  const dir = makeTemp('dear-own-changes-');
  const put = (p, t) => {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    writeFileSync(join(dir, p), t);
  };
  try {
    const job = '---\nemoji: x\nevery: 1 hour\nstatus: never\nfailures: 0\n---\n# Do the job\n';
    put('README.md', 'as installed\n');
    put('notes.md', 'as installed\n');
    put('gone.md', 'as installed\n');
    put('kept.md', 'as installed\n');
    put('.claude/jobs/upkeep.md', job);
    put('data/core/now.md', 'her record\n');
    const installed = hashTree(dir, ['README.md', 'notes.md', 'gone.md', 'kept.md', '.claude/jobs/upkeep.md']);
    put('README.md', 'changed here\n');
    put('gone.md', 'changed here\n');
    put('kept.md', 'changed here\n');
    put('.claude/jobs/upkeep.md', job.replace('status: never', 'status: ok\nlast_started: 2026-10-20T00:00:00.000Z'));
    put('data/core/now.md', 'her record, changed\n');
    put('new.md', 'made here\n');
    put('data/core/x.md', 'x\n');
    const next = { ...hashTree(dir, ['kept.md']) };
    put('src.tmp', 'from the release\n');
    const rel = hashTree(dir, ['src.tmp'])['src.tmp'];
    const release = { 'README.md': rel, 'notes.md': rel, 'kept.md': next['kept.md'], '.claude/jobs/upkeep.md': installed['.claude/jobs/upkeep.md'], 'new.md': rel, 'data/core/now.md': rel };
    const own = ownChanges(dir, installed, release);
    check('the copy\'s own change the update overwrites is named', own.includes('README.md'), own.join(', '));
    check('and one the update removes', own.includes('gone.md'), own.join(', '));
    check('and a file the copy made that the release would write over', own.includes('new.md'), own.join(', '));
    check('a file it never changed is not, nor one the release brings as it already is', !own.includes('notes.md') && !own.includes('kept.md'), own.join(', '));
    check('a job file\'s run record is never a change of the copy\'s', !own.includes('.claude/jobs/upkeep.md'), own.join(', '));
    put('.claude/jobs/upkeep.md', job.replace('# Do the job', '# Do the job her way'));
    check('but a change to its instructions is', ownChanges(dir, installed, release).includes('.claude/jobs/upkeep.md'));
    // D1, the larger fix: the record moves to .claude/jobs/state.json, and a release
    // ships job files with none. A copy taking one keeps its old record lines until its
    // next claim moves them: not a change of hers; the state file is never the update's.
    const bare = '---\nemoji: x\nevery: 1 hour\n---\n# Do the job\n';
    put('.claude/jobs/bare.md', bare);
    const bareInstalled = { ...installed, ...hashTree(dir, ['.claude/jobs/bare.md']) };
    put('.claude/jobs/bare.md', bare.replace('---\n#', 'status: ok\nlast_runner: cc-routine\n---\n#'));
    check('nor one installed bare that still carries a record of its own', !ownChanges(dir, bareInstalled, { '.claude/jobs/bare.md': bareInstalled['.claude/jobs/bare.md'] }).includes('.claude/jobs/bare.md'));
    put('.claude/jobs/state.json', '{"upkeep":{"status":"ok"}}\n');
    check('the jobs\' state file is never touched by an update', !touchable('.claude/jobs/state.json') && !ownChanges(dir, { ...installed, '.claude/jobs/state.json': rel }, { '.claude/jobs/state.json': rel }).includes('.claude/jobs/state.json'));
    check('the job files themselves still are', touchable('.claude/jobs/upkeep.md'));
    check('her record is never in it', !own.some((f) => f.startsWith('data/')), own.join(', '));
    check('a first install (no manifest) names nothing', ownChanges(dir, null, release).length === 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (failed) {
  console.error(`update lib test: ${failed} failed`);
  process.exit(1);
}
console.log('update lib test: all passed');
