// Part of the record's read layer (lib/content-read.js, the one door views use
// through lib/content.js): the journal reader. Nothing here writes.

import { yearOf } from '@/lib/dates';
import { core, listDir, render } from '@/lib/read/source';

// ── Journal ─────────────────────────────────────────────────────────────────

// Dated entries, newest first. No count is returned and none is displayed: see
// the note at the top of lib/dates.js.
export function getJournal() {
  return listDir(core('journal'))
    .map((name) => {
      const doc = render(core(`journal/${name}`));
      if (!doc) return null;
      const date = /(\d{4}-\d{2}-\d{2})/.exec(name)?.[1] ?? doc.updated ?? null;
      return {
        slug: name.replace(/\.md$/, ''),
        date,
        year: yearOf(date),
        title: doc.title,
        html: doc.html,
        filled: doc.filled,
        path: doc.path,
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
}
