import { RailFacts } from '@/components/shell/RailFacts';
import { RailNav } from '@/components/shell/RailNav';
import { slugify } from '@/lib/views';
import { DOC_TOP } from '@/lib/harness-anchors';
import { folderRows } from '@/lib/harness-facts';
import { getFolderDates } from '@/lib/git';
import { changedLabel } from '@/lib/dates';
import { sizeLabel } from '@/lib/bytes';

// The headings of whatever document is open.
//
// One job, now the tree sits in the middle column: a folder's contents are in
// the index beside the panel, so the rail no longer lists those. What the index
// cannot show is the INSIDE of a file, and that is where this earns its keep —
// CLAUDE.md and the architecture spec are the longest documents in the
// repository and are almost always opened for one specific rule; a contents list
// turns that from a scroll into a click.
//
// The anchors come from the same slugify() the panel's SectionHead uses, so the
// two cannot drift.
export async function FolderPathRail({ params, view }) {
  const { path } = await params;
  const entry = view.getPath((path ?? []).join('/'));

  // When this last changed, from the history rather than from the filesystem —
  // see getFolderDates(). One git call dates every file in the harness, and
  // react's cache means the rail and anything else asking share the one answer.
  //
  // A file with no date has never been committed, which is worth showing as an
  // absence rather than as a guess: the row simply does not appear.
  const changed = (await getFolderDates(view.folder)).get(entry.path);

  if (entry.kind === 'doc') {
    // Sections, and under each the rows of any table it holds.
    //
    // A spec's substance is its table, and the unit anyone refers to is a row:
    // ARCHITECTURE.md says "always cite a row by both its ID and its spec
    // statement". A contents list that stopped at `## Specifications Register`
    // therefore stopped one level above everything the document is opened for —
    // seventeen ARC rows behind a single line, none of them reachable.
    //
    // Flattened rather than nested, with a depth marker. See RailNav.
    // The document itself leads the list, and everything in it is indented one
    // step under it.
    //
    // Without that row there was no way to name where you were when you were at
    // the top of a spec, and no way to get back to it: the first row was the
    // first SECTION, so a reader who had scrolled was offered every part of the
    // document except its beginning — which is the part that says what the
    // document is and, in ARCHITECTURE.md, the rule about not editing it.
    //
    // It also makes the list say the shape it actually has. `Purpose and Scope`
    // and `ARC-003` sat one indent apart as though the register were a peer of
    // the sections rather than inside one; with the document at the top the
    // three levels on screen are the three levels in the file.
    const items = [
      { href: `#${DOC_TOP}`, label: entry.title },
      // Rows above the first heading come next, because that is where they are.
      // `search` is what the row says, which is not what the row is called —
      // see tableRows() in lib/harness.js. A label is `ARC-003`; the filter in
      // the rail needs words, and this is where they come from.
      ...(entry.leadRows ?? []).map((row) => ({
        href: `#${row.id}`,
        label: row.label,
        search: row.text,
        depth: 1,
      })),
      ...entry.sections.flatMap((section) => [
        { href: `#${slugify(section.heading)}`, label: section.heading, depth: 1 },
        ...section.rows.map((row) => ({
          href: `#${row.id}`,
          label: row.label,
          search: row.text,
          depth: 2,
        })),
      ]),
    ];
    return (
      <>
        {/* What is true ABOUT the document, above the way into it.
            
            Same order as the source view below: the facts, then the contents.
            They answer different questions and the facts answer theirs faster —
            "how big is this and how much of it is binding" is a decision about
            whether to read now, and it should not be reached by scrolling past
            twenty rules to find out there are twenty rules.
            
            Every row hides itself when it has nothing to say, so a two-hundred
            word skill with no register and no citations shows its length and
            stops, rather than printing two zeroes to fill a shape. */}
        <RailFacts
          title="This file"
          rows={[
            { label: 'Lines', value: entry.lines?.toLocaleString('en') ?? null },
            { label: 'Words', value: entry.words?.toLocaleString('en') ?? null },
            // Last, as it is on a folder: the only row that is not a count, and
            // the only one that answers for the whole file at once.
            { label: 'Size', value: sizeLabel(entry.bytes) },
            { label: 'Changed', value: changed ? changedLabel(changed) : null },
          ]}
        />
        {/* Unless the document itself is the only thing in it.

            Every doc gets a row for its own head, which is what makes "Top"
            land somewhere named — but a file with no `##` and no register has
            nothing under that row, and a contents list of one entry pointing at
            the top of the page you are already on is furniture with no job.
            Three files in the harness are like this today; a short skill is
            supposed to be.

            The facts above stand on their own in that case, which is the right
            answer: how long it is, is the only thing left to say about it. */}
        {items.length > 1 && <RailNav title="On this page" items={items} />}
        <Referenced entry={entry} />
      </>
    );
  }

  // A source file: what is true of it, then a way into it.
  //
  // The facts come first because they are two or three short rows and they say
  // what you are looking at; the contents list under them is the working tool
  // and wants the run of the column. Both are .rail-card, so .rail-sticky's own
  // 28px gap separates them and neither has to know the other is there.
  //
  // The hooks divide themselves with `// ── Heading ───`, the same rule this
  // repository's own modules and stylesheet use, and a formatted JSON file
  // divides itself at its top-level keys. Both are marked in lib/harness-code.js
  // and carried here, so hook.mjs — 250 lines and four sections — is navigable
  // for the same reason a spec is, rather than being the one kind of file you
  // have to scroll.
  if (entry.kind === 'code') {
    return (
      <>
        <RailFacts
          title="File"
          rows={[
            // The moment a hook fires, where the file names one. First, because
            // it is the only row here that changes what the file DOES.
            { label: 'Runs on', value: entry.event },
            { label: 'Format', value: entry.lang },
            { label: 'Lines', value: entry.lines?.toLocaleString('en') ?? entry.lines },
            { label: 'Size', value: sizeLabel(entry.bytes) },
            { label: 'Changed', value: changed ? changedLabel(changed) : null },
          ]}
        />

        {/* Nothing is invented. A file with no dividers gets no contents list,
            which is the honest answer for a forty-line hook that is one idea
            from top to bottom — the facts above it still stand. */}
        {entry.marks?.length > 0 && (
          <RailNav
            title="In this file"
            items={entry.marks.map((mark) => ({ href: `#${mark.id}`, label: mark.label }))}
          />
        )}
      </>
    );
  }

  // A folder has nowhere to jump to — its contents are in the middle column's
  // index, and a second list of the same names is how a reader stops trusting
  // either — but it is still a thing with facts about it, and those are what the
  // index cannot give: it shows `specs/` as one row and says nothing about the
  // twenty-four files under it.
  //
  // Counted through the whole subtree, deliberately. The listing beside this
  // already heads its own groups "6 folders" and "4 files", so the top level is
  // on screen twice over if this repeats it. What is worth a margin is the total
  // weight of the thing you are standing in.
  if (entry.kind === 'dir') {
    return (
      <>
        <RailFacts title="This folder" rows={folderRows(entry.stats, changed)} />
        <Referenced entry={entry} />
      </>
    );
  }

  // A file this view will not open. Nothing to jump to and nothing read, so
  // inventing rows for a rail is how a rail stops being trustworthy.
  return null;
}

// Who points at this file, as rows that open them.
//
// The one thing neither column can otherwise say. The tree beside the panel
// knows what is NEXT to what; it cannot know what LEANS on what, and in a set of
// documents that cite each other that is the fact you want before you change
// one. `specs/REFERENCES.md` is cited from six other specs — editing it is a
// six-document decision, and nothing on the page said so.
//
// RailNav rather than a list of its own: it already renders plain links for the
// one other view that needs them, and borrowing it means these rows fold, indent
// and highlight exactly as the contents list above them does. Its scroll spy
// stands down on its own, because nothing here starts with '#'.
//
// Labelled by path, not by title. Three files in the harness are called
// README.md and two are called data.md; a column of names would be a column of
// ambiguities, and the path is the thing that opens.
function Referenced({ entry }) {
  return (
    <>
      <Links name="referenced-by" title="Referenced by" refs={entry.referencedBy} />
      {/* The same graph read the other way, and second: what points AT this is
          what you need before changing it, and what it points at is where you go
          next. A reader arrives here asking the first question far more often
          than the second. */}
      <Links name="references" title="References" refs={entry.references} />
    </>
  );
}

function Links({ name, title, refs }) {
  if (!refs?.length) return null;
  return (
    <RailNav
      name={name}
      title={title}
      items={refs.map((ref) => ({ href: ref.href, label: ref.path }))}
    />
  );
}
