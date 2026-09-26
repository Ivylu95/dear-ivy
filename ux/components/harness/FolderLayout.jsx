import { HarnessIndex } from '@/components/harness/HarnessIndex';
import { HarnessPanel } from '@/components/harness/HarnessPanel';
import { HarnessResizer } from '@/components/harness/HarnessResizer';

// Two columns inside the one the app already gives this view: the whole harness
// on the left, whatever is open on the right.
//
// ── Why a layout and not a component on each page ───────────────────────────
//
// Because Next keeps a layout's DOM across navigations between its children.
// Clicking CLAUDE.md swaps the panel and leaves the index alone — same scroll
// position, same folders unfolded, no re-mount, no flash. Rendered per page it
// would be rebuilt every time, which is the same pixels and a completely
// different feeling: a tree that blinks on every click reads as a new screen
// with a menu on it, which is exactly what this replaces.
//
// It also means /harness, /harness/hooks and every file under /harness/[...path]
// get the index for free, and a route added later cannot forget it.
//
// ── Why the harness gets this and her record does not ───────────────────────
//
// Every view over `data/` is one page about one thing, read on its own. The
// harness is a folder tree, and reading it means moving through a series of
// files in one sitting — a spec, then the skill it governs, then the hook that
// enforces it. That is the one activity in this app a master-and-detail layout
// is actually for, and the one place the extra column earns its width.
//
// The reading column beside it is not narrowed to pay for it: globals.css widens
// the whole middle column for this view instead, so a spec here is read at the
// same measure as a journal entry.
//
// Shared by the Harness and Specs tabs: `view` is the folder's reader, `tab`
// its wording, handed to the index because the index is a client component and
// takes plain data.
export function FolderLayout({ view, tab, children }) {
  const { entries } = view.getTree();

  return (
    <div className="harness-split">
      {/* Below the breakpoint the two columns stack and the tree folds itself
          away behind a button — a tree and a document side by side on a phone is
          two things each too narrow to read. That fold lives inside HarnessIndex
          rather than around it, because <details> would have been the obvious
          wrapper and is the wrong one: a <details> without `open` hides its
          contents at every width, so the column would be empty on the wide
          screens this layout exists for. */}
      <aside className="harness-aside">
        <HarnessIndex entries={entries} tab={tab} />
      </aside>

      {/* The seam sits between the two columns rather than inside either, so the
          grid gives it a track of its own and neither column has to reserve
          space for a control that belongs to both. Hidden below the breakpoint,
          where the columns stack and there is nothing to resize. */}
      <HarnessResizer />

      {/* A client component only so it can hear the click before the content
          changes: the outgoing file has to start fading while the server is
          still reading the incoming one, and a server layout cannot know a
          navigation is in flight. It renders nothing of its own. */}
      <HarnessPanel>{children}</HarnessPanel>
    </div>
  );
}
