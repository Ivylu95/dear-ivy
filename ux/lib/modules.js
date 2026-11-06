import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { HARNESS } from './harness-dir';
import { VIEW_MODULE } from './views';

// Which optional modules are switched on (ARC-006).
//
// A module is on when its folder under modules/ carries a module.json. Removing
// the folder switches off every view that belongs to it — the rail row, the
// route, and the sections of other views that read its files — so the surface
// never shows a tab for an area the harness no longer has. Which views belong
// to which module is VIEW_MODULE in lib/views.js; the page code stays in ux/,
// because the router only finds routes under app/.
//
// Found from the harness, like the specs: modules/ sits beside .claude/ at the
// repository root (ARC-005). Non-personal: this reads folder names, never data/.
const MODULES = join(dirname(HARNESS), 'modules');

export const moduleOn = (name) => existsSync(join(MODULES, name, 'module.json'));

/** The views whose module is switched off, for the rail and the workflow map to leave out. */
export const hiddenViews = () =>
  Object.entries(VIEW_MODULE)
    .filter(([, name]) => !moduleOn(name))
    .map(([href]) => href);
