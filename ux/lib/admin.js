// Whether the developer's app is answering (WKB-002), asked by the gate in
// proxy.js before it passes /admin/… on, and by admin-not-running, which sends
// the reader back to /admin once it is.

import { connect } from 'node:net';
import { ADMIN_ORIGIN } from '@/config/admin.mjs';

// Whether the admin app is listening: a refused connection must become a page
// saying so rather than a proxy error. A connection, not a request, so the
// answer costs no render and is not slowed by the app compiling a view. Every
// asset of an admin page passes through here, so a yes is kept a few seconds; a
// no is asked again on the next request, so a starting app is found at once.
const ADMIN_UP_FOR_MS = 5000;
let adminUpAt = 0;
// `fresh` skips the kept yes: admin-not-running acts on its answer by sending the
// reader back to /admin, and a stale yes there, with the gate's fresh no, would
// bounce between the two until the yes expired.
export function adminAnswers({ fresh = false } = {}) {
  if (!fresh && Date.now() - adminUpAt < ADMIN_UP_FOR_MS) return Promise.resolve(true);
  const { hostname, port } = new URL(ADMIN_ORIGIN);
  return new Promise((resolve) => {
    const socket = connect({ host: hostname, port: Number(port) });
    const done = (up) => {
      socket.destroy();
      if (up) adminUpAt = Date.now();
      resolve(up);
    };
    socket.setTimeout(1000, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}
