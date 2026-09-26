import { sizeLabel } from '@/lib/bytes';
import { changedLabel } from '@/lib/dates';

// What a folder is, as rail rows: what it holds directly, then what is under it,
// then how much all of that weighs.
//
// Its own module because two routes render it — the harness overview and every
// folder under it — and a route importing a helper out of another route file is
// a dependency between two things that are only supposed to be pages.
//
// ── Why both counts ─────────────────────────────────────────────────────────
//
// They answer different questions. The direct pair is what the listing beside
// this shows, and it says what kind of thing you are standing in: a drawer of
// files, or six doors. The nested pair is what the listing cannot say — `specs/`
// is one row there and twenty-eight files underneath.
//
// The nested pair hides when it says the same as the pair above it. A flat
// folder like `commands/` would otherwise print "Files 2" and "All files 2", and
// a fact block that repeats itself teaches a reader to stop reading it. Where
// they differ, the difference IS the fact.
export function folderRows(stats, changed) {
  if (!stats) return [];

  const nested =
    stats.nestedFolders !== stats.folders || stats.nestedFiles !== stats.files;

  // Ordered so each number sits against the one it is compared with.
  //
  // It was grouped the other way — both direct counts, then both totals — which
  // put 6 and 41 two rows apart and left the reader to do the pairing. The only
  // reason both exist is the contrast between them, so they go next to each
  // other and the contrast is read rather than worked out.
  //
  // Folders before files, which is also the order the listing beside this uses:
  // it heads its own groups "6 folders" then "4 files", and a margin that
  // reversed them would be describing the same page in a different order.
  //
  // Size last, because it is the only row that is not a count and the only one
  // that summarises everything above it.
  return [
    { label: 'Sub-folders', value: stats.folders || null },
    { label: 'All folders', value: nested ? stats.nestedFolders || null : null },
    { label: 'Files', value: stats.files?.toLocaleString('en') || null },
    {
      label: 'All files',
      value: nested ? stats.nestedFiles?.toLocaleString('en') || null : null,
    },
    { label: 'Size', value: sizeLabel(stats.bytes) },
    // Last, under the size, because it is the only row that is not about how
    // much there is. For a folder this is the newest change anywhere inside it.
    { label: 'Changed', value: changed ? changedLabel(changed) : null },
  ];
}
