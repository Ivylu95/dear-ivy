// SAF-002: assert the crisis numbers are present and parseable, before anything
// ships.
//
//   node scripts/check-safety.mjs        (runs as part of `npm run build`)
//
// The spec asks for "a startup check [that] asserts their presence before the
// session begins", and its key consideration is that duplicated numbers drift
// and "the copy that drifts is the one nobody reads until it matters. They have
// already been wrong once."
//
// So has the parser. An earlier version of it silently dropped SOS 1767 and
// emergency 995 — the two most urgent entries — while rendering the two least
// urgent perfectly, and nothing anywhere reported a problem. The page looked
// fine. That is precisely the state this exists to make impossible.
//
// It imports the SAME function the app renders from, deliberately. A check with
// its own copy of the parse is a check that passes while the real one fails.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MINIMUM_CONTACTS,
  parseCrisisContacts,
  spokenNumbers,
  urgentSection,
} from '../lib/safety.mjs';

const repoRoot = join(dirname(dirname(fileURLToPath(import.meta.url))), '..');
const planPath = process.env.DEAR_DATA
  ? join(process.env.DEAR_DATA, 'safety', 'safety_plan.md')
  : join(repoRoot, 'data', 'safety', 'safety_plan.md');
// The crisis script. Harness, never relocated by DEAR_DATA — it is not part of
// the record, it is what gets said about it.
const scriptPath = join(repoRoot, '.claude', 'CLAUDE.md');

function fail(message) {
  console.error(`\n  SAFETY CHECK FAILED\n  ${message}\n`);
  console.error(`  file: ${planPath}`);
  console.error('  Nothing ships until the crisis numbers parse. See SAF-002 in');
  console.error('  specs/interaction/safety.md.\n');
  process.exit(1);
}

if (!existsSync(planPath)) fail('data/safety/safety_plan.md does not exist.');

const plan = readFileSync(planPath, 'utf8');

if (!urgentSection(plan)) {
  fail('No "if you need help right now" section found. The heading may have been renamed.');
}

const contacts = parseCrisisContacts(plan);

if (contacts.length < MINIMUM_CONTACTS) {
  fail(
    `Only ${contacts.length} number(s) parsed, expected at least ${MINIMUM_CONTACTS}.\n` +
      `  Found: ${contacts.map((c) => `${c.label} ${c.number}`).join(', ') || 'none'}`,
  );
}

// A number that is not dialable is worse than one that is missing, because it
// looks like it works.
for (const contact of contacts) {
  if (!/^[\d\s]+$/.test(contact.number)) fail(`"${contact.number}" is not dialable.`);
  if (!contact.label) fail(`A number (${contact.number}) has no label saying who it reaches.`);
}

console.log(`safety check: ${contacts.length} crisis numbers parse —`);
for (const c of contacts) console.log(`  ${c.number.padEnd(12)} ${c.label}`);

// ── The second copy ─────────────────────────────────────────────────────────
//
// Everything above checks the numbers the PAGE renders. These are the numbers
// the agent SAYS, and until this was written nothing compared the two.
//
// SAF-002's key consideration is not that a number might be absent; it is that
// "duplicated numbers drift, and the copy that drifts is the one nobody reads
// until it matters." The crisis script in .claude/CLAUDE.md is that second copy,
// and it cannot be replaced by a pointer — SAF-001 requires it in the
// always-loaded layer, where a file lookup is exactly what is not guaranteed to
// happen. So the duplication stays and this watches it.
//
// The two directions are not symmetrical, and the asymmetry is the design:
//
//   A number said but not in her plan   →  FAIL. The agent would recite a
//                                           helpline the record does not carry.
//                                           That is the drift, and it is the
//                                           one that reaches her.
//
//   A number in her plan but not said   →  NOTICE. Her plan may legitimately
//                                           hold a number the crisis script does
//                                           not recite — her care team, a ward
//                                           line — and CLAUDE.md is not the
//                                           agent's to edit in any case. Failing
//                                           here would block a build on
//                                           something no agent may fix.
if (!existsSync(scriptPath)) {
  console.log('safety check: no .claude/CLAUDE.md to compare against — skipped.');
} else {
  const onFile = new Set(contacts.map((c) => c.number));
  const spoken = spokenNumbers(readFileSync(scriptPath, 'utf8'));

  const stale = [...spoken].filter((n) => !onFile.has(n));
  if (stale.length > 0) {
    fail(
      `.claude/CLAUDE.md would say ${stale.map((n) => `"${n}"`).join(', ')}, ` +
        'which is not in her plan.\n' +
        `  Her plan has: ${[...onFile].join(', ')}\n` +
        '  The crisis script and the record have to agree. CLAUDE.md is not the\n' +
        "  agent's to edit — the change goes to data/state/proposals.md.",
    );
  }

  const unsaid = [...onFile].filter((n) => !spoken.has(n));
  console.log(
    `safety check: ${spoken.size} numbers in the crisis script, all of them in her plan` +
      (unsaid.length > 0 ? ` (${unsaid.join(', ')} on file but not recited)` : ''),
  );
}
