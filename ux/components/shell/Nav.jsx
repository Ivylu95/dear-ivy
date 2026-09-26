'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  getPendingRoute,
  routeFor,
  serverPendingRoute,
  setPendingRoute,
  subscribePendingRoute,
} from '@/lib/route-pending';
import { setDrawerOpen } from '@/lib/sidebar';
import { VIEW_ICON, VIEW_LABEL } from '@/lib/views';
import { Icon } from '@/components/ui/icons';
import { Reading } from '@/components/ui/Reading';

// Icons carry the nav once the rail collapses to a 64px column, where a label
// cannot fit. Expanded, they sit left of the label in a fixed gutter, which is
// also what keeps the collapsed and expanded rails optically aligned: the icon
// does not move when the rail opens, only what follows it appears.
//
// ── Why the groups are these groups ─────────────────────────────────────────
//
// The axis is whose the thing is, not what kind of file it is.
//
//   Now        — the way in. A heading over one row is noise.
//   The space  — what happened, who it happened with, who it was said to, what
//                is still meant to be said, and what to do on a bad night. The
//                record OF the person.
//   The machine — what it was told, how that came to say what it says, and what
//                somebody has argued it should say instead. Not hers.
//
// The two headings name the two sides of that axis: the record is the person's,
// the machine is not. It was "The record" before this and "Her life" before
// that. "Her life" said the same thing and said it about a woman — and nothing
// in this repository is about a woman except the record it happens to be
// holding. "The record" was accurate and named the FILES; this side of the axis
// is the half of the line in .claude/CLAUDE.md that is hers — a private space to
// think out loud — and the rows under it are where she goes, not what is stored. Whose the record is belongs in
// data/profile.yaml, which is the one place a person is described; the rail has
// to be right for whoever opens it.
//
// The standing files — the record ABOUT the person — are no longer a row here.
// They sit behind their own name at the foot of the rail, which was already an
// identity row doing nothing else; see components/shell/Profile.jsx. That left
// Therapy alone under its old heading, and a heading over one row is noise here
// too, so it joined the dated things it belongs with.
//
// About went the same way and for a better reason: it is the app explaining
// itself, not the record, and it now sits under Settings at the foot of the rail
// with the other thing here that is about the machine — see
// components/shell/AboutLink.jsx. That left Open loops alone under "Keeping it", so by
// the same rule it joined The space, which is where the thing still meant to be
// said belongs anyway.
//
// Safety plan sat last and alone below the machine, with the one warm tint in
// the rail, on the argument that last is where the eye lands when it is scanning
// for something it cannot name. It reads the other way round in practice: alone
// under no heading, it fell under The machine's rule and looked like the fourth
// row of the machine's group — the one place in this rail where being misread
// costs something. It is hers, so it sits with the rest of what is hers, last in
// The space, and it is styled like every other row there. A row she can find by
// where it lives beats a row she has to find by its colour.
//
// No icon field here. The glyph comes from VIEW_ICON, keyed by the same href
// these entries already carry, so the rail and the view's own header cannot show
// two different marks for one place.
const SECTIONS = [
  { label: null, items: [{ href: '/' }] },
  {
    label: 'The space',
    items: [
      { href: '/timeline' },
      { href: '/journal' },
      { href: '/people' },
      { href: '/therapy' },
      { href: '/calendar' },
      { href: '/loops' },
      { href: '/safety' },
    ],
  },
  // Harness is a tab by explicit instruction, against the grouping argument
  // above: it is the machine, not her record, and by that argument it belongs at
  // the foot with About and Settings.
  //
  // ── Why this group is named, when it was not ────────────────────────────────
  //
  // It was unlabelled, on the reasoning that the space alone would keep it from
  // being read as part of Her life. Space says these three are not those six; it
  // does not say what they are instead, and the difference matters more here
  // than anywhere else in the rail. Every other row in this list is hers — the
  // record OF her, and the plan for a bad night. These three are the machine
  // talking about itself: what it was told, how that instruction came to say
  // what it says, and what somebody has argued it should say instead. None of
  // them is written for her and none of them is about her.
  //
  // So the heading is doing the same job "Her life" does, from the other side.
  // The rail's axis is whose the thing is, and a rail that names one side of
  // that axis and leaves the other to be inferred from a gap is only half
  // saying it.
  //
  // It was Hooks until the rest of the harness got a view too. One row rather
  // than two: hooks are one area of `.claude/` among eight, and a rail with a
  // row for the folder AND a row for one folder inside it is a rail that has
  // stopped describing the shape of anything.
  //
  // Changes joins it in the same group rather than getting one of its own,
  // because the two are the same subject in two tenses: the harness is what the
  // machine is told to do now, and this is how that instruction got to be what
  // it says. A reader who wants one wants the other in the next click.
  //
  // It sits directly under For review and above Harness, by explicit
  // instruction. The order that reading gives the group is the machine in time:
  // what has been argued and not yet answered, then what has just changed, then
  // what the machine does, then what it is told. The two rows about movement
  // come before the two rows of reference, and the one with a queue in it still
  // leads.
  //
  // Review is the third tense: what somebody has argued the instruction should
  // say instead, and has not been allowed to change. The row was "For review",
  // then "For Review", and is now the one word — the rail names places, and the
  // other rows in this group are Changes, Workflow and Harness rather than
  // sentences about them. The file followed the tab rather than the other way
  // round: `.claude/FOR_REVIEW.md` was renamed `REVIEW.md` in the same change,
  // so the tab, the route and the file it reads now say one word between them.
  //
  // It leads the group, by explicit instruction and against the argument that
  // put Workflow there first — that the row explaining what the machine does
  // should come before the three that assume you know. The order it replaces
  // ranked the rows by how much a stranger needs them; this one ranks them by
  // which is waiting on somebody. Three of these four are reference, read when
  // a question comes up and otherwise not at all. This one is the only row in
  // the whole rail that is a queue: it has things in it that stay there until a
  // person answers them, and it is the only row that carries a count, because
  // the exact failure it was built to fix is a backlog nobody could see the
  // length of. A list nobody has to act on does not go above one that does.
  {
    label: 'The machine',
    items: [
      { href: '/review' },
      { href: '/changes' },
      { href: '/workflow' },
      { href: '/specs' },
      { href: '/harness' },
    ],
  },
];

const ITEMS = SECTIONS.flatMap((s) => s.items);

const matches = (href, pathname) =>
  href === '/' ? pathname === '/' : pathname.startsWith(href);

export default function Nav({ counts = {} }) {
  const pathname = usePathname();

  // Optimistic highlight: the marker moves the moment a link is clicked rather
  // than waiting for the server component to stream in.
  //
  // The destination is read from lib/route-pending.js rather than held here,
  // because not every destination is one of these rows. The profile chip at the
  // foot of the rail goes to About me, and while that page was loading this nav
  // still saw the OLD pathname and kept the row you were leaving lit — two
  // places marked at once. Asking the shared channel means a click on anything
  // that announces itself unmarks this list, whether or not the target is here.
  useSyncExternalStore(subscribePendingRoute, getPendingRoute, serverPendingRoute);
  const activeHref = ITEMS.find((i) => matches(i.href, routeFor(pathname)))?.href;

  // The marker is one element for the whole nav rather than one per item, and its
  // position is measured from the active link — the rows are not a fixed height
  // at every breakpoint, and hard-coding one would drift the moment the padding
  // changed.
  //
  // It does not animate between rows. It used to, and that travel was the one
  // moving thing on screen at the moment a new page was trying to be read: a
  // marker says where you are, and animating it turns that statement into an
  // event, pulling the eye back to the rail you have just finished with. The
  // measurement below still runs on every change, because WHERE it goes is not
  // knowable without it; only the journey is gone.
  //
  // Measuring means it cannot be server-rendered: it appears on hydration rather
  // than in the first paint. That is the trade for it travelling, and the active
  // row is not unmarked in the meantime — aria-current, the heavier weight and
  // the full-strength icon are all in the server HTML.
  const navRef = useRef(null);
  const [markerTop, setMarkerTop] = useState(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;

    const measure = () => {
      const el = nav.querySelector('[data-active="true"]');
      // A number rather than an object, so React's own bailout does the work: the
      // observer fires on every frame of the rail's width animation, and a fresh
      // object each time would re-render the whole nav through the one animation
      // this marker exists to keep smooth.
      setMarkerTop(el ? el.offsetTop + el.offsetHeight / 2 : null);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeHref]);

  return (
    <nav className="nav" id="sidebar-nav" aria-label="Sections" ref={navRef}>
      {markerTop != null && (
        <span
          className="nav-marker"
          aria-hidden="true"
          style={{ transform: `translateY(${markerTop}px)` }}
        />
      )}
      {SECTIONS.map((section, i) => (
        <Fragment key={section.label ?? `top-${i}`}>
          {section.label && (
            <h2 className="nav-section">
              {/* Fades out with every other open-rail-only element. Collapsed, the
                  heading keeps its height and its rule and loses only the words,
                  so nothing reflows during the width animation and the groups stay
                  visibly separated in the 64px column. */}
              <span className="nav-section-label">{section.label}</span>
            </h2>
          )}
          {section.items.map((item) => {
            const active = item.href === activeHref;
            const count = counts[item.href];
            return (
              <Link
                key={item.href}
                href={item.href}
                className="nav-item"
                data-active={active ? 'true' : undefined}
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  setPendingRoute(item.href, pathname);
                  // Picking a view from the mobile drawer dismisses it; on desktop
                  // there is no drawer open and this is a no-op.
                  setDrawerOpen(false);
                }}
              >
                <Icon name={VIEW_ICON[item.href]} size={16} className="nav-icon" />
                {/* Labels stay laid out at full width and are clipped by the rail's
                    overflow when it is narrow, then faded in as it opens. Nothing
                    is removed from the DOM, so the links keep their accessible
                    names and no text reflows during the width animation. */}
                <span className="nav-label">{VIEW_LABEL[item.href]}</span>
                {/* A count only ever says how many things are ON FILE — people,
                    open threads. Never how often she wrote, never how long since.
                    lib/content.js getNavCounts() is where that rule is enforced;
                    this just renders what it is given. */}
                {count != null && <span className="nav-count">{count.value}</span>}
                {/* Only ever seen if the read is genuinely slow — see
                    components/ui/Reading.jsx. */}
                <Reading />
              </Link>
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
}
