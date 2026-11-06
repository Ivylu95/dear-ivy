// PreToolUse(WebSearch|WebFetch|mcp__*) — nothing personal leaves the machine in
// a request the agent makes.
//
// SFG-012, "Nothing personal leaves the machine in a request the agent makes." A
// search query or a fetched address goes to someone else's server, where it is
// logged and kept; a name sent there is the one privacy failure nothing
// afterwards can undo. The same two checks as guard-harness-privacy.mjs, applied
// to what would be sent:
//
//   NAMES   her own name, and each first name on file in data/core/people/
//   COPIES  a line of the record, or a long enough part of one, in the request
//
// It fails closed: a request it cannot check is not sent. It matches what is on
// file, not what identifies — a rare condition, a place and a date can point to
// her with no name in them — and a shell command that reaches the network is not
// seen. Both limits are in the row's design.
//
// One exception, on the owner's yes (A-127, T-344): a first name from people/
// may go to her own Google Calendar, since "Dinner" with no name is no use to
// her. Only on the connector whose writes guard-calendar-writes.mjs also guards
// (the same prefix, so no write reaches her calendar by a route that guard does
// not see); her yes to the draft, and a search she asked for, stay with the
// calendar skill. Her own name and a copied line still go nowhere.

import { join } from 'node:path';
import { readHookInput, refuse, pass, read, walk, recordNames, peopleNames, realDataDir as dataDir } from '../lib/hook.mjs';

const QUOTE_LENGTH = 30; // Queries are short; a shared run this long is not coincidence.

const ask =
  'Ask it in general terms instead — the condition, the situation, the kind of person — ' +
  'with no name and nothing copied from the record. It is usually the better search too.';

try {
  const input = await readHookInput();
  const sent = JSON.stringify(input?.tool_input ?? {});
  if (sent.length <= 2) pass();

  const calendar = String(input?.tool_name ?? '').startsWith('mcp__Google_Calendar__');
  const allowed = calendar ? new Set(peopleNames(dataDir)) : new Set();
  if (calendar) {
    const { profileName } = await import('../lib/profile-schema.mjs');
    const own = profileName(read(join(dataDir, 'PROFILE.yaml'))).toLowerCase();
    for (const name of allowed) if (name.toLowerCase() === own) allowed.delete(name);
  }
  for (const name of await recordNames()) {
    if (allowed.has(name)) continue;
    if (new RegExp(`\\b${name}\\b`, 'i').test(sent)) {
      refuse('PreToolUse', `Blocked: "${name}" is a name from the record, and this request leaves the machine.\n\n${ask}`);
    }
  }

  const lower = sent.toLowerCase();
  for (const file of walk(dataDir)) {
    if (!file.endsWith('.md') && !file.endsWith('.yaml')) continue;
    for (const raw of read(file).split('\n')) {
      const line = raw.trim().toLowerCase();
      if (line.length >= QUOTE_LENGTH && !line.startsWith('#') && !line.startsWith('|') && lower.includes(line)) {
        refuse('PreToolUse', `Blocked: this request carries a line from the record.\n\n${ask}`);
      }
    }
  }
  pass();
} catch (error) {
  refuse('PreToolUse', `Blocked: the outbound privacy check could not run (${error?.message ?? error}), and a request it cannot check is not sent.`);
}
