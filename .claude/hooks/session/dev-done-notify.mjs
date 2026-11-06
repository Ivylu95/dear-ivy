// Stop — a development chat that has finished its turn tells his phone (card A-162).
//
// He starts something in a development chat, turns to other work, and finds out much later it
// was waiting on him. So at the end of every development turn, however short (T-718), one
// Telegram line names the chat, its name a link straight back, then a dash and what the turn
// did (T-751: one concise line; T-753: no bell, just what was done). Only once the chat is idle
// (T-801): while a background job or agent it started has not reported back, nothing is sent, so
// a line always means it is his move; work still out sends a "still running after
// 30 min" line, then every half hour with the time so far (T-838), from a watcher the hook leaves behind. A permission prompt sends
// "waiting for your permission" at once, through the Notification hook (T-813). Personal
// chats never send it: only a chat switched to development mode, and never one playing her
// conversation (sandbox). It uses the development bot's key, never the one her reminders use,
// and says nothing when this environment holds none. Never blocks.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { telegramPost } from '../lib/telegram-post.mjs';
import { readHookInput, pass, markerSeen, markerWrite, repoRoot } from '../lib/hook.mjs';
import { sessionId, inSandbox } from '../lib/sandbox.mjs';
import { entries } from '../lib/new-chat-tip.mjs';
import { esc } from '../lib/chat-link.mjs';
import { liveTitle } from '../lib/chats.mjs';

/** No turn is too short: he wants every development turn's end on his phone (T-718). */
export const MIN_MINUTES = 0;

const bare = (id) => String(id ?? '').replace(/^(cse_|session_)/, '');

/** This chat's entry in his chat list, matched by session, or null. */
export function chatOf(id, chats) {
  const want = bare(id);
  if (!want) return null;
  return (chats ?? []).find((c) => bare(String(c?.url ?? '').split('/').pop()) === want) ?? null;
}

/** What marks one reply as sent: his last typed message and the reply itself. */
export const sentKey = (uuid, reply) => `${uuid}:${createHash('sha256').update(String(reply ?? '')).digest('hex').slice(0, 16)}`;

/** When the turn began: the last message he typed, by its timestamp, or null. */
export function turnStart(list) {
  for (let i = (list ?? []).length - 1; i >= 0; i--) {
    const e = list[i];
    if (e?.type !== 'user' || e.isMeta) continue;
    const c = e.message?.content;
    const typed = typeof c === 'string' ? c : Array.isArray(c) && c.some((p) => p?.type === 'text') ? c : null;
    if (typed && e.timestamp) return { at: Date.parse(e.timestamp), uuid: e.uuid ?? e.timestamp };
  }
  return null;
}

/** How often the watcher looks, and so the gap between "still running" lines (T-801, T-838). */
export const FALLBACK_MS = 30 * 60e3;

const textOf = (c) => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => (p?.type === 'text' ? p.text : '')).join('\n') : '');

/** Background work the chat started that has not reported back (T-801): a shell or Monitor run
 *  in the background, or an agent launched to run on its own, until its task-notification comes
 *  with a final status, or it is stopped. Each as { id, at }. */
export function pending(list) {
  const out = new Map();
  for (const e of list ?? []) {
    const r = e?.toolUseResult;
    const at = Date.parse(e?.timestamp ?? '') || 0;
    if (r && typeof r === 'object') {
      const id = r.backgroundTaskId ?? (r.isAsync || r.status === 'async_launched' ? r.agentId : null) ?? r.taskId ?? r.task_id;
      if (typeof id === 'string' && id) out.set(id, { id, at });
    }
    if (e?.type === 'assistant' && Array.isArray(e.message?.content)) {
      for (const p of e.message.content) if (p?.type === 'tool_use' && p.name === 'TaskStop') out.delete(String(p.input?.task_id ?? p.input?.shell_id ?? ''));
    }
    // The notice can land as a message of his turn, as a queued wake (attachment), or only in the
    // queue's log when it was taken in mid-turn: every one counts. Never an assistant entry, which
    // can quote one.
    if (e && e.type !== 'assistant') {
      const said = [textOf(e.message?.content), typeof e.content === 'string' ? e.content : '', String(e.attachment?.prompt ?? '')].join('\n');
      for (const m of said.matchAll(/<task-notification>[\s\S]*?<\/task-notification>/g)) {
        const id = m[0].match(/<task-id>([^<]+)<\/task-id>/)?.[1];
        const status = m[0].match(/<status>([^<]+)<\/status>/)?.[1] ?? '';
        if (id && !/^(running|progress|started)$/i.test(status.trim())) out.delete(id);
      }
    }
  }
  return [...out.values()];
}

/** A Notification hook's input that is a permission prompt, not an idle or other notice (T-813). */
export const isPermissionPrompt = (input) => input?.notification_type ? input.notification_type === 'permission_prompt' : /permission/i.test(String(input?.message ?? ''));

/** How long work has been out, in his words: "30 min", "1 hr", "1 hr 30 min" (T-838). */
export function waited(ms) {
  const min = Math.max(1, Math.round(ms / 60e3));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} hr${m ? ` ${m} min` : ''}` : `${m} min`;
}

/** The still-running line: the chat's name its link, then how long the work has been out in all. */
export const stillLine = (url, title, ms) => `<a href="${url}">${esc(title)}</a> – still running after ${waited(ms)}, nothing needed yet`;

/** The chat's own title, as the app names it, a joined emoji's joiner put back (lib/chats.mjs); or ''. */
export const titleOf = liveTitle;

/** The text of the last reply in the transcript, or ''. */
export function lastReply(list) {
  for (let i = (list ?? []).length - 1; i >= 0; i--) {
    const e = list[i];
    if (e?.type !== 'assistant') continue;
    const c = e.message?.content;
    const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((p) => p?.type === 'text').map((p) => p.text).join('\n') : '';
    if (text.trim()) return text;
  }
  return '';
}

const MAX = 120;
const plain = (t) => t.replace(/\*\*|__|~~|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s+/g, ' ').trim();
/** The first sentence, so a long line is never cut mid-word on his phone (T-771). */
const firstSentence = (t) => t.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? t;
const LIST = /^(\d+[.)]|[-*•])\s/;

/** What the turn did, in a few words, to tell him and send him back to the chat (T-771: concise,
 *  inform, then direct; never a list item cut off). In order: the question the reply ends on, as
 *  "your answer needed: …"; the reply's "Last turn" line; its title (a "# …" or "## …" heading);
 *  its first plain paragraph that is not a list. Code blocks never count (T-761). Formatting
 *  dropped, one sentence, clipped on a word; '' when none (T-753). */
export function didOf(reply) {
  const text = String(reply ?? '').replace(/^\s*(```|~~~)[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '');
  const asks = [...text.matchAll(/^##\s+(.+\?)\s*$/gm)].map((m) => m[1]);
  let did = asks.length ? `your answer needed: ${plain(asks.at(-1)).replace(/^\p{Extended_Pictographic}\uFE0F?\s*/u, '')}` : '';
  if (!did) did = text.match(/^\s*[-*]\s*\*\*Last turn:\*\*\s*(.+)$/mi)?.[1];
  if (!did) did = text.match(/^#{1,2}\s+(?!🎯)(.+)$/m)?.[1];
  if (!did) did = text.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^(🛠️|>|#|---|\||```)/.test(p) && !LIST.test(p));
  did = firstSentence(plain(did ?? ''));
  if (did.length <= MAX) return did;
  const cut = did.slice(0, MAX - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 40 ? cut.lastIndexOf(' ') : cut.length).trimEnd()}…`;
}

/** The message as plain text, for when Telegram refuses its HTML: tags dropped, the link spelled out. */
export const plainText = (html) => String(html).replace(/<a href="([^"]+)">([^<]*)<\/a>/g, '$2: $1').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** The message to send, or null when none is due: one line, the chat's name its link, a dash,
 *  then what the turn did; no bell (T-753). */
export function notice({ id, chats, startedMs, nowMs, minMinutes = MIN_MINUTES, title: own = '', reply = '', did = '' }) {
  if (!id || !Number.isFinite(startedMs) || nowMs - startedMs < minMinutes * 60e3) return null;
  const chat = chatOf(id, chats);
  // A name read from the app itself (title_from "app") first: this machine's copy of the chat can
  // keep an old app-made name (T-928: the 🍏 sent after he renamed it 🏋️). Else the transcript's,
  // which a rename made in this session does reach, then the list's.
  const fromApp = chat?.title_from === 'app' ? chat.title?.trim() : '';
  const title = fromApp || own || chat?.title?.trim() || 'A development chat';
  const url = chat?.url ?? `https://claude.ai/code/session_${bare(id)}`;
  return `<a href="${url}">${esc(title)}</a> – ${esc(did || didOf(reply) || 'done and ready for you')}`;
}

const readChats = () => {
  const path = join(repoRoot, 'data', 'core', 'state', 'chats.json');
  try {
    return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).chats ?? [] : [];
  } catch {
    return [];
  }
};

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] === '--later') {
  // The watcher (T-801): every half hour while that same work is still out, one "still running"
  // line saying how long it has been out in all (T-838: 30 min, then 1 hr, 1 hr 30 min…), from
  // when the work started, as the chat's history records it. It stops once the work is back, or
  // the chat starts other work (a newer watcher takes over).
  const [, , , path, id, watchKey] = process.argv;
  const wait = Number(process.env.DEV_DONE_FALLBACK_TEST_MS) > 0 ? Number(process.env.DEV_DONE_FALLBACK_TEST_MS) : FALLBACK_MS;
  const token = process.env.TELEGRAM_DEV_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  const api = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.TELEGRAM_API_TEST ?? '') ? process.env.TELEGRAM_API_TEST : 'https://api.telegram.org';
  for (;;) {
    await new Promise((r) => setTimeout(r, wait));
    const list = entries(path);
    const out = pending(list);
    const still = out.map((o) => o.id).sort().join(',');
    let mark = '';
    try { mark = readFileSync(join(repoRoot, '.claude', 'hooks', 'state', `dev-done-${id}-watch`), 'utf8'); } catch {}
    if (!token || !chat || !still || still !== watchKey || mark !== watchKey) break;
    const chatRow = chatOf(id, readChats());
    const title = (chatRow?.title_from === 'app' && chatRow.title?.trim()) || titleOf(list) || chatRow?.title?.trim() || 'A development chat';
    const url = chatRow?.url ?? `https://claude.ai/code/session_${bare(id)}`;
    const since = Math.min(...out.map((o) => o.at).filter((t) => t > 0));
    const res = await telegramPost(`${api}/bot${token}/sendMessage`, { body: JSON.stringify({ chat_id: chat, link_preview_options: { is_disabled: true }, parse_mode: 'HTML', text: stillLine(url, title, Number.isFinite(since) ? Date.now() - since : 0) }) });
    markerWrite(`dev-done-${id}-last`, `${new Date().toISOString()} ${res?.ok ? 'ok (still running)' : `refused: ${String(res?.description ?? 'no answer').slice(0, 200)}`}`);
  }
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}` && process.argv[2] !== '--later') {
  const input = await readHookInput();
  const id = sessionId(input);
  const token = process.env.TELEGRAM_DEV_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!id || !token || !chat || !markerSeen(`dev-mode-${id}`) || inSandbox(id)) pass();
  const list = entries(input?.transcript_path);
  const api0 = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.TELEGRAM_API_TEST ?? '') ? process.env.TELEGRAM_API_TEST : 'https://api.telegram.org';
  // A permission prompt (T-813): the chat is stopped on him whatever else is out, so it says so
  // at once, once per prompt.
  if (input?.hook_event_name === 'Notification') {
    if (!isPermissionPrompt(input)) pass();
    const askMark = `dev-done-${id}-ask`;
    const askKey = createHash('sha256').update(`${input?.message ?? ''}|${list.length}`).digest('hex').slice(0, 16);
    if ((() => { try { return readFileSync(join(repoRoot, '.claude', 'hooks', 'state', askMark), 'utf8') === askKey; } catch { return false; } })()) pass();
    markerWrite(askMark, askKey);
    const text = notice({ id, chats: readChats(), startedMs: 0, nowMs: 0, title: titleOf(list), reply: '', did: 'waiting for your permission' });
    const res = await telegramPost(`${api0}/bot${token}/sendMessage`, { body: JSON.stringify({ chat_id: chat, link_preview_options: { is_disabled: true }, parse_mode: 'HTML', text }) });
    markerWrite(`dev-done-${id}-last`, `${new Date().toISOString()} ${res?.ok ? 'ok (permission)' : `refused: ${String(res?.description ?? 'no answer').slice(0, 200)}`}`);
    pass();
  }
  const start = turnStart(list);
  if (!start) pass();
  const api = /^http:\/\/127\.0\.0\.1:\d+$/.test(process.env.TELEGRAM_API_TEST ?? '') ? process.env.TELEGRAM_API_TEST : 'https://api.telegram.org';
  const out = pending(list);
  // Still working (T-801): no line now; it comes when the last job reports back and that turn
  // ends. One watcher per set of work out, to send "still running" every half hour it stays out.
  if (out.length) {
    const watchKey = out.map((o) => o.id).sort().join(',');
    const watchMark = `dev-done-${id}-watch`;
    const watched = (() => { try { return readFileSync(join(repoRoot, '.claude', 'hooks', 'state', watchMark), 'utf8') === watchKey; } catch { return false; } })();
    if (!watched && input?.transcript_path) {
      markerWrite(watchMark, watchKey);
      spawn(process.execPath, [fileURLToPath(import.meta.url), '--later', input.transcript_path, id, watchKey], { detached: true, stdio: 'ignore', cwd: repoRoot }).unref();
    }
    pass();
  }
  const reply = typeof input?.last_assistant_message === 'string' && input.last_assistant_message.trim() ? input.last_assistant_message : lastReply(list);
  // Once per reply: a Stop hook can run again on the same reply. Keyed on the reply as well as
  // his last typed message, because a chat also finishes on a turn he did not type: a
  // background agent handing back, or a hook's feedback (T-781: the build finished on such a
  // turn and his phone stayed silent, since the key was still his earlier "yes").
  const sentMark = `dev-done-${id}`;
  const key = sentKey(start.uuid, reply);
  if (markerSeen(sentMark) && (() => { try { return readFileSync(join(repoRoot, '.claude', 'hooks', 'state', sentMark), 'utf8') === key; } catch { return false; } })()) pass();
  const text = notice({ id, chats: readChats(), startedMs: start.at, nowMs: Date.now(), title: titleOf(list), reply });
  if (!text) pass();
  markerWrite(sentMark, key);
  // A test points the send at a stand-in on this machine, never at any other host (api, above).
  // Through curl, never Node's fetch, which ignores the machine's proxy (telegram-post.mjs).
  const send = (body) => telegramPost(`${api}/bot${token}/sendMessage`, { body: JSON.stringify({ chat_id: chat, link_preview_options: { is_disabled: true }, ...body }) });
  let res = await send({ text, parse_mode: 'HTML' });
  // Telegram refuses the whole message over one bad tag: send it again as plain text, link and all.
  if (!res?.ok && /parse|entit/i.test(String(res?.description ?? ''))) res = await send({ text: plainText(text) });
  // What Telegram said, kept on this machine only, so a silent miss can be found (T-733).
  markerWrite(`${sentMark}-last`, `${new Date().toISOString()} ${res?.ok ? 'ok' : `refused: ${String(res?.description ?? 'no answer').slice(0, 200)}`}`);
  pass();
}
