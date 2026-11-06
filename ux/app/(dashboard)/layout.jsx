import Shell from '@/components/shell/Shell';
import { getIdentity, getNavCounts } from '@/lib/content';
import { hiddenViews } from '@/lib/modules';
import { ADMIN_PRESENT } from '@/config/admin.mjs';
import { SECTIONS } from '@/lib/sections';

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

// Her record's views only, and a switch beside her name to the developer's app
// where it is here (DASHBOARDS): its views are served at /admin by that app,
// not this one, and never listed in this rail (WKB-002).
export default async function DashboardLayout({ children, rail }) {
  return (
    <Shell rail={rail} sections={SECTIONS} dashboard={ADMIN_PRESENT ? 'user' : null} counts={await getNavCounts()} hidden={hiddenViews()}>
      {children}
    </Shell>
  );
}
