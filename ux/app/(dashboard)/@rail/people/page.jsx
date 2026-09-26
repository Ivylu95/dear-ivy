import { RailNav } from '@/components/shell/RailNav';
import { getPeople } from '@/lib/content';

// The one contents list whose rows are routes rather than anchors.
//
// Every name here IS on this page — the view is that grid and nothing else — so
// the list is honest about what it indexes; it just opens the file instead of
// scrolling to the card. The scroll-spy has nothing to watch, which is why
// RailNav treats an href without a leading '#' as an ordinary link.
export default async function PeopleRail() {
  const items = (await getPeople()).map((p) => ({
    href: `/people/${p.slug}`,
    label: p.name,
  }));

  return <RailNav title="On this page" items={items} />;
}
