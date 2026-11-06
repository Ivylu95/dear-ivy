import Link from 'next/link';
import { Tag, Tags } from '@/components/ui';
import { dateLabel } from '@/lib/dates';
import { pronouns } from '@/lib/pronouns';
import { routeForFile } from '@/lib/views';

// One line of the timeline, wherever it is shown: the Timeline itself, Lately
// on Now, and a person's page (DES-001 design 3). Three hand-written copies had
// drifted apart: one said "their words" and one "her words" whatever the record
// held, and one printed the raw ISO date.
//
// TML-004: a line marked [inferred] is shown with a reading tag, the mark
// stripped from the sentence (test/read.test.mjs).
//
// TML-003: the told date shows beside the event date only when the entry has
// one (test/read.test.mjs).
//
// `p` is the record's pronoun set (lib/pronouns.js, from getPronouns), so the
// reading-not-words tag names the person the way the profile does. Left out,
// it falls back to the default set ("their") rather than failing the page.
export function TimelineEntry({ entry, p = pronouns() }) {
  const route = entry.file ? routeForFile(entry.file) : null;
  return (
    <article className="tl-item">
      <div className="tl-date">
        {dateLabel(entry.date)}
        {/* The gap between when something happened and when it was told.
            Surfaced rather than swallowed: it is the difference between a
            record of an event and a record of a disclosure. */}
        {entry.told && ` · told ${dateLabel(entry.told)}`}
      </div>
      <p className="tl-what">{entry.what.replace(/\[inferred\]\s*/i, '')}</p>
      {(entry.type || entry.tags?.length > 0 || entry.inferred) && (
        <Tags>
          {entry.type && <Tag kind="accent">{entry.type}</Tag>}
          {entry.tags?.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
          {/* The words are the record; a reading of them is not. */}
          {entry.inferred && <Tag kind="inferred">{`a reading, not ${p.possessive} words`}</Tag>}
        </Tags>
      )}
      {/* The pointer at the end of the line: the whole mechanism the timeline
          runs on, one line here and the detail in the file it names, so it has
          to be followable rather than merely parsed. Where this app has no view
          for the file, the path still shows, as text. */}
      {entry.file &&
        (route ? (
          <Link className="tl-file" href={route}>
            {entry.file}
          </Link>
        ) : (
          <span className="tl-file is-plain">{entry.file}</span>
        ))}
    </article>
  );
}
