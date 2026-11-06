import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// A reminder may name the chat it belongs to (card A-128): one Claude Code chat's address
// and its name, as "chat": {"url": "https://claude.ai/code/session_…", "title": "…"}. Every
// message sent for it then ends with a way back to that chat, added here by code, so the
// sweep can never forget it, word it wrong or point it elsewhere.

export const CHAT_URL = /^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]{8,64}$/;
const TITLE_MAX = 60;
// Telegram refuses a message over 4,096 characters; the link is kept whole and the words give way.
export const TELEGRAM_MAX = 4096;

/** What is wrong with an entry's "chat", if it has one: none when it is absent or sound. */
export function chatFaults(entry) {
  const c = entry?.chat;
  if (c === undefined) return [];
  const id = entry?.id ?? '?';
  if (!c || typeof c !== 'object' || Array.isArray(c)) return [`${id}: "chat" should be {"url": "https://claude.ai/code/session_…", "title": "…"}`];
  const faults = [];
  if (typeof c.url !== 'string' || !CHAT_URL.test(c.url)) faults.push(`${id}: "chat.url" should be one Claude Code chat's address, https://claude.ai/code/session_…`);
  if (typeof c.title !== 'string' || !c.title.trim() || /[\n\r]/.test(c.title) || c.title.length > TITLE_MAX) faults.push(`${id}: "chat.title" should be the chat's name, one line of at most ${TITLE_MAX} characters`);
  return faults;
}

// Sent as Telegram's HTML (parse_mode HTML), so her words are escaped and only the code's
// own tags are markup (card A-129, the owner's "Not aesthetic. Help improve it").
export const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// A first line this short reads as a heading, and goes in bold.
const HEADING_MAX = 60;

/** The line that ends a message for this entry, or '' when it names no chat, or a broken one:
 * the chat's name as a link, never the raw address (which Telegram turns into a large preview). */
export function chatLine(entry) {
  if (entry?.chat === undefined || chatFaults(entry).length) return '';
  return `💬 Carry on in <a href="${entry.chat.url}">${esc(entry.chat.title.trim())}</a>`;
}

/** What a person sees of a message: tags dropped, entities read. Telegram's limit counts this. */
export const visible = (html) => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/**
 * The whole message, as Telegram HTML: its emoji once (the words may already open with it),
 * a short first line in bold, a line straight under it joined after an en dash, the rest
 * line for line with a run of emoji-led lines bulleted, then the chat line, within
 * Telegram's limit, the words giving way and the link kept whole.
 */
export function messageFor(entry, text) {
  const emoji = entry?.emoji ?? '⏰';
  let words = String(text).trim();
  if (words.startsWith(emoji)) words = words.slice(emoji.length).trimStart();
  const line = chatLine(entry);
  const room = TELEGRAM_MAX - emoji.length - 1 - (line ? visible(line).length + 2 : 0);
  if (words.length > room) words = `${words.slice(0, Math.max(0, room - 1)).trimEnd()}…`;
  const [first, ...rest] = words.split('\n');
  const bold = rest.length && first.trim().length <= HEADING_MAX;
  let head = bold ? `<b>${emoji} ${esc(first.trim())}</b>` : `${emoji} ${esc(first)}`;
  // A line straight under the bold heading joins it after an en dash (a short
  // line under a bold heading, left on a line of its own, read as two headings).
  if (bold && rest[0]?.trim() && !listItem(rest[0])) head = `${head} – ${esc(rest.shift().trim())}`;
  return `${head}${rest.length ? `\n${esc(bullets(rest).join('\n'))}` : ''}${line ? `\n\n${line}` : ''}`;
}

const startsWithEmoji = (s) => /^\s*\p{Extended_Pictographic}/u.test(String(s));
// A list item as written: a dash, star or bullet mark, or a line opening with an emoji.
const MARK = /^\s*[-*•]\s+/;
const listItem = (s) => MARK.test(String(s)) || startsWithEmoji(s);

/**
 * Any list becomes bullets (the developer asked that a list read as bullet points): two or more lines in a
 * row that each open with a mark or an emoji, each then led by "• ", its own mark dropped.
 */
export function bullets(lines) {
  const out = [...lines];
  for (let i = 0; i < out.length; ) {
    let j = i;
    while (j < out.length && listItem(out[j])) j++;
    if (j - i >= 2) for (let k = i; k < j; k++) out[k] = `• ${out[k].replace(MARK, '').trim()}`;
    i = j > i ? j : i + 1;
  }
  return out;
}

/**
 * Her chats, from her record (`core/state/chats.json`): each one's address, name, what it is
 * for, whether it is an everyday or a development chat, and open or closed (card A-128). Null
 * when the record keeps no list, as a copy that never linked a chat does.
 */
export function readChats(recordDir) {
  const path = join(recordDir, 'core', 'state', 'chats.json');
  if (!existsSync(path)) return null;
  try {
    const chats = JSON.parse(readFileSync(path, 'utf8')).chats;
    return Array.isArray(chats) ? chats.filter((c) => c && CHAT_URL.test(c.url ?? '')) : [];
  } catch {
    return [];
  }
}

const linkable = (c) => c && c.kind === 'everyday' && c.state === 'open';

/**
 * The chat a message links to (card A-128): none when the sweep says it needs nothing back
 * (`none`); else the chat it chose (`url`), which must be an open everyday chat on her list;
 * else the entry's own. With a list, a development, closed or unlisted chat is never linked:
 * `fault` says why. With no list, the entry's own chat stands as written. One the agent set
 * unasked (`inferred`, card A-172) links its own chat whatever the list says, and nothing else.
 */
export function chatFor(entry, { url = null, none = false } = {}, chats = null) {
  // Card A-172: a reminder the agent set unasked links back to the chat it came from, and only
  // that one, development chats included: the sweep can neither drop the link nor point it elsewhere.
  if (entry?.inferred === true) {
    if (none || (url && url !== entry?.chat?.url)) return { chat: null, fault: 'a reminder set unasked links only the chat it came from' };
    return chatFaults(entry).length || !entry.chat ? { chat: null, fault: 'its own chat is not a sound link' } : { chat: entry.chat, fault: null };
  }
  if (none) return { chat: null, fault: null };
  const want = url ?? entry?.chat?.url ?? null;
  if (!want) return { chat: null, fault: null };
  if (!chats) return url ? { chat: null, fault: 'her record keeps no list of chats to choose from' } : { chat: entry.chat, fault: null };
  const c = chats.find((x) => x.url === want);
  if (!c) return { chat: null, fault: 'that chat is not on her list' };
  if (!linkable(c)) return { chat: null, fault: c.kind !== 'everyday' ? 'that is a development chat' : 'that chat is closed' };
  return { chat: { url: c.url, title: c.title }, fault: null };
}
