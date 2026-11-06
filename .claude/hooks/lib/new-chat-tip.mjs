// The one-time tip that a fresh chat is fine (CON-021). People new to AI keep
// one chat going for weeks, often because they think the memory lives in the
// chat. It does not: every chat opens on her record. Once a chat has been
// compacted often enough to drag, she is told so, once in her life here, and
// never again whatever she does with it.
//
// Two hooks share this: session/new-chat-tip.mjs offers it before a reply, and
// record/new-chat-tip-shown.mjs writes down that it went out. The "once" is kept
// in the record, not in a marker, because markers are gitignored and the
// machine is disposable: a tip remembered only on this machine would come back.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CORE_DATA } from './modules.mjs';
import { threshold } from './thresholds.mjs';

export const tipPath = (dir) => join(dir, CORE_DATA, 'state', 'new_chat_tip.md');

/** The transcript's entries, or [] when it cannot be read. */
export function entries(transcriptPath) {
  let text;
  try {
    text = readFileSync(String(transcriptPath ?? ''), 'utf8');
  } catch {
    return [];
  }
  const out = [];
  for (const line of text.split('\n')) {
    if (!line) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* a partial last line is still being written */
    }
  }
  return out;
}

/** How many times this chat has been compacted. */
export const compactions = (list) => list.filter((e) => e?.isCompactSummary).length;

/** Whether the tip has ever gone out: the file exists and says when. */
export const tipShown = (text) => /^shown:\s*\d{4}-\d{2}-\d{2}/m.test(String(text ?? ''));

/** Whether today's session log carries the crisis floor's line: then no tip, today. */
export const crisisToday = (log, date) => String(log ?? '').includes(`| ${date} · crisis`);

/**
 * Whether to offer the tip now. Null threshold means do nothing (FND-009):
 * a tip that fires on a missing number is a tip nobody set.
 */
export function eligible({ list, tipText, log, date, need = threshold('newChatTip.compactions', 'compactions') }) {
  if (!need) return false;
  if (tipShown(tipText)) return false;
  if (crisisToday(log, date)) return false;
  return compactions(list) >= need;
}

/** The tip, as a reply carries it: recognised by the Stop hook to mark it shown. */
export const TIP_PATTERN = /\b(new|fresh) chat\b/i;

/** The text of the last reply in the transcript, every text block joined. */
export function lastReplyText(list) {
  let start = list.length - 1;
  const typed = (e) =>
    e?.type === 'user' && !e.isCompactSummary &&
    (typeof e.message?.content === 'string' ||
      (Array.isArray(e.message?.content) && e.message.content.some((c) => c?.type === 'text')));
  while (start >= 0 && !typed(list[start])) start -= 1;
  return list
    .slice(start + 1)
    .filter((e) => e?.type === 'assistant' && Array.isArray(e.message?.content))
    .flatMap((e) => e.message.content.filter((c) => c?.type === 'text').map((c) => c.text))
    .join('\n');
}

export const tipFile = (date) =>
  [
    '---',
    `shown: ${date}`,
    '---',
    '',
    '# New-chat tip',
    '',
    'The one-time line that a fresh chat is fine and remembers everything went out',
    'on the date above. It is never offered again (CON-021).',
    '',
  ].join('\n');
