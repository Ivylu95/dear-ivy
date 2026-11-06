// SessionEnd — one line in data/state/log.md, which drives the upkeep triggers.
//
// CLAUDE.md gives log.md a job nothing else does: "One line per session, and
// maintenance triggers. Not events." The upkeep, review and research thresholds
// are all counted in sessions, so a session that ends without a line makes every
// threshold quietly wrong — and the thresholds are what stop the record rotting.
//
// It writes the shape, not the meaning: date, and the files that moved. The
// playbook and the one clause are the model's to fill in while it still knows
// what the session was; this is the floor under that, for the sessions that end
// without a goodbye.

import { readHookInput, pass, read, git, dataDir, today } from '../lib/hook.mjs';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

const input = await readHookInput();
if (input?.reason === 'clear') pass(); // A cleared context is not a session lived.

const logPath = join(dataDir, 'state', 'log.md');
const log = read(logPath);
if (!log) pass();

const session = String(input?.session_id ?? '').slice(0, 8);
if (session && log.includes(session)) pass(); // Already logged; never twice.

const files = new Set();
for (const line of git(['log', '--since=midnight', '--name-only', '--pretty=format:', '--', 'data/']).split('\n')) {
  const path = line.trim();
  if (path && !path.startsWith('data/state/')) files.add(path.replace(/^data\//, ''));
}
if (!files.size) pass(); // Nothing was written; nothing to count.

appendFileSync(
  logPath,
  `\n| ${today()} · session ${session} · touched: ${[...files].slice(0, 6).join(', ')} |\n`,
);
pass();
