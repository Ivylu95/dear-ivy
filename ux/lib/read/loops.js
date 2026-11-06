// Part of the record's read layer (lib/content-read.js, the one door views use
// through lib/content.js): the loops reader. Nothing here writes.

import { renderBody, sections } from '@/lib/markdown';
import { core, derive, readFile } from '@/lib/read/source';

// ── Open loops ──────────────────────────────────────────────────────────────

// Threads to come back to, and the things she meant to say to her therapist and
// has not. The second group is the one that earns this a place on the home view:
// it is written verbatim, ready for the next appointment, and it is useless if it
// is only found by someone who went looking.
export function getOpenLoops() {
  const file = readFile(core('state/open_loops.md'));
  if (!file) return { groups: [], open: 0, filled: false, shown: false };
  return derive(file, 'loops', parseOpenLoops);
}

function parseOpenLoops(file) {
  const groups = sections(file.raw).sections.map((s) => ({
    heading: s.heading,
    items: s.body
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /^-\s*\[[ xX]\]/.test(l))
      .map((l) => ({
        done: /^-\s*\[[xX]\]/.test(l),
        text: l.replace(/^-\s*\[[ xX]\]\s*/, '').trim(),
      }))
      .filter((i) => i.text),
    // Anything that is not a checkbox — prose she or the agent left under the
    // heading. Kept, because dropping it would silently lose part of the record.
    html: renderBody(s.body.split('\n').filter((l) => !/^\s*-\s*\[[ xX]\]/.test(l)).join('\n')),
  }));

  const open = groups.flatMap((g) => g.items).filter((i) => !i.done).length;
  // Whether there is anything to show: a group of prose counts, because the view
  // renders it (LPS-005). `filled` stays about open items alone.
  const shown = groups.some((g) => g.items.length > 0 || g.html.trim() !== '');
  return { groups, open, filled: open > 0, shown, path: file.path };
}
