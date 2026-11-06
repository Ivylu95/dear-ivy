// Rule test (SFG-005 design 1): a write that leaves a broken pointer or a cited
// row that does not exist is reported to its author as the write lands, by the
// after-write hook (check-profile.mjs), and a clean write, a file the write did
// not touch and a file that is not markdown draw nothing.
//
// Run against a throwaway tree, never this repository: the hook reads
// CLAUDE_PROJECT_DIR, which is set to it. Exits non-zero on any failure.
// Run by selftest.mjs.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'check-profile.mjs');
const FILES = {
  'CLAUDE.md': '# Rules\n',
  'AGENTS.md': 'Read [CLAUDE.md](CLAUDE.md).\n',
  'docs/a.md': '# A\n',
  'docs/clean.md': 'See [a](a.md) and ABC-001.\n',
  'docs/bad-pointer.md': 'See [gone](gone.md).\n',
  'docs/bad-row.md': 'Cites ABC-099.\n',
  'docs/other-bad.md': 'See [gone](elsewhere.md).\n',
  'docs/notes.txt': 'See [gone](gone.md).\n',
  'dev/specs/system/one.md': '## **ABC-001 • 🔐📁🧳**\n\nA row.\n',
};

const root = makeTemp('dear-writelinks-');
for (const [rel, text] of Object.entries(FILES)) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

let failed = 0;
const run = (tool, file) => {
  const input = JSON.stringify({ hook_event_name: 'PostToolUse', session_id: 'writelinks', tool_name: tool, tool_input: file ? { file_path: join(root, file) } : { command: 'ls' } });
  const out = spawnSync('node', [hook], { input, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root }, timeout: 20000 });
  return out.stdout.trim();
};
const expect = (label, got, ok) => {
  if (!ok(got)) failed += 1;
  console.log(`${ok(got) ? 'ok  ' : 'FAIL'} ${label}${ok(got) ? '' : ` — got ${JSON.stringify(got).slice(0, 300)}`}`);
};
const blocked = (name) => (s) => s.includes('"decision":"block"') && s.includes(name);

try {
  expect('a Write leaving a broken pointer is reported', run('Write', 'docs/bad-pointer.md'), blocked('gone.md'));
  expect('an Edit citing a row no spec defines is reported', run('Edit', 'docs/bad-row.md'), blocked('ABC-099'));
  expect('a clean markdown write draws nothing', run('Write', 'docs/clean.md'), (s) => s === '');
  expect('only the written file is reported, not its neighbours', run('Write', 'docs/bad-pointer.md'), (s) => !s.includes('elsewhere.md'));
  expect('a file that is not markdown draws nothing', run('Write', 'docs/notes.txt'), (s) => s === '');
  expect('a shell command with no file draws nothing', run('Bash', null), (s) => s === '');
} finally {
  rmSync(root, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
