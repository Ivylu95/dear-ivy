// The context meter reads true across a compaction (DEV-018), and stays out of
// the development header, which the app already tops with it (T-450).
//
//   node .claude/hooks/session/test-session-meta.mjs
//
// Run by the hook self-test (selftest.mjs). Writes its transcripts to a temp folder.

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sessionMeta, sessionFigures } from '../lib/session-meta.mjs';
import { makeTemp } from '../lib/temp-litter.mjs';

const dir = makeTemp('dear-meta-');
let n = 0;
const at = (m) => `2026-10-01T00:${String(m).padStart(2, '0')}:00Z`;
const typed = (m, text = 'go on') => ({ type: 'user', timestamp: at(m), message: { content: text } });
const reply = (m, tokens, model = 'claude-x') => ({ type: 'assistant', timestamp: at(m), message: { model, usage: { input_tokens: 2, cache_read_input_tokens: tokens } } });
const compacted = (m, pre) => ({ type: 'system', subtype: 'compact_boundary', timestamp: at(m), compactMetadata: { preTokens: pre } });
const summary = (m) => ({ type: 'user', timestamp: at(m), isCompactSummary: true, message: { content: 'This session is being continued...' } });
// The chat as the hook sees it on turn 1: opened, the first message not yet written.
const opened = (m) => ({ type: 'system', timestamp: at(m) });
const file = (entries) => {
  const path = join(dir, `t${(n += 1)}.jsonl`);
  writeFileSync(path, entries.map((e) => JSON.stringify(e)).join('\n'));
  return path;
};
const before = [typed(1), reply(2, 700000)];

// [what, transcript, must contain, must not contain]
const CASES = [
  ['a full chat is measured against 1M', file(before), '(70%)', ''],
  ['right after a compaction the old count is not reused', file([...before, compacted(3, 700000), summary(3), typed(4)]), 'Context just compacted', '%)'],
  ['the compaction summary is not counted as a turn', file([...before, compacted(3, 700000), summary(3), typed(4)]), 'Turn 3 ', ''],
  ['after a compaction a 1M chat is still measured against 1M', file([...before, compacted(3, 700000), summary(3), typed(4), reply(5, 90000), typed(6)]), '/ 1M (9%)', '200k'],
  ['a small chat that never compacted is measured against 200k', file([typed(1), reply(2, 90000)]), '/ 200k (45%)', ''],
  ['turn 1 has no Last reply', file([opened(1)]), 'Turn 1 · Started', 'Last reply'],
  ['the status line goes on its own callout line', file([opened(1)]), '\n> Development mode on', ''],
  ['an Opus chat is measured against 1M from its first reply', file([typed(1), reply(2, 160000, 'claude-opus-5-5')]), '/ 1M (16%)', '200k'],
  ['header: no context figure (T-450)', file(before), 'Turn 2 · Started', 'Context'],
  ['header: no "ago" (T-450)', file(before), 'Last reply', 'ago'],
  ['header: the last reply says how long it took (A-166)', file(before), '(took 1m 00s)', ''],
  ['header: the time runs from the message it answered, past tool calls', file([typed(1), reply(2, 9000), { type: 'user', timestamp: at(3), message: { content: [{ type: 'tool_result', content: 'ok' }] } }, reply(7, 9000)]), '(took 6m 00s)', ''],
  ['header: hook feedback does not restart the clock', file([typed(1), { type: 'user', timestamp: at(4), message: { content: 'Stop hook feedback: commit' } }, reply(5, 9000)]), '(took 4m 00s)', ''],
  ['header: turn 1 has no time taken', file([opened(1)]), 'Turn 1 · Started', 'took'],
];

let failed = 0;
for (const [what, path, want, never] of CASES) {
  // The header's own cases read the header; the rest read the measured context.
  const header = /^(header|turn 1|the status|the compaction summary)/.test(what);
  const got = header ? sessionMeta(path, new Date(at(10)), what.includes('status') ? { status: 'Development mode on' } : {}) : sessionFigures(path)?.context ?? '';
  if (!got.includes(want) || (never && got.includes(never))) {
    failed += 1;
    console.error(`FAIL ${what}: got ${got.split('\n').pop()}`);
  }
}
rmSync(dir, { recursive: true, force: true });
if (failed) process.exit(1);
console.log(`session meta tests: ${CASES.length} cases pass`);
