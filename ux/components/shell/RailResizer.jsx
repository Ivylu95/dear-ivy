'use client';

import { PaneSeam } from '@/components/shell/PaneSeam';
import { RAIL_WIDTH } from '@/lib/rail-width';

// The seam at the contents rail's left edge.
//
// `origin="end"` because this column is anchored to the right of the window: its
// width is the pointer's distance from that edge, and dragging left makes it
// wider rather than narrower.
export function RailResizer() {
  return (
    <PaneSeam pane={RAIL_WIDTH} className="rail-seam" label="Resize the contents" origin="end" />
  );
}
