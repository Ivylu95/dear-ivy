// Record migrations (lib/migrations.mjs, .claude/migrations/): a session start runs
// each pending numbered script once, keeps every superseded file in
// archive/migrations/, records what ran, and writes nothing when none is pending;
// a broken or non-idempotent script writes nothing; and the release check refuses a
// reader change with no migration and no declaration.
//
//   node .claude/hooks/lib/test-migrations.mjs
//
// Invented records in throwaway folders only. Exits non-zero on any failure.

import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LEDGER, MIGRATIONS_DIR, archivePathFor, formatProblems, readFormats, readLedger, readScripts, runMigrations } from './migrations.mjs';
import { makeTemp } from './temp-litter.mjs';

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : `\n     ${detail}`}`);
  if (!ok) failed += 1;
};

const FORMATS = JSON.stringify({
  formats: {
    widgets: { files: ['core/widgets.json', 'core/more-widgets.json'], readers: ['.claude/hooks/lib/widgets.mjs'], version: 2 },
  },
});
const put = (dir, rel, text) => {
  mkdirSync(join(dir, rel, '..'), { recursive: true });
  writeFileSync(join(dir, rel), text);
};
// v1 → v2: a flat list becomes { items: [...] }. Idempotent: an object is left alone.
const GOOD = `export function migrate(text) {
  const v = JSON.parse(text);
  if (!Array.isArray(v)) return null;
  return JSON.stringify({ items: v });
}
`;

function setUp(scripts) {
  const dir = makeTemp('migrations-dir-');
  put(dir, 'formats.json', FORMATS);
  for (const [name, body] of Object.entries(scripts)) put(dir, name, body);
  const record = makeTemp('migrations-record-');
  put(record, 'core/widgets.json', JSON.stringify(['a', 'b']));
  return { dir, record };
}

// 1. A pending migration: rewritten, the old kept, recorded; then nothing again.
{
  const { dir, record } = setUp({ '001-widgets-v2.mjs': GOOD });
  const first = await runMigrations(record, { dir, today: '2026-01-05' });
  check('a pending migration runs', first.ran.join() === '001-widgets-v2.mjs' && !first.problems.length, JSON.stringify(first));
  check('the file is in the new shape', readFileSync(join(record, 'core/widgets.json'), 'utf8') === '{"items":["a","b"]}');
  const kept = join(record, 'archive/migrations/001-core-widgets-2026-01-05.json');
  check('the superseded file is kept whole in archive/migrations/', existsSync(kept) && readFileSync(kept, 'utf8') === '["a","b"]');
  check('an absent file of the format is left absent', !existsSync(join(record, 'core/more-widgets.json')));
  const ledger = readLedger(record);
  check('the ledger records what ran and what it archived', ledger.ran.length === 1 && ledger.ran[0].script === '001-widgets-v2.mjs' && ledger.ran[0].archived[0] === 'archive/migrations/001-core-widgets-2026-01-05.json');
  const ledgerText = readFileSync(join(record, LEDGER), 'utf8');
  const second = await runMigrations(record, { dir, today: '2026-01-06' });
  check('a second session start runs nothing', !second.ran.length && !second.archived.length && !second.problems.length);
  check('and leaves the ledger as it was', readFileSync(join(record, LEDGER), 'utf8') === ledgerText);
  check('and archives nothing more', readdirSync(join(record, 'archive/migrations')).length === 2);
}

// 2. Nothing pending: not a byte written, no ledger made.
{
  const { dir, record } = setUp({});
  const out = await runMigrations(record, { dir });
  check('with no migration, nothing runs', !out.ran.length && !out.problems.length);
  check('and no ledger or archive is made', !existsSync(join(record, 'archive')));
}

// 3. A file already in the new shape is not archived, but the script is recorded.
{
  const { dir, record } = setUp({ '001-widgets-v2.mjs': GOOD });
  put(record, 'core/widgets.json', '{"items":[]}');
  const out = await runMigrations(record, { dir, today: '2026-01-05' });
  check('a record already in shape is left untouched', out.ran.length === 1 && !out.archived.length && readFileSync(join(record, 'core/widgets.json'), 'utf8') === '{"items":[]}');
  check('and the migration is still recorded as run', readLedger(record).ran[0]?.archived.length === 0);
}

// 4. Non-idempotent: refused, nothing written, nothing recorded, later ones wait.
{
  const { dir, record } = setUp({
    '001-widgets-v2.mjs': 'export function migrate(text) { return text + "!"; }\n',
    '002-widgets-v2.mjs': GOOD,
  });
  const out = await runMigrations(record, { dir });
  check('a script whose result would change again is refused', out.problems.some((p) => /idempotent/.test(p)), JSON.stringify(out.problems));
  check('the file is left as it was', readFileSync(join(record, 'core/widgets.json'), 'utf8') === '["a","b"]');
  check('nothing is recorded or archived', !existsSync(join(record, 'archive')));
  check('and no later migration runs past it', !out.ran.length);
}

// 5. A script that throws on its second file writes neither.
{
  const { dir, record } = setUp({ '001-widgets-v2.mjs': `export function migrate(text, { path }) { if (path.includes('more')) throw new Error('cannot read it'); ${GOOD.split('\n').slice(1, -2).join(' ')} }\n` });
  put(record, 'core/more-widgets.json', '["c"]');
  const out = await runMigrations(record, { dir });
  check('a script that fails part-way is reported', out.problems.some((p) => /cannot read it/.test(p)), JSON.stringify(out.problems));
  check('and writes none of its files', readFileSync(join(record, 'core/widgets.json'), 'utf8') === '["a","b"]' && !existsSync(join(record, 'archive')));
}

// 6. A badly named or unregistered script holds the run.
{
  const { dir, record } = setUp({ 'widgets-fix.mjs': GOOD });
  const out = await runMigrations(record, { dir });
  check('a script not named NNN-<format>-v<N>.mjs holds the run', out.problems.length === 1 && !out.ran.length);
  const two = setUp({ '001-gadgets-v2.mjs': GOOD });
  const out2 = await runMigrations(two.record, { dir: two.dir });
  check('a script for an unknown format holds the run', out2.problems.some((p) => /no format "gadgets"/.test(p)) && !out2.ran.length);
}

// 7. Numbering and archive names.
{
  const { scripts, problems } = readScripts(['010-widgets-v3.mjs', '002-widgets-v2.mjs', 'formats.json', 'README.md']);
  check('scripts run in number order', scripts.map((s) => s.n).join() === '2,10' && !problems.length);
  check('a number used twice is refused', readScripts(['001-widgets-v2.mjs', '001-widgets-v3.mjs']).problems.length === 1);
  const record = makeTemp('migrations-names-');
  put(record, 'archive/migrations/003-PROFILE-2026-01-05.yaml', 'older');
  check('an archive name never lands on another', archivePathFor(record, 'PROFILE.yaml', 3, '2026-01-05') === 'archive/migrations/003-PROFILE-2026-01-05-2.yaml');
}

// 8. The release check (prepare).
{
  const v1 = JSON.stringify({ formats: { widgets: { files: ['w.json'], readers: ['lib/w.mjs'], version: 1 } } });
  const v2 = v1.replace('"version":1', '"version":2');
  const changed = (f) => f === 'lib/w.mjs';
  const same = () => false;
  const p = (o) => formatProblems({ changed: same, scripts: [], ...o });
  check('a release changing no reader passes', !p({ prev: v1, next: v1 }).length);
  check('a reader changed with no version raised is refused', /--same-format widgets/.test(p({ prev: v1, next: v1, changed }).join()));
  check('unless its shape is declared unchanged', !p({ prev: v1, next: v1, changed, sameFormat: ['widgets'] }).length);
  check('a version raised with no migration is refused', /no migration brings it to v2/.test(p({ prev: v1, next: v2, changed }).join()));
  check('a version raised with its migration passes', !p({ prev: v1, next: v2, changed, scripts: ['001-widgets-v2.mjs'] }).length);
  check('a version lowered is refused', /went down/.test(p({ prev: v2, next: v1 }).join()));
  check('a migration above the version is refused', /above its version/.test(p({ prev: v1, next: v1, scripts: ['001-widgets-v2.mjs'] }).join()));
  check('a badly named script is refused', p({ prev: v1, next: v1, scripts: ['fix.mjs'] }).length === 1);
  check('with no earlier registry, only the folder itself is checked', !p({ prev: '', next: v1, changed }).length);
}

// 9. The shipped folder: a valid registry, readers that exist, well-named scripts,
//    and a run on an invented record of the current shape that changes nothing.
{
  let formats = {};
  try {
    formats = readFormats(readFileSync(join(MIGRATIONS_DIR, 'formats.json'), 'utf8'));
    check('.claude/migrations/formats.json is valid', true);
  } catch (e) {
    check('.claude/migrations/formats.json is valid', false, e.message);
  }
  const repo = join(MIGRATIONS_DIR, '..', '..');
  const missing = Object.values(formats).flatMap((f) => f.readers).filter((r) => !existsSync(join(repo, r)));
  check('every reader it names exists', !missing.length, missing.join(', '));
  const names = readdirSync(MIGRATIONS_DIR);
  const { scripts, problems } = readScripts(names);
  const bad = [...problems, ...scripts.filter((s) => !formats[s.format] || s.to > formats[s.format].version).map((s) => s.file)];
  check('every migration here is well named and registered', !bad.length, bad.join(', '));
  check('the folder holds only the registry, its README and migrations', names.every((n) => n === 'formats.json' || n === 'README.md' || n.endsWith('.mjs')), names.join(', '));
  const record = makeTemp('migrations-sample-');
  put(record, 'PROFILE.yaml', readFileSync(join(repo, 'modules/core/templates/first-contact/PROFILE.yaml'), 'utf8'));
  put(record, 'core/calendar/reminders.json', JSON.stringify({ timezone: 'Etc/UTC', reminders: [{ id: 'r1', text: 'an invented reminder', at: '2026-01-01 09:00' }] }));
  const out = await runMigrations(record);
  check('the shipped migrations run clean on a record in the current shape', !out.problems.length && !out.archived.length, out.problems.join('; '));
}

// 10. The hook selftest runs the session brief on the live repository with
//     DEAR_RECORD_READONLY, from every session start and every harness commit's
//     gate, and its cases must write nothing of the record (round 45): a pending
//     migration ran there on her real record, beside the session's own start and
//     its save. A copy of the hooks on an invented record; the same brief without
//     the variable still migrates.
{
  const root = makeTemp('migrations-brief-');
  const here = join(MIGRATIONS_DIR, '..', '..');
  cpSync(join(here, '.claude', 'hooks'), join(root, '.claude', 'hooks'), { recursive: true, filter: (p) => !/[\\/]state([\\/]|$)/.test(p.slice(here.length)) });
  cpSync(join(here, 'modules'), join(root, 'modules'), { recursive: true });
  put(root, '.claude/migrations/formats.json', JSON.stringify({ formats: { reminders: { files: ['core/calendar/reminders.json'], readers: ['.claude/hooks/lib/reminder-schedule.mjs'], version: 2 } } }));
  put(root, '.claude/migrations/001-reminders-v2.mjs', `export function migrate(text) {
  const v = JSON.parse(text);
  return Array.isArray(v) ? JSON.stringify({ reminders: v }) : null;
}
`);
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_(?!CONFIG_)/.test(k) && k !== 'DEAR_RECORD_READONLY'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: root, env, stdio: 'ignore' });
  const old = JSON.stringify(['an invented reminder']);
  put(root, 'data/core/calendar/reminders.json', old);
  const brief = (extra) => spawnSync(process.execPath, [join(root, '.claude', 'hooks', 'session', 'session-brief.mjs')], { cwd: root, env: { ...env, CLAUDE_PROJECT_DIR: root, ...extra }, input: '{}', encoding: 'utf8', timeout: 120000 });
  brief({ DEAR_RECORD_READONLY: '1' });
  check('under the selftest the session brief migrates nothing of the record', readFileSync(join(root, 'data/core/calendar/reminders.json'), 'utf8') === old && !existsSync(join(root, 'data', LEDGER)));
  brief({});
  check('a real session start still migrates it', readFileSync(join(root, 'data/core/calendar/reminders.json'), 'utf8') !== old && existsSync(join(root, 'data', LEDGER)));
}

if (failed) {
  console.log(`\n${failed} failed`);
  process.exit(1);
}
console.log('\nmigrations: all pass');
