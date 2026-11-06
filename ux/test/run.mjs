#!/usr/bin/env node
// The dashboard's unit tests: every test/*.test.mjs under node's own test
// runner, with imports resolved as Next resolves them (register.mjs). They read
// the invented record in data-sample/, never hers (SMP).
//
//   node test/run.mjs        from ux/, or from anywhere
//
// Run by `npm run check`, the commit gate and CI (lib/checks.mjs).

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ux = join(dirname(fileURLToPath(import.meta.url)), '..');
const tests = readdirSync(join(ux, 'test'))
  .filter((f) => f.endsWith('.test.mjs'))
  .map((f) => join('test', f));

const run = spawnSync(process.execPath, ['--import', './test/register.mjs', '--test', '--test-reporter=spec', ...tests], { cwd: ux, stdio: 'inherit' });
process.exit(run.status ?? 1);
