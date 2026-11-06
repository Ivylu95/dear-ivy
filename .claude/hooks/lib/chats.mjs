// A chat for each lasting part of her life (card A-158). Each module names the chat it
// wants in its module.json ("chat": { emoji, title, for }); core's is the chat for how she
// is. A module she uses with no open everyday chat on her list (data/core/state/chats.json)
// is a gap, offered once: her answer is kept under "offers", and a module with any answer
// there is never offered again. No dependencies, like everything under hooks/.

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_DATA, ROOT_OWNER } from './modules.mjs';

/** Her chat list and her answers to offers, or empty ones when the record keeps none. */
export function readList(dataDir) {
  try {
    const j = JSON.parse(readFileSync(join(dataDir, CORE_DATA, 'state', 'chats.json'), 'utf8'));
    return { chats: Array.isArray(j.chats) ? j.chats : [], offers: j.offers && typeof j.offers === 'object' ? j.offers : {} };
  } catch {
    return { chats: [], offers: {} };
  }
}

/** Whether a module is in use: core always; another once one of its growing folders holds an entry. */
export function inUse(mod, dataDir) {
  if (mod.name === ROOT_OWNER) return true;
  return mod.grows.some((rel) => {
    const dir = join(dataDir, rel);
    try {
      return existsSync(dir) && readdirSync(dir).some((f) => !f.startsWith('.') && f !== 'README.md');
    } catch {
      return false;
    }
  });
}

/** The modules a chat covers: its "modules", or core alone for the general chat that names none. */
export const covers = (chat) => (Array.isArray(chat.modules) ? chat.modules : chat.general ? [ROOT_OWNER] : []);
const open = (c) => c && c.kind === 'everyday' && c.state === 'open';

/** The chats to offer: modules in use, declaring a chat, with no open everyday chat and no answer kept. */
export function chatGaps(mods, dataDir, list = readList(dataDir)) {
  const covered = new Set(list.chats.filter(open).flatMap(covers));
  return mods
    .filter((m) => m.manifest.chat && inUse(m, dataDir) && !covered.has(m.name) && !(m.name in list.offers))
    .map((m) => ({ module: m.name, ...m.manifest.chat }));
}

/** This chat's own entry on her list, from its session id (cse_… or session_…), or null. */
export function thisChat(list, id) {
  const tail = String(id ?? '').replace(/^(cse|session)_/, '');
  return tail ? list.chats.find((c) => String(c.url ?? '').endsWith(`session_${tail}`)) ?? null : null;
}

// What this chat is for, and what to do with a topic another chat holds (card A-158, as
// amended 3 Nov 2026): a short answer here, the chat named, nothing that carries it on here.
export function thisChatLine(here, others) {
  const rest = others.length
    ? ` Her other chats: ${others.map((c) => `${c.title} (${c.for})`).join('; ')}. Something one of them holds: answer it briefly here, a few lines with just the headline, then name that chat; no question that carries it on here, and once a session, offer to start it off there (the chats skill).`
    : '';
  return `THIS CHAT (A-158): ${here.title}, for ${here.for}.${rest}`;
}

/**
 * Keep this chat's name on her list the one the app shows (A-158, 2026-11-05): renamed in the app,
 * the list kept the old name, and the Telegram line, the session brief and her
 * reminders' links all said it. Read from the chat's own transcript at each turn's
 * end, unless the title was read from the app (`title_from: "app"`, which wins); the old
 * name is kept under `formerly`, never dropped. Returns the entry when
 * it changed, else null. Never throws.
 */
export function syncTitle(dataDir, id, live, today = new Date().toISOString().slice(0, 10)) {
  const title = String(live ?? '').trim();
  if (!title || /[\n\r]/.test(title)) return null;
  const path = join(dataDir, CORE_DATA, 'state', 'chats.json');
  try {
    const j = JSON.parse(readFileSync(path, 'utf8'));
    const entry = thisChat({ chats: Array.isArray(j.chats) ? j.chats : [] }, id);
    if (!entry || entry.title === title) return null;
    // The transcript's title can be stale: renamed in the app, the chat's own transcript may keep
    // an old name (T-795: the app said 🏋️, the transcript 🍏, and the list was moved to 🍏). A title
    // read from the app itself (`title_from: "app"`) is never overwritten by the transcript's, and
    // a name the chat already left is never taken back.
    if (entry.title_from === 'app' || (Array.isArray(entry.formerly) && entry.formerly.some((f) => f?.title === title))) return null;
    entry.formerly = [...(Array.isArray(entry.formerly) ? entry.formerly : []), { title: entry.title, until: today }];
    entry.title = title;
    writeFileSync(path, `${JSON.stringify(j, null, 2)}\n`);
    return entry;
  } catch {
    return null;
  }
}

/**
 * The chat's own title, as the app names it, from its transcript entries; or ''. The
 * transcript keeps a joined emoji with a space where its joiner was ("🧑 🏫" for "🧑‍🏫",
 * seen 2026-11-05), so a space between two emoji is put back as the joiner.
 */
export function liveTitle(list) {
  for (let i = (list ?? []).length - 1; i >= 0; i--) {
    if (list[i]?.type === 'custom-title' && list[i].customTitle) {
      return String(list[i].customTitle).trim().replace(/(\p{Extended_Pictographic}️?) (?=\p{Extended_Pictographic})/gu, '$1‍');
    }
  }
  return '';
}

// ── The app's own name, on two events (T-829, T-836): his saying he renamed the chat, and a
// chat's first turn here. No clock. Code decides when; the one lookup is the agent's remote-session
// tool, the only sanctioned reader of the app's title; code records what it says.

/** He says he renamed or re-emojied this chat. */
export const RENAMED = /\b(renamed|rename[ds]?|changed (the |its |this chat'?s? )?(name|title|emoji))\b|\bchat'?s? (name|title|emoji)\b[^.?!]{0,30}\b(changed|new|different)\b/i;

/** Why this turn owes a name check, or null: his rename, else the first turn here. Only where the
 *  remote-session tool exists (a cloud chat), never in a message about safety. */
export function nameCheckDue({ prompt = '', checked = false, remote = false, unsafe = false }) {
  if (!remote || unsafe) return null;
  if (RENAMED.test(String(prompt))) return 'renamed';
  return checked ? null : 'first';
}

/** Put the app's name on this chat's entry, marked as read from the app; the old one kept under
 *  `formerly`. Returns the entry when it changed, else null. Never throws. */
export function appName(dataDir, id, title, today = new Date().toISOString().slice(0, 10)) {
  const name = String(title ?? '').trim();
  if (!name || /[\n\r]/.test(name)) return null;
  const path = join(dataDir, CORE_DATA, 'state', 'chats.json');
  try {
    const j = JSON.parse(readFileSync(path, 'utf8'));
    const entry = thisChat({ chats: Array.isArray(j.chats) ? j.chats : [] }, id);
    if (!entry) return null;
    if (entry.title === name && entry.title_from === 'app') return null;
    if (entry.title !== name) entry.formerly = [...(Array.isArray(entry.formerly) ? entry.formerly : []), { title: entry.title, until: today }];
    entry.title = name;
    entry.title_from = 'app';
    writeFileSync(path, `${JSON.stringify(j, null, 2)}\n`);
    return entry;
  } catch {
    return null;
  }
}

// `node .claude/hooks/lib/chats.mjs app-name "<the session's title>"`: records the app's name for
// this chat and settles the check the turn owed.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] && process.argv[2] === 'app-name') {
  const { dataDir, markerWrite } = await import('./hook.mjs');
  const id = String(process.env.CLAUDE_CODE_REMOTE_SESSION_ID || process.env.CLAUDE_CODE_SESSION_ID || '').replace(/^(cse_|session_)/, '');
  const changed = appName(dataDir, id, process.argv[3]);
  markerWrite(`name-checked-${id}`, new Date().toISOString());
  markerWrite(`name-owed-${id}`, ''); // empty: nothing owed
  console.log(changed ? `chat name: now "${changed.title}", read from the app` : 'chat name: already the app\'s');
}
