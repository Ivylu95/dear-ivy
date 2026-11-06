import { DATE_VIEWS } from '@/lib/views';

// The dashboard's sections, in the left rail. Read by components/shell/Nav.jsx
// through app/(dashboard)/layout.jsx; the admin app in dev/ui/ passes its own.
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
// is the half of the line in CLAUDE.md that is hers — a private space to
// think out loud — and the rows under it are where she goes, not what is stored. Whose the record is belongs in
// data/PROFILE.yaml, which is the one place a person is described; the rail has
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
//
// The machine's group left this rail on 2026-10-03 for an app of its own in
// dev/ui/ (WKB-002): what it says about itself is in dev/ui/lib/sections.js.
export const SECTIONS = [
  { label: null, items: [{ href: '/' }] },
  {
    label: 'The space',
    items: [
      // One row for both date views; Calendar is reached by the switch on the
      // page (dev/specs/ux/tabs/README.md), and the row stays lit there.
      { href: DATE_VIEWS[0].href, also: DATE_VIEWS.slice(1).map((v) => v.href) },
      { href: '/journal' },
      { href: '/people' },
      { href: '/therapy' },
      { href: '/loops' },
      { href: '/safety' },
    ],
  },
];

// The machine: the developer's views, in their own app under /admin where it
// is here (config/admin.mjs says whether). Their order and the reasons for it
// are in dev/ui/lib/sections.js. The list is written once, here, and that app
// builds its own rail from it: it may import from ux/, never the other way
// (ARC-008).
export const MACHINE_VIEWS = ['/backlog', '/agreements', '/evals', '/changes', '/workflow', '/specs', '/harness', '/codemap', '/stack'];
export const MACHINE_LABEL = 'The machine';

// The two dashboards never share a rail (WKB-002 design 1, 2026-10-10): hers
// lists only her views and the admin app's only the developer's. Where the
// admin app is here, a switch beside her name crosses between them: the shared
// Segmented, a glyph per side, the lit side saying which dashboard this is.
export const DASHBOARDS = [
  { key: 'user', href: '/', icon: 'user', title: 'User dashboard' },
  // Straight to the first view: /admin only redirects there, a second round
  // trip through both servers on every switch, and warming it warmed nothing.
  { key: 'admin', href: `/admin${MACHINE_VIEWS[0]}`, icon: 'terminal', title: 'Admin dashboard' },
];
