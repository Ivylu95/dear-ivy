# Photograph a view without the login

**Learned 2026-10-06, building the spec map.** The developer asked for the Specs
tab to be photographed at different points and judged from the photos. Every
page sits behind the login, and no session may sign in as the developer or mint
a session to get past it (a gate a script walks through is not a gate). Three
traps came with it; each cost a round trip.

## The recipe: a login-free preview of the component alone

A view's client component (an admin page's interactive part) can be served by a
throwaway Next app that imports it directly, with no shell, no proxy and so no
login. It must read nothing of the record: only `dev/specs` or `.claude`
(SPC-002; the Document shell reads the record, so it is never imported).

1. In `temp/<name>-preview/` (untracked): `package.json`, a `jsconfig.json` with
   the admin app's aliases (`@/*` to ux, `@admin/*` to the admin app), a
   `next.config.mjs` setting `turbopack.root` to the repository and the same
   harness env as the admin app's own `next.config.mjs`, a root layout importing
   the real `globals.css`, `admin.css` and the font, and a page rendering the
   component with its real server reader. Link `node_modules` to ux's with a
   junction (`mklink /J`). **Unlink it before anything deletes the folder**
   (`cmd /c rmdir temp\<name>-preview\node_modules` removes the link alone):
   `rm -rf` and most recursive deletes follow a junction and empty the
   dashboard's installed packages themselves (2026-10-08: found holding 27, every
   page of both apps answering 500, `npm install` the fix). Then move the
   folder to the scratchpad rather than deleting it; the agent's `rm -rf` is
   refused anyway.
2. Run it on a free port with `next dev`, never one of the developer's
   (3210, 3220, 3221, 3299), and stop it by port when done.
3. Photograph it through Chrome's DevTools protocol: `chrome --headless=new
   --remote-debugging-port=N`, with `--user-data-dir` in the session's own
   scratchpad outside the repository, never under `temp/`: Chrome copies the
   installed extensions into the profile, and their code trips the privacy
   check at the end of every chat sharing the tree (2026-10-08: a security
   extension's scripts "named" someone in the record, twenty files). Connect to the page's `webSocketDebuggerUrl`
   (`node --experimental-websocket` on Node 20), then `Page.navigate`,
   `Runtime.evaluate` to click (dispatch a bubbling `click`, or `PointerEvent`s
   for a drag), and `Page.captureScreenshot`. Read the PNGs, and send the ones
   the developer should see.
4. For a phone width, set it with `Emulation.setDeviceMetricsOverride`
   (`{ width: 375, height, deviceScaleFactor: 1, mobile: true }`) before
   navigating, and check `innerWidth` and `scrollWidth` in the page. Headless
   Chrome will not render a window narrower than about 500px: `--window-size=400,…`
   rendered at ~500 and cropped, so a 400px shot showed an overflow that was
   not there (2026-10-07, the header switch).

What it cannot show is the shell around the component (the navigation, the
rails, the index column); say so, and ask the developer for a screenshot of that.

## Traps found by photographing

- **A view that refits on its `data` prop resets under live reload.** The page
  is refreshed on every file change (`ux/components/shell/WatchForChanges.jsx`),
  with other chats changing files every few minutes, and each refresh passes a
  new object. Key effects on what the data says (the rows' IDs), never on its
  identity.
- **Capturing the pointer on press swallows taps.** With `setPointerCapture`
  on `pointerdown`, the browser delivers the click to the capturing element, not
  the card under it. Capture only once a drag has begun.
- **Setting React state on every pointer move stutters.** Move the drawing with a
  direct style write once per animation frame; commit to state when the hand lets
  go.

## Measure in a warm process

A timing taken by starting Node (`node script.mjs`) includes Node's own start-up
and module loading: the spec parse "cost 400 ms" that way, and 15 ms inside a
running server. Time inside a warm server (repeat requests against the preview),
and report a cold figure only as one.

## A plain link leaves the admin app

The admin app is served under `/admin` (its `next.config` `basePath`), and only
Next's `<Link>` adds that prefix. A plain `<a href="/specs/graph">` went to the
dashboard's not-found page instead of the map (2026-10-07). Inside `dev/ui`, an
internal link is always a `<Link>`.
