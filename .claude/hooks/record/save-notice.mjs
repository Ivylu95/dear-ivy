// Stop — she knows what about her was kept, and what was left out at her word.
//
// MEM-015, "She knows what about her was kept, and what was left out at her
// word." A turn that wrote to her record ends with a reply carrying one line
// that opens 📝 and names, in her terms, what was kept, worded fresh to fit it.
// Where she asked for something to stay out (MEM-016), the same line says so.
// Without it the record fills behind her back, and she never gets the moment to
// say "don't keep that"; with a stock phrase she learns that something moved,
// not what.
//
// How it knows: this turn's tool calls, read from the transcript. A write or an
// edit whose path is inside her record (or the sandbox record) counts; so does a
// shell command that names one with something that writes. Record paths are
// never stored anywhere: the check reads, decides, and forgets.
//
// What it can judge of the line itself: that it is there, that it is not a bare
// stock phrase ("📝 I've noted that."), and that it does not repeat an earlier
// 📝 line word for word. Whether it names the right thing is past it.
//
// It never sends a reply back: a sent-back reply reaches her twice (found
// 2026-09-30). A shortfall is noted, and everyday-voice.mjs hands the note to
// the next reply, whose 📝 line covers what this turn kept as well. Nothing is
// filed in a crisis, so a crisis turn has nothing to announce, and the note
// says to stay with her first.

import { relative, resolve } from 'node:path';
import { readHookInput, pass, repoRoot, markerWrite, readEntries, turnStart } from '../lib/hook.mjs';
import { saveNoteMarker } from '../lib/everyday-reply.mjs';

const input = await readHookInput();
// Noted, never sent back: the next reply carries it (see everyday-voice.mjs).
const block = (text) => {
  markerWrite(saveNoteMarker(input), `${text}\nThe last reply is already with her: end this reply's 📝 line so it also names what the last turn kept.`);
  pass();
};
if (input?.stop_hook_active) pass();
markerWrite(saveNoteMarker(input), '');

const entries = readEntries(input?.transcript_path);
if (!entries) pass(); // No transcript, nothing to judge: never block on a guess.

// The turn starts at the last message she typed: a user entry that is not a tool result.
const start = turnStart(entries);
const turn = entries.slice(start + 1).filter((e) => e?.type === 'assistant');

// Her record is this repository's data/ (or data-sandbox/), nowhere else: a
// scratch copy whose own folder is called data/ is not her. A path counts when
// it resolves inside the repository's record; a shell command, when it names the
// record relative to the repository (data/…, ./data/…) or by the repository's
// own absolute path, and writes. `2>&1` and `->` are not writes. A call that was
// refused or failed wrote nothing. All three were false alarms on 2026-09-27.
const root = resolve(repoRoot);
const inRecord = (p) => /^(data|data-sandbox)(\/|$)/.test(relative(root, resolve(root, p)).replace(/\\/g, '/'));
const repoAbs = root.replace(/\\/g, '/').toLowerCase();
const namesRecord = (cmd) =>
  /(^|[\s"'=(])(\.\/)?data(-sandbox)?\//.test(cmd) || cmd.replace(/\\/g, '/').toLowerCase().includes(`${repoAbs}/data`);
const WRITES = /((^|[^\d&>-])>>?\s*[^\s&>]|\btee\b|\bmv\b|\bcp\b|sed\s+-i|writeFile|\bgit\s+mv\b)/;

const failed = new Set(
  entries
    .slice(start + 1)
    .flatMap((e) => (e?.type === 'user' && Array.isArray(e.message?.content) ? e.message.content : []))
    .filter((c) => c?.type === 'tool_result' && c.is_error)
    .map((c) => c.tool_use_id),
);

const blocks = turn.flatMap((e) => (Array.isArray(e.message?.content) ? e.message.content : []));
const wrote = blocks.some((c) => {
  if (c?.type !== 'tool_use' || failed.has(c.id)) return false;
  const path = String(c.input?.file_path ?? c.input?.notebook_path ?? '');
  if (['Write', 'Edit', 'NotebookEdit'].includes(c.name)) return path !== '' && inRecord(path);
  if (c.name === 'Bash') {
    const cmd = String(c.input?.command ?? '');
    return namesRecord(cmd) && WRITES.test(cmd);
  }
  return false;
});

const said = blocks.filter((c) => c?.type === 'text').map((c) => c.text ?? '');
const reply = said[said.length - 1] ?? '';

// CON-017, design 4: a lesson written to FEEDBACK.md is told to her in one 🔧
// line. A turn that wrote one without it is noted, like a missed 📝 line.
const feedback = resolve(root, 'FEEDBACK.md');
const wroteLesson = blocks.some((c) => {
  if (c?.type !== 'tool_use' || failed.has(c.id)) return false;
  const path = String(c.input?.file_path ?? '');
  if (['Write', 'Edit'].includes(c.name)) return path !== '' && resolve(root, path) === feedback;
  if (c.name === 'Bash') {
    const cmd = String(c.input?.command ?? '');
    return /(^|[\s"'=(/])FEEDBACK\.md/.test(cmd) && WRITES.test(cmd);
  }
  return false;
});
if (wroteLesson && !reply.split('\n').some((l) => l.trim().startsWith('🔧'))) {
  block(
    [
      'This turn passed a lesson to the developer and the reply does not say so (CON-017).',
      'End the reply with one plain line opening 🔧, straight after any 📝 line, worded fresh: "🔧 I\'ve also passed a note to the developer, so I check your record before asking about your past."',
      'Never a question, and never in a crisis.',
    ].join('\n'),
  );
}
if (!wrote) pass();
const noteOf = (text) => (text.split('\n').find((l) => l.includes('📝')) ?? '').trim();
const note = noteOf(reply);

// The words of a 📝 line, for comparing: no emoji, no punctuation, no case.
const bare = (line) =>
  line
    .replace(/📝/gu, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
// A stock phrase says something moved, not what: "noted", "saved that",
// "I've noted that", "I have kept this".
const STOCK = /^(ive |i have |i )?(noted|saved|kept|recorded|written down|filed)( (that|this|it|down|everything))?$/;

const earlier = entries
  .slice(0, start + 1)
  .filter((e) => e?.type === 'assistant' && Array.isArray(e.message?.content))
  .flatMap((e) => e.message.content)
  .filter((c) => c?.type === 'text')
  .map((c) => bare(noteOf(c.text ?? '')))
  .filter(Boolean);

const HOW = [
  'Name what was kept, in her terms and worded fresh to fit it, under a --- rule: "---" then "📝 I\'ve kept Friday\'s appointment, and how the evening landed."',
  'If she asked for something to stay out, the same line says so without restating it (MEM-016).',
  'No file names, no counts (CON-013). If she is in crisis or distressed, stay with her and do this afterwards.',
];

if (!note) {
  block(['This turn wrote to her record and the reply does not say so (MEM-015).', 'End the reply with one plain line opening 📝.', ...HOW].join('\n'));
}
// The 📝 line is set apart from the reply by a rule on its own line above it
// (a blank line, then ---): what was kept reads as a footer, not as more of the
// conversation. The developer asked for it on 2026-09-30.
const replyLines = reply.split('\n').map((l) => l.trim());
const at = replyLines.findIndex((l) => l.includes('📝'));
const above = replyLines.slice(0, at).filter(Boolean).pop() ?? '';
if (!/^(-{3,}|\*{3,}|_{3,})$/.test(above)) {
  block(['The 📝 line needs a rule above it, on its own line after a blank line: ---, so what was kept is set apart from the reply (MEM-015).', ...HOW].join('\n'));
}
if (STOCK.test(bare(note))) {
  block(['The 📝 line is a stock phrase: it says something was kept, not what (MEM-015).', ...HOW].join('\n'));
}
if (earlier.includes(bare(note))) {
  block(['The 📝 line repeats an earlier one word for word (MEM-015). Word it fresh, to what this turn kept.', ...HOW].join('\n'));
}
pass();
