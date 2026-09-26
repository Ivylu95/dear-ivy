import { Empty, Enter, PageHead, Prose, SectionHead, Source } from '@/components/ui';
import { getTimeline } from '@/lib/content';
import TimelineList from './TimelineList';

export const dynamic = 'force-dynamic';

// The spine of the record, in the two tiers the file keeps: Eras to orient, then
// the entries.
//
// Entries run newest first here and oldest first in the file. The file is
// appended to, so oldest-first is right for it; a reader arriving at this page
// wants the most recent thing at the top. Both are correct for their own medium,
// and lib/content.js is where the flip happens.
export default async function Timeline() {
  const { eras, entries, tags, types, filled } = await getTimeline();

  return (
    <Enter>
      <PageHead
        route="/timeline"
        title="Timeline"
        sub="Everything that happened, in order. One line each."
      />

      {eras && (
        <>
          <SectionHead title="Eras" note="the shape of each period, not its contents" />
          <div className="card">
            <Prose html={eras} />
          </div>
        </>
      )}

      {filled ? (
        <>
          <SectionHead title="Entries" note={`${entries.length} on file`} />
          <TimelineList entries={entries} tags={tags} types={types} />
        </>
      ) : (
        <Empty title="Nothing on the timeline yet">
          Every event that matters gets one dated line here. Nothing has been added
          so far.
        </Empty>
      )}

      <Source path="data/timeline.md" />
    </Enter>
  );
}
