// PRV-005: revoking someone's access actually revokes it. The session names the
// account it was issued to, so removing or renaming that account, or changing
// the signing secret, ends every token already issued; and an edit to the .env
// takes effect on the next request, in the same process, with no restart.
//
// Each case runs in a child process, so the environment it is given is the
// only one it sees; the last case edits a .env of its own while one process
// runs, which is the revocation an operator makes.

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../../.claude/hooks/lib/temp-litter.mjs';

const UX = fileURLToPath(new URL('../', import.meta.url));
// A file:// URL, not a path: on Windows `node --import C:\...` is refused (ERR_UNSUPPORTED_ESM_URL_SCHEME).
const REGISTER = new URL('./register.mjs', import.meta.url).href;

const accounts = (...names) => JSON.stringify(names.map((username) => ({ username, password: `pw-${username}` })));

// Runs `body` as a module under the same loader as the tests, with this
// environment, and returns what it printed as JSON.
function inFreshProcess(env, body) {
  const run = spawnSync(process.execPath, ['--import', REGISTER, '--input-type=module', '-e', body], {
    cwd: UX,
    encoding: 'utf8',
    env: { ...shellWithout(), DEAR_SESSION_DAYS: '30', ...env },
  });
  assert.equal(run.status, 0, run.stderr);
  return JSON.parse(run.stdout.trim().split('\n').pop());
}

// The shell's environment less any credential it holds, so a case is given only
// the credentials it names.
function shellWithout() {
  const env = { ...process.env };
  for (const key of ['DEAR_ACCOUNTS', 'DEAR_SESSION_SECRET', 'DEAR_SESSION_DAYS', 'DEAR_ENV_FILE']) delete env[key];
  return env;
}

const issue = (env, username) =>
  inFreshProcess(env, `import { createToken } from '@/lib/auth.js'; console.log(JSON.stringify(await createToken(${JSON.stringify(username)})));`);

const whoIs = (env, token) =>
  inFreshProcess(env, `import { sessionUser } from '@/lib/auth.js'; console.log(JSON.stringify(await sessionUser(${JSON.stringify(token)})));`);

const base = { DEAR_ACCOUNTS: accounts('user-a', 'user-b'), DEAR_SESSION_SECRET: 'secret-one' };

describe('PRV-005: revoking access', () => {
  test('a token is good while its account is on the list', () => {
    assert.equal(whoIs(base, issue(base, 'user-a')), 'user-a');
  });

  test('removing the account ends the tokens issued to it, and only those', () => {
    const token = issue(base, 'user-a');
    const userBOnly = { ...base, DEAR_ACCOUNTS: accounts('user-b') };
    assert.equal(whoIs(userBOnly, token), null);
    assert.equal(whoIs(userBOnly, issue(base, 'user-b')), 'user-b');
  });

  test('renaming the account ends its tokens', () => {
    const token = issue(base, 'user-a');
    assert.equal(whoIs({ ...base, DEAR_ACCOUNTS: accounts('user-aa', 'user-b') }, token), null);
  });

  test('changing the signing secret ends every session at once', () => {
    const tokenA = issue(base, 'user-a');
    const tokenB = issue(base, 'user-b');
    const rotated = { ...base, DEAR_SESSION_SECRET: 'secret-two' };
    assert.equal(whoIs(rotated, tokenA), null);
    assert.equal(whoIs(rotated, tokenB), null);
  });

  test('with no signing secret there is no session at all', () => {
    assert.equal(whoIs({ ...base, DEAR_SESSION_SECRET: '' }, issue(base, 'user-a')), null);
  });

  test('an account removed from the .env is refused at once, without a restart', () => {
    const dir = makeTemp('dear-auth-env-');
    try {
      const file = join(dir, '.env');
      const envFile = (names, secret) => `DEAR_ACCOUNTS='${accounts(...names)}'\nDEAR_SESSION_SECRET=${secret}\n`;
      writeFileSync(file, envFile(['user-a', 'user-b'], 'secret-one'));
      // One process throughout: it signs a token in, the file is edited under
      // it, and the same process is asked again. The file is rewritten with a
      // different length each time, so the change is seen even where the
      // clock's resolution would hide a second write in the same tick.
      const seen = inFreshProcess(
        { DEAR_ENV_FILE: file },
        `import { writeFileSync } from 'node:fs';
         import { authConfigured, createToken, sessionUser } from '@/lib/auth.js';
         const file = ${JSON.stringify(file)};
         const a = await createToken('user-a');
         const b = await createToken('user-b');
         const before = [await sessionUser(a), await sessionUser(b)];
         writeFileSync(file, ${JSON.stringify(envFile(['user-b'], 'secret-one'))});
         const removed = [await sessionUser(a), await sessionUser(b)];
         writeFileSync(file, ${JSON.stringify(envFile(['user-b'], 'secret-two-longer'))});
         const rotated = [await sessionUser(b)];
         writeFileSync(file, '');
         const emptied = authConfigured();
         console.log(JSON.stringify({ before, removed, rotated, emptied }));`,
      );
      assert.deepEqual(seen.before, ['user-a', 'user-b'], 'both accounts are good while on the list');
      assert.deepEqual(seen.removed, [null, 'user-b'], 'the removed account is refused, the other kept');
      assert.deepEqual(seen.rotated, [null], 'a changed secret ends every session at once');
      assert.equal(seen.emptied, false, 'an emptied file fails closed');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('a credential exported in the shell still wins over the file', () => {
    const dir = makeTemp('dear-auth-env-');
    try {
      const file = join(dir, '.env');
      writeFileSync(file, `DEAR_ACCOUNTS='${accounts('user-file')}'\nDEAR_SESSION_SECRET=secret-file\n`);
      const env = { ...base, DEAR_ENV_FILE: file };
      assert.equal(whoIs(env, issue(env, 'user-a')), 'user-a');
      assert.equal(whoIs(env, issue(env, 'user-file')), null);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
