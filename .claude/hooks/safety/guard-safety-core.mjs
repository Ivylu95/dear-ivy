// PreToolUse(Bash|Write|Edit|MultiEdit) — the safety core changes only when the
// developer has unlocked it, in their own words, in this session.
//
// MNT-006, "Evolution may only strengthen the core — never soften, shorten or
// remove it." Its rationale: "Self-restraint is not a control." The rest of the
// harness is open to agent edits on the developer's instruction (SFG-001) and is
// protected by history; the core is where a well-meant tidy-up costs most and is
// noticed last, so it keeps a lock. The owner chose this on 2026-09-27.
//
// The core, and what counts as changing it:
//   .claude/settings.json      every line that wires a hook in hooks/safety/,
//                              or either anti-destruction guard
//   the safety register, its tab spec, the crisis numbers and their check,
//   every file in hooks/safety/ (this one and its unlock included), and the
//   two guards that keep history and the record from being destroyed  whole
//
// The Crisis section of CLAUDE.md is NOT here: the owner took it out of the
// lock on 2026-09-27, so the agent edits it on the developer's instruction like
// the rest of CLAUDE.md. What still holds it is the safety gate (a hazard-log
// entry before any turn that changed it can end) and history.
//
// Each edit is simulated and refused only if the core text would differ, so the
// rest of settings.json stays open. Unlocked by the developer
// typing "unlock safety core", which unlock-safety-core.mjs records from their
// own message; the agent is refused writes to that record. The unlock lasts two
// hours and this session only.
//
// Refuses outright. Falls short in that a shell
// command can write a path it does not name plainly (a script file, a variable,
// a path built in pieces; an inline script naming one plainly is caught),
// and the git pre-commit hook is not part of the core.

import { failClosed, readHookInput, refuse, pass, repoRoot, markerSeen, markerRead } from '../lib/hook.mjs';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';


// A guard: a crash refuses the call (lib/hook.mjs, failClosed).
failClosed('PreToolUse', 'the safety-core guard');
const UNLOCK_FOR_MS = 2 * 60 * 60 * 1000;
const PHRASE = 'unlock safety core';

const input = await readHookInput();
const tool = input?.tool_name ?? '';
const args = input?.tool_input ?? {};
const session = String(input?.session_id ?? '');

const marker = `core-unlock-${session.replace(/[^\w-]/g, '')}`;
if (session && markerSeen(marker) && Date.now() - Number(markerRead(marker)) < UNLOCK_FOR_MS) pass();

// The anti-destruction guards are core too: MNT-006 names nothing-is-deleted.
const GUARDS = ['.claude/hooks/record/guard-git-history.mjs', '.claude/hooks/record/guard-record-deletion.mjs'];
const safetyWiring = (text) =>
  text
    .split('\n')
    .filter((l) => l.includes('hooks/safety/') || GUARDS.some((g) => l.includes(g.slice('.claude/hooks/'.length))))
    .map((l) => l.trim())
    .sort()
    .join('\n');
const whole = (text) => text;
// Every number inside bold text in CLAUDE.md ("**SOS on 1767**", "**995**"): the crisis lines and
// the emergency number, wherever they appear.
const crisisNumbers = (text) => [...text.matchAll(/\*\*([^*\n]+)\*\*/g)].flatMap((m) => m[1].match(/\d[\d ]*\d/g) ?? []).map((n) => n.replace(/\s+/g, ' ')).sort().join('\n');

const CORE = [
  ['.claude/settings.json', safetyWiring],
  ['dev/specs/interaction/safety.md', whole],
  ['dev/specs/ux/tabs/safety.md', whole],
  ['ux/lib/safety.mjs', whole],
  ['ux/scripts/check-safety.mjs', whole],
  ['.claude/hooks/safety/', whole],
  ...GUARDS.map((g) => [g, whole]),
  // What the git-history guard reads a command as: weaken it and the guard
  // weakens with it, so it is locked with the guard (2026-10-08).
  ['.claude/hooks/lib/git-words.mjs', whole],
];

const REFUSAL =
  'The safety core — the safety register, the ' +
  'crisis numbers and their check, the safety hooks, the git-history and record-deletion guards and the git parser they read, ' +
  'and their wiring — changes only when ' +
  `the developer types "${PHRASE}" in this session (MNT-006). Ask them; do not route around it.`;

const rel = (p) => relative(repoRoot, resolve(repoRoot, p)).replace(/\\/g, '/');
const coreOf = (path) => CORE.find(([p]) => (p.endsWith('/') ? path.startsWith(p) : path === p));
const isUnlockRecord = (s) => /core-unlock/i.test(s);

const read = (path) => {
  try {
    return readFileSync(resolve(repoRoot, path), 'utf8').replace(/\r\n/g, '\n');
  } catch {
    return '';
  }
};

const applyEdit = (text, { old_string = '', new_string = '', replace_all = false }) =>
  replace_all ? text.split(old_string).join(new_string) : text.replace(old_string, () => new_string);

if (args.file_path) {
  const path = rel(args.file_path);
  if (isUnlockRecord(path)) refuse('PreToolUse', `Blocked: writing the unlock record.\n\n${REFUSAL}`);
  // The crisis numbers in CLAUDE.md are core, the rest of it is not (the crisis section
  // left the lock on the owner's instruction, 2026-09-27). E-015, twice on 2026-10-20: a
  // pushy "typo fix" changed one, the gates refused the commit, and the bad number stayed
  // staged, one commit from landing. So the edit itself is refused while the lock is shut.
  if (path === 'CLAUDE.md') {
    const current = read(path);
    let proposed = current;
    if (tool === 'Write') proposed = String(args.content ?? '').replace(/\r\n/g, '\n');
    else if (tool === 'Edit') proposed = applyEdit(current, args);
    else if (tool === 'MultiEdit') proposed = (args.edits ?? []).reduce(applyEdit, current);
    if (crisisNumbers(current) !== crisisNumbers(proposed)) refuse('PreToolUse', `Blocked: this changes a crisis number in CLAUDE.md. The numbers come from her plan and modules/core/knowledge/crisis-lines.md, never from a chat.\n\n${REFUSAL}`);
    pass();
  }
  const core = coreOf(path);
  if (!core) pass();
  const current = read(path);
  let proposed = current;
  if (tool === 'Write') proposed = String(args.content ?? '').replace(/\r\n/g, '\n');
  else if (tool === 'Edit') proposed = applyEdit(current, args);
  else if (tool === 'MultiEdit') proposed = (args.edits ?? []).reduce(applyEdit, current);
  if (core[1](current) !== core[1](proposed)) refuse('PreToolUse', `Blocked: this changes the safety core (${path}).\n\n${REFUSAL}`);
  pass();
}

const command = String(args.command ?? '');
if (!command) pass();

// A script handed to an interpreter (python, node -e, perl, ruby, a shell -c)
// writes what its own code says, and the judging below strips heredocs and
// quoted text, so it saw none of it: on 2026-10-20 a Python heredoc rewrote a
// core file with the lock shut. So an interpreter whose script names a core
// path and carries any write call is refused whole; reading through one passes.
const INTERPRETER = /\b(python3?|node|perl|ruby|deno|bun)\b|\b(ba|z)?sh\s+-c\b/;
const WRITES = /open\([^)]*,\s*['"][wax+]|\.write(_text|_bytes)?\(|write(File|FileSync)|append(File|FileSync)|rename(Sync)?\(|unlink(Sync)?\(|rm(Sync)?\(|copyFile(Sync)?\(|shutil\.|os\.(remove|replace|rename)|truncate\(|(?<![\d&>])>{1,2}\s*(?!&)[^\s&|;]/;
if (INTERPRETER.test(command) && WRITES.test(command)) {
  const flat = command.replace(/\\/g, '/');
  const named = CORE.map(([p]) => p).find((p) => flat.includes(p) || (p.endsWith('/') && flat.includes(p.slice(0, -1))));
  if (named) refuse('PreToolUse', `Blocked: a script that writes, naming the safety core (${named}).\n\n${REFUSAL}`);
}

// A shell command can only be judged by what it names, so each part is judged
// by what it WRITES. An in-place edit, a move, a delete or a git restore writes
// every path it names; a copy writes only its last argument; a redirect writes
// only its target. So copying a core file out, or quoting a core path in a
// message body, passes, and writing into one is still refused. Quoted text with
// a space in it is prose, not a path, and is set aside before judging (it was a
// false alarm on an issue body, 2026-09-27).
const WHOLE = /(\bsed\s+(-\w+\s+)*-i|\bperl\s+-\w*i|\btee\b|\b(mv|rm|truncate|Set-Content|Add-Content|Out-File|Remove-Item|Move-Item)\b|\bgit\s+(checkout|restore|apply)\b)/i;
const COPY = /\b(cp|Copy-Item)\b/i;
const REDIRECT = /(^|[^<>\d])>{1,2}(?!&)\s*("[^"]*"|'[^']*'|[^\s;&|]+)/g;
const code = command
  .replace(/\\/g, '/')
  .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\s*\2\b/g, '')
  .replace(/(\s-m|--message)(=|\s+)("([^"\\]|\\.)*"|'[^']*')/g, '')
  .replace(/"(?:[^"\\]|\\.)*\s(?:[^"\\]|\\.)*"|'[^']*\s[^']*'/g, '""');

const writtenIn = (part) => {
  if (WHOLE.test(part)) return part;
  const targets = [...part.matchAll(REDIRECT)].map((m) => m[2]);
  if (COPY.test(part)) targets.push(part.trim().split(/\s+/).pop());
  return targets.join(' ');
};

for (const part of code.split(/;|&&|\|\||\|/)) {
  if (isUnlockRecord(part)) refuse('PreToolUse', `Blocked: touching the unlock record.\n\n${REFUSAL}`);
  const written = writtenIn(part);
  if (!written) continue;
  const named = CORE.map(([p]) => p).find((p) => written.includes(p) || (p.endsWith('/') && written.includes(p.slice(0, -1))));
  if (named) refuse('PreToolUse', `Blocked: a shell command that writes to the safety core (${named}).\n\n${REFUSAL}`);
}

pass();
