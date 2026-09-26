import { AboutLink } from '@/components/shell/AboutLink';
import { MobileNav } from '@/components/shell/MobileNav';
import Nav from '@/components/shell/Nav';
import { Profile } from '@/components/shell/Profile';
import RemountOnRoute from '@/components/shell/RemountOnRoute';
import { RailResizer } from '@/components/shell/RailResizer';
import { SidebarResizer } from '@/components/shell/SidebarResizer';
import { SidebarToggle } from '@/components/shell/SidebarToggle';
import { SettingsMenu } from '@/components/shell/Theme';
import WatchForChanges from '@/components/shell/WatchForChanges';
import { BrandMark } from '@/components/ui/icons';
import { avatarStamp } from '@/lib/avatar';
import { SESSION_COOKIE, sessionUser } from '@/lib/auth';
import { getIdentity, getNavCounts } from '@/lib/content';
import { SAMPLE_EXISTS, currentRecord } from '@/lib/data-dir';
import { countOpen } from '@/lib/review';
import { cookies } from 'next/headers';
import { Suspense } from 'react';

// Always read the files on request. A line written into timeline.md during a
// session has to be visible on the next page load with no rebuild — that is the
// whole point of a filesystem-backed surface, and the alternative is a dashboard
// that quietly shows last week's record. The reads themselves are cached on file
// mtime, so "on request" costs a few stat() calls, not a full re-parse.

// The tab says who, but only behind the gate.
//
// The root layout titles the document "Dear" and that is what the login page
// keeps: it is served to anyone who reaches the origin, and a title reaches
// browser history and link previews. Inside, the only person who can see the tab
// is someone already looking at the open record over her shoulder, so the
// marginal cost of naming her there is nothing and the gain is a tab she can
// pick out of twenty.
//
// The home-screen name stays generic for the opposite reason: a phone home
// screen is seen by people who are not looking at the record.
export async function generateMetadata() {
  const { name } = await getIdentity();
  return name ? { title: `Dear ${name}` } : {};
}

export const dynamic = 'force-dynamic';

// `rail` is the @rail parallel-route slot. Each tab supplies its own from
// app/(dashboard)/@rail/<route>/page.jsx; anything without one falls through to
// @rail/default.jsx. Kept as a route rather than a prop so every rail stays a
// server component with its own cached reads.
export default async function DashboardLayout({ children, rail }) {
  const counts = await getNavCounts();

  // The review count is added here rather than inside getNavCounts, and the
  // reason is the same one that gives the harness its own resolver: that
  // function runs inside a record scope and answers questions about HER files,
  // so whichever record is on screen decides its answers. This one counts
  // entries in the harness, which is the same folder whether the sample is up or
  // not — adding it in there would have made it look like something of hers.
  const openReviews = countOpen();
  if (openReviews > 0) counts['/review'] = { value: openReviews };

  // "Dear" is the app; the name is hers and comes from the record. Before she
  // has told us one, it addresses her as anyone would address a letter to
  // someone they have not met — not with a placeholder that looks like a bug.
  const { name } = await getIdentity();
  const wordmark = `Dear ${name ?? 'you'}`;

  // Read from the signed session rather than from configuration, so the name
  // shown is the account this browser actually holds a token for. The proxy has
  // already refused anything without one; this only asks WHICH.
  const account = await sessionUser((await cookies()).get(SESSION_COOKIE)?.value);

  // Which record is on screen. The settings menu needs it to show the switch in
  // the right position; the profile chip needs it because her photograph belongs
  // to her record alone. While the sample is up the chip falls back to the
  // initial of the invented name, which is the honest thing for it to do — her
  // face beside someone else's name would read as a claim about who this is.
  const record = await currentRecord();

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <MobileNav />
      <div className="shell">
        <aside className="sidebar" id="sidebar">
          <div className="sidebar-inner">
            {/* The mark sits beside BOTH lines, not beside the wordmark with the
                tagline hung underneath. Centred on the wordmark alone it floated
                9px above the block's optical centre and read as drifting away
                from the line it belongs to.

                It also makes the indent structural: the tagline is in the same
                column as the wordmark, so it aligns to it by construction rather
                than by a hard-coded 32px that had to be kept in step with the
                mark's size and the gap by hand. */}
            <div className="brand">
              <BrandMark size={28} />
              <div className="brand-text">
                <span className="brand-name" title={wordmark}>
                  {wordmark}
                </span>
                <span className="brand-tag" title="A space to think out loud">
                  A space to think out loud
                </span>
              </div>
            </div>

            <Nav counts={counts} />

            <SidebarToggle />

            {/* Three rows: who is signed in, everything adjustable, and what
                this app is. Colour, reading style, light/dark and the way out all
                live behind the second one — none of them is touched in a normal
                session, and a reading surface should not carry four rows of
                chrome under its navigation.

                The first row is also the door to her standing files (see
                components/shell/Profile.jsx) and the last is the door to About, which
                used to be a tab. Both belong here for the same reason: the list
                above is her record, and neither of these is. */}
            <div className="sidebar-foot">
              {account && (
                <Profile
                  account={account}
                  avatarStamp={record.isSample ? null : avatarStamp()}
                />
              )}
              <SettingsMenu record={record.key} sampleAvailable={SAMPLE_EXISTS} />
              <AboutLink />
            </div>
          </div>
        </aside>

        {/* The navigation's right edge, draggable. Outside the <aside> because
            that column is fixed and clips its own overflow; a seam inside it
            would be cut off at the very edge it is there to move. */}
        <SidebarResizer />

        <main className="main" id="main">
          {/* The column grows to fill whatever is between the two rails; the
              content inside it is capped and centred. Without the wrapper the
              page stopped at 1000px and left a dead band down the right of a wide
              window, which is the one place a three-column layout must not have
              one — the right rail is supposed to be AT the edge. */}
          <div className="main-inner">{children}</div>
        </main>

        {/* The contents rail's left edge, draggable. A flex item of its own
            between the reading column and the rail, so neither has to reserve
            space for a control that belongs to both. */}
        <RailResizer />

        {/* The second navigation. The left rail moves between views; this one
            moves within the view you are already in, and is supplied per route by
            the @rail slot — nothing else. It used to carry the route to the
            safety plan below the slot as well, so that link could not sit behind
            a route matcher; that job belongs to the left rail, where Safety plan
            is its own row, last and alone, on every screen. Two permanent doors
            to one page is one more than it needs. */}
        <aside className="rail" aria-label="On this page">
          <div className="rail-sticky">
            {/* Client wrapper, server children: the rail is the one region with
                no entrance of its own, and its slot's DOM node is reused across
                routes. Every rail inside stays a server component. */}
            {/* The rail waits; the page does not.

                Without a boundary here the whole document is held until the
                slowest thing in it resolves, and on the harness routes the
                slowest thing is in this slot: the rail dates the folder from
                `git log`, which is a spawn. It is cached on HEAD now, so the
                spawn only happens on the first harness page after a commit —
                but that is exactly when someone is opening the harness to see
                what changed, and the panel beside it was ready in about 45ms
                and spent the next 130 waiting to be allowed out.

                The fallback is deliberately nothing rather than a skeleton:
                the column's width is fixed in CSS, so an empty rail shifts
                nothing when it fills, and a shape that pretends to be facts for
                a tenth of a second is worse than a margin that is briefly blank.

                OUTSIDE the remount, not inside it. RemountOnRoute keys its node
                on the pathname, so a boundary inside it would be a new boundary
                on every navigation — and a new boundary shows its fallback,
                which would blank the rail on each click while the next one
                loaded. Out here the boundary is the same one across routes, and
                React keeps an already-revealed boundary's content on screen
                through a navigation rather than falling back. */}
            <Suspense fallback={null}>
              <RemountOnRoute className="rail-enter">{rail}</RemountOnRoute>
            </Suspense>
          </div>
        </aside>
      </div>

      {/* Nothing on screen. It holds a connection to /api/watch and re-reads the
          page when a file under the record or the harness changes, because
          nothing else tells the browser that one did — the markdown this app
          renders is read at request time from outside ux/, so the bundler's
          watcher never sees it and Fast Refresh never fires.

          Development only. Deployed, the page is current when she opens it and
          there is nothing to watch for. */}
      {process.env.NODE_ENV !== 'production' && <WatchForChanges />}
    </>
  );
}
