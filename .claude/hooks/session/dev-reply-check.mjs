// Stop — a development reply that falls short is noted for the next message.
//
// DEV-002..011, DEV-020 and DEV-008 (and DEP-014's set-up learning step): in development mode every reply opens with the
// tracker, asks one thing, and fits a phone. The shape and the judgement are
// in ../lib/dev-reply.mjs; this reads the turn's last reply and applies it.
// Silent outside development mode. Never blocks, so no reply reaches the
// developer twice, and never holds a reply about someone's safety to a format.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DEV_DIR } from '../lib/paths.mjs';
import { sortParts } from '../lib/transcript-parts.mjs';
import { execFileSync, spawnSync } from 'node:child_process';
import { readHookInput, pass, markerRead, markerWrite, repoRoot, readEntries, turnStart, saidAfter, typed } from '../lib/hook.mjs';
import { sessionId } from '../lib/sandbox.mjs';
import { devModeActive } from '../lib/dev-mode.mjs';
import { chatView, replyProblem, lessonLineProblem, reviewProblem, closeProblem, noteMarker, unpushedProblem, parseSessionLog, setUpLearnProblem, setUpLearnCarry, SET_UP_LEARN_OWED, setUpFeedbackProblem, recentAssistantContent, claimProblem } from '../lib/dev-reply.mjs';
import { reviewState, reviewConfirmed } from '../lib/dev-review.mjs';

const input = await readHookInput();
if (input?.stop_hook_active) pass();
if (!devModeActive(input)) pass();

const entries = readEntries(input?.transcript_path);
if (!entries) pass(); // No transcript, nothing to judge: never block on a guess.

// The turn starts at the last message typed: a user entry that is not a tool result.
const start = turnStart(entries);
const said = saidAfter(entries, start);
const reply = said[said.length - 1] ?? '';

// A shortfall is noted for the next message, never sent back: a sent-back
// reply reaches the developer twice (seen 2026-09-30, five times in one chat).
const state = reviewState(input);
// Harness work reaches the remote as it lands (DEV-015):
// the machine is disposable, and a commit on no remote branch dies with it.
// Counted against the last fetch, so it can only under-report. Attributed by
// each commit's Claude-Session trailer, not by branch: the shared tree's HEAD
// can hold another chat's finished commit, and that chat's own check names it.
let unpushedLog = '';
try {
  unpushedLog = execFileSync('git', ['log', 'HEAD', '--not', '--remotes=origin', '--format=%x00%H%x01%(trailers:key=Claude-Session,valueonly,separator=%x20)'], { cwd: repoRoot, encoding: 'utf8', timeout: 15000, windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
} catch {
  /* no git, or no remote: nothing to count */
}
const ids = [input?.session_id, process.env.CLAUDE_CODE_SESSION_ID, process.env.CLAUDE_CODE_REMOTE_SESSION_ID, sessionId(input)];
const unsaved = unpushedProblem(parseSessionLog(unpushedLog), ids);
// What this chat still has open is its tracker's alone: there is no backlog to
// carry it (A-152), so the close checks read the reply's own steps left.
const unread = state === 'unreadable' ? 'Git history could not be read, so whether this chat owes its end-of-session review is not known (DEV-020): say so under "Still open" rather than reading it as done.' : '';
// FIT-001: the view chosen for this chat, from every message the developer typed.
const typedText = (e) => (typeof e.message.content === 'string' ? e.message.content : e.message.content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n'));
const view = chatView(entries.filter(typed).map(typedText));
// DEP-014: a set-up run's learning step, read from every tool call of the chat.
const content = entries.filter((e) => e?.type === 'assistant' && Array.isArray(e.message?.content)).flatMap((e) => e.message.content);
// D-G1: distress typed this turn sets the shape and set-up checks aside (lib/dev-reply.mjs).
const typedNow = start >= 0 ? typedText(entries[start]) : '';
const learn = setUpLearnProblem(content, reply, typedNow);
// A chat's last reply is never followed by a message here, so the shortfall
// outlives the chat: the next session's brief says it once (session-brief.mjs).
const owed = markerRead(SET_UP_LEARN_OWED);
const carry = setUpLearnCarry(content, learn, owed);
if (carry !== owed) markerWrite(SET_UP_LEARN_OWED, carry);
// The developer asking or correcting mid-run is a gap in the skill, recorded that turn.
const before = recentAssistantContent(entries, typed, start, 10);
const thisTurn = entries.slice(start + 1).filter((e) => e?.type === 'assistant' && Array.isArray(e.message?.content)).flatMap((e) => e.message.content);
const feedback = start >= 0 ? setUpFeedbackProblem(before, typedNow, thisTurn, reply) : '';
// A-093: the newest Transcript entry, which a teaching reply must leave its lesson on.
let latestEntry = null;
try {
  const dir = join(repoRoot, DEV_DIR, 'dialogue', 'transcript');
  // The newest month's last part holds the newest entry (T-499).
  const month = sortParts(readdirSync(dir)).at(-1);
  if (month) latestEntry = readFileSync(join(dir, month), 'utf8').split(/\n(?=### T-\d+ · )/).at(-1);
} catch { /* no Transcript in this copy: nothing to hold */ }
// A-096: a card agreed in the newest remark is done at every level before the reply says so.
let halfBuilt = '';
const justAgreed = [...String(latestEntry ?? '').matchAll(/^- \*\*Card (A-\d+)\*\* · status: agreed/gm)].map((m) => m[1]);
if (justAgreed.length) {
  const r = spawnSync(process.execPath, [join(repoRoot, 'ux', 'scripts', 'dialogue.mjs'), 'done', ...justAgreed], { cwd: repoRoot, encoding: 'utf8', timeout: 20_000 });
  if (r.status === 1) halfBuilt = `You agreed ${justAgreed.join(', ')} but it is not done at every level (A-096): ${String(r.stdout).split('\n').filter((l) => l.includes('❌')).map((l) => l.trim()).join('; ')}. Fill each gap, or say plainly which is left and why.`;
}
const claim = start >= 0 ? claimProblem(reply, entries.slice(start + 1)) : '';
const problems = [replyProblem(reply, view, undefined, typedNow), claim, lessonLineProblem(reply, latestEntry), halfBuilt, reviewProblem(reply, state), closeProblem(reply), learn, feedback, unsaved, unread].filter(Boolean);
markerWrite(noteMarker(input), problems.join(' '));
if (state === 'confirm' && !reviewProblem(reply, state)) reviewConfirmed(input);
pass();
