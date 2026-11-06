// Rule test for session/typed-phrase.mjs: the approval phrase a person types.
//
// The code in the phrase is written in an alphabet with no I, L, O or U, so a
// letter misread for a digit is read as that digit (B2); and a recorded phrase
// lasts the turn it was typed in: her next message without one clears it, a
// relayed frame does not (D-G9; edge cases, 2026-10-29). Run against a
// throwaway folder (CLAUDE_PROJECT_DIR); only the hook itself writes the record.
// Exits non-zero on any failure. Run by selftest.mjs.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHRASE_MARKER } from '../lib/update/secrets.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const dir = makeTemp('dear-phrase-');
const id = 'test-phrase-hook';
const env = { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_CODE_SESSION_ID: id };
delete env.CLAUDE_CODE_REMOTE_SESSION_ID;
const marker = join(dir, '.claude', 'hooks', 'state', `${PHRASE_MARKER}${id}`);

let failed = 0;
const expect = (name, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
};
const type = (prompt) =>
  spawnSync(process.execPath, [join(root, '.claude', 'hooks', 'session', 'typed-phrase.mjs')], {
    env, input: JSON.stringify({ session_id: id, prompt }), timeout: 20000,
  });
const recorded = () => {
  try {
    return JSON.parse(readFileSync(marker, 'utf8')).phrase;
  } catch {
    return null;
  }
};

try {
  mkdirSync(join(dir, '.claude', 'hooks', 'state'), { recursive: true });

  type('Update to version 1.4 7f2k');
  expect('records a typed update phrase in its canonical form', recorded() === 'update to version 1.4 7F2K');
  type('update to version 1.4 7FIK');
  expect('the incident: an I in the code is read as 1', recorded() === 'update to version 1.4 7F1K');
  type('update to version 1.4 oL2k');
  expect('an O is read as 0 and an L as 1', recorded() === 'update to version 1.4 012K');
  type('RELEASE v1.4 7fo2');
  expect('the release phrase reads its code the same way', recorded() === 'RELEASE v1.4 7F02');

  type('[Subagent hand-back]\nsomething relayed mid-turn');
  expect('a relayed frame does not clear a phrase', recorded() === 'RELEASE v1.4 7F02');
  type('ok, thanks');
  expect('the incident: her next message without the phrase clears it', recorded() === null);
  type('and another');
  expect('an ordinary message with nothing recorded records nothing', recorded() === null);
} finally {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
}

process.exit(failed ? 1 : 0);
