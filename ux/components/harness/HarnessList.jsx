import Link from 'next/link';
import { Icon } from '@/components/ui/icons';
import { Empty } from '@/components/ui';
import { Reading } from '@/components/ui/Reading';
import { markFor } from '@/lib/harness-marks';

// A folder of the harness, as rows.
//
// The same list renders the overview and every folder under it, which is the
// point: the harness is a tree, and a tree that changes its appearance by depth
// makes the reader re-learn it at every level. One row shape, all the way down.
//
// Each row is a folder or a file, and carries the one line that says what it is
// — a skill's own `description:`, or the first paragraph of a spec. That line is
// what makes this a list worth reading rather than a directory: `a-person` says
// nothing, and "a conversation centred on someone in her life" says the whole
// thing.
//
// A server component. It renders what the page already read, and fetches
// nothing.

// How many things are inside, said as a phrase rather than as a bare number.
//
// The number alone was ambiguous in the one way this list cannot afford: `14`
// beside a name reads as an index, a version, an id — anything. "14 files" can
// only mean a container, so the right-hand column carries the folder/file
// distinction instead of merely decorating it. A file gets nothing there at all,
// which is its own answer.
function holds(n) {
  if (!n) return 'empty';
  return n === 1 ? '1 file' : `${n} files`;
}

export function HarnessList({ entries }) {
  if (!entries?.length) {
    return (
      <Empty title="Nothing in here yet">
        This folder is part of the harness but holds no files — scaffolding for
        something not written yet.
      </Empty>
    );
  }

  const folders = entries.filter((entry) => entry.kind === 'dir');
  const files = entries.filter((entry) => entry.kind === 'file');

  // Labelled only when the distinction is live.
  //
  // A folder holding nothing but files has nothing to tell apart, and a heading
  // over a list of one kind is a heading that says what you can already see.
  // Where both are present the labels do the work the glyph used to: each mark
  // is now chosen for what that particular thing IS — a bolt for the hooks, a
  // plumb bob for the specs — which is more useful per row and says nothing
  // about folder or file. This puts that back, once per group rather than once
  // per row.
  const split = folders.length > 0 && files.length > 0;

  if (!split) return <Rows entries={entries} />;

  return (
    <>
      <p className="harness-group">
        {folders.length === 1 ? '1 folder' : `${folders.length} folders`}
      </p>
      <Rows entries={folders} />
      <p className="harness-group">{files.length === 1 ? '1 file' : `${files.length} files`}</p>
      <Rows entries={files} />
    </>
  );
}

function Rows({ entries }) {
  return (
    <div className="harness-list">
      {entries.map((entry) => (
        <Link key={entry.path} href={entry.href} className="harness-row" data-kind={entry.kind}>
          {/* The mark says what this particular thing IS where one is known — a
              bolt for the hooks, a plumb bob for the specs — and falls back to
              the plain folder or file where none is. Which means it no longer
              carries folder-or-file on the rows that have a bespoke mark; the
              group label above and the phrase on the right do that. */}
          {/* Sized to the row rather than to the name. A 16px glyph beside a
              two-line row was a footnote against the first line of it; at the
              height of the pair it becomes the row's mark — the thing the eye
              lands on first when running down a folder. */}
          <Icon name={markFor(entry)} size={26} className="harness-mark" />
          <span className="harness-what">
            <span className="harness-name">
              {entry.name}
              {entry.kind === 'dir' ? '/' : ''}
            </span>
            {/* The hand-written line where there is one, the entry's own
                first paragraph otherwise. GLOSS in lib/harness.js says what a
                top-level folder is FOR, which is the one thing a filename
                cannot; below the top level there is no gloss and the file
                speaks for itself. */}
            {(entry.gloss ?? entry.description) && (
              <span className="harness-desc">{entry.gloss ?? entry.description}</span>
            )}
          </span>
          {/* Always rendered, empty or not. Left conditional, the column
              collapsed on every row without a count and the chevron beside it
              moved — so a list of folders and files had its right edge in two
              places, which reads as two kinds of row rather than one list. */}
          <span className="harness-n">{entry.count != null ? holds(entry.count) : ''}</span>
          <Icon name="chevron" size={13} className="harness-chevron" />
          {/* Says the row has been clicked and not yet arrived. Every route under
              /harness is a server component reading files at request time, so
              there is a real gap after the click — and in that gap the pointer
              has usually already moved off the row, taking the hover mark with
              it, which leaves nothing on screen answering for the click.

              The dot it draws is hidden here (see globals.css): this row is a
              paragraph tall and has its own furniture to say it with — the edge
              marker holds, the ground stays up, the chevron travels. What is
              wanted from this component is the attribute, not the dot. */}
          <Reading />
        </Link>
      ))}
    </div>
  );
}
