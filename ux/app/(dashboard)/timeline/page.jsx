import { Card, Empty, Enter, PageHead, Prose, SectionHead, Source } from '@/components/ui';
import { Segmented } from '@/components/ui/Segmented';
import { getPronouns, getTimeline } from '@/lib/content';
import { DATE_VIEWS } from '@/lib/views';
import TimelineList, { filterFrom } from './TimelineList';

export const dynamic = 'force-dynamic';

// The spine of the record, in the two tiers the file keeps: Eras to orient, then
// the entries (TML-001). The Eras render whole, above and apart from the
// filters, which touch only the entries; test/read.test.mjs holds both.
//
// Entries run newest first here and oldest first in the file. The file is
// appended to, so oldest-first is right for it; a reader arriving at this page
// wants the most recent thing at the top. Both are correct for their own medium,
// and lib/content.js is where the flip happens.
export default async function Timeline({ searchParams }) {
  const { eras, entries, tags, types, filled } = await getTimeline();
  const { tag, type } = filterFrom(await searchParams, { tags, types });
  const p = await getPronouns();

  return (
    <Enter>
      <PageHead
        route="/timeline"
        title="Timeline"
        sub="Everything that happened, in order. One line each."
      >
        <Segmented options={DATE_VIEWS} current="timeline" label="View dates as" />
      </PageHead>

      {eras && (
        <>
          <SectionHead title="Eras" note="the shape of each period, not its contents" />
          <Card>
            <Prose html={eras} />
          </Card>
        </>
      )}

      {filled ? (
        <>
          <SectionHead title="Entries" />
          <TimelineList entries={entries} tags={tags} types={types} tag={tag} type={type} p={p} />
        </>
      ) : (
        <Empty title="Nothing on the timeline yet">
          Every event that matters gets one dated line here. Nothing has been added
          so far.
        </Empty>
      )}

      <Source path="data/core/timeline.md" />
    </Enter>
  );
}
