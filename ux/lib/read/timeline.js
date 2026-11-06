// Part of the record's read layer (lib/content-read.js, the one door views use
// through lib/content.js): the timeline reader. Nothing here writes.

import { yearOf } from '@/lib/dates';
import { renderBody, sections, table } from '@/lib/markdown';
import { core, derive, readFile } from '@/lib/read/source';

// ── Timeline ────────────────────────────────────────────────────────────────

// The spine. Two tiers, as the record keeps it: Eras to orient, entries for the
// range you need.
//
// Entries are returned newest first, which is the opposite of how the file stores
// them. The file is oldest-first because it is appended to; a reader arriving at
// the view wants the most recent thing at the top. Both are right for their own
// medium.
export function getTimeline() {
  const file = readFile(core('timeline.md'));
  if (!file) return { eras: null, entries: [], tags: [], types: [], filled: false };
  return derive(file, 'timeline', parseTimeline);
}

function parseTimeline(file) {
  const parsed = sections(file.raw);
  const find = (name) =>
    parsed.sections.find((s) => s.heading.toLowerCase().startsWith(name));

  const eras = find('eras');
  const rows = table(file.raw, 'Entries', parsed);

  const entries = rows
    .map((row) => {
      const date = /(\d{4}-\d{2}-\d{2})/.exec(row.date ?? '')?.[1] ?? null;
      return {
        date,
        year: yearOf(date),
        // "(told YYYY-MM-DD)" marks a gap between when something happened and
        // when she said it. Surfaced rather than swallowed: it is the difference
        // between a record of an event and a record of a disclosure.
        told: /\(told\s+(\d{4}-\d{2}-\d{2})\)/.exec(row.date ?? '')?.[1] ?? null,
        type: row.type ?? '',
        tags: (row.tags ?? '')
          .split(/[·,]/)
          .map((t) => t.trim().replace(/^`|`$/g, ''))
          .filter(Boolean),
        what: row.what_happened ?? '',
        // Her words are the record; a reading of them is not. The record marks
        // the difference with [inferred], and so does this (TML-004).
        inferred: /\[inferred\]/i.test(row.what_happened ?? ''),
        file: (row.file ?? '').replace(/^`|`$/g, '').replace(/^→\s*/, '') || null,
      };
    })
    .filter((e) => e.date || e.what)
    // Reversed before the sort: the file runs oldest first, and the sort is
    // stable, so without it a day's events kept that order inside a
    // newest-first list, and "Lately" could cut the day's latest.
    .reverse()
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));

  // The controlled tag list at the top of the file, so a filter offers the tags
  // the record actually uses rather than inventing a vocabulary beside it.
  const declared = (find('tags in use')?.body ?? '')
    .split('\n')
    .filter((l) => l.includes('`'))
    .flatMap((l) => [...l.matchAll(/`([^`]+)`/g)].map((m) => m[1]));

  const used = [...new Set(entries.flatMap((e) => e.tags))];
  const tags = [...new Set([...declared, ...used])].sort();

  return {
    eras: eras?.filled ? renderBody(eras.body) : null,
    entries,
    tags,
    types: [...new Set(entries.map((e) => e.type).filter(Boolean))].sort(),
    filled: entries.length > 0,
    path: file.path,
  };
}
