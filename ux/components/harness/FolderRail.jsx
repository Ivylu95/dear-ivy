import { RailFacts } from '@/components/shell/RailFacts';
import { folderRows } from '@/lib/harness-facts';
import { getFolderDates } from '@/lib/git';

// What `.claude/` amounts to, and nothing else.
//
// No contents list here, and that is deliberate. It used to list the areas as
// anchors. The index now sits in the middle column, beside the panel, and lists
// the same areas with every file under them — so the rail's version was the same
// navigation, shorter, further away, and one of two lists of identical names on
// one screen. Two indexes is how a reader stops trusting either.
//
// The facts are a different question and the index cannot answer it. It shows
// `specs/` as one row; it does not say the harness is two hundred kilobytes of
// instructions, which is the thing worth knowing about a folder that is read
// into every conversation.
//
// Same block, same counting rule, as every folder under this one — see
// FolderPathRail.jsx. A route that reported its own totals differently
// from the folders inside it would be the one page you could not compare.
export async function FolderRail({ view, tab }) {
  const entry = view.getPath('');
  // The most recent change anywhere under `.claude/`, which is what "changed"
  // means for a folder: not when the directory entry was touched, but when
  // anything it holds last did.
  const dates = await getFolderDates(view.folder);
  const changed = [...dates.values()].sort().pop() ?? null;
  if (entry.kind !== 'dir') return null;

  return (
    <RailFacts title={tab.title} rows={folderRows(entry.stats, changed)} />
  );
}
