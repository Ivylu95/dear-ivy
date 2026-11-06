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
// `/dev-mode sandbox` (dev/commands/dev-mode.md, WKB-013) runs ux/scripts/sandbox.mjs, which
// calls enter / leave / reset here. hook.mjs reads activeRecordDir() so every
// hook follows the chat's record without knowing the sandbox exists.
//
// No dependencies, like everything under hooks/: this runs before anything is
// installed.

import { execFileSync } from 'node:child_process';
import { appendFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import { CORE_DATA, readModules } from './modules.mjs';
import { PHRASE_MARKER } from './update/secrets.mjs';

const repoRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

// WKB-013: the sandbox switches only when the developer's own message typed
// `/dev-mode sandbox <action>`. typed-phrase.mjs records it under this name;
// the PHRASE_MARKER prefix puts it behind guard-secrets.mjs, so no tool call
// can forge it by name. Each typed switch allows the script steps listed here,
// is spent on the last of them, and lasts only the turn it was typed in;
// `reset` and `sample` are followed by `on`, so a test never runs on data/.
// Falls short in that code importing this file can still call enter() itself:
// it stops the agent drifting into a switch, not one set on getting round it.
export const switchMarker = (id) => `${PHRASE_MARKER}sandbox-${String(id).replace(/[^\w-]/g, '')}`;
export const SWITCH_STEPS = { on: ['on'], off: ['off'], reset: ['reset', 'on'], sample: ['sample', 'on'] };

/** Whether the developer typed a switch that allows `action` in this chat; spends it on its last step. */
export function takeSwitch(id, action) {
  const path = join(repoRoot, '.claude', 'hooks', 'state', switchMarker(id));
  let typed;
  try {
    typed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return false;
  }
  const steps = SWITCH_STEPS[typed?.action] ?? [];
  if (!steps.includes(action)) return false;
  if (action === steps[steps.length - 1]) rmSync(path, { force: true });
  return true;
}

export const SANDBOX = 'data-sandbox';
export const sandboxDir = join(repoRoot, SANDBOX);
const sessionsPath = join(sandboxDir, '.sessions');

// Each module under modules/ — core/ included — names its blank shapes in its
// module.json, read through the one reader in modules.mjs: `shapes` pairs a
// template with its path under the record, `grows` lists the folders that fill
// one file per entry.
const modules = () => readModules(repoRoot);

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

// The switch as main last saved it, read only while this folder lacks main. The save
// pushes a chat's switch to main, never to the chat's own branch, so a test chat resumed
// on a fresh machine opens on that branch as GitHub last had it, without the switch, until
// the session start merges main in; every hook that chose the record before that merge
// chose hers, and the start sent the test chat to read her snapshot (round 51). Once the
// folder holds main, it is as new as anything saved, and its own file alone decides, so a
// switch turned off here is off.
function savedSessions() {
  const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 5000, windowsHide: true });
  try {
    git(['merge-base', '--is-ancestor', 'origin/main', 'HEAD']);
    return [];
  } catch {}
  try {
    return git(['show', `origin/main:${SANDBOX}/.sessions`]).split('\n').map((line) => line.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export function inSandbox(id = sessionId()) {
  return Boolean(id) && (sessions().includes(id) || savedSessions().includes(id));
}

/** The record this chat reads and writes: data-sandbox/ if switched on, else data/. */
export function activeRecordDir(id = sessionId()) {
  return inSandbox(id) ? sandboxDir : join(repoRoot, 'data');
}

/** Write a blank record into dir: every module's standing shapes. */
export function buildBlankRecord(dir, { overwrite = true } = {}) {
  // force: false with errorOnExist: false skips a file that exists, file by file,
  // inside a recursive copy too — which is what lets restoreMissing() below run
  // against her real record.
  const opts = { recursive: true, force: overwrite, errorOnExist: false };
  for (const mod of modules()) {
    for (const [from, to] of mod.shapes) {
      mkdirSync(dirname(join(dir, to)), { recursive: true });
      cpSync(join(repoRoot, from), join(dir, to), opts);
    }
    for (const folder of mod.grows) mkdirSync(join(dir, folder), { recursive: true });
  }
}

function filesUnder(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => relative(dir, join(e.parentPath ?? e.path, e.name)).replace(/\\/g, '/'));
}

/**
 * DAT-005: whatever of the record's shape is missing is built blank, and
 * nothing that exists is touched — the whole folder when it is gone, one file
 * when one is. Returns the paths it created, relative to dir; empty when the
 * record was whole.
 */
/**
 * Whether a rebuild is a fresh start (DAT-005), from what `restoreMissing` made and
 * whether git ever held one of them. A file no commit held, beside a record whose
 * profile and snapshot were already there, is a standing file an update added (the
 * reminders file, 2026-10-16): the record grew, it did not start over.
 */
export const isFreshStart = (restored, heldInHistory) =>
  Boolean(heldInHistory) || restored.some((p) => p === 'PROFILE.yaml' || p === 'core/state/now.md');

export function restoreMissing(dir) {
  const before = new Set(filesUnder(dir));
  buildBlankRecord(dir, { overwrite: false });
  return filesUnder(dir).filter((p) => !before.has(p));
}

/** Switch this chat on, building the sandbox first if there is none. */
export function enter(id) {
  if (!existsSync(sandboxDir)) buildBlankRecord(sandboxDir);
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
  buildBlankRecord(sandboxDir);
  writeFileSync(sessionsPath, keep.length ? `${keep.join('\n')}\n` : '');
}

/**
 * Reset to a copy of the invented record in data-sample/, so a test can play on
 * a full record. The sample itself is never written (SMP-008): the copy is the
 * sandbox's own, and the IS_SAMPLE marker stays behind, since the copy is no
 * longer the showcase. Switched chats stay switched, as with reset().
 */
export function resetFromSample() {
  const sampleDir = join(repoRoot, 'data-sample');
  if (!existsSync(join(sampleDir, 'IS_SAMPLE'))) throw new Error(`no sample record at ${sampleDir}`);
  const keep = sessions();
  rmSync(sandboxDir, { recursive: true, force: true });
  cpSync(sampleDir, sandboxDir, { recursive: true, filter: (src) => basename(src) !== 'IS_SAMPLE' });
  const readme = join(sandboxDir, 'README.md');
  const note = `> **A copy of data-sample/, made ${new Date().toLocaleDateString('en-CA')} by \`/dev-mode sandbox sample\`.** This copy is the sandbox's own: write to it freely. The rule below that nothing writes here is the sample's, not this copy's.\n\n`;
  writeFileSync(readme, note + (existsSync(readme) ? readFileSync(readme, 'utf8') : ''));
  writeFileSync(sessionsPath, keep.length ? `${keep.join('\n')}\n` : '');
}

/**
 * Files data/ has that the blank record does not — the sign data/ has grown a
 * new kind of file and the template needs a blank one. Folders that fill with
 * one file per entry are compared by their fixed files only.
 */
const MADE_ON_USE = new Set([`${CORE_DATA}/state/PUSH_FAILED.md`, `${CORE_DATA}/state/setup_notes.md`]);

export function missingFromTemplate(listDataFiles) {
  const mods = modules();
  // A growing folder is made by buildBlankRecord(), so only its own README needs a blank.
  const growing = (rel) =>
    mods.some((m) => m.grows.some((f) => rel.startsWith(`${f}/`) && rel !== `${f}/README.md`));
  // Does some module's standing entry, file or folder, hold a blank for rel?
  const blank = (rel) =>
    mods.some((m) =>
      m.shapes.some(([from, to]) => {
        if (to === rel) return true;
        const under = relative(to, rel).replace(/\\/g, '/');
        return !under.startsWith('..') && existsSync(join(repoRoot, from, under));
      }),
    );
  return listDataFiles().filter(
    // The archive holds superseded material, one-off by nature: it has no shape
    // to template, and a blank record starts with it empty (ARC-010). The push-failed
    // note and the setup notes are made on first use (set-up SKILL.md § 1), never laid
    // blank: a template would be laid into every record at session start
    // (restoreMissing), and new-copy.mjs writes the notes in every new copy, so the
    // check failed on each (set-up cases, rehearsal 2026-10-27).
    (rel) => !/^archive(-local)?\//.test(rel) && !growing(rel) && !MADE_ON_USE.has(rel) && !blank(rel),
  );
}
