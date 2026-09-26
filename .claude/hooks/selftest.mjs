// Does every hook still run, decide what it is supposed to decide, and finish
// fast enough that she never sees it?
//
//   node .claude/hooks/selftest.mjs
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// The hooks fail open: an uncaught error becomes a silent pass, because a
// crashed guard that blocks every tool call is worse than one that lets a call
// through. The cost of that choice is that a hook can go completely dead —
// wrong import, renamed helper, moved file — and nothing anywhere says so. The
// session looks normal. The guarantee is simply gone.
//
// That is not hypothetical: it is how this file came to exist. A hook lost one
// import and spent an afternoon exiting 0 on every call while appearing to pass
// its timing runs.
//
// So every hook is run here under DEAR_HOOK_STRICT, which turns failing open
// off, against a payload it should act on and a payload it should ignore. A
// hook that cannot decide, or that decides both ways, fails the run.

import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const hooksDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(hooksDir, '..', '..');

// Each case: the payload, and what the hook must do with it.
//   'deny'  permissionDecision deny   ·  'block'  decision block
//   'context'  additionalContext      ·  'pass'   no output at all
//   'any'   anything, as long as it does not crash
const CASES = {
  'safety/crisis-floor.mjs': [
    ['fires on the crisis list', { prompt: 'i want to disappear' }, 'context'],
    ['ignores an ordinary message', { prompt: 'work was busy but fine' }, 'pass'],
  ],
  'privacy/guard-harness-privacy.mjs': [
    ['allows an impersonal harness write', { tool_input: { file_path: 'ux/a.jsx', content: 'const a = 1;' } }, 'pass'],
    ['allows any write inside data/', { tool_input: { file_path: 'data/journal/x.md', content: 'anything at all' } }, 'pass'],
  ],
  'record/guard-record-deletion.mjs': [
    ['refuses rm against the record', { tool_input: { command: 'rm -f data/timeline.md' } }, 'deny'],
    ['refuses a truncating redirect', { tool_input: { command: 'echo x > data/state/now.md' } }, 'deny'],
    ['allows an append', { tool_input: { command: 'echo x >> data/timeline.md' } }, 'pass'],
    ['allows ordinary commands', { tool_input: { command: 'git status --porcelain' } }, 'pass'],
  ],
  'record/guard-protected-files.mjs': [
    ['refuses an edit to CLAUDE.md', { tool_input: { file_path: '.claude/CLAUDE.md' } }, 'deny'],
    ['refuses an edit to a spec', { tool_input: { file_path: 'specs/system/ARCHITECTURE.md' } }, 'deny'],
    ['refuses an edit to a nested spec', { tool_input: { file_path: 'specs/ux/tabs/now.md' } }, 'deny'],
    ['allows an edit to REVIEW.md, which is where findings go', { tool_input: { file_path: '.claude/REVIEW.md' } }, 'pass'],
    ['allows the specs findings queue, inside the folder it guards', { tool_input: { file_path: 'specs/REVIEW.md' } }, 'pass'],
    ['refuses an edit to the archive', { tool_input: { file_path: 'data/archive/old.md' } }, 'deny'],
    ['allows an ordinary record write', { tool_input: { file_path: 'data/timeline.md' } }, 'pass'],
  ],
  'record/timeline-before-close.mjs': [
    ['never loops on itself', { session_id: 'selftest', stop_hook_active: true }, 'pass'],
  ],
  'record/record-gate.mjs': [
    ['runs the checks and decides', { session_id: 'selftest' }, 'any'],
  ],
  'record/save-record.mjs': [
    // Read-only here: with nothing staged in data/ it must reach the end and
    // touch nothing. The commit and push paths are exercised against a throwaway
    // repository, not this one.
    ['no-ops when the record has not moved', {}, 'any'],
  ],
  'record/check-profile.mjs': [
    ['never loops on itself', { hook_event_name: 'Stop', stop_hook_active: true }, 'pass'],
    ['passes a valid profile after an edit', { hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: 'data/profile.yaml' } }, 'pass'],
  ],
  'session/session-brief.mjs': [['reports the state of the save', {}, 'any']],
  'session/session-context.mjs': [
    ['briefs a new session', { hook_event_name: 'SessionStart' }, 'any'],
    ['briefs again after a compaction', { hook_event_name: 'PreCompact' }, 'any'],
  ],
  'session/sandbox-reminder.mjs': [['is silent outside the sandbox', { session_id: 'selftest' }, 'any']],
  'session/session-log.mjs': [['does not log a cleared context', { reason: 'clear' }, 'pass']],
};

function classify(stdout) {
  if (!stdout.trim()) return 'pass';
  let parsed;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return 'unparseable';
  }
  if (parsed.decision === 'block') return 'block';
  const out = parsed.hookSpecificOutput ?? {};
  if (out.permissionDecision === 'deny') return 'deny';
  if (out.additionalContext) return 'context';
  return 'unrecognised';
}

/** Every hook on disk, so a new one cannot be added without a case for it. */
function everyHook() {
  const found = [];
  for (const folder of readdirSync(hooksDir, { withFileTypes: true })) {
    if (!folder.isDirectory() || folder.name === 'lib') continue;
    for (const file of readdirSync(join(hooksDir, folder.name))) {
      // test-*.mjs are rule tests, not hooks: run once below, never with a payload.
      if (file.endsWith('.mjs') && !file.startsWith('test-')) found.push(`${folder.name}/${file}`);
    }
  }
  return found.sort();
}

const env = { ...process.env, CLAUDE_PROJECT_DIR: repoRoot, DEAR_HOOK_STRICT: '1' };

/**
 * Run one hook exactly as Claude Code does: a payload on stdin, and stdin then
 * closed. Closing it is the whole point — a hook awaiting a stream nobody ends
 * hangs until its timeout, which is how this runner's first version reported
 * every hook as crashing.
 */
function runHook(file, payload) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [file], { cwd: repoRoot, env, windowsHide: true });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve({ stdout, stderr, hung: true });
    }, 30000);
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

let failed = 0;

console.log(`\n  hooks selftest — ${relative(process.cwd(), hooksDir) || hooksDir}\n`);

for (const hook of everyHook()) {
  const cases = CASES[hook];
  if (!cases) {
    console.log(`  MISSING CASE  ${hook} — every hook needs one, or it can die unnoticed`);
    failed += 1;
    continue;
  }
  for (const [what, payload, expected] of cases) {
    const started = Date.now();
    const { stdout, stderr, code, hung } = await runHook(join(hooksDir, hook), payload);
    const ms = Date.now() - started;

    // A hook may only ever exit 0: any other code is Claude Code's signal to
    // block the call, and none of these means to block by dying.
    const crash = hung
      ? 'hung on stdin or a child process'
      : code !== 0
        ? `exit ${code} — ${stderr.split('\n').filter(Boolean).slice(0, 2).join(' ')}`
        : stderr.trim()
          ? `wrote to stderr — ${stderr.split('\n')[0]}`
          : '';
    const got = crash ? 'CRASH' : classify(stdout);
    const ok = !crash && (expected === 'any' ? got !== 'unparseable' && got !== 'unrecognised' : got === expected);
    if (!ok) failed += 1;
    // An 'any' case still prints what it got: a hook that blocks every turn is
    // passing this test and failing her, and that has to be visible here.
    const note = ok && expected === 'any' ? ` → ${got}` : '';
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'}  ${String(ms).padStart(4)}ms  ${hook.padEnd(38)} ${what}${note}` +
        (ok ? '' : `\n           expected ${expected}, got ${got}${crash ? ` — ${crash}` : ''}`),
    );
  }
}

// The rule tests a hook depends on: a hook can be alive and deciding on rules
// that have quietly stopped firing, and this is where that shows.
for (const folder of readdirSync(hooksDir, { withFileTypes: true })) {
  if (!folder.isDirectory()) continue;
  for (const file of readdirSync(join(hooksDir, folder.name)).filter((f) => /^test-.*\.mjs$/.test(f))) {
    const started = Date.now();
    const { stdout, stderr, code } = await runHook(join(hooksDir, folder.name, file), {});
    const ok = code === 0;
    if (!ok) failed += 1;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'}  ${String(Date.now() - started).padStart(4)}ms  ${`${folder.name}/${file}`.padEnd(38)} ${(ok ? stdout : stderr).trim().split('\n').slice(0, 6).join('\n           ')}`,
    );
  }
}

console.log(failed ? `\n  ${failed} failing\n` : '\n  all hooks alive and deciding\n');
process.exit(failed ? 1 : 0);
