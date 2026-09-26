'use client';

import { PaneSeam } from '@/components/shell/PaneSeam';
import { REVIEW_WIDTH } from '@/lib/review-width';

// The seam between the queue and the entry. Everything it does lives in
// PaneSeam; what is decided here is which column it moves and what it is called.
//
// The class is `harness-seam` and that is deliberate rather than left over. It
// names a piece of chrome — the hairline between an index column and the
// document beside it — not a tab, and this view reuses the same split, aside and
// panel classes for the same reason. A `.review-seam` would be the same eleven
// declarations under a second name, which is the duplication DES-001 forbids,
// and the two would drift the first time either was touched.
export function ReviewResizer() {
  return <PaneSeam pane={REVIEW_WIDTH} className="harness-seam" label="Resize the queue" />;
}
