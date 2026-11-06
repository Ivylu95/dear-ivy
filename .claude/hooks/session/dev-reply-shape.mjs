// UserPromptSubmit and PreCompact — in development mode, the reply shape in
// front of the agent, and a note on the last reply if it fell short.
//
// DEV-002, "Every development reply can be picked up cold, from that reply
// alone." The full shape (~1,000 tokens) goes in once per chat, and again after
// a compaction has dropped it from context; every other message carries only a
// one-line reminder and the header block, which is measured fresh each turn.
// If the Stop check noted a shortfall in the last reply, the note comes here,
// once, so the next reply fixes it: a reply is never sent back, because a sent
// back reply reaches the developer twice. Silent outside development mode, so
// her conversations never see it.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readHookInput, context, pass, markerRead, markerWrite, CONTEXT_LIMIT, repoRoot as projectDir, readEntries, typed } from '../lib/hook.mjs';
import { FOR_YOU_FILE, SKILLS_DIR } from '../lib/paths.mjs';
import { sessionId } from '../lib/sandbox.mjs';
import { devModeActive, devModeArgs, devStatus, entersSandbox } from '../lib/dev-mode.mjs';
import { SHAPE, DIALOGUE_FIRST, RELAYED_TURN, relayedTurn, chatView, viewChoice, noteMarker, contextLoad, contextHeavy, typedCrisis, recentAssistantContent, setUpGapAhead } from '../lib/dev-reply.mjs';
import { sessionMeta, sessionFigures } from '../lib/session-meta.mjs';
import { parseForYou, forYouMenu, overdue, owedReviewsRead } from '../lib/for-you.mjs';
import { parseIdeas, putBackDue, ideasMenu, IDEAS_ROOM } from '../lib/ideas.mjs';

const input = await readHookInput();
const sent = `dev-shape-sent-${String(input?.session_id || sessionId(input) || 'unknown').replace(/[^\w-]/g, '')}`;

// A compaction drops the shape from context: send it in full again next time.
if (input.hook_event_name === 'PreCompact') {
  markerWrite(sent, '');
  pass();
}

const prompt = String(input.prompt ?? '');
// Entering the sandbox, the reply is her first test line, not a development one (WKB-013).
if (entersSandbox(prompt)) pass();
const named = devModeArgs(prompt);
const switching = named !== null;
if (!switching && !devModeActive(input)) pass();

const full = switching || !markerRead(sent);

// DEV-003: /dev-mode with nothing named opens on the menu, not an empty tracker.
const opening = switching && !named
  ? 'OPENING (DEV-003): nothing is chosen yet, so this reply is the MENU, headed "🛠️ **Dev Mode · Menu**".'
  : '';
if (full) markerWrite(sent, new Date().toISOString());

// D-G1: a message that trips the crisis list is answered by the Crisis section
// of CLAUDE.md, not the shape: no shortfall note and no header demand on this
// reply. A note waiting from the last reply is held for the next message.
const distress = typedCrisis(prompt);
// A-165's pull at each message is in dialogue-record.mjs, before the remark is written:
// here it ran side by side with that write (T-681).
const note = distress ? '' : markerRead(noteMarker(input));
if (note) markerWrite(noteMarker(input), '');

const meta = sessionMeta(input.transcript_path, new Date(), { status: switching ? devStatus() : '' });

// What waits on the developer (A-152), counted here so the "For you" bullet is
// computed, not guessed: every item at the start of a chat, for the dev menu
// to show until he answers it, and the count every turn. There is no backlog:
// this chat's own unfinished work is its tracker's, finished or dropped before
// it closes.
const { items: forYou } = parseForYou();
const late = overdue(forYou);
const menuLines = forYouMenu(forYou);
const items = full
  ? menuLines.length
    ? `FOR YOU (A-152), the menu's first entry. ${menuLines[0]}${late.length ? ` (${late.length} over two weeks)` : ''}`
    : 'FOR YOU (A-152): nothing waits on the developer; the menu leaves the "For you" entry out.'
  // Trimmed 2026-11-02: on an ordinary turn the count changes nothing the reply does, so it is left
  // to the chat's first turn and the menu (A-152 is met there, where the list is shown).
  : '';

// A-125, WKB-017: once in each month, at a chat's start, the open ideas go back
// to him with what was found about each; the showing is recorded by
// `ideas.mjs shown`, so a chat that forgets leaves it due for the next.
// Its lines are fitted below, before the for-you list, in what room is left.
const ideaList = parseIdeas();
const ideasDue = full && putBackDue(ideaList);
const ideasLine = ideasDue ? 'IDEAS (A-125)' : '';

// D19, D42: the dialogue's own status opens every development chat, with what changed
// while the developer was away. Read through the dialogue script, so it cannot disagree
// with its checks; a copy without dev/ prints nothing, and a failure never stops the hook.
let dialogueLine = '';
if (full) {
  try {
    const r = spawnSync(process.execPath, [join(projectDir, 'ux', 'scripts', 'dialogue.mjs'), 'status'], { cwd: projectDir, encoding: 'utf8', timeout: 10_000 });
    const text = String(r.stdout ?? '').trim();
    if (r.status === 0 && text.startsWith('🧭')) dialogueLine = `DIALOGUE STATUS, for the start of this chat (D19, D42): open the reply's body with it, in plain words, before anything else:\n${text}`;
  } catch { /* the line is a courtesy; its absence is not an error */ }
}

// DEV-021: a review an earlier chat owed and never ran survives that chat.
// History that could not be read is said, never taken for "none owed". Three IDs
// at most: eighteen pushed the shape past its limit (2026-10-10); the rest are
// named by count and listed by `dev-review.mjs owed`.
const { chats: owed, unreadable } = owedReviewsRead({ exclude: sessionId(input) });
const OWED_SHOWN = 3;
const owedNamed = owed.length > OWED_SHOWN ? `${owed.slice(0, OWED_SHOWN).join(', ')}, and ${owed.length - OWED_SHOWN} more: node .claude/hooks/lib/dev-review.mjs owed` : owed.join(', ');
// Trimmed 2026-11-02: earlier chats' reviews are offered at a chat's start, not on every turn.
const owedLine = !full ? '' : unreadable
  ? `REVIEWS OWED: unknown, git history unreadable (${unreadable}); say so in a line, never as none.`
  : owed.length
  ?`REVIEWS OWED by ${owed.length} earlier chat(s) that changed the harness and whose end-of-session review never ran, or ran before later work (${owedNamed}): offer to run it here on their commits, record it under that chat with "node .claude/hooks/lib/dev-review.mjs done <chat id>", and name it in one line.`
  : '';

// DEV-018: past 70% of the window or 400k, say so, with the way out. Never
// /clear in a cloud chat: a resume brings the original conversation back beside
// the cleared one, and both answer (2026-09-30, 10-01). /compact keeps one.
const measured = sessionFigures(input.transcript_path)?.context ?? '';
const { share, used } = contextLoad(measured);
const heavy = contextHeavy(measured)
  ? `CONTEXT IS AT ${share}%, ~${Math.round(used / 1000)}k (DEV-018): say so in this reply, and suggest finishing the step in hand, running the end-of-session review, and then /compact to shrink this same conversation. Do not suggest /clear in a cloud chat: when the machine is reclaimed the platform resumes the chat's original conversation, and it answers alongside the cleared one, so every message gets two replies (seen 2026-09-30 and 10-01). If /compact is not enough, suggest a new chat once this one's work is finished or dropped (A-152).`
  : '';

// FIT-001: narrow (mobile) or wide (desktop), chosen per chat; this message counts.
const typedSoFar = [];
try {
  for (const line of readFileSync(String(input.transcript_path ?? ''), 'utf8').split('\n')) {
    try {
      const e = JSON.parse(line);
      const c = e?.type === 'user' ? e.message?.content : null;
      if (typeof c === 'string') typedSoFar.push(c);
      else if (Array.isArray(c)) typedSoFar.push(c.filter((x) => x?.type === 'text').map((x) => x.text).join('\n'));
    } catch { /* a partial line */ }
  }
} catch { /* no transcript: no choice yet */ }
const view = chatView([...typedSoFar, prompt]);
// Trimmed 2026-11-02: the view is said once per chat (FIT-001), so after the first turn the line
// returns only on the message that chooses it.
const viewLine = !full && !viewChoice(prompt) ? '' : view
  ? `VIEW (FIT-001): ${view}, chosen for this chat.`
  : 'VIEW (FIT-001): narrow, not chosen. Once per chat, under the header callout: "> View · narrow · say "wide" for desktop".';

// A-016, E-060: a question or correction mid set-up is a gap, said up front so this
// reply records it; the Stop check's note would only reach the next one. The
// prompt is not in the transcript yet, so the recent run is read up to its end.
const entries = readEntries(input.transcript_path) ?? [];
const gapAhead = setUpGapAhead(recentAssistantContent(entries, typed, entries.length, 10), prompt);

// A-053, E-094: a question he keeps asking, matched on his own words here, because the
// agent's own `ask` search may carry only a few of them and miss it.
// A hand-back or a notification is not his message: neither line below is for it.
const relayed = relayedTurn(prompt);
let keptLine = '';
if (!distress && !relayed && /\?/.test(prompt)) {
  try {
    const { keptAgain } = await import('../../../ux/scripts/dialogue-views.mjs');
    const [k] = keptAgain(prompt.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, ''));
    if (k) keptLine = `🔁 KEPT QUESTION (A-053): he asks "${k.question}" again (first ${k.first}). Run dialogue.mjs ask on his whole message, which prints it. Before any view: say it is kept in dev/dialogue/README.md "Your questions" (claim no count or log beyond that), ask it of one other area where it bites, and put it back to him to answer; yours waits for his.`;
  } catch { /* a copy without dev/ keeps no questions */ }
}

const parts = [
  distress ? 'SAFETY FIRST (D-G1): this message matched the crisis list. The Crisis section of CLAUDE.md governs this reply: stay with the person first; no header, no tracker, no set-up gap note. The shape below waits until they are steady.' : '',
  full ? SHAPE : 'DEVELOPMENT REPLY SHAPE (DEV-002..014) applies, as given in full earlier in this chat.',
  relayed ? RELAYED_TURN : DIALOGUE_FIRST,
  full
    ? `DEV SKILLS (ARC-005): the procedures only development mode uses keep only a typed dev- entry; if this message matches a row under "Dev skills" in ${SKILLS_DIR}/README.md, read that body in full and follow it.`
    : `DEV SKILLS (ARC-005): a matching row in ${SKILLS_DIR}/README.md is read in full first.`,
  items,
  ideasLine,
  dialogueLine,
  viewLine,
  opening,
  owedLine,
  heavy,
  gapAhead,
  keptLine,
  note ? `YOUR LAST REPLY FELL SHORT, fix it in this one: ${note}` : '',
  meta && !distress ? `HEADER BLOCK for this reply, first, with the shape named inside the first line's tags (" · Menu", " · View" or " · Tracker"; DEV-003):\n${meta}` : '',
].filter(Boolean);

// The for-you listing is the one part that grows, so it takes what room is
// left under CONTEXT_LIMIT, oldest first, and names the rest by count: over the
// limit, the whole text is cut to a preview and the shape above is never read.
// The margin holds the "…and N more" line.
const MARGIN = 200;
// The kept-question line gives way first: `ask` prints the same instruction.
if (keptLine && parts.join('\n\n').length > CONTEXT_LIMIT - MARGIN) parts.splice(parts.indexOf(keptLine), 1);
if (ideasDue) {
  const room = CONTEXT_LIMIT - parts.join('\n\n').length + ideasLine.length - MARGIN;
  parts[parts.indexOf(ideasLine)] = ideasMenu(ideaList.ideas, Math.min(IDEAS_ROOM, room)).join('\n');
}
if (full && menuLines.length) {
  let room = CONTEXT_LIMIT - parts.join('\n\n').length - MARGIN;
  if (room < 0) process.stderr.write(`dev-reply-shape: ${-room} characters over CONTEXT_LIMIT before the for-you list; the shape will be cut to a preview\n`);
  const shown = [];
  for (const line of menuLines.slice(1)) {
    if (line.length + 1 > room) break;
    shown.push(line);
    room -= line.length + 1;
  }
  const more = forYou.length - shown.length;
  parts[parts.indexOf(items)] = [items, ...shown, ...(more ? [`  - …and ${more} more: read ${FOR_YOU_FILE}`] : [])].join('\n');
}
context('UserPromptSubmit', parts.join('\n\n'));
