// Whether the developer's views are here, and where they listen (WKB-002).
//
// They are their own app in dev/ui/, which only the developer's copy has
// (ARC-007). Where it is present, the dashboard's start command starts it too
// (scripts/dev.mjs), a switch beside her name crosses to it (lib/sections.js,
// DASHBOARDS), and the gate passes /admin/… to it (proxy.js). Where it is
// absent, none of that exists.
//
// The dashboard only asks whether the folder is there and talks to the app over
// HTTP; it never imports from it, so a copy without dev/ builds and runs whole
// (ARC-008).
//
//   DEAR_ADMIN_PORT   the admin app's port, optional, defaults to 3221

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ADMIN_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'dev', 'ui');

export const ADMIN_PRESENT = existsSync(join(ADMIN_DIR, 'package.json'));

export const ADMIN_PORT = Number(process.env.DEAR_ADMIN_PORT) || 3221;

export const ADMIN_ORIGIN = `http://127.0.0.1:${ADMIN_PORT}`;

// The path the admin app is served under, here and on its own port.
export const ADMIN_BASE = '/admin';
