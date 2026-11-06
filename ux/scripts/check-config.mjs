// Every profile.yaml is valid, or the check fails.
//
//   node scripts/check-config.mjs        (runs as part of `npm run check`)
//
// A pointer, kept so the command everyone knows still works. The check itself
// lives with the rest of the harness enforcement, because the profile must stay
// valid whether or not anyone is looking at the dashboard:
// .claude/hooks/record/check-profile.mjs --all, reading the rules in
// .claude/hooks/lib/profile-schema.mjs.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const run = (script, args = []) =>
  spawnSync(process.execPath, [join(repoRoot, '.claude', 'hooks', 'record', script), ...args], {
    stdio: 'inherit',
    env: { ...process.env, CLAUDE_PROJECT_DIR: repoRoot },
  }).status;

process.exit(run('check-profile.mjs', ['--all']) || run('test-profile.mjs'));
