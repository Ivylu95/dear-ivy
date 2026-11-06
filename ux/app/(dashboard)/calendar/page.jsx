import { Empty, Enter, PageHead, SectionHead, Source, Tag, Tags, dateLabel, untilLabel } from '@/components/ui';
import { Segmented } from '@/components/ui/Segmented';
import { Row } from '@/components/ui/Row';
import { getCalendar, getToday } from '@/lib/content';
import { DATE_VIEWS } from '@/lib/views';

export const dynamic = 'force-dynamic';

// What is coming, and the dates that land hard every year. The second view of
// the Timeline tab: the rail opens on Timeline, so these dates show only once
// she switches here (CAL-001).
//
// ── Why the hard anniversaries are shown the way they are ───────────────────
//
// CLAUDE.md asks the agent to know when it is inside a fortnight of one, be
// gentler, and NOT announce it. That instruction is about a conversation, and it
// does not transfer unchanged to a page she opened on purpose: a date she chose
// to look up should not be hidden from her.
//
// So the compromise is that this view SHOWS them and does not COUNT DOWN to
// them. A date and how she wants it handled, in the same quiet type as every
// other row — never "6 days away" in amber, which would turn a page she can
// close into a thing that follows her around. The fortnight window is computed
// in lib/content.js and used by the agent; nothing on this page renders it.
export default async function Calendar() {
  const { upcoming, passed, hard, good, filled } = await getCalendar();
  const today = await getToday();

  if (!filled) {
    return (
      <Enter>
        <PageHead
          route="/calendar"
          title="Calendar"
          sub="What's coming, and the dates that land hard."
        />
        <Empty title="Nothing on the calendar yet">
          Appointments, deadlines, trips and birthdays land here as they come up.
        </Empty>
        <Source path="data/core/calendar/calendar.md" />
      </Enter>
    );
  }

  return (
    <Enter>
      <PageHead
        route="/calendar"
        title="Calendar"
        sub="What's coming, and the dates that land hard."
      >
        <Segmented options={DATE_VIEWS} current="calendar" label="View dates as" />
      </PageHead>

      <SectionHead title="Coming up" />
      {upcoming.length === 0 ? (
        <Empty title="Nothing coming up">Anything with a date lands here first.</Empty>
      ) : (
        upcoming.map((item) => (
          <Row
            key={`${item.date}-${item.what}`}
            title={item.what}
            meta={untilLabel(item.date, today)}
            details={[dateLabel(item.date), item.notes]}
          />
        ))
      )}

      {/* Already happened, still in the file. An entry moves to the timeline
          during a session, and sessions do not run on the day a thing happens, so
          this gap is normal rather than a lapse — and the rows are shown rather
          than hidden, because "did I actually go?" is a real question. */}
      {passed.length > 0 && (
        <>
          <SectionHead title="Just gone" note="not yet moved to the timeline" />
          {passed.map((item) => (
            <Row
              key={`${item.date}-${item.what}`}
              title={item.what}
              meta={untilLabel(item.date, today)}
              details={[dateLabel(item.date), item.notes]}
              past
            />
          ))}
        </>
      )}

      {hard.length > 0 && (
        <>
          {/* The first recurring section carries the plain "every-year" anchor
              the rail links to; slugged from its own title it would be
              every-year-the-hard-ones, and the rail's row would go nowhere. */}
          <SectionHead title="Every year — the hard ones" id="every-year" />
          {hard.map((item) => (
            <Row key={`${item.when}-${item.what}`} title={item.what} meta={item.when} details={[item.handling]} />
          ))}
        </>
      )}

      {good.length > 0 && (
        <>
          <SectionHead
            title="Every year — the good ones"
            id={hard.length ? undefined : 'every-year'}
          />
          {good.map((item) => (
            <Row key={`${item.when}-${item.what}`} title={item.what} meta={item.when}>
              <Tags>
                <Tag kind="ok">worth remembering warmly</Tag>
              </Tags>
            </Row>
          ))}
        </>
      )}

      <Source path="data/core/calendar/calendar.md" />
    </Enter>
  );
}
