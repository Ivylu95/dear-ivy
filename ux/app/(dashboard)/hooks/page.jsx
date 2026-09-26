import { permanentRedirect } from 'next/navigation';

// Hooks used to be a tab of its own. It is now one area of the harness, and
// lives at /harness/hooks.
//
// This file is the forwarding address. Nothing in the app links here any more —
// the left rail points at /harness — but a bookmark, a browser history entry or
// a link in a commit message still does, and a route that silently becomes a
// 404 is how someone concludes the page was removed rather than moved.
//
// permanentRedirect rather than redirect: the move is not coming back, and a 308
// lets a browser stop asking.
export default function HooksMoved() {
  permanentRedirect('/harness/hooks');
}
