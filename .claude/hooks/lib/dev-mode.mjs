// Development mode's per-session marker (DEV-001), shared by the hook that reads
// it and the command that writes it. Run directly, it switches the current
// session on — how the agent switches when the developer asks for development
// work in plain words rather than typing /dev-mode.

import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { markerRead, markerSeen, markerWrite, repoRoot } from './hook.mjs';
import { SPECS_DIR } from './paths.mjs';
import { rowStatements } from './dev-reply.mjs';
import { SWITCH_STEPS, inSandbox, sessionId } from './sandbox.mjs';
import { sessionMeta } from './session-meta.mjs';

export function devModeMarker(input) {
  return `dev-mode-${sessionId(input) || 'unknown'}`;
}

/** The chats switched on, kept in git so the switch outlives the machine (T-849): the marker
 *  lives in an ignored folder, so a chat resumed on a fresh machine opened in everyday and its
 *  remarks went unkept and its Telegram lines unsent. Chat IDs only, nothing of anyone. */
export const SAVED_CHATS = join(repoRoot, '.claude', 'dev-mode-chats');
const savedChats = () => { try { return readFileSync(SAVED_CHATS, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean); } catch { return []; } };
/** Only a real chat's ID is kept: a cloud chat's (cse_… or session_…) or a local one's (a UUID).
 *  A test's made-up chat never reaches the list in git, even when its run is cut off before it
 *  clears up (2026-11-05: test-turn-kind IDs were found saved). */
export const realChat = (id) => /^(cse|session)_[A-Za-z0-9]+$/.test(String(id ?? '')) || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id ?? ''));
const saveChats = (ids) => writeFileSync(SAVED_CHATS, ids.length ? `${ids.join('\n')}\n` : '');

export function devModeOn(input) {
  markerWrite(devModeMarker(input), new Date().toISOString());
  const id = sessionId(input);
  if (realChat(id) && !savedChats().includes(id)) saveChats([...savedChats(), id]);
  // A switch made mid-turn makes this turn a building one, and the short answers after it too.
  markerWrite(turnMarker(input), 'build');
}

/**
 * Whether this chat's replies follow development practice now: switched on,
 * and not in sandbox mode, where the chat plays her everyday conversation and
 * the development checks stand down until it is switched off (WKB-013).
 */
export function devModeActive(input) {
  const id = sessionId(input);
  return Boolean(id) && markerSeen(devModeMarker(input)) && !inSandbox(id) && turnKind(input) !== 'life';
}

// Card A-146: development mode is for building. A chat switched on stays on, but a message
// about her life (food, training, her day) is answered the everyday way, and its words are
// not kept in the development Transcript. Each message is judged on its own (turnKind);
// "leave dev mode" switches the chat off.
export const SAFETY = /\b(suicid\w*|kill (my|him|her)self|end (it|my life)|self[- ]?harm|hurt(ing)? myself|don'?t want to (be here|live|wake up)|not safe|unsafe|panic\w*|can'?t (breathe|stop crying)|overdose)\b/i;
const LEAVE = /\b(leave|exit|quit|stop|end|turn off|switch off|get out of|no more|out of) (the )?(dev|development)[- ]?mode\b|\b(dev|development)[- ]?mode off\b/i;
const BUILD = /\b(harness|repo(sitory)?|codebase|code|coding|commit(ted|s)?|push(ed)? to main|hooks?|skills?|specs?|agreements?|evals?|test ?cases?|edge ?cases?|stress[- ]?test\w*|tests?|bugs?|features?|dev[- ]?mode|development|implement\w*|refactor\w*|modules?|dashboard|claude code|subagents?|agents?|transcript|backlog|retrospective|end[- ]of[- ]session|compact|deploy\w*|build (it|this|that|them)|make the changes|this chat'?s? (name|title)|rename (this|the) chat|telegram (messages?|updates?|bot)|morning (messages?|check-?ins?)|check-?ins?|chat link|messages?|heartbeats?|ddd|personas?|restore drill|developer|gaps?|wording|end of (the )?chat|reviews?|idea dump|chats|set ?up|set (this|it|that|them|everything|me) up|layout|aesthetic|mimic)\b/i;
// A set or an amount told as numbers: "45 for 8", "50 x 10", "70kg", "150g", "15min".
/** Words BUILD holds that also come up in her day; alone beside a life word, they do not make it building. */
const LOOSE = /\b(gaps?|reviews?)\b/gi;
const SETS = /\b\d+(\.\d+)? ?((for|x|×) ?\d+|kg|kgs|kcal|cal|g|ml|l|km|min|mins)\b/i;
const LIFE = /\b(ate|eat(ing|en)?|drank|drink(ing)?|breakfast|lunch|dinner|supper|snack|meal|food|kcal|calories|protein|carbs|fat|nutrition|fitness|training|workout|alcohol|beer|wine|sleep|slept|tired|sore|ache|pain|deadlift\w*|squat\w*|bench|lift(ed|ing)?|sets?|reps?|kg|gym|train(ed|ing)?|session|reps? left|\d+(st|nd|rd|th) (one|rep|set)|did (it )?for \d+|(foot|basket|floor|hand|net)ball|badminton|tennis|hockey|running|treadmill|weigh(ed|t)?|mood|feel(ing)?|felt|sad|happy|anxious|stressed|work today|my day|today|yesterday|ytd|tonight)\b/i;

/**
 * What this message is: 'leave' (switch the chat off), 'build' (development) or 'life'
 * (everything else, answered the everyday way). Anything about her safety is life, always.
 * A message with neither kind of word ("Ok", "40g", "Where are we with it", a photo)
 * carries on the turn before, so it takes that turn's kind: an everyday turn stays everyday,
 * and a development question with no telltale word is still kept in the Transcript.
 */
export function classifyTurn(prompt, previous = 'build') {
  const p = String(prompt ?? '').replace(/<[^>]+>/g, ' ').trim();
  if (SAFETY.test(p)) return 'life';
  if (LEAVE.test(p)) return 'leave';
  if (devModeArgs(prompt) !== null) return 'build';
  if (BUILD.test(p)) {
    // A word that names building only loosely ("gaps", "review", "messages") beside a word about
    // her own day is her day: "a review of my fitness, what gaps should I fill" (T-777). A word
    // that only building uses ("harness", "skill", "hook") still makes it development.
    const life = LIFE.test(p) || SETS.test(p);
    return life && !BUILD.test(p.replace(LOOSE, ' ')) ? 'life' : 'build';
  }
  if (LIFE.test(p) || SETS.test(p)) return 'life';
  return previous === 'life' ? 'life' : 'build';
}

const turnMarker = (input) => `turn-kind-${sessionId(input) || 'unknown'}`;

/**
 * This turn's kind. A hook given the prompt (UserPromptSubmit) judges it and keeps the result
 * for the hooks after the reply (Stop), which are given no prompt and read it back. Judging
 * the same prompt again gives the same answer, so every hook of a turn agrees. A 'leave'
 * switches the chat off here, and the turn is answered the everyday way.
 */
export function turnKind(input) {
  const m = turnMarker(input);
  if (typeof input?.prompt !== 'string') return markerRead(m).trim() || 'build';
  // The same prompt again (another hook of this turn): the answer already given.
  // Her words never sit outside data/ (A-155): only a fingerprint of the prompt is kept.
  const print = createHash('sha256').update(input.prompt).digest('hex');
  if (markerSeen(`${m}-prompt`) && markerRead(`${m}-prompt`).trim() === print) return markerRead(m).trim() || 'build';
  let kind = classifyTurn(input.prompt, markerRead(m).trim() || 'build');
  if (kind === 'leave') {
    devModeOff(input);
    kind = 'life';
  }
  markerWrite(m, kind);
  markerWrite(`${m}-prompt`, print);
  return kind;
}

/**
 * True when this prompt is `/dev-mode sandbox` taking the chat into the
 * sandbox (on, reset or sample), typed or expanded with its arguments: that
 * reply is her first test line, not a development reply. `off` is not one.
 */
export function entersSandbox(prompt) {
  const action = sandboxAction(prompt);
  return Boolean(action) && action !== 'off';
}

/**
 * The action a `/dev-mode sandbox …` prompt asks for (`on` when none is named),
 * read from the first line of its arguments, or null.
 */
export function sandboxAction(prompt) {
  const [verb, action = 'on', ...rest] = (devModeArgs(prompt) ?? '').split('\n')[0].trim().toLowerCase().split(/\s+/);
  return verb === 'sandbox' && !rest.length && Object.hasOwn(SWITCH_STEPS, action) ? action : null;
}

/**
 * Whether this prompt is the developer's `/dev-red-team`, typed or expanded with its
 * command name: the one-word switch that flips a red-team chat between the sandbox
 * test and development (T-958..T-961, T-965). Its direction is read from the chat's
 * state when it is typed, so it is recorded as `on` or `off` like the long form.
 */
export function redTeamTyped(prompt) {
  const p = String(prompt ?? '');
  if (/<command-name>\/?dev-red-team<\/command-name>/.test(p)) return true;
  return /^\s*\/dev-red-team\s*$/i.test(p.split('\n').find((l) => l.trim()) ?? '');
}

/**
 * What follows `/dev-mode` in this prompt, trimmed, typed or expanded with its
 * command name and arguments; null when the prompt is not `/dev-mode` at all.
 */
export function devModeArgs(prompt) {
  const p = String(prompt ?? '');
  if (/<command-name>\/?dev-mode<\/command-name>/.test(p)) return (p.match(/<command-args>([\s\S]*?)<\/command-args>/)?.[1] ?? '').trim();
  const typed = p.match(/^\s*\/dev-mode\b([\s\S]*)$/);
  return typed ? typed[1].trim() : null;
}

/** Back to everyday for this session only; every other session's switch is left alone. */
export function devModeOff(input) {
  rmSync(join(repoRoot, '.claude', 'hooks', 'state', devModeMarker(input)), { force: true });
  const id = sessionId(input);
  if (id && savedChats().includes(id)) saveChats(savedChats().filter((s) => s !== id));
}

/** At a resume on any machine: a chat saved as switched on is on again (T-849). Never on a
 *  /clear, which starts everyday (dev-mode-reset.mjs), never for a chat not saved, and never
 *  in a copy without dev/, which has no development mode at all. True when it switched it back. */
export function devModeRestore(input) {
  const id = sessionId(input);
  if (!id || input?.source === 'clear' || !existsSync(join(repoRoot, 'dev'))) return false;
  if (markerSeen(devModeMarker(input)) || !savedChats().includes(id)) return false;
  markerWrite(devModeMarker(input), `${new Date().toISOString()} restored`);
  return true;
}

/**
 * The status line for the turn development mode switches on: which rows now
 * bind, never recalled (dev-mode.md, step 2). Read from the rows the harness
 * carries (.claude/spec-statements.json, generated from the registers and held
 * in step by the commit gate), not the register itself: the harness never reads
 * dev/ while it runs (ARC-008). A copy without them leaves the range out, not
 * the switch.
 */
export function devStatus() {
  const all = Object.keys(rowStatements());
  const range = (prefix) => {
    const ids = all.filter((id) => id.startsWith(`${prefix}-`)).sort();
    return ids.length ? `${ids[0]} to ${ids[ids.length - 1]}` : '';
  };
  const dev = range('DEV');
  const wkb = range('WKB');
  return `Development mode on${dev ? ` · ${dev} now bind (${SPECS_DIR}/system/dev.md)${wkb ? `, and ${wkb} (${SPECS_DIR}/system/workbench.md)` : ''}` : ''}`;
}

// This chat's transcript, where Claude Code keeps it, for a switch made in plain
// words: no hook payload names it then. Best-effort; sessionMeta gives '' if absent.
function transcriptPath() {
  const id = process.env.CLAUDE_CODE_SESSION_ID;
  return id ? join(homedir(), '.claude', 'projects', repoRoot.replace(/[^\w-]/g, '-'), `${id}.jsonl`) : '';
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (!sessionId({})) {
    console.error('dev-mode: no session id in the environment; type /dev-mode instead.');
    process.exit(1);
  }
  if (process.argv[2] === 'off') {
    devModeOff({});
    console.log('development mode off');
  } else {
    devModeOn({});
    console.log('development mode on');
    // A switch in plain words comes after the shape hook ran, so this turn's
    // header block is printed here instead: copy it, adding the shape's name.
    const header = sessionMeta(transcriptPath(), new Date(), { status: devStatus() });
    if (header) console.log(`\nHEADER BLOCK for this reply, first, with the shape named inside the first line's tags (" · Menu", " · View" or " · Tracker"; DEV-003):\n${header}`);
  }
}
