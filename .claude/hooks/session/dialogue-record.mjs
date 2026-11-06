// UserPromptSubmit — in development mode, keeps the developer's message in the
// Transcript, verbatim, before the agent has read it (D35, WKB-007 design 10).
//
// A-002, "Remember everything I say in dev mode": until 2026-10-20 the
// Transcript held a remark only if the agent remembered to write it, which is
// the instruction this hook replaces with code. The entry lands as
// `❔ unsorted`; the agent sorts it into its way the same day, and
// `node ux/scripts/dialogue.mjs check` fails while one older than today is
// left unsorted (`dialogue.mjs sort` lists them).
//
// Silent, and records nothing, outside development mode and in the sandbox
// (where the chat plays her everyday conversation, WKB-013), so none of her
// words reach dev/. Also skips what is not the developer speaking: an empty
// message, a slash command, a frame the harness wraps relayed text in (a
// subagent's report, a notification), a Claude run from inside another Claude
// (lib/nested-claude.mjs), and anything carrying a key or an
// approval phrase, which never belongs in a file. The privacy check reads the
// Transcript at every commit as well. Does nothing in a copy without dev/
// (ARC-008).
//
// Each message it keeps also leaves one line in the typed record beside the
// Transcript (lib/typed.mjs): when, and a hash of the words, never the words.
// Only this hook writes it, so an agreed card's yes and a commit's `Approved:`
// quote are checked against what he typed rather than what an agent wrote.
// The line is staged at once, so the next commit carries it.
//
// Verbatim, with one exception (A-155, which outranks it): his words about his
// own life (food, training, body, health, the people in it) do not stay in
// dev/. Once sorted as life, they move, verbatim, into his record,
// data/core/dev-chats/<YYYY-MM>.md under the entry's `## T-nnn · <date>`, and
// leave `[moved to his record]` here; the rest of the remark stays word for word.

import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { readHookInput, context, pass, repoRoot, today, peopleNames, dataDir } from '../lib/hook.mjs';
import { profileName } from '../lib/profile-schema.mjs';
import { DEV_DIR } from '../lib/paths.mjs';
import { devModeActive } from '../lib/dev-mode.mjs';
import { hasToken } from '../lib/update/secrets.mjs';
import { recordTyped, typedFile } from '../lib/typed.mjs';
import { nestedClaude } from '../lib/nested-claude.mjs';
import { pullAtStart } from '../lib/pull-at-start.mjs';
import { typedCrisis } from '../lib/dev-reply.mjs';
import { PART_LINES, lineCount, monthsNewestFirst, partHeader, partName, partOf, sortParts } from '../lib/transcript-parts.mjs';

const RELAYED = /<agent-message\b|\[Subagent hand-back\]|<task-notification\b|<system-reminder\b|<teammate-message\b|\[SYSTEM NOTIFICATION|<command-name>/i;
const PHRASE = /^\s*(RELEASE v\d+(?:\.\d+)* [0-9A-Z]{4}|update to version \d+(?:\.\d+)* [0-9A-Z]{4})\s*$/im;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const input = await readHookInput();
const typed = String(input?.prompt ?? '').replace(/\r\n/g, '\n').trim();
// A name from her record never reaches dev/ (ARC-004): the privacy check refused
// the commit after it was written (2026-10-26, a remark naming someone), so the
// name is set aside here, before it is written, and the quote stays otherwise
// verbatim. The typed record hashes the same words, so a quote still matches.
// The owner's own name too, from data/PROFILE.yaml, as the privacy check reads it: on
// 2026-10-30 two remarks carried it, were refused at commit, and taken out by hand,
// which broke their hash, so neither could approve anything (T-484, T-485).
const ownName = (() => {
  try {
    const n = profileName(readFileSync(join(dataDir, 'PROFILE.yaml'), 'utf8'));
    return n && n.length > 2 ? [n] : [];
  } catch { return []; }
})();
const names = (() => { try { return [...peopleNames(), ...ownName]; } catch { return ownName; } })();
const prompt = names.reduce((t, n) => t.replace(new RegExp(`(?<![\\p{L}\\p{N}_])${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'giu'), '[a name]'), typed);
const dir = join(repoRoot, DEV_DIR, 'dialogue', 'transcript');

if (!prompt || prompt.startsWith('/') || RELAYED.test(prompt) || PHRASE.test(prompt) || hasToken(prompt)) pass();
if (!existsSync(dir) || !devModeActive(input)) pass();
// A Claude started inside another (an agent's `claude -p` probe or eval run) is
// not him typing, and its prompt must never stand as his words (T-577, T-612).
if (nestedClaude()) pass();

// The next number runs on across every month's file: an ID is never reused. Numbers
// only rise, so the two latest months hold the highest (the newest may be empty on
// the first of a month); reading every month made each message's cost grow with all
// the history (A-147).
// Other chats file too, so GitHub's main is fetched first and its numbers count
// as well (2026-10-26: T-065, T-170 and T-176 each named two remarks). Offline,
// the local files alone; a collision left is failed by `dialogue.mjs check`
// and settled by `dialogue.mjs renumber`.
//
// Numbers only rise, month on month, so the highest sits in the newest month
// that holds an entry: months are read newest first and the reading stops
// there, rather than every month being read, and shown from main, on every
// prompt (2026-10-29, unbounded per prompt). An older month is read only while
// every newer one holds no entry, as at the start of a month. A month kept in
// parts (T-499) is read whole, every part, since a merge can leave a high number
// in an earlier part.
let last = 0;
const highest = (text) => {
  let found = false;
  for (const m of String(text).matchAll(/^### T-(\d+) · /gm)) {
    last = Math.max(last, Number(m[1]));
    found = true;
  }
  return found;
};
const newestMonth = (names, show) => {
  for (const [, parts] of monthsNewestFirst(names)) if (parts.map((f) => highest(show(f))).some(Boolean)) break;
};
newestMonth(readdirSync(dir), (f) => readFileSync(join(dir, f), 'utf8'));
const git = (args, timeout = 4000) => {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};
const rel = `${DEV_DIR}/dialogue/transcript`;
// A-165: the pull at each message lives here, before this remark is written, so the
// fast-forward and the write never run side by side (hooks on one event run at once:
// in the reply-shape hook it raced this file, T-681). It is also the one fetch: the
// numbering below needed one anyway. On a message that trips the crisis list it is
// skipped, and only the fetch for numbering runs, as before.
const crisis = typedCrisis(typed);
const cameIn = crisis ? '' : pullAtStart({ session: String(input?.session_id || ''), dev: true });
if (crisis) git(['fetch', '-q', 'origin', 'main']);
newestMonth(git(['ls-tree', '--name-only', 'origin/main', `${rel}/`]).split('\n').filter(Boolean), (f) => git(['show', `origin/main:${f}`]));
const id = `T-${String(last + 1).padStart(3, '0')}`;
const date = today();
const monthKey = date.slice(0, 7);
const monthName = `${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
const quote = prompt.split('\n').map((l) => (l.trim() ? `> ${l.trimEnd()}` : '>')).join('\n');
const entry = `\n### ${id} · ${date} · ❔ unsorted\n${quote}\n`;
// The month's last part takes the remark; one it would carry past PART_LINES is
// left whole and the next part begins, so every part stays one read (T-499).
let name = sortParts(readdirSync(dir)).filter((f) => partOf(f).month === monthKey).at(-1) ?? partName(monthKey, 1);
let file = join(dir, name);
if (!existsSync(file)) {
  writeFileSync(
    file,
    `# Transcript · ${monthName}\n\nEverything the developer said in development mode, verbatim and dated, each remark sorted into one of\n` +
      'the sixteen ways, and tagged by topic. Never edited: a correction is a new entry; only his words about his own life move, to his record (A-155). An agreed remark carries its card, and\n' +
      '[`../agreements.md`](../agreements.md) is generated from those cards.\n\n---\n',
  );
} else if (lineCount(readFileSync(file, 'utf8') + entry) > PART_LINES && /^### T-\d+ · /m.test(readFileSync(file, 'utf8'))) {
  const part = partOf(name).part + 1;
  name = partName(monthKey, part);
  file = join(dir, name);
  writeFileSync(file, partHeader(monthKey, part, monthName));
}
appendFileSync(file, entry);
// The part it went to: the record keeps parts, each within one read (lib/typed.mjs, T-768).
git(['add', '--', recordTyped(prompt, repoRoot) ?? typedFile(repoRoot)]);

context(
  'UserPromptSubmit',
  // Tightened on the developer's yes, 2026-11-02: every rule kept, in fewer words.
  (cameIn ? `${cameIn}\n\n` : '') +
  `TRANSCRIPT: already kept verbatim as ${id} (❔ unsorted) in ${DEV_DIR}/dialogue/transcript/${name}; do not write it again. ` +
    'Sort it today: its way in the heading, then Gist, Became, Topics (every topic it touches) and Also (any other way) lines; `node ux/scripts/dialogue.mjs check` fails on an unsorted entry from an earlier day. ' +
    'Show him what `dialogue.mjs ask` found on each key word before proposing anything new. ' +
    // A-006 (E-010, 2026-10-27): "i don't like that" straight after a change was read as a
    // complaint about the question that followed it, and the change stayed live.
    'If he dislikes something ("I don\'t like that", "annoying", "undo it") and you changed anything this chat, "that" is your last change: undo it first (git revert, or edit back and `git restore --staged`), rebuild what it built and rerun the checks it touched, showing them pass, then ask what bothered him (A-006).',
);
