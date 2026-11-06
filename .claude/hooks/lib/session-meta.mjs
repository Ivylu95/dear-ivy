// The conversation's own numbers, read from its transcript, for the metadata
// line at the top of every development reply (DEV-002): which turn this is,
// when the conversation started, and when the last reply went out (left out on
// turn 1, which has none) and how long that reply took, from the message it
// answered to its last word (A-166), in one block with the Dev Mode label. How full the
// context window is stays out of the header, since the app shows it already
// (T-450); it is still measured, by sessionFigures, for the DEV-018 note.
//
// Read-only and best-effort: a transcript that cannot be read gives '', and the
// reply simply goes without the line's figures.

import { readFileSync } from 'node:fs';

const TZ = process.env.DEAR_TZ || 'Asia/Singapore';

const when = (iso) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });

/** A span in words for the header: 45s, 4m 12s, 1h 03m. */
export function span(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m`;
}

const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(n % 1e6 ? 1 : 0)}M` : `${Math.round(n / 1000)}k`);

/** The figures behind the header, or null when the transcript cannot be read. */
export function sessionFigures(transcriptPath) {
  let entries;
  try {
    entries = readFileSync(String(transcriptPath ?? ''), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  } catch {
    return null;
  }
  const stamped = entries.filter((e) => e.timestamp);
  if (!stamped.length) return null;

  // A turn is a message the developer typed: not a tool result, not a hook's feedback.
  const typed = entries.filter((e) => {
    if (e.type !== 'user' || e.isMeta) return false;
    const c = e.message?.content;
    const text = typeof c === 'string' ? c : Array.isArray(c) ? c.filter((b) => b?.type === 'text').map((b) => b.text).join('') : '';
    // The summary a compaction writes is not a message the developer typed.
    if (e.isCompactSummary) return false;
    return text.trim() && !/^\s*(Stop hook feedback|<command-|<local-command|Caveat:)/.test(text);
  });

  const replies = entries.filter((e) => e.type === 'assistant' && e.timestamp);
  const last = replies[replies.length - 1];
  const tokens = (u = {}) => (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);

  // DEV-018: a compaction after the last reply makes that reply's count stale.
  // It measured the context before the compaction, so it would call a chat full
  // just after it was shrunk (seen 2026-10-01: 70% shown, about 9% true). Until
  // a reply lands after the compaction, the size is not known: say so.
  const lastIndex = last ? entries.lastIndexOf(last) : -1;
  const compactions = entries.filter((e) => e.type === 'system' && e.subtype === 'compact_boundary');
  const compactedSince = compactions.some((e) => entries.indexOf(e) > lastIndex);
  const used = compactedSince ? 0 : tokens(last?.message?.usage);

  // The window is the largest the chat has ever shown, not a guess from the
  // latest count alone: after a compaction the count drops under 200k, and a
  // 1M chat would otherwise be measured against 200k (seen 2026-10-01: 45%).
  const model = String(last?.message?.model ?? '');
  const peak = Math.max(0, ...replies.map((e) => tokens(e.message?.usage)), ...compactions.map((e) => Number(e.compactMetadata?.preTokens) || 0));
  // An Opus chat runs with a 1M window even though its model id carries no
  // [1m] suffix (seen 2026-10-01: an Opus chat warned at 80% of 200k, 16% true).
  const limit = Number(process.env.DEAR_CONTEXT_LIMIT) || (/\[1m\]|opus/i.test(model) || peak > 200000 ? 1000000 : 200000);

  // How long the last reply took: from the message it answered to its last
  // word, so the tool calls, checks and saves in between count (A-166).
  const asked = last ? typed.filter((e) => e.timestamp && e.timestamp <= last.timestamp).pop() : null;
  const took = asked ? Math.max(0, Date.parse(last.timestamp) - Date.parse(asked.timestamp)) : NaN;

  return {
    turn: typed.length + 1,
    took: Number.isFinite(took) ? took : null,
    started: stamped[0].timestamp,
    last: last?.timestamp ?? '',
    context: used ? `Context ~${k(used)} / ${k(limit)} (${Math.round((used / limit) * 100)}%)` : compactedSince ? 'Context just compacted' : 'Context not yet measured',
  };
}

export function sessionMeta(transcriptPath, now = new Date(), { status = '' } = {}) {
  const f = sessionFigures(transcriptPath);
  if (!f) return '';
  const lines = [
    `Turn ${f.turn} · Started ${when(f.started)}`,
    // Turn 1 has no reply before it: the part is left out, not filled with a placeholder.
    f.last ? `Last reply ${when(f.last)}${f.took == null ? '' : ` (took ${span(f.took)})`}` : '',
  ].filter(Boolean);
  // The Dev Mode label on its own line, then the rest on one line beneath it in
  // the same small type, set in a callout; no <br>, which the app prints as text.
  // The label is left without a shape: the reply adds " · Menu", " · View" or
  // " · Tracker" (DEV-003), since only the reply knows which it is.
  // On the turn development mode switches on, its status goes on a callout line
  // of its own beneath the figures, never folded into them.
  return ['🛠️ **Dev Mode**', `> ${lines.join(' · ')}`, status ? `> ${status}` : '']
    .filter(Boolean)
    .join('\n');
}
