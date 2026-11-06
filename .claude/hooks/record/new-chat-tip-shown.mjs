// Stop — write down that the one-time new-chat tip went out (CON-021), and keep this
// chat's name on her list the one the app shows (A-158, 2026-11-05, lib/chats.mjs syncTitle): in
// every chat, development ones too, before anything else here.
//
// Reads the reply just sent; if the tip was offered this turn and the reply
// carries it, the record gains data/core/state/new_chat_tip.md, and save-record
// commits it with the rest of the turn or the next. Never blocks.

import { writeFileSync } from 'node:fs';
import { readHookInput, pass, read, dataDir, block, markerRead, markerWrite } from '../lib/hook.mjs';
import { devModeActive } from '../lib/dev-mode.mjs';
import { CORE_DATA } from '../lib/modules.mjs';
import { profilePath, record } from '../lib/profile.mjs';
import { syncTitle, liveTitle } from '../lib/chats.mjs';
import { sessionId } from '../lib/sandbox.mjs';
import { entries, eligible, lastReplyText, tipFile, tipPath, TIP_PATTERN } from '../lib/new-chat-tip.mjs';
import { join } from 'node:path';

const input = await readHookInput();
if (input?.stop_hook_active) pass();
const list = entries(input?.transcript_path);
try {
  if (!process.env.DEAR_RECORD_READONLY) syncTitle(dataDir, sessionId(input), liveTitle(list));
} catch {
  /* the list keeps its old name until the next turn */
}
// The chat name check this turn owed (T-829): the turn is held once until it is done, never twice.
{
  const id = String(sessionId(input)).replace(/^(cse_|session_)/, '');
  const owed = id ? markerRead(`name-owed-${id}`).trim() : '';
  if (owed && owed !== 'held') {
    markerWrite(`name-owed-${id}`, 'held');
    block('CHAT NAME (A-158) still owed this turn: call get_session (no session_id), then run node .claude/hooks/lib/chats.mjs app-name "<its title>". Say nothing about it to her unless the name changed.');
  }
}
if (devModeActive(input)) pass(); // a sandbox test is not development mode (WKB-013)

const zone = record.readProfile(read(profilePath(dataDir))).value.timezone ?? 'UTC';
const date = record.zonedDateTime(new Date(), zone).slice(0, 10);
const ok = eligible({
  list,
  tipText: read(tipPath(dataDir)),
  log: read(join(dataDir, CORE_DATA, 'state', 'log.md')),
  date,
});
if (!ok || !TIP_PATTERN.test(lastReplyText(list))) pass();

try {
  writeFileSync(tipPath(dataDir), tipFile(date));
} catch {
  /* unwritable: the tip may come once more, which is the lesser harm */
}
pass();
