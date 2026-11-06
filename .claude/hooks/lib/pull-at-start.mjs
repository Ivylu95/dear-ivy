// A-165, "Each of my messages starts from the latest work": before a reply, bring in what
// other chats have saved, and tell the agent, in a line, what came in that bears on this
// chat, so it never answers from an out-of-date picture.
//
// Called from a hook that runs on every message: dialogue-record.mjs in development
// mode, before it writes the remark (hooks on one event run side by side, so the pull
// and that write must share one process), and everyday-voice.mjs outside it, where no
// hook writes a tracked file as a message arrives. The end-of-turn pull stays: it
// exists so the push works.
//
// Safe by construction, never in the way:
// - a message that trips the crisis list skips it entirely (the reply is never held);
// - the fetch is capped at a few seconds, and any failure is silent here;
// - only a fast-forward is made: it never merges, never runs a commit hook, and git
//   refuses it, touching nothing, when this chat's own unsaved changes are in the way.
//   Otherwise the note says what came in and that it is not merged yet;
// - nothing is said when nothing relevant came in.

import { git } from './hook.mjs';
import { touchedBy } from './touched.mjs';

/** The whole pull, every git call together, never past this (A-164: no waiting). */
export const DEADLINE_MS = 4000;
const SHOWN = 6;
/** Files every chat leans on, whatever it has touched. */
const ALWAYS = new Set(['CLAUDE.md', '.claude/modules.md', 'dev/dialogue/agreements.md']);

/**
 * The incoming files that bear on this chat: the always-read files, the files this
 * chat has itself touched (exact names only, so a touched folder never claims all
 * under it), and, outside development mode, her record, which another of her chats
 * may have changed.
 */
export function relevantIncoming(incoming, touched, { dev = false } = {}) {
  const mine = new Set(touched);
  return incoming.filter((f) => ALWAYS.has(f) || (!NOISE.test(f) && (mine.has(f) || (!dev && /^data\//.test(f)))));
}
/**
 * Files every chat rewrites and none reads to answer: other chats' remarks, the index
 * built from them, the record of what was typed, run histories. The first live run
 * (2026-11-03) listed 39 files, nearly all of these; the cards stay, through ALWAYS.
 */
const NOISE = /^dev\/dialogue\/(transcript|index)\/|^dev\/dialogue\/[^/]+\.jsonl$|^dev\/evals\/history\/|^\.claude\/hooks\/state\//;

/** The note for the agent, or '' when nothing relevant came in. */
export function incomingNote({ commits, relevant, merged, dev }) {
  if (!relevant.length) return '';
  const list = relevant.slice(0, SHOWN).join(', ') + (relevant.length > SHOWN ? `, and ${relevant.length - SHOWN} more` : '');
  const where = merged
    ? 'now in this copy'
    : 'NOT merged yet (this copy\'s own unsaved changes are in the way): read them with `git show origin/main:<path>`, and the end-of-turn pull merges them';
  return dev
    ? `CAME IN (A-165): ${commits} commit(s) from other chats, ${where}. Bearing on this chat: ${list}. Reread what matters before relying on it, and say in a line if it changes your answer.`
    : `CAME IN (A-165): another chat changed ${list} (${where}). Reread before relying on what you remember; say nothing about this to her.`;
}

/** Fetch, fast-forward if it can, and return the note ('' when nothing to say). */
export function pullAtStart({ session = '', dev = false, crisis = false } = {}) {
  // The selftest (DEAR_HOOK_STRICT) runs these hooks on the real repository: never pull there.
  if (crisis || (process.env.DEAR_HOOK_STRICT && !process.env.DEAR_PULL_TEST)) return '';
  // One deadline over every git call (T-681): a cap per call let two capped calls take
  // twice the cap. Out of time, the hook stops where it is and says nothing.
  const end = Date.now() + Number(process.env.DEAR_PULL_MS || DEADLINE_MS);
  const left = () => end - Date.now();
  const run = (args) => (left() > 0 ? git(args, { timeout: Math.max(1, left()) }) : '');
  // The fetch comes first, whatever else holds: the Transcript hook numbers his remark
  // from what it brings, even in a copy with no commit of its own yet.
  run(['fetch', '-q', 'origin', 'main']);
  const old = run(['rev-parse', 'HEAD']).trim();
  if (!old) return '';
  const remote = run(['rev-parse', 'origin/main']).trim();
  if (!remote || remote === old) return '';
  const ahead = run(['merge-base', old, remote]).trim() === old;
  if (!ahead) return ''; // this copy has its own commits: the end-of-turn pull merges both
  run(['merge', '--ff-only', '-q', 'origin/main']);
  const merged = run(['rev-parse', 'HEAD']).trim() === remote;
  const incoming = run(['diff', '--name-only', old, remote]).split('\n').filter(Boolean);
  const commits = Number(run(['rev-list', '--count', `${old}..${remote}`]).trim()) || 0;
  const relevant = relevantIncoming(incoming, touchedBy(session), { dev });
  return incomingNote({ commits, relevant, merged, dev });
}
