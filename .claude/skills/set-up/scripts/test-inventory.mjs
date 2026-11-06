// Regression tests for inventory.mjs, against an invented repository.
//
//   node .claude/skills/set-up/scripts/test-inventory.mjs
//
// Every fix the skill learns in its script adds a case here that fails without
// the fix. Fixture data is invented, never taken from a real source — this file
// is harness, and the privacy guard reads it. The fixture is built in the
// repository's temp/ and removed afterwards.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const SC = join(here, 'inventory.mjs');
const TEMP = join(here, '..', '..', '..', '..', 'temp');
mkdirSync(TEMP, { recursive: true });
const R = mkdtempSync(join(TEMP, 'import-data-fixture-'));
const mpath = `${R}.manifest.md`;

const g = (...a) => execFileSync('git', ['-C', R, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
const w = (p, s) => { mkdirSync(join(R, p, '..'), { recursive: true }); writeFileSync(join(R, p), s); };
const run = (...a) => {
  try {
    return { code: 0, out: execFileSync('node', [SC, R, '--exclude', 'temp', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
  } catch (e) {
    return { code: e.status, out: e.stdout + e.stderr };
  }
};
let failed = 0;
const expect = (label, cond) => { if (!cond) failed++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`); };

try {
  g('init', '-q', '-b', 'main'); g('config', 'user.email', 't@t'); g('config', 'user.name', 't');
  g('config', 'core.autocrlf', 'false');
  w('notes/2024-01-01.md', 'journal\n'); w('.gitignore', 'secret.txt\n');
  g('add', '-A'); g('commit', '-qm', 'a');
  g('checkout', '-qb', 'side'); w('diary.md', 'gone\n'); g('add', 'diary.md'); g('commit', '-qm', 'b');
  g('checkout', '-q', 'main');
  w('old.md', 'was here\n'); w('café.md', 'accent\n'); w('temp/x.log', 'x\n'); g('add', '-A'); g('commit', '-qm', 'c');
  unlinkSync(join(R, 'old.md')); unlinkSync(join(R, 'café.md')); g('add', '-A'); g('commit', '-qm', 'd');
  w('secret.txt', 's\n'); w('loose.md', 'u\n'); w('node_modules/x/i.js', 'm\n');

  const inv = run();
  const at = (name) => inv.out.match(new RegExp(`${name}\` \\| history @(\\S+)`))?.[1];
  expect('side-branch file readable', at('diary\\.md') && g('show', `${at('diary\\.md')}:diary.md`).trim() === 'gone');
  expect('deleted file readable', at('old\\.md') && g('show', `${at('old\\.md')}:old.md`).trim() === 'was here');
  expect('non-ASCII deleted file found', !!at('café\\.md'));
  expect('excluded folder absent', !inv.out.includes('temp/'));
  expect('ignored and untracked listed', inv.out.includes('secret.txt` | ignored') && inv.out.includes('loose.md` | untracked'));

  const rowsAs = (cls) => inv.out.split('\n').filter((l) => l.startsWith('|')).map((l) => l.replace(/\| \|$/, `| ${cls} |`)).join('\n');
  const HAND = ['agent-memory', 'git:messages', 'git:edits', 'git:stash'].map((r) => `| ${r} | hand | harness |`).join('\n');
  const manifest = (i, m) => `# M\n\n## Inventory\n\n| Path | Origin | Class |\n|---|---|---|\n${i}\n\n## Map\n\n| Path | Destination | Reason | Done |\n|---|---|---|---|\n${m}\n\n## Conflicts\n`;
  const check = (i, m) => { writeFileSync(mpath, manifest(i, m)); return run('--check', mpath); };

  let r = check(`${rowsAs('harness')}\n${HAND}`, '');
  expect('all accounted for passes', r.code === 0);
  r = check(`${rowsAs('personal')}\n${HAND}`, '| `notes/2024-01-01.md` | journal/2024-01-01.md | | |');
  expect('personal rows without a destination fail', r.code === 1 && r.out.includes('no destination or reason in Map: loose.md'));
  r = check(rowsAs('harness'), '');
  expect('missing hand rows fail', r.code === 1 && r.out.includes('hand row missing from Inventory: git:stash'));
  r = check(`${rowsAs('secret')}\n${HAND}`, '');
  expect('secret class accepted, needs no map', r.code === 0);
  r = check(`| \`notes/2024-01-01.md\` | tracked | personal |\n${HAND}`, '| `notes/2024-01-01.md` | x | | |');
  expect('path missing from Inventory fails', r.code === 1 && r.out.includes('not in Inventory: loose.md'));
  r = check(`${rowsAs('maybe')}\n${HAND}`, '');
  expect('unknown class fails', r.code === 1 && r.out.includes('no class'));

  // Learned cases go below, one block each, named for the case in ../cases.md.

  // Case 8: a newline or a pipe in a filename. Windows can't create either, so
  // they arrive the way a source from another system brings them: in history.
  {
    const blob = execFileSync('git', ['-C', R, 'hash-object', '-w', '--stdin'], { input: 'odd\n', encoding: 'utf8' }).trim();
    for (const name of ['two\nlines.md', 'a|b.md']) {
      execFileSync('git', ['-C', R, '-c', 'core.protectNTFS=false', 'update-index', '--add', '--cacheinfo', `100644,${blob},${name}`]);
    }
    g('commit', '-qm', 'odd names');
    for (const name of ['two\nlines.md', 'a|b.md']) execFileSync('git', ['-C', R, 'rm', '-q', '--cached', name]);
    g('commit', '-qm', 'odd names gone');
    const odd = run();
    expect('case 8: newline filename listed once, escaped', odd.out.includes('`two\\nlines.md` | history'));
    expect('case 8: pipe filename listed once, escaped', odd.out.includes('`a\\|b.md` | history'));
    const oddRows = odd.out.split('\n').filter((l) => l.startsWith('|')).map((l) => l.replace(/\| \|$/, '| harness |')).join('\n');
    r = check(`${oddRows}\n${HAND}`, '');
    expect('case 8: escaped rows match on --check', r.code === 0);
  }

  // Case 9: a source copied into a folder of another repository, its history
  // carried as a bundle. Git must not answer for the outer repository.
  {
    w('.gitignore', 'secret.txt\nnested/\n');
    w('nested/src/entry.md', 'n\n'); w('nested/src/history.bundle', 'b\n');
    const { stdout, stderr } = spawnSync('node', [SC, join(R, 'nested', 'src')], { encoding: 'utf8' });
    expect('case 9: nested source rows are `file`, not the outer repo\'s `ignored`', stdout.includes('entry.md` | file'));
    expect('case 9: no outer history offered as the source\'s', !stdout.includes('history @'));
    expect('case 9: bundle named on stderr', stderr.includes('history in a bundle: history.bundle'));
  }

  // Rehearsal 2026-10-27: an unmerged branch edits a file main also has (a stranded
  // save to the timeline). Its version must get a row, or only a bundle keeps it.
  {
    g('checkout', '-qb', 'stranded'); w('notes/2024-01-01.md', 'journal\nadded on the branch\n'); g('add', '-A'); g('commit', '-qm', 'e');
    g('checkout', '-q', 'main');
    const b = run();
    const at = b.out.match(/`branch:stranded:notes\/2024-01-01\.md` \| branch @(\S+)/)?.[1];
    expect('rehearsal: a branch edit to a tracked file gets its own row', !!at);
    expect('rehearsal: that row reads back the branch version', !!at && g('show', `${at}:notes/2024-01-01.md`).includes('added on the branch'));
    expect('rehearsal: a merged branch adds no row', !b.out.includes('branch:main:'));
  }

  // Second rehearsal 2026-10-27: the credential look before a bundle printed record
  // lines, and an older harness's own word "token" decided nothing. --secrets prints
  // no line: word matches by path, shapes by commit and path, exit 1 on a shape.
  {
    w('notes/word.md', 'PLANTED-WORD-LINE: my password is on the fridge\n'); g('add', '-A'); g('commit', '-qm', 'f');
    let s = run('--secrets');
    expect('second rehearsal: words alone pass, counted by path', s.code === 0 && /notes\/word\.md: 1/.test(s.out));
    expect('second rehearsal: no line is printed', !s.out.includes('PLANTED-WORD-LINE'));
    const shaped = `${'7'.repeat(10)}:${'Ab'.repeat(17)}c`; // a bot token's shape, made here, never stored
    w('notes/key.txt', `PLANTED-KEY-LINE ${shaped}\n`); g('add', '-A'); g('commit', '-qm', 'g');
    s = run('--secrets');
    expect('second rehearsal: a credential shape fails, named by path', s.code === 1 && /notes\/key\.txt/.test(s.out));
    expect('second rehearsal: the credential is never printed', !s.out.includes(shaped) && !s.out.includes('PLANTED-KEY-LINE'));
  }

  // Edge test 2026-10-29: --secrets on a source inside another repository read the
  // outer history and printed its paths; on a plain folder it threw. An archive in
  // a source was one row, never read, and nothing said so.
  {
    const nested = spawnSync('node', [SC, join(R, 'nested', 'src'), '--secrets'], { encoding: 'utf8' });
    expect('edge: --secrets inside another repository exits 2', nested.status === 2 && /not a repository of its own/.test(nested.stderr));
    expect('edge: --secrets prints none of the outer history', !/notes\//.test(nested.stdout + nested.stderr));
    const plain = mkdtempSync(join(TEMP, 'import-plain-'));
    try {
      const p = spawnSync('node', [SC, plain, '--secrets'], { encoding: 'utf8', env: { ...process.env, GIT_CEILING_DIRECTORIES: TEMP } });
      expect('edge: --secrets on a plain folder exits 2, no throw', p.status === 2 && /not a git repository/.test(p.stderr) && !/at .*inventory\.mjs/.test(p.stderr));
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
    w('nested/src/old-notes.zip', 'z\n');
    const { stderr } = spawnSync('node', [SC, join(R, 'nested', 'src')], { encoding: 'utf8' });
    expect('edge: an archive is named on stderr', stderr.includes('an archive: old-notes.zip'));
  }

  // Round 2, 2026-10-29 (C24): --secrets read only the text of ordinary commits'
  // changes: a key in a commit message, in a binary file, or added by a merge
  // alone went unseen, and a .zst or .xz archive was not named.
  {
    const fresh = mkdtempSync(join(TEMP, 'import-secrets-'));
    const h = (...a) => execFileSync('git', ['-C', fresh, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const scan = () => spawnSync('node', [SC, fresh, '--secrets'], { encoding: 'utf8' });
    const shaped = () => `${'8'.repeat(9)}:${'Cd'.repeat(17)}e`; // a bot token's shape, made here, never stored
    try {
      h('init', '-q', '-b', 'main'); h('config', 'user.email', 't@t'); h('config', 'user.name', 't');
      writeFileSync(join(fresh, 'a.md'), 'a\n'); h('add', '-A'); h('commit', '-qm', 'start');
      let s = scan();
      expect('round 2: a clean history passes', s.status === 0);

      h('commit', '-q', '--allow-empty', '-m', `PLANTED-MESSAGE ${shaped()}`);
      s = scan();
      expect('round 2: a key in a commit message fails, named as a message', s.status === 1 && /\(message\)/.test(s.stdout) && !s.stdout.includes(shaped()) && !s.stdout.includes('PLANTED-MESSAGE'));
      h('reset', '-q', '--hard', 'HEAD~1');
      h('reflog', 'expire', '--expire=now', '--all'); h('gc', '-q', '--prune=now');

      writeFileSync(join(fresh, 'blob.bin'), Buffer.concat([Buffer.from([0, 1, 2, 0]), Buffer.from(` ${shaped()} `), Buffer.from([0])]));
      h('add', '-A'); h('commit', '-qm', 'binary');
      s = scan();
      expect('round 2: a key in a binary file fails, named by path', s.status === 1 && /blob\.bin/.test(s.stdout) && !s.stdout.includes(shaped()));
      h('reset', '-q', '--hard', 'HEAD~1');
      h('reflog', 'expire', '--expire=now', '--all'); h('gc', '-q', '--prune=now');

      h('checkout', '-qb', 'other'); writeFileSync(join(fresh, 'b.md'), 'b\n'); h('add', '-A'); h('commit', '-qm', 'b');
      h('checkout', '-q', 'main'); writeFileSync(join(fresh, 'c.md'), 'c\n'); h('add', '-A'); h('commit', '-qm', 'c');
      h('merge', '-q', '--no-commit', 'other');
      writeFileSync(join(fresh, 'a.md'), `a\n${shaped()}\n`); h('add', '-A'); h('commit', '-qm', 'merge');
      s = scan();
      expect('round 2: a key added by a merge alone fails, named by path', s.status === 1 && /a\.md/.test(s.stdout) && !s.stdout.includes(shaped()));

      // Round 3 (C26): a token pasted from an encoded address, its colon as %3a.
      h('checkout', '-qb', 'encoded');
      writeFileSync(join(fresh, 'url.md'), `${shaped().replace(':', '%3a')}\n`); h('add', '-A'); h('commit', '-qm', 'url');
      s = scan();
      expect('round 3: a key with its colon encoded in lowercase fails, named by path', s.status === 1 && /url\.md/.test(s.stdout));
      h('checkout', '-q', 'main'); h('branch', '-q', '-D', 'encoded');
      h('reflog', 'expire', '--expire=now', '--all'); h('gc', '-q', '--prune=now');

      // Round 3 (C23): a history too long to hold whole crashed the scan, and the
      // crash exited 1, read as a credential found. Unreadable now says so: exit 2.
      const blob = h('rev-parse', 'HEAD:c.md').trim();
      const loose = join(fresh, '.git', 'objects', blob.slice(0, 2), blob.slice(2));
      h('repack', '-q', '-a', '-d');
      const packs = join(fresh, '.git', 'objects', 'pack');
      // Unpacked again, and the one object removed: the history can no longer be read whole.
      for (const f of readdirSync(packs).filter((x) => x.endsWith('.pack'))) {
        const pack = readFileSync(join(packs, f));
        for (const x of readdirSync(packs).filter((y) => y.startsWith(f.replace(/\.pack$/, '')))) unlinkSync(join(packs, x));
        execFileSync('git', ['-C', fresh, 'unpack-objects', '-q'], { input: pack });
      }
      unlinkSync(loose);
      s = scan();
      expect('round 3: an unreadable history exits 2, never 1, with a plain line', s.status === 2 && /could not read the whole history/.test(s.stderr) && !/at .*inventory\.mjs/.test(s.stderr));

      for (const ext of ['zst', 'xz', 'bz2', 'txz', 'tbz2']) writeFileSync(join(fresh, `old.${ext}`), 'z\n');
      const { stderr } = spawnSync('node', [SC, fresh], { encoding: 'utf8' });
      expect('round 2: .zst, .xz, .bz2, .txz and .tbz2 archives are named', ['zst', 'xz', 'bz2', 'txz', 'tbz2'].every((ext) => stderr.includes(`an archive: old.${ext}`)));
    } finally {
      rmSync(fresh, { recursive: true, force: true });
    }
  }
} finally {
  rmSync(R, { recursive: true, force: true });
  rmSync(mpath, { force: true });
}

console.log(failed ? `${failed} failed` : 'all passed');
process.exit(failed ? 1 : 0);
