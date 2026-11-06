import Link from 'next/link';
import { Empty, Enter, PageHead, Prose, SectionHead, Source, Tag, dateLabel, untilLabel } from '@/components/ui';
import { getHome, getPronouns, getToday } from '@/lib/content';
import { agree } from '@/lib/pronouns';
import { slugify } from '@/lib/views';

export const dynamic = 'force-dynamic';

// The home view is the same read a session does, rendered: now.md first, then the
// timeline, then what those point at. Anything else would be a second opinion
// about what matters, and the record already has one.
//
// What is deliberately NOT here: any count of her. No entries this month, no
// sessions held, no days since the last one. The reasoning is at the bottom of
// components/ui/index.jsx and it is the single firmest rule in this app.
export default async function Home() {
  const { now, recent, timelineFilled, calendar, loops, people, focus, blank, lastSession } =
    await getHome();
  const p = await getPronouns();

  // Before anything real is on file, the surface changes shape rather than
  // showing eight empty panels. Eight empty panels read as a broken system; one
  // sentence reads as a record that has not started, which is the truth.
  if (blank) {
    return (
      <Enter>
        <PageHead
          route="/"
          title="Nothing yet"
          sub="Fills itself in as you talk. Nothing to file."
        />
        <Empty title="The record starts from the next conversation">
          Whatever you say gets written down where it belongs — what happened, who
          it involved, what helped. This page is where you come back to read it.
        </Empty>
        {now?.filled && (
          <>
            <SectionHead title="Where things stand" note={now.updated ? dateLabel(now.updated) : null} />
            {now.sections
              .filter((s) => s.filled)
              .map((s) => (
                <section key={s.heading} id={slugify(s.heading)} className="card">
                  <h2 className="card-heading">{s.heading}</h2>
                  <Prose html={s.html} />
                </section>
              ))}
            <Source path="data/state/now.md" />
          </>
        )}
      </Enter>
    );
  }

  const upcoming = calendar.upcoming.slice(0, 4);
  const today = await getToday();
  const forTherapist = loops.groups.find((g) => /appointment/i.test(g.heading));

  return (
    <Enter>
      <PageHead
        route="/"
        title="Now"
        sub={
          lastSession
            ? `Where things stand, as of ${dateLabel(lastSession)}.`
            : 'Where things stand, before anything is written down.'
        }
      />

      {/* now.md, section by section rather than as one blob. "How she's doing" is
          the first heading in the file and carries the most, so it gets its own
          card at the top and the rest sit under it in the order the file keeps
          them. The file decides the order; this just renders it. */}
      {now?.filled ? (
        now.sections
          .filter((s) => s.filled)
          .map((s) => (
            <section key={s.heading} id={slugify(s.heading)} className="card">
              <h2 className="card-heading">{s.heading}</h2>
              <Prose html={s.html} />
            </section>
          ))
      ) : (
        <Empty title="No snapshot written yet">
          The current picture gets rewritten at the end of every conversation.
        </Empty>
      )}
      <Source path="data/state/now.md" />

      {/* Coming up. Above the timeline because what is ahead is the thing a
          snapshot cannot tell you and the thing most likely to need thinking
          about before it arrives. */}
      {upcoming.length > 0 && (
        <>
          <SectionHead title="Coming up" note={<Link href="/calendar">all dates</Link>} />
          {upcoming.map((item) => (
            <div key={`${item.date}-${item.what}`} className="row">
              <div className="row-head">
                <span className="row-title">{item.what}</span>
                <span className="row-meta">{untilLabel(item.date, today)}</span>
              </div>
              <div className="meta-line">
                <span>{dateLabel(item.date)}</span>
                {item.notes && <span>{item.notes}</span>}
              </div>
            </div>
          ))}
        </>
      )}

      {/* What she meant to say to her therapist and has not.

          This is on the home view and not only under Open loops for one reason:
          it is written verbatim, ready for the next appointment, and it is
          useless if it is only found by someone who went looking for it. */}
      {forTherapist && forTherapist.items.some((i) => !i.done) && (
        <>
          <SectionHead
            title="For the next appointment"
            note={<Link href="/loops">open loops</Link>}
          />
          <div className="card">
            <ul className="bullets">
              {forTherapist.items
                .filter((i) => !i.done)
                .map((item) => (
                  <li key={item.text}>{item.text}</li>
                ))}
            </ul>
          </div>
          <Source path="data/state/open_loops.md" />
        </>
      )}

      <SectionHead title="Lately" note={<Link href="/timeline">the whole timeline</Link>} />
      {timelineFilled ? (
        <div className="tl">
          {recent.map((entry) => (
            <article key={`${entry.date}-${entry.what}`} className="tl-item">
              <div className="tl-date">
                {dateLabel(entry.date)}
                {entry.told && ` · told ${dateLabel(entry.told)}`}
              </div>
              <p className="tl-what">{entry.what.replace(/\[inferred\]\s*/i, '')}</p>
              <div className="tags">
                {entry.type && <Tag kind="accent">{entry.type}</Tag>}
                {entry.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
                {/* Her words are the record; a reading of them is not. */}
                {entry.inferred && <Tag kind="inferred">a reading, not her words</Tag>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No events on the timeline yet">
          Anything that happens gets one dated line here, pointing at wherever the
          detail lives.
        </Empty>
      )}

      {focus?.filled && (
        <>
          <SectionHead title={`What ${p.subject} ${agree(p, 'be')} working on`} note={<Link href="/therapy">therapy</Link>} />
          <div className="card">
            <Prose html={focus.html} />
          </div>
          <Source path="data/therapy/what_im_working_on.md" />
        </>
      )}

      {people.length > 0 && (
        <>
          <SectionHead title="People" note={<Link href="/people">everyone on file</Link>} />
          <div className="grid-2">
            {people.slice(0, 6).map((person) => (
              <Link key={person.slug} href={`/people/${person.slug}`} className="row">
                <div className="row-head">
                  <span className="row-title">{person.name}</span>
                </div>
                {person.relation && (
                  <div className="meta-line">
                    <span>{person.relation}</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </Enter>
  );
}
