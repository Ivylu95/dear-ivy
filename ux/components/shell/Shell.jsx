import { AboutLink } from '@/components/shell/AboutLink';
import { AppSwitch } from '@/components/shell/AppSwitch';
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
import { getIdentity } from '@/lib/content';
import { SAMPLE_EXISTS, currentRecord } from '@/lib/data-dir';
import { cookies } from 'next/headers';
import { Suspense } from 'react';

// The shell both apps share: the sidebar, the reading column and the contents
// rail. The dashboard (app/(dashboard)/layout.jsx) passes her sections and
// counts; the admin app in dev/ui/ passes the developer's (WKB-002). Only the
// admin app imports from here across the folder line, never the other way, so
// a copy without dev/ keeps the dashboard whole (ARC-008).
//
// `rail` is the @rail parallel-route slot. Each tab supplies its own from
// app/(dashboard)/@rail/<route>/page.jsx; anything without one falls through to
// @rail/default.jsx. Kept as a route rather than a prop so every rail stays a
// server component with its own cached reads.
// `away` marks the admin app (WKB-002): the footer's links lead back into the
// dashboard from there. `dashboard` is which of the two this is ('user' or
// 'admin') for the switch beside her name (lib/sections.js, DASHBOARDS), or
// null where there is no other one.
export default async function Shell({ children, rail, sections, counts = {}, hidden = [], away = false, dashboard = null }) {
  // "Dear" is the app; the name is hers and comes from the record. Before she
  // has told us one, it addresses her as anyone would address a letter to
  // someone they have not met — not with a placeholder that looks like a bug.
  const { name } = await getIdentity();
  const wordmark = `Dear ${name ?? 'you'}`;

  // Whether this browser is signed in, from the signed session. The chip shows
  // only when it is, and never shows the account itself: the username is a
  // credential, and the name on screen is the record's (DES-007).
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

            <Nav sections={sections} counts={counts} hidden={hidden} />

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
              {(account || dashboard) && (
                <div className="profile-row">
                  {account && (
                    <Profile
                      name={name ?? 'You'}
                      away={away}
                      avatarStamp={record.isSample ? null : avatarStamp()}
                    />
                  )}
                  {dashboard && <AppSwitch current={dashboard} />}
                </div>
              )}
              <SettingsMenu record={record.key} sampleAvailable={SAMPLE_EXISTS} />
              <AboutLink away={away} />
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
