import { RailNav } from '@/components/shell/RailNav';
import { slugify } from '@/lib/views';

// The four sections of the Workflow view.
//
// Written out rather than derived, because the page beside it is prose and holds
// no data either of them could read — a parallel route cannot be handed anything
// by the page it sits next to. The titles are run through the same slugify the
// page's own SectionHead uses, so a reworded heading keeps its anchor and this
// list keeps pointing at it.
const SECTIONS = ['The loop', 'Where it lands', 'What shapes it', 'What always holds'];

export default function WorkflowRail() {
  const items = SECTIONS.map((title) => ({ href: `#${slugify(title)}`, label: title }));

  return <RailNav title="On this page" items={items} />;
}
