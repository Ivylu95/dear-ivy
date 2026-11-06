// UserPromptSubmit — offer, once ever, that a fresh chat is fine (CON-021).
//
// The judgement is in ../lib/new-chat-tip.mjs. This only puts the permission in
// front of the reply; the model decides whether this moment is calm enough, and
// if it is not, the offer simply comes again on the next message. Silent in
// development mode outside its sandbox, and on any day the crisis floor fired.

import { readHookInput, context, pass, read, dataDir, markerRead, markerSeen, markerWrite } from '../lib/hook.mjs';
import { devModeActive, SAFETY } from '../lib/dev-mode.mjs';
import { nameCheckDue } from '../lib/chats.mjs';
import { sessionId } from '../lib/sandbox.mjs';
import { CORE_DATA } from '../lib/modules.mjs';
import { profilePath, record } from '../lib/profile.mjs';
import { entries, eligible, tipPath } from '../lib/new-chat-tip.mjs';
import { join } from 'node:path';

const input = await readHookInput();

// The app's name for this chat (T-829): owed on his "I renamed it" and on a chat's first turn here,
// in every chat; the Stop half (new-chat-tip-shown.mjs) holds the turn until it is checked.
const id = String(sessionId(input)).replace(/^(cse_|session_)/, '');
const why = id ? nameCheckDue({ prompt: input?.prompt, checked: markerSeen(`name-checked-${id}`), remote: Boolean(process.env.CLAUDE_CODE_REMOTE_SESSION_ID), unsafe: SAFETY.test(String(input?.prompt ?? '')) }) : null;
const nameLine = why
  ? `CHAT NAME (A-158, ${why === 'renamed' ? 'he says he renamed it' : "this chat's first turn here"}): call get_session (no session_id), then run node .claude/hooks/lib/chats.mjs app-name "<its title>". Say nothing about it unless the name changed.`
  : '';
if (why && !markerRead(`name-owed-${id}`)) markerWrite(`name-owed-${id}`, why);
if (devModeActive(input)) (nameLine ? context('UserPromptSubmit', nameLine) : pass()); // a sandbox test is not development mode (WKB-013)

const zone = record.readProfile(read(profilePath(dataDir))).value.timezone ?? 'UTC';
const ok = eligible({
  list: entries(input?.transcript_path),
  tipText: read(tipPath(dataDir)),
  log: read(join(dataDir, CORE_DATA, 'state', 'log.md')),
  date: record.zonedDateTime(new Date(), zone).slice(0, 10),
});
if (!ok) (nameLine ? context('UserPromptSubmit', nameLine) : pass());

context(
  'UserPromptSubmit',
  (nameLine ? `${nameLine}\n` : '') +
  'NEW-CHAT TIP (CON-021), once ever: this chat has grown long enough to slow down. Only if this moment is calm, ' +
  'not mid-event, not a hard feeling, nothing near safety, add one short line at the very end of your reply, ' +
  'above any 📝 line, saying in your own words that she can start a new chat any time and you will still remember ' +
  'everything, and that it tends to feel quicker. Say "new chat". No steps, no question, never again after this. ' +
  'If the moment is not calm, leave it out entirely; it will be offered again on a later message.',
);
