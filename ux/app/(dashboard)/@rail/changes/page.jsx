import { RailNav } from '@/components/shell/RailNav';
import { dateLabel } from '@/lib/dates';
import { byDay, getHistory, queryFrom } from '@/lib/git';

export const dynamic = 'force-dynamic';

// The days, as anchors. The same job the journal's rail does, for the same
// reason: the page is one long scroll whose only structure is dates, so without
// this the only way back to last Tuesday is the scrollbar.
//
// It asks for the log independently of the page beside it, because that is what
// a parallel route is — neither can hand the other anything.
//
// ── Why it reads the query string rather than taking the default ────────────
//
// Because the list beside it is filterable, and a rail that always asked for the
// unfiltered log listed days the page was not showing, with counts that did not
// match the headings — "40" in the rail against a heading reading "29 commits",
// two numbers for one day on one screen. A contents list that disagrees with its
// contents is worse than no contents list.
//
// Reading the same query through the same helper also costs nothing. getHistory
// is deduped by React's cache() on the three primitives it unpacks, so the page
// and the rail asking the identical question is one `git log` rather than two —
// and asking DIFFERENT questions was the expensive half of the same bug.
export default async function ChangesRail({ searchParams }) {
  const { ok, commits } = await getHistory(queryFrom(await searchParams));
  if (!ok) return null;

  const items = byDay(commits).map((day) => ({
    href: `#day-${day.day}`,
    label: dateLabel(day.day),
    meta: String(day.commits.length),
  }));

  return <RailNav title="On this page" items={items} />;
}
