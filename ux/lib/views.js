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
  // An inbox tray: the queue the agent fills and a person clears. See `inbox`
  // in components/ui/icons.jsx.
  '/review': 'inbox',
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
  '/specs': 'Specs',
  '/workflow': 'Workflow',
  '/changes': 'Changes',
  '/review': 'Review',
};

// A path out of the record, turned into a route in this app.
//
// Every timeline line ends with a pointer — `→ data/people/sam.md` — and that
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
    .replace(/^\.?\/?data\//, '');

  const person = /^people\/([^/]+)\.md$/.exec(clean);
  if (person) return `/people/${person[1]}`;

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
export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}
