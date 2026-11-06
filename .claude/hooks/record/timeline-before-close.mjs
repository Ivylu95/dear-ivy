// Stop — an event that never reaches the timeline is forgotten.
//
// CLAUDE.md: "Every session, ask whether anything belongs on it, and add it
// before you close." The timeline is the spine of retrieval; a session that
// writes a journal entry or a person's file but leaves the timeline alone has
// written something that the next session has no route to.
//
// So: if anything under data/ was touched today and data/timeline.md was not,
// the turn does not end quietly — the model is asked once, and told what it
// wrote. It blocks a single time per session (a marker in temp/hooks/), because
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

const substantive = [...touched].filter((p) => !/^data\/state\//.test(p));
if (!substantive.length) pass();
if ([...touched].some((p) => p.startsWith('data/timeline'))) pass();

markerWrite(marker);

block(
  [
    'The record moved today and data/timeline.md did not:',
    '',
    ...substantive.map((p) => `  · ${p}`),
    '',
    'Before closing: does anything from this session belong on the timeline — one line,',
    '`YYYY-MM-DD · type · tags · one-clause gist · → path`, sorted by when it happened',
    'rather than when she said it? Add it if so. If nothing dated actually happened,',
    'say so in one line and end the turn; this asks once per session.',
  ].join('\n'),
);
