// Stop — an event that never reaches the timeline is forgotten.
//
// CLAUDE.md: "Every session, ask whether anything belongs on it, and add it
// before you close." The timeline is the spine of retrieval; a session that
// writes a journal entry or a person's file but leaves the timeline alone has
// written something that the next session has no route to.
//
// So: if anything under data/ was touched today and data/core/timeline.md was not,
// the turn does not end quietly — the model is asked once, and told what it
// wrote. It blocks a single time per session (a marker in .claude/hooks/state/), because
// the second refusal to end a turn is an argument, not a reminder, and she is
// the one waiting on the other side of it.

import { readHookInput, block, pass, git, markerSeen, markerWrite } from '../lib/hook.mjs';

const input = await readHookInput();
if (input?.stop_hook_active) pass(); // Already blocked once this turn; never loop.

const marker = `timeline-${String(input?.session_id ?? 'unknown').replace(/[^\w-]/g, '')}`;
if (markerSeen(marker)) pass();

// Everything in data/ that moved today: uncommitted, plus today's commits.
const touched = new Set();
for (const line of git(['status', '--porcelain', '--', 'data/']).split('\n')) {
  const path = line.slice(3).trim();
  if (path) touched.add(path.split(' -> ').pop());
}
for (const path of git(['log', '--since=midnight', '--name-only', '--pretty=format:', '--', 'data/']).split('\n')) {
  if (path.trim()) touched.add(path.trim());
}

// The timeline is data/core/timeline.md, and once split by year data/core/timeline/;
// data/timeline/ is read too, where a split was made at the old path (lib/modules.mjs).
// The state folder is session bookkeeping, not an event: data/core/state/, or data/state/
// in a record not yet moved into its module.
const substantive = [...touched].filter((p) => !/^data\/(?:core\/)?state\//.test(p));
if (!substantive.length) pass();
if ([...touched].some((p) => /^data\/(?:core\/)?timeline(?:\.md$|\/)/.test(p))) pass();

markerWrite(marker);

block(
  [
    'The record moved today and data/core/timeline.md did not:',
    '',
    ...substantive.map((p) => `  · ${p}`),
    '',
    'Before closing: does anything from this session belong on the timeline — one line,',
    '`YYYY-MM-DD · type · tags · one-clause gist · → path`, sorted by when it happened',
    'rather than when she said it? Add it if so. If nothing dated actually happened,',
    'say so in one line and end the turn; this asks once per session.',
  ].join('\n'),
);
