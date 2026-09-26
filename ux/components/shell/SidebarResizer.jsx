'use client';

import { PaneSeam } from '@/components/shell/PaneSeam';
import { SIDEBAR_WIDTH } from '@/lib/sidebar-width';

// The seam at the navigation's right edge.
//
// `origin="window"` because this column is fixed to the window rather than laid
// out in a grid: its width is the pointer's distance from the left of the
// screen, not from a container that starts somewhere else.
export function SidebarResizer() {
  return (
    <PaneSeam
      pane={SIDEBAR_WIDTH}
      className="nav-seam"
      label="Resize the navigation"
      origin="window"
    />
  );
}
