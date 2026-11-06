// Rule test for spec-context.mjs: an edit to a register regenerates
// .claude/spec-statements.json, so a row just amended is cited in its new words
// without waiting for the commit gate (WKB-007); an edit elsewhere leaves the
// file alone; and a copy without dev/ names no spec (ARC-008). Run against a throwaway copy laid out as the harness is, never
// this repository. Run by selftest.mjs; exits non-zero on any failure.

import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hooks = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(hooks, '..', '..');
const dir = makeTemp('dear-spec-context-');

const row = (words) => `# Test [TST]\n\n---\n\n## **TST-001 • ✅**\n\n> ---\n>\n> ### **(§) SPEC STATEMENT —**\n>\n> ${words}\n>\n> ---\n`;
const register = join(dir, 'dev', 'specs', 'system', 'test.md');
const statementsFile = join(dir, '.claude', 'spec-statements.json');
const statement = () => {
  try {
    return JSON.parse(readFileSync(statementsFile, 'utf8')).statements['TST-001'] ?? '';
  } catch {
    return '';
  }
};
const edit = (path) =>
  spawnSync(process.execPath, [join(dir, '.claude', 'hooks', 'session', 'spec-context.mjs')], {
    cwd: dir,
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir },
    input: JSON.stringify({ session_id: 'selftest-spec-context', tool_name: 'Edit', tool_input: { file_path: path } }),
    encoding: 'utf8',
    windowsHide: true,
  });

let failed = 0;
const check = (what, ok) => {
  if (!ok) failed += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`);
};

try {
  cpSync(join(hooks, 'lib'), join(dir, '.claude', 'hooks', 'lib'), { recursive: true });
  cpSync(join(hooks, 'session', 'spec-context.mjs'), join(dir, '.claude', 'hooks', 'session', 'spec-context.mjs'));
  mkdirSync(join(dir, '.claude', 'hooks', 'state'), { recursive: true });
  cpSync(join(root, 'ux', 'scripts', 'spec-statements.mjs'), join(dir, 'ux', 'scripts', 'spec-statements.mjs'));
  cpSync(join(root, 'ux', 'lib', 'walk-skip.mjs'), join(dir, 'ux', 'lib', 'walk-skip.mjs'));
  mkdirSync(dirname(register), { recursive: true });

  writeFileSync(register, row('The old words of the row.'));
  edit(register);
  check('an edit to a register writes the statements file', statement() === 'The old words of the row.');

  writeFileSync(register, row('The amended words of the row.'));
  edit('ux/app/page.jsx');
  check('an edit outside the registers leaves it alone', statement() === 'The old words of the row.');

  edit('dev/specs/system/test.md');
  check('an edit to the register carries the amended words', statement() === 'The amended words of the row.');

  rmSync(join(dir, 'dev'), { recursive: true, force: true });
  const run = edit('ux/app/page.jsx');
  check('without dev/ the hook runs clean and names no spec', run.status === 0 && !run.stderr.trim() && !run.stdout.trim() && existsSync(statementsFile));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) {
  console.error(`${failed} failing`);
  process.exit(1);
}
console.log('spec context: all cases hold');
