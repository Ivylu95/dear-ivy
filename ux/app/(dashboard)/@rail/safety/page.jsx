import { RailNav } from '@/components/shell/RailNav';
import { getSafetyPlan } from '@/lib/content';
import { slugify } from '@/lib/views';

// The plan's own sections, in the order the view renders them — which is the
// order lib/content.js puts them in, not the order the file keeps them.
//
// The numbers are always the first row, and they are the first row because they
// are the first thing on the page. On a night when reading is hard, the contents
// list beside a long plan is how she gets to "what helps" without scrolling past
// everything between here and there.
export default async function SafetyRail() {
  const plan = await getSafetyPlan();
  if (!plan) return null;

  const items = [
    { href: '#if-you-need-help-right-now', label: 'If you need help right now' },
    // Only once there is a plan under the numbers. Before that the view renders
    // one empty state and no headings, so there is nothing to point at.
    ...(plan.filled
      ? plan.sections.map((s) => ({ href: `#${slugify(s.heading)}`, label: s.heading }))
      : []),
  ];

  return <RailNav title="On this page" items={items} />;
}
