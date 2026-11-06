// Tests' throwaway commits stay unsigned (lib/unsigned-git.mjs, T-781). Two things must
// hold for that: the runners' environment turns signing off, and no test strips that
// switch away when it clears git's own variables from its environment.

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from './temp-litter.mjs';
import { unsignedEnv, withoutUnsigned } from './unsigned-git.mjs';

const lib = dirname(fileURLToPath(import.meta.url));
const root = join(lib, '..', '..', '..');
let failed = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failed += 1; };

// 1. The switch turns signing off, adds to a count already set, and comes off again.
const e = unsignedEnv({ GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'a.b', GIT_CONFIG_VALUE_0: 'c' });
check('adds after keys already set', e.GIT_CONFIG_KEY_0 === 'a.b' && e.GIT_CONFIG_KEY_1 === 'commit.gpgsign' && e.GIT_CONFIG_VALUE_1 === 'false' && e.GIT_CONFIG_COUNT === '3');
check('comes off whole', Object.keys(withoutUnsigned(e)).every((k) => !k.startsWith('GIT_CONFIG_')));

// 2. Under it, a commit in a repository whose own config asks to sign, with a signer that
// always fails, still commits, unsigned: the signer is never called.
const dir = makeTemp('dear-unsigned-');
try {
  const env = unsignedEnv(Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^GIT_/.test(k))));
  const g = (...a) => execFileSync('git', a, { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  g('init', '-q');
  for (const [k, v] of [['user.email', 't@t'], ['user.name', 't'], ['core.hooksPath', '/dev/null'], ['commit.gpgsign', 'true'], ['gpg.format', 'openpgp'], ['gpg.program', '/bin/false']]) g('config', k, v);
  let ok = true;
  try { g('commit', '-q', '--allow-empty', '-m', 'a test commit'); } catch { ok = false; }
  check('a test commit never calls the signer', ok && !/^gpgsig /m.test(g('cat-file', 'commit', 'HEAD')));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

// 3. No test clears GIT_CONFIG_* with the rest of git's variables. A filter that drops
// every GIT_ name drops the switch too, and its commits go back through the signer. A
// test that signs through a made-up signer of its own marks the line signs-on-purpose.
const STRIPS_ALL = /startsWith\(['"]GIT_['"]\)|\/\^GIT_\/i?\.test\(|\/\^\(GIT_\|/;
const offenders = [];
const walk = (d) => {
  for (const ent of readdirSync(d, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.git')) continue;
    const p = join(d, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/^test-.*\.mjs$/.test(ent.name) && ent.name !== 'test-quiet-git.mjs' && ent.name !== 'test-unsigned-git.mjs') {
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => { if (STRIPS_ALL.test(line) && !line.includes('signs-on-purpose')) offenders.push(`${relative(root, p)}:${i + 1}`); });
    }
  }
};
for (const d of ['.claude/hooks', 'ux/scripts', 'ux/lib']) walk(join(root, d));
check(`no test strips the switch${offenders.length ? `: ${offenders.join(', ')}` : ''}`, offenders.length === 0);

if (failed) { console.log(`\n${failed} failing`); process.exit(1); }
console.log('\nunsigned tests: all cases hold');
