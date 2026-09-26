'use client';

import { PaneSeam } from '@/components/shell/PaneSeam';
import { HARNESS_WIDTH } from '@/lib/harness-width';

// The seam between the tree and the document. Everything it does lives in
// PaneSeam; what is decided here is which column it moves and what it is called.
export function HarnessResizer() {
  return (
    <PaneSeam pane={HARNESS_WIDTH} className="harness-seam" label="Resize the index" />
  );
}
