// Is this hook running under a Claude started from inside another Claude?
//
// The typed record (lib/typed.mjs) holds what the developer typed, and an
// approval is checked against it. On 2026-11-01 an agent ran `claude -p` as a
// probe, inside the repository, and session/dialogue-record.mjs kept the probe's
// prompt as if he had typed it (T-577). A nested run inherits the whole
// environment of the chat that started it (session id, entrypoint, everything),
// so nothing in the hook's input or environment tells the two apart. The
// process tree does: his chat is one Claude; a probe is a Claude whose
// ancestors include another. So a hook with two or more Claude processes above
// it is not him speaking.
//
// Read from /proc (Linux, where the cloud chats run). Where /proc is missing
// the count is 0 and the hook records as before. No environment variable can
// switch this off: one would be the bypass this closes. Tests pass `read`.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const fromProc = (pid, file) => readFileSync(`/proc/${pid}/${file}`, 'utf8');

/** A process is a Claude when its name, or the program it runs, is Claude Code. */
export function isClaude(comm, cmdline) {
  if (String(comm).trim() === 'claude') return true;
  const argv = String(cmdline).split('\0').filter(Boolean);
  if (argv[0] && basename(argv[0]) === 'claude') return true;
  return argv.slice(0, 3).some((a) => /[\\/]@anthropic-ai[\\/]claude-code[\\/]cli\.m?js$/.test(a));
}

/** How many Claude processes stand above `pid` (itself included). */
export function claudeAncestors(pid = process.pid, read = fromProc) {
  let count = 0;
  const seen = new Set();
  for (let p = pid; p > 1 && !seen.has(p); ) {
    seen.add(p);
    let stat;
    try { stat = read(p, 'stat'); } catch { break; }
    // Field 4 is the parent; the name in field 2 may hold spaces and brackets.
    const after = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    let comm = '', cmdline = '';
    try { comm = read(p, 'comm'); } catch {}
    try { cmdline = read(p, 'cmdline'); } catch {}
    if (isClaude(comm, cmdline)) count++;
    p = Number(after[1]);
  }
  return count;
}

export const nestedClaude = (pid, read) => claudeAncestors(pid, read) >= 2;
