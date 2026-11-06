// PreToolUse(Bash|Write|Edit|MultiEdit|NotebookEdit) — in a person's copy, the
// harness is not the agent's to change.
//
// DEP-013, "In a copy without the developer's folder, the harness changes only
// through a release she accepts." The developer's folder, dev/, is withheld from
// every release (ARC-007), so its absence marks a person's copy. There, a write
// anywhere in the repository except data/, temp/ and FEEDBACK.md is refused, and
// so a procedure cannot be added, changed or retired there without a release
// (PMM-003, "only approval creates a procedure"; PRL-002 for leaving), and
// the agent is told to leave a note in FEEDBACK.md instead (CON-017). With dev/
// present this hook passes everything: the developer's copy stays open
// (guard-protected-files.mjs was parked for that, 2026-09-27).
//
// Shell: a redirect, tee, sed -i, cp, mv, rm, touch, mkdir, ln or install whose
// target is a repository path outside those three. The updater's own command
// passes, since it is DEP-004's path. A script that opens a file itself is not
// seen; the spec row says so.

import { readHookInput, refuse, pass, repoRoot } from '../lib/hook.mjs';
import { existsSync } from 'node:fs';
import { join, resolve, relative, isAbsolute } from 'node:path';

const root = process.env.HARNESS_LOCK_ROOT || repoRoot;
if (existsSync(join(root, 'dev'))) pass();

const input = await readHookInput();
const { command = '', file_path = '', notebook_path = '' } = input?.tool_input ?? {};

const REASON = (what) =>
  `Blocked: ${what}.\n\nThis is a person's copy (there is no dev/ folder), so the harness ` +
  'changes only through a release they accept (DEP-013). Leave a general note for the ' +
  'developer in FEEDBACK.md instead (CON-017), and tell them in one plain 🔧 line.';

// Repository-relative path, or null when the path is outside the repository.
function inRepo(p) {
  const rel = relative(root, isAbsolute(p) ? p : resolve(root, p)).replace(/\\/g, '/');
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return rel === '' ? '.' : null;
  return rel;
}
function allowed(rel) {
  return rel === 'FEEDBACK.md' || /^(data|temp)(\/|$)/.test(rel);
}

const path = file_path || notebook_path;
if (path) {
  const rel = inRepo(path);
  if (rel !== null && !allowed(rel)) refuse('PreToolUse', REASON(`changing ${rel}`));
  pass();
}
if (!command) pass();

// The updater, alone and unchained, is the release path.
if (/^\s*node\s+\S*\.claude\/hooks\/lib\/update\/update\.mjs\b[^;&|]*$/.test(command)) pass();

// Targets a shell command writes to.
const targets = [];
for (const m of command.matchAll(/(?:^|[^>\d&])>>?\s*["']?([^\s"';&|)]+)/g)) targets.push(m[1]);
for (const seg of command.split(/&&|\|\||[;|\n]/)) {
  const words = seg.trim().split(/\s+/).filter((w) => !w.startsWith('-'));
  const verb = words[0];
  if (!verb) continue;
  if (verb === 'tee' || ['rm', 'touch', 'mkdir', 'rmdir', 'unlink', 'truncate'].includes(verb)) {
    targets.push(...words.slice(1));
  } else if (['cp', 'mv', 'ln', 'install'].includes(verb) && words.length > 2) {
    targets.push(words[words.length - 1]);
    if (verb === 'mv') targets.push(...words.slice(1, -1));
  } else if ((verb === 'sed' && /\s--in-place/.test(seg)) || (verb === 'perl' && /\s-\w*i/.test(seg))) {
    // PMM-007: a repair to a procedure in her copy is a note, never applied.
    targets.push(words[words.length - 1]);
  } else if (verb === 'patch' && words.length > 1) {
    targets.push(words[1]);
  } else if (verb === 'sed' && /\s-i/.test(seg)) {
    targets.push(words[words.length - 1]);
  } else if (verb === 'git' && ['mv', 'rm', 'restore'].includes(words[1])) {
    // git mv into data/archive/ is how the record archives; judge the paths.
    targets.push(...words.slice(2));
  } else if (verb === 'git' && words[1] === 'checkout' && seg.includes(' -- ')) {
    targets.push(...seg.split(' -- ')[1].trim().split(/\s+/));
  } else if (verb === 'git' && words[1] === 'apply') {
    refuse('PreToolUse', REASON("git apply in a person's copy"));
  }
}
for (const t of targets) {
  const clean = t.replace(/^["']|["']$/g, '');
  if (!clean || clean.startsWith('/dev/') || clean === '/dev/null') continue;
  const rel = inRepo(clean);
  if (rel !== null && !allowed(rel)) refuse('PreToolUse', REASON(`a shell write to ${rel}`));
}
pass();
