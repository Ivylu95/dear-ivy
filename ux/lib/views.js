// The glyph and the label for each view, in one place.
//
// Both are read twice: by the rail, where the glyph is the whole label once it
// collapses, and by the view's own header. Two literals in two files is how a
// rail row and the page it opens end up disagreeing about where you are.
export const VIEW_ICON = {
  '/': 'now',
  '/timeline': 'timeline',
  '/people': 'people',
  '/calendar': 'calendar',
  '/journal': 'journal',
  '/me': 'me',
  '/therapy': 'therapy',
  '/loops': 'loops',
  '/safety': 'safety',
  '/about': 'about',
  '/harness': 'harness',
  // A charter scroll: standing rules, written down and binding. See
  // `spec` in components/ui/icons.jsx.
  '/specs': 'spec',
  '/workflow': 'workflow',
  '/changes': 'history',
  '/backlog': 'layers',
  // Tiles of unequal size, for the code map: its first drawing is a treemap.
  '/codemap': 'codemap',
  // Blocks stacked on a base, for the tech stack: what the system stands on.
  '/stack': 'stack',
  // The developer's Agreements and Evals (WKB-002 design 4).
  '/agreements': 'agreement',
  '/evals': 'flask',
};

// The views that share one tab, in switch order, as Segmented options. The tab
// index lets a tab hold more than one view (dev/specs/ux/tabs/README.md); the
// rail shows the first and opens on it, and lights it on every view listed.
export const DATE_VIEWS = [
  { key: 'timeline', label: 'Timeline', href: '/timeline' },
  { key: 'calendar', label: 'Calendar', href: '/calendar' },
];

// Views that belong to an optional module (ARC-006), shown only while that
// module is switched on — see lib/modules.js. A view not listed here is core.
export const VIEW_MODULE = {
  '/therapy': 'therapy',
};

export const VIEW_LABEL = {
  '/': 'Now',
  '/timeline': 'Timeline',
  '/people': 'People',
  '/calendar': 'Calendar',
  '/journal': 'Journal',
  '/me': 'About me',
  '/therapy': 'Therapy',
  '/loops': 'Open loops',
  '/safety': 'Safety plan',
  '/about': 'About',
  '/harness': 'Harness',
  '/specs': 'Specs Register',
  '/workflow': 'Workflow',
  '/changes': 'Changes',
  '/backlog': 'For you',
  '/codemap': 'Code map',
  '/stack': 'Tech stack',
  '/agreements': 'Agreements',
  '/evals': 'Evals',
};

// A path out of the record, turned into a route in this app.
//
// Every timeline line ends with a pointer — `→ data/core/people/person-s.md` — and that
// pointer is the mechanism REC-02 names: a short orienting layer, with
// everything else reached by pointer rather than by sweeping the folder. The
// timeline view's own subtitle promises it ("the detail lives in the file it
// points at"), and for a while the pointer was parsed and then thrown away, so
// the page made a promise the reader could not act on.
//
// Returns null for anything with no view of its own. The caller then shows the
// path as plain text rather than a dead link — the pointer is still information
// even when this app has nowhere to send it.
export function routeForFile(path) {
  if (!path) return null;
  const clean = String(path)
    .trim()
    .replace(/^→\s*/, '')
    .replace(/^`|`$/g, '')
    .replace(/^\.?\/?data\//, '')
    // core's files sit under data/core/ (CORE_DATA in .claude/hooks/lib/modules.mjs,
    // not imported here because this file also reaches the browser). A module's
    // own files keep their folder, which is how therapy/ below is matched.
    .replace(/^core\//, '');

  // A person's front page, as a page or a folder (FND-004). The other files in a
  // person's folder have no view of their own.
  const person = /^people\/([^/]+?)(?:\.md|\/(?:README\.md)?)$/.exec(clean);
  if (person && person[1] !== 'README') return `/people/${person[1]}`;

  // Anchors match the ids the journal and therapy views give their entries,
  // which are the filenames without the extension.
  const journal = /^journal\/([^/]+)\.md$/.exec(clean);
  if (journal) return `/journal#${journal[1]}`;

  const session = /^therapy\/sessions\/([^/]+)\.md$/.exec(clean);
  if (session) return `/therapy#${session[1]}`;

  const me = /^me\/([^/]+)\.md$/.exec(clean);
  if (me) return `/me#${me[1]}`;

  if (clean === 'safety/safety_plan.md') return '/safety';
  if (clean === 'calendar/calendar.md') return '/calendar';
  if (clean === 'therapy/what_im_working_on.md') return '/therapy';
  if (clean === 'state/open_loops.md') return '/loops';

  return null;
}

// Longest-prefix match, so a person's own page reports the tab it lives under.
// '/' would prefix-match everything, so it only wins on an exact hit.
export function viewForPath(pathname) {
  if (pathname === '/') return '/';
  const hit = Object.keys(VIEW_LABEL)
    .filter((href) => href !== '/' && pathname.startsWith(href))
    .sort((a, b) => b.length - a.length)[0];
  return hit ?? null;
}

// A heading turned into a URL fragment.
//
// The right rail navigates within a view, which means every heading it lists has
// to be addressable. Deriving the id from the heading text rather than declaring
// one per page keeps the two from drifting: a heading that gets reworded takes
// its anchor with it, and a rail built from the same strings still points at it.
//
// The cost of that choice is that renaming a heading breaks any link someone had
// saved to it. Nothing in this app stores such a link — the rail rebuilds itself
// from the page on every request — so the trade is worth taking here and would
// not be somewhere with shared URLs.
//
// Slugged the way GitHub does it, deliberately: lowercase, everything but
// letters, digits, spaces, `_` and `-` dropped, each space to its own hyphen,
// letters outside ASCII kept. The same file is read on GitHub and in this app,
// and a link that works in one place and not the other is worse than one that
// works nowhere, because only half the readers find out. So a spec row's heading
// `PRD-001 • 🌙⚡🎒` lands at `#prd-001--` here as there.
//
// One function for the whole app, and no truncation: lib/markdown.js gave a
// rendered heading its id with a GitHub-style slug while the rails linked to it
// through a second slug cut at sixty characters, so a long heading carried two
// anchors and its rail link missed.
export function slugify(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}
