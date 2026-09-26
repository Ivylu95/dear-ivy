'use client';

import { useSyncExternalStore } from 'react';
import { Icon } from '@/components/ui/icons';
import { getFolded, serverFolded, setFolded, subscribeFolded } from '@/lib/rail-fold';

// The head row of a rail block, with the fold on its heading.
//
// ── Why the heading is the button ───────────────────────────────────────────
//
// The fold was a word — `hide` / `show` — sitting where RailNav puts its "Top".
// Two problems with that. It read as a label rather than as furniture: a 206px
// margin has room for one small word per row, and spending it on the mechanism
// rather than on the content is what makes a column look like a control panel.
// And RailNav's row already HAS a control, so the contents list would have
// carried two, side by side, in a column that narrow — the toolbar the harness
// index explicitly refused, for the same reason.
//
// The heading solves both. It is already the widest thing on the row, it is
// already the name of what folds, and a title that opens and closes what is
// under it is the oldest disclosure there is. Nothing is added to the row, and
// "Top" keeps the slot it had.
//
// The chevron is the whole indicator: pointing at the row when the block is
// folded and downward when it is open. Same glyph and same turn as the harness
// tree's fold, so the gesture is learned once for the app rather than per
// column.
export function RailHead({ name, title, bodyId, children }) {
  const folded = useRailFold(name);

  return (
    <div className="rail-head">
      {title && (
        <h2 className="rail-title">
          <button
            type="button"
            className="rail-fold"
            aria-expanded={!folded}
            aria-controls={bodyId}
            onClick={() => setFolded(name, !folded)}
          >
            {/* Decorative: aria-expanded already says which way this points, and
                a screen reader naming a chevron after announcing "expanded" is
                saying the same thing twice. */}
            <Icon name="chevron" size={10} className="rail-fold-mark" aria-hidden="true" />
            {title}
          </button>
        </h2>
      )}
      {/* Whatever else the block wants on the row — RailNav's way back to the
          top. It stays while the block is folded, because a folded contents list
          has not stopped the page being scrollable. */}
      {children}
    </div>
  );
}

// The same state, for the block itself. The body is not rendered while folded
// rather than hidden with CSS: RailNav's list is driven by a scroll spy, and
// there is no sense measuring a document for a list nobody can see.
export function useRailFold(name) {
  return useSyncExternalStore(subscribeFolded, () => getFolded(name), () => serverFolded(name));
}
