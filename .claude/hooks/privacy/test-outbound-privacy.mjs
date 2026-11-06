// Rule test for guard-outbound-privacy.mjs (SFG-012, A-127): a name on file in
// people/ may go to her own Google Calendar, in an event she approved or a search
// she asked for, and nowhere else; her own name and a copied line of the record
// go nowhere. Runs against an invented record in a throwaway folder, so no real
// name is ever read or written here. Run by selftest.mjs and eval E-078; exits
// non-zero on any failure.

import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTemp } from '../lib/temp-litter.mjs';

const hook = join(dirname(fileURLToPath(import.meta.url)), 'guard-outbound-privacy.mjs');
const root = makeTemp('dear-outbound-');
const FRIEND = 'Zephyrine';
const OWN = 'Quillabel';
const LINE = 'always brings the green thermos to the saturday market';
mkdirSync(join(root, 'data', 'core', 'people'), { recursive: true });
writeFileSync(join(root, 'data', 'PROFILE.yaml'), `mandatory:\n  name:\n    value: ${OWN}\n    status: answered\n`);
writeFileSync(join(root, 'data', 'core', 'people', `${FRIEND.toLowerCase()}.md`), `# ${FRIEND}\n\n${LINE}\n`);

const create = (summary) => ({ tool_name: 'mcp__Google_Calendar__create_event', tool_input: { summary, startTime: '2026-11-06T19:00:00', endTime: '2026-11-06T21:00:00' } });
const cases = [
  ['a calendar event naming someone on file passes', create(`Dinner with ${FRIEND}`), false],
  ['a calendar search naming someone on file passes', { tool_name: 'mcp__Google_Calendar__search_events', tool_input: { query: FRIEND } }, false],
  ['a calendar update naming someone on file passes', { tool_name: 'mcp__Google_Calendar__update_event', tool_input: { eventId: 'x', summary: `Lunch with ${FRIEND}`, notificationLevel: 'NONE' } }, false],
  ['the same name in a web search is refused', { tool_name: 'WebSearch', tool_input: { query: `what to say to ${FRIEND}` } }, true],
  ['the same name in a page fetch is refused', { tool_name: 'WebFetch', tool_input: { url: `https://example.com/?q=${FRIEND}`, prompt: 'x' } }, true],
  ['the same name in another connector is refused', { tool_name: 'mcp__Claude_Docs__batch', tool_input: { text: `notes on ${FRIEND}` } }, true],
  ['the same name under a look-alike calendar prefix is refused', { tool_name: 'mcp__claude_ai_Google_Calendar__create_event', tool_input: { summary: `Dinner with ${FRIEND}` } }, true],
  ['her own name in a calendar event is refused', create(`${OWN}'s haircut`), true],
  ['a copied record line in a calendar event is refused', create(`Note: ${LINE}`), true],
  ['a plain calendar event passes', create('Dinner'), false],
];

let failed = 0;
for (const [name, payload, refused] of cases) {
  const run = spawnSync(process.execPath, [hook], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, DEAR_HOOK_STRICT: '1' },
    windowsHide: true,
  });
  const denied = /"permissionDecision":\s*"deny"/.test(run.stdout || '');
  const ok = run.status === 0 && denied === refused;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`);
  if (!ok) {
    failed += 1;
    console.log(`     expected ${refused ? 'refused' : 'passed'}, got ${denied ? 'refused' : 'passed'} (exit ${run.status}) ${(run.stderr || '').split('\n')[0]}`);
  }
}
rmSync(root, { recursive: true, force: true });
if (failed) process.exit(1);
