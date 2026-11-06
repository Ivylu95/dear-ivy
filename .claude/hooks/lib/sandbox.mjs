// The sandbox: a blank record at data-sandbox/, switched on per chat.
//
// `data/` is hers and is never touched by a test. `data-sandbox/` has the same
// shape, starts blank, and can be removed at any time with nothing else changing.
// A chat is in the sandbox when its session ID is listed in
// data-sandbox/.sessions — a file saved to git like the rest of the sandbox, so
// the switch survives the machine being reclaimed and the chat being resumed on
// a fresh one. A switch held only on the machine would quietly flip a resumed
// test chat back onto her real record, which is the one failure this must not
// have.
//
// `/sandbox` (.claude/commands/sandbox.md) runs ux/scripts/sandbox.mjs, which
// calls enter / leave / reset here. hook.mjs reads activeRecordDir() so every
// hook follows the chat's record without knowing the sandbox exists.
//
// No dependencies, like everything under hooks/: this runs before anything is
// installed.

import { appendFileSync, cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

export const SANDBOX = 'data-sandbox';
export const sandboxDir = join(repoRoot, SANDBOX);
const sessionsPath = join(sandboxDir, '.sessions');

// The blank record: .claude/templates/record/ holds every file data/ has, empty,
// except the three first-contact owns and keeps beside itself — overlaid here so
// each blank shape has one home (ARC-013).
const TEMPLATE = join(repoRoot, '.claude', 'templates', 'record');
const FIRST_CONTACT = join(repoRoot, '.claude', 'skills', 'first-contact', 'templates');
const OVERLAY = [
  ['profile.yaml', 'profile.yaml'],
  ['now.md', join('state', 'now.md')],
  ['safety_plan.md', join('safety', 'safety_plan.md')],
];

/**
 * Which chat this is. The cloud session ID is stable across a resume onto a new
 * machine, so it is preferred; the CLI's own ID covers a desk session. Empty
 * when neither is set — the caller then refuses rather than guessing.
 */
export function sessionId(input) {
  return process.env.CLAUDE_CODE_REMOTE_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID || input?.session_id || '';
}

function sessions() {
  if (!existsSync(sessionsPath)) return [];
  return readFileSync(sessionsPath, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function inSandbox(id = sessionId()) {
  return Boolean(id) && sessions().includes(id);
}

/** The record this chat reads and writes: data-sandbox/ if switched on, else data/. */
export function activeRecordDir(id = sessionId()) {
  return inSandbox(id) ? sandboxDir : join(repoRoot, 'data');
}

function build() {
  cpSync(TEMPLATE, sandboxDir, { recursive: true });
  for (const [from, to] of OVERLAY) cpSync(join(FIRST_CONTACT, from), join(sandboxDir, to));
}

/** Switch this chat on, building the sandbox first if there is none. */
export function enter(id) {
  if (!existsSync(sandboxDir)) build();
  if (!sessions().includes(id)) appendFileSync(sessionsPath, `${id}\n`);
}

/** Switch this chat off. The sandbox itself stays for the next test. */
export function leave(id) {
  const rest = sessions().filter((s) => s !== id);
  writeFileSync(sessionsPath, rest.length ? `${rest.join('\n')}\n` : '');
}

/**
 * Back to blank. The sandbox is throwaway by design, so this is a real delete —
 * the previous test stays in git history — and every chat that was switched on
 * stays switched on, now against the blank copy.
 */
export function reset() {
  const keep = sessions();
  rmSync(sandboxDir, { recursive: true, force: true });
  build();
  writeFileSync(sessionsPath, keep.length ? `${keep.join('\n')}\n` : '');
}

/**
 * Files data/ has that the blank record does not — the sign data/ has grown a
 * new kind of file and the template needs a blank one. Folders that fill with
 * one file per entry are compared by their fixed files only.
 */
export function missingFromTemplate(listDataFiles) {
  const growing = /^(journal|people|archive|assets|therapy\/sessions)\/(?!README\.md$|\.gitkeep$)/;
  const overlaid = new Set(OVERLAY.map(([, to]) => to.replace(/\\/g, '/')));
  return listDataFiles()
    .filter((rel) => !growing.test(rel) && !overlaid.has(rel) && rel !== 'state/PUSH_FAILED.md')
    .filter((rel) => !existsSync(join(TEMPLATE, rel)));
}
