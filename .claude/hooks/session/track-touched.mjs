// PostToolUse(Write|Edit|MultiEdit|NotebookEdit|Bash) — note which files this
// session touched, so the end-of-turn checks block the session that made a
// change and not every session sharing the tree. lib/touched.mjs says why.
//
// An edit names its file. A shell command that can write (a move, copy, delete,
// in-place edit, redirect, or git command that rewrites the tree) is read for
// every token that is an existing path inside the repository; over-counting only
// means this session is asked about a file it did not change, the safe
// direction. A read-only command (grep, ls, git status) records nothing, or one
// search across dev/specs/ would claim every spec. A path this session stages or
// commits by name is its own, and so is each file staged under a folder it stages
// or commits by name (lib/touched.mjs, stagedUnder), which the pre-commit hook reads to tell one chat's
// staged files from another's (lib/refused-staged.mjs). Never refuses, never fails a call.

import { readHookInput, pass, repoRoot } from '../lib/hook.mjs';
import { recordTouched, stagedUnder } from '../lib/touched.mjs';
import { checkoutOf, recordWriter } from '../lib/shared-tree.mjs';
import { existsSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

const input = await readHookInput();
const session = input?.session_id;
const args = input?.tool_input ?? {};
const cwd = input?.cwd || repoRoot;

const insideRepo = (abs) => {
  const rel = relative(repoRoot, abs);
  return rel && !rel.startsWith('..') && !isAbsolute(rel);
};

const paths = [];
if (args.file_path || args.notebook_path) paths.push(args.file_path || args.notebook_path);
const WRITES = /(^|[\s;&|(])(mv|cp|rm|rmdir|mkdir|touch|tee|git\s+(mv|rm|add|commit|checkout|restore|apply|reset))\b|\bsed\s+-i|[^2&]>\s*[^&\s]/;
if (typeof args.command === 'string' && WRITES.test(args.command)) {
  for (const raw of args.command.split(/[\s;|&<>()]+/)) {
    const token = raw.replace(/^['"]+|['"]+$/g, '');
    if (!token || token.startsWith('-') || token.length > 400) continue;
    for (const base of [cwd, repoRoot]) {
      const abs = resolve(base, token);
      if (insideRepo(abs) && existsSync(abs)) {
        paths.push(abs);
        break;
      }
    }
  }
}

// A folder staged or committed by name: the files staged under it are this session's.
const stages = typeof args.command === 'string' && /(^|[\s;&|(])git\s+(add|commit)\b/.test(args.command);
recordTouched(session, stages ? stagedUnder(paths, cwd) : paths);

// Which checkout this session's agent (or the chat itself) is writing in, and when, so a
// subagent's commit can tell whether another writer is working there (lib/shared-tree.mjs,
// DEV-017 design 6). An edit is stamped in its file's checkout; a writing command in its own.
const editAt = args.file_path || args.notebook_path;
const writes = editAt || (typeof args.command === 'string' && WRITES.test(args.command));
if (session && writes) {
  try {
    recordWriter(session, input?.agent_id, checkoutOf(editAt ? resolve(cwd, editAt) : cwd));
  } catch {}
}
pass();
