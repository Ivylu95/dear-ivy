# A slow dev server is usually its watcher, not the code

**Learned 2026-10-07, chasing a laggy Specs Register.** The developer said the
app was slow even after a speed pass (file cache, `staleTimes`, warm-up) had
landed. A session that has only the code in front of it would profile the
readers again, find them fast, and conclude the lag is imagined or is Next's.

## What it was

The admin app took 4 to 5 seconds to answer even its login page, and used about
two thirds of a core while nobody was clicking. Five agent worktrees sat in
the worktrees folder inside `.claude`, about 28,000 files, each with its own `node_modules` and
`.next`. The admin app's `turbopack.root` is the whole repository (it imports
the dashboard's shell from `ux/`), so its watcher watched all of them. The
server had also been up for hours and had crashed once ("Jest worker
encountered 2 child process exceptions"). After `git-reconcile` cleared the
worktrees and the server was restarted: 0.06 to 0.12 seconds, and no CPU at idle.

So, in order:

1. **Time the running server first,** without signing in: its `/login` answer.
   Compare it with the dashboard's. A slow login page means the server, not any
   view.
2. **Look in the worktrees folder inside `.claude`** for leftovers. `npm run git:reconcile` in
   `ux/` clears the clean ones, and lists the rest with what they hold.
3. Only then profile readers.

The launcher now does step 1 and 2 at every `npm run dev` (DES-008, design 4).

## The second trap: React's cache() outside a request

Timing a reader in plain Node (`ux/scripts/check-speed.mjs`) first said the
Harness view took 2.4 seconds. It does not: `cache()` from `react` memoises
only inside a server render, and outside one it calls straight through, so the
folder walk every part of the page shares ran 24 times per timed call. The
check swaps in a cache scoped to one timed request. Any script that times the
app's readers outside Next has to do the same, or it reports a ceiling many
times the real cost.

## And: a server started by a chat outlives it

A chat that starts `npm run dev` in the background leaves a launcher with no
terminal to Ctrl+C in, and the next `npm run dev` refuses its ports. The
launcher now prints the `taskkill` that stops it, whole trees, since on Windows
the child holding the port outlives a plain stop. Stop your own test servers
by port before ending a turn.

## An environment variable is not a record guard

The first version of that check kept the record out by pointing `DEAR_DATA`
at a folder that did not exist. A reviewer found it guarded nothing:
`ux/lib/data-dir.js` takes the first candidate holding a `PROFILE.yaml` and
skips a missing one, so the next candidate, the real record, would have been
read. A guard has to refuse at the one door, not hope a lookup fails: the check
now refuses to load the record's resolver and reader at all, and is proven
failing when a reader imports one.
