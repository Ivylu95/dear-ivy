// PreToolUse on starting or renaming a chat (card A-169): every chat's name begins with an emoji,
// so he can tell his chats apart at a glance, on his phone and in the finished-chat message.
//
// A chat an agent starts (create_session) or renames (set_session_title) is refused unless its
// title begins with an emoji, and a chat started with no title at all is refused too, as the app
// would name it in plain words. A chat he names himself in the app is his, and no hook sees it.

import { pathToFileURL } from 'node:url';
import { readHookInput, refuse, pass } from '../lib/hook.mjs';

/** Whether a title begins with an emoji: a pictograph, a flag, or a keycap. */
export const startsWithEmoji = (title) => /^(\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]️?⃣)/u.test(String(title ?? '').trim());

/** The refusal for this call, or '' when it may go ahead. */
export function verdict(tool, args) {
  const m = /^mcp__claude-code-remote__(create_session|set_session_title)$/.exec(String(tool ?? ''));
  if (!m) return '';
  const title = String(args?.title ?? '').trim();
  if (!title) return m[1] === 'create_session' ? 'Every chat starts with an emoji in its name (A-169): give it a title, an emoji then the name, such as "🔎 Check: dev bot key".' : '';
  return startsWithEmoji(title) ? '' : `Every chat's name begins with an emoji (A-169): "${title.slice(0, 60)}" does not. Put one first, then a space, then the name.`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const input = await readHookInput();
  const why = verdict(input?.tool_name, input?.tool_input);
  if (why) refuse('PreToolUse', why);
  pass();
}
