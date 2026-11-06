// Rule test: the Stop gate keeps the hazard log as a fingerprint, not a copy, and
// still asks for an entry exactly as before (A-147; SFG-010).
//
// A throwaway project: the first Stop sets the baseline with a 40-character
// fingerprint, never the log's text; a state file in the old form (the whole
// text) compares equal, so a surface change this chat made is still held for an
// entry; a new entry lets it through. Run by selftest.mjs.

import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'safety-at-stop.mjs');
const dir = makeTemp('dear-safety-log-');
const state = join(dir, '.claude', 'hooks', 'state');
mkdirSync(state, { recursive: true });
mkdirSync(join(dir, 'policies'), { recursive: true });
const policy = (rows) => writeFileSync(join(dir, 'policies', 'SAFETY_POLICY.md'), `# Policy\n\n## The hazard log\n\n| Date | Change |\n| --- | --- |\n${rows.join('\n')}\n`);
const log = () => readFileSync(join(dir, 'policies', 'SAFETY_POLICY.md'), 'utf8').slice(readFileSync(join(dir, 'policies', 'SAFETY_POLICY.md'), 'utf8').indexOf('## The hazard log'));
const stop = () => spawnSync(process.execPath, [hook], { env: { ...process.env, CLAUDE_PROJECT_DIR: dir }, input: JSON.stringify({ hook_event_name: 'Stop', session_id: 's1' }), encoding: 'utf8', timeout: 20000 });
const held = (r) => r.status === 2 || /"decision":\s*"block"/.test(r.stdout ?? '');
const saved = () => JSON.parse(readFileSync(join(state, 'safety-surface.json'), 'utf8'));

let failed = 0;
const expect = (name, ok) => { if (!ok) failed += 1; console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); };

writeFileSync(join(dir, 'CLAUDE.md'), 'first\n');
policy(['| 2026-10-01 | first |']);
stop();
expect('the baseline keeps a fingerprint of the log, not its text', /^[0-9a-f]{40}$/.test(saved().log));

// The old form: the whole log as text, as every state file held before this change.
writeFileSync(join(state, 'safety-surface.json'), JSON.stringify({ ...saved(), log: log() }));
writeFileSync(join(dir, 'CLAUDE.md'), 'changed\n');
writeFileSync(join(state, 'touched-s1.json'), JSON.stringify(['CLAUDE.md']));
expect('a surface change with no entry is still held, from a state file of the old form', held(stop()));
expect('and held again on the next Stop', held(stop()));
policy(['| 2026-10-01 | first |', '| 2026-10-31 | the change, assessed |']);
expect('a new entry lets it through', !held(stop()));
expect('the state file stays small', readFileSync(join(state, 'safety-surface.json'), 'utf8').length < 20000);

if (failed) { console.log(`${failed} failing`); process.exit(1); }
console.log('safety log print tests: all pass');
