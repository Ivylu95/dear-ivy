// PostToolUse(Write|Edit|MultiEdit) — after an edit to the harness, name the
// specs that govern the file, once per spec per session.
//
// SFG-008, "Before an edit to the harness is finished, the agent has read the
// specs that govern the file it changed." The map is lib/spec-map.mjs; this is
// the hook its design names. It hands the agent the list and leaves the reading
// to it: a hook cannot tell whether a file was read, only that it was named.
// Never refuses, never fails a call.
//
// An edit to a register also regenerates .claude/spec-statements.json, the
// rows' words the development reply check holds a citation to (WKB-007,
// lib/dev-reply.mjs): until then a row just amended was refused in its new
// words, and only the commit gate's --check said why. Only a register edit
// starts it, and a register exists only where dev/ does, so a copy without the
// design never runs it (ARC-008).

import { readHookInput, context, pass, repoRoot, markerRead, markerWrite } from '../lib/hook.mjs';
import { specsFor } from '../lib/spec-map.mjs';
import { SPECS_DIR } from '../lib/paths.mjs';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

const input = await readHookInput();
const session = String(input?.session_id || '').replace(/[^\w-]/g, '');
const file = input?.tool_input?.file_path;
if (!file) pass();

const rel = (isAbsolute(file) ? relative(repoRoot, file) : file).split('\\').join('/');
if (rel.startsWith('..') || rel.startsWith('data/')) pass();

const generator = join(repoRoot, 'ux', 'scripts', 'spec-statements.mjs');
if (rel.startsWith(`${SPECS_DIR}/`) && rel.endsWith('.md') && existsSync(generator)) {
  // Its output is for the gate; a register that does not parse is the gate's to report.
  spawnSync(process.execPath, [generator], { cwd: repoRoot, stdio: 'ignore', timeout: 15000, windowsHide: true });
}
// A copy without the design has no specs to name: silent, rather than pointing
// the agent at files that are not there (ARC-008). Naming a path reads nothing.
if (!session || !existsSync(join(repoRoot, SPECS_DIR))) pass();

const marker = `specs-named-${session}.json`;
let named = [];
try {
  named = JSON.parse(markerRead(marker) || '[]');
} catch {
  named = [];
}
const fresh = specsFor(rel)
  .map((s) => (s.startsWith(`${SPECS_DIR}/`) ? s : `${SPECS_DIR}/${s}`))
  .filter((s) => !named.includes(s));
if (!fresh.length) pass();

markerWrite(marker, JSON.stringify([...named, ...fresh]));
context(
  'PostToolUse',
  `SFG-008: ${rel} is governed by ${fresh.join(', ')}. Read ${fresh.length === 1 ? 'it' : 'them'} before calling this edit finished, if not already read this session.`,
);
