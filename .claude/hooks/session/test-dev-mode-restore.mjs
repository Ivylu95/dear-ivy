// Rule test (T-849): development mode outlives the machine. A chat switched on is saved in git;
// resumed on a fresh machine (its marker gone), the session start switches it back on. A /clear
// still starts everyday and drops it from the list; a chat never switched on, and a copy with no
// dev/, are never switched on.
//
// Run: node .claude/hooks/session/test-dev-mode-restore.mjs. In a throwaway folder, never this repository.

import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const devMode = join(here, '..', 'lib', 'dev-mode.mjs');
const reset = join(here, 'dev-mode-reset.mjs');
let failed = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) failed++;
};

const dir = makeTemp('dear-dev-restore-');
try {
  mkdirSync(join(dir, 'dev'), { recursive: true });
  mkdirSync(join(dir, '.claude', 'hooks', 'state'), { recursive: true });
  const env = (id) => ({ ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_CODE_REMOTE_SESSION_ID: id, CLAUDE_CODE_SESSION_ID: id, DEAR_RECORD_READONLY: '' });
  const marker = (id) => join(dir, '.claude', 'hooks', 'state', `dev-mode-${id}`);
  const saved = () => (existsSync(join(dir, '.claude', 'dev-mode-chats')) ? readFileSync(join(dir, '.claude', 'dev-mode-chats'), 'utf8') : '');
  const start = (id, source) => spawnSync(process.execPath, [reset], { input: JSON.stringify({ session_id: id, source }), env: env(id), encoding: 'utf8' });

  spawnSync(process.execPath, [devMode], { env: env('cse_A'), encoding: 'utf8', cwd: dir });
  check('switching a chat on saves it in the list git keeps', existsSync(marker('cse_A')) && saved().includes('cse_A'));
  rmSync(marker('cse_A'), { force: true });
  start('cse_A', 'resume');
  check('resumed on a fresh machine, it is on again (T-849)', existsSync(marker('cse_A')));
  rmSync(marker('cse_A'), { force: true });
  start('cse_A', 'startup');
  check('a fresh start of the same chat is on again too', existsSync(marker('cse_A')));
  spawnSync(process.execPath, [devMode], { env: env('test-turn-kind-1-0'), encoding: 'utf8', cwd: dir });
  check('a test\'s made-up chat is never saved in the list (2026-11-05)', existsSync(marker('test-turn-kind-1-0')) && !saved().includes('test-turn-kind-1-0'));
  start('cse_B', 'resume');
  check('a chat never switched on stays everyday', !existsSync(marker('cse_B')));
  start('cse_A', 'clear');
  check('a /clear still starts everyday, and drops the chat from the list', !existsSync(marker('cse_A')) && !saved().includes('cse_A'));
  start('cse_A', 'resume');
  check('and after it, a resume does not switch it back', !existsSync(marker('cse_A')));
  spawnSync(process.execPath, [devMode], { env: env('cse_C'), encoding: 'utf8', cwd: dir });
  rmSync(marker('cse_C'), { force: true });
  rmSync(join(dir, 'dev'), { recursive: true });
  start('cse_C', 'resume');
  check('a copy with no dev/ never switches a chat on, saved or not', !existsSync(marker('cse_C')));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed ? `dev-mode restore: ${failed} failed` : 'dev-mode restore: all cases hold');
process.exit(failed ? 1 : 0);
