import { notFound } from 'next/navigation';
import { HarnessList } from '@/components/harness/HarnessList';
import {
  Banner,
  Crumbs,
  Empty,
  Enter,
  PageHead,
  Prose,
  SectionHead,
  Tag,
} from '@/components/ui';
// The same mark the tree and the overview give this entry, so a file wears one
// glyph everywhere it appears. Hard-coded here as `file` and `folder`, the head
// of a document was the one place in the harness that said nothing about what it
// was looking at: ARCHITECTURE.md is a pair of dividers in both columns and a
// blank page at the top of its own page.
import { markFor } from '@/lib/harness-marks';
import { slugify } from '@/lib/views';
import { DOC_TOP } from '@/lib/harness-anchors';

// Everything below a folder tab — /harness or /specs: a folder to list, or a
// file to read. `view` is the folder's reader from lib/harness.js; the route
// files under app/ are one line each around this.
//
// One route for both, and for every depth, because the harness is a tree and a
// tree does not change shape at level three. `specs` lists,
// `specs/dashboard` lists, `specs/dashboard/design.md` renders —
// same route, same furniture, no special case per area. The alternative is a
// page per folder, which drifts the day someone adds a folder and forgets.
//
// The URL is the file path, deliberately. `/harness/skills/check-in/SKILL.md` is
// the thing it shows, extension and all. That is the same instinct as the
// <Source> line at the foot of the record's views: a record whose provenance
// you cannot see is just a screen telling you things. Here the provenance is
// the address bar and the breadcrumb, so the page carries no <Source> line.
//
// ── The boundary ────────────────────────────────────────────────────────────
//
// Every segment here arrives from the address bar, which makes this the one
// route in the app taking a filesystem path from a stranger. lib/harness.js
// resolves it and refuses anything landing outside `.claude/` — compared after
// resolution, so `..`, an absolute path and their encoded forms are all the same
// question with the same answer. Refused paths come back as `missing` rather
// than as an error that says why, because "that exists but you may not have it"
// is free information about a filesystem.
export async function FolderPath({ params, view }) {
  const { path } = await params;
  const entry = view.getPath((path ?? []).join('/'));
  const { route } = view;

  if (entry.kind === 'missing') notFound();

  // What a document calls itself, where that is not just its filename again.
  //
  // ARCHITECTURE.md opens `# Architecture [ARC]`. That is the document's title
  // and it belongs where a title goes — so it takes the heading, and the
  // FILENAME moves up into the breadcrumb where the rest of its path already
  // is. The header then reads as one thing: the path to the file, then what the
  // file is called.
  // A document opens `# Architecture [ARC]`; a folder is named by whatever
  // SKILL.md or README.md it keeps, or failing that by its own tidied name. See
  // folderTitle() in lib/harness.js.
  const ownName =
    entry.kind === 'dir'
      ? entry.title
      : entry.kind === 'doc' && entry.title && entry.title !== entry.name
        ? entry.title
        : null;

  // Named for the folder rather than for the section: the trail reads
  // `.claude / specs / dashboard /`, which is a path someone could type, and
  // the root is the one crumb that used to translate itself into a word. Bare,
  // with no slash of its own — Crumbs draws a .crumb-sep after every crumb, so
  // a label ending in one would double it.
  //
  // The entry joins the trail whenever something else is taking the title —
  // every folder, and every document that heads itself. A settings.json or a
  // hook has no heading inside it, so its filename stays the title and the trail
  // stops short: putting the name in both places would print it twice, an inch
  // apart, in two sizes.
  const crumbs = [
    { href: route, label: view.folder },
    ...entry.crumbs,
    ...(ownName ? [{ href: view.href(entry.path), label: entry.name, current: true }] : []),
  ];

  return (
    <Enter>
      <Crumbs items={crumbs} />

      {entry.kind === 'dir' && <Folder entry={entry} title={ownName} route={route} />}
      {entry.kind === 'doc' && <Doc entry={entry} docTitle={ownName} route={route} />}
      {entry.kind === 'code' && <Code entry={entry} route={route} />}
      {entry.kind === 'opaque' && <Opaque entry={entry} route={route} />}
    </Enter>
  );
}

// A folder. Its gloss becomes the subtitle where it has one, because that is the
// sentence already written to explain this folder and there is no point writing
// a second one here. Below the top level there is none, and the listing speaks
// for itself.
function Folder({ entry, title, route }) {
  return (
    <>
      {/* Titled with what the folder calls itself — the heading of the SKILL.md
          or README.md it keeps, or its own tidied name where it keeps neither.
          
          It used to be the directory name with a trailing slash, which was right
          while the trail stopped short of the folder and ran INTO the title. Now
          the folder sits in the trail like a file does, so the title is free to
          be the thing no filename can say: `skills/first-contact` is "First
          contact — when the record is empty", and no rule applied to a
          directory name would ever have produced that. The old note follows, for
          the rule the fallback still keeps: The claim this whole view makes is that it shows you
          `.claude/`; a heading that quietly retitled `specs` to "Specs" would be
          the one place it stopped being true.

          The slash is spaced off the name here, as it is in the breadcrumb
          above: at heading size a tight slash reads as part of the last letter,
          and this one is doing the work of saying "a folder". */}
      <PageHead route={route} icon={markFor(entry)} title={title} sub={entry.gloss} />
      <HarnessList entries={entry.entries} />
    </>
  );
}

// A markdown file, rendered.
//
// Split into its `##` sections rather than poured out as one block, for the same
// reason every other view here is: SectionHead anchors itself, so the right rail
// can navigate a two-thousand-word spec without the page having to declare a
// single target. CLAUDE.md is the file this matters most for — it is the longest
// document in the harness and the one most often read for one specific rule.
//
// The lead — anything before the first `##` — keeps its own card. In most files
// here that is the paragraph that says what the document is for, and burying it
// under the first heading would hide the part that orients you.
function Doc({ entry, docTitle, route }) {
  // The filename, not the document's own H1.
  //
  // The breadcrumb ends in a slash on purpose — see Crumbs in components/ui/index.jsx
  // — because the trail runs INTO the title, and the two together spell the path
  // to what you are reading: `.claude / commands /` then `check-work.md`.
  //
  // That only works if the title is the last segment of the path. It was the H1
  // instead, and check-work.md opens with a slash command, so the line came out
  // as `.claude / commands /` then `/check-work` — two slashes colliding, and a
  // title that looked like a path segment without being one.
  //
  const sub = entry.meta.description ?? null;
  const hasLead = entry.lead.trim().length > 0;

  return (
    <>
      {/* The id makes the document's own head the first thing the rail can
          reach. DOC_TOP is shared with the rail so the two cannot drift. */}
      <PageHead
        id={DOC_TOP}
        route={route}
        icon={markFor(entry)}
        title={docTitle ?? entry.name}
        sub={sub}
      >
        {/* A skill's frontmatter name is what dispatch matches on, and it is not
            always what the file is called. Where they differ, the one the
            harness actually uses is the one worth showing. */}
        {entry.meta.name && entry.meta.name !== entry.name && <Tag>{entry.meta.name}</Tag>}
      </PageHead>

      {/* Set on the page rather than on a card, which every other view here still
          uses. A card is the right container for a thing you look at beside its
          siblings; these are documents, read end to end, and the section heads
          pin themselves to the top of the column as you go — a heading cannot
          pin over paper without appearing to slice it. globals.css has the
          whole argument, under "The heading you are under". */}
      {hasLead && (
        <div className="doc-body">
          <Prose html={entry.lead} />
        </div>
      )}

      {/* The anchor is on the SECTION, not on the heading inside it.

          This is the one view that pins its section heads, and a sticky box is
          not a dependable place to land a link — see SectionHead. The wrapper's
          border box starts exactly where the heading does (the heading carries
          no margin here, only the section does), so the target is the same
          pixel; it is just measured from something that stays still. The rail
          builds these hrefs from the same slugify(), so the two cannot drift. */}
      {entry.sections.map((section) => (
        <section
          key={section.heading}
          id={slugify(section.heading)}
          className="view-section"
        >
          <SectionHead title={section.heading} anchorHere={false} />
          <div className="doc-body">
            <Prose html={section.html} />
          </div>
        </section>
      ))}

      {!hasLead && !entry.sections.length && (
        <Empty title="Nothing written in this one yet">
          The file is in the harness but holds no text — a heading somebody meant
          to come back to.
        </Empty>
      )}
    </>
  );
}

// Anything that is not markdown: settings.json, a hook, a script.
//
// Shown as source, unhighlighted and unwrapped. These are read to check an exact
// value — a matcher, a path, a permission — and a rendering that reflows or
// prettifies them is a rendering you cannot trust to be what is on disk.
function Code({ entry, route }) {
  return (
    <>
      {/* No tags under the title.

          The event, the format and the line count are all facts ABOUT the file
          rather than parts of it, and they are in the right rail now — see
          components/shell/RailFacts.jsx for the argument. What is left here is
          the file's name and the sentence it opens with, which is the same head
          every other view in this app has. */}
      <PageHead
        route={route}
        icon={markFor(entry)}
        title={entry.name}
        sub={entry.sub ?? sourceSub(entry.name)}
      />

      {/* The header comment, as the paragraph it always was. Same container the
          lead of a markdown document gets, deliberately: a hook explaining
          itself and a spec explaining itself are the same act, and the view
          should not make one of them look like an afterthought. */}
      {entry.lead && (
        <div className="doc-body">
          <Prose html={entry.lead} />
        </div>
      )}

      {/* An empty file, said rather than drawn. heartbeats.json is zero bytes
          today, and an empty card under a "Source" heading reads as a view that
          failed to load one — the same wrong answer <Opaque> below exists to
          stop this page giving. */}
      {!entry.code.length && (
        <Empty title="Nothing in this one yet">
          The file is in the harness but holds no bytes at all. It is still read
          by whatever reads it; there is simply nothing in it to show.
        </Empty>
      )}

      {entry.code.length > 0 && (
        <SectionHead title="Source" note={`${entry.lines} lines, as on disk`} />
      )}

      {/* Unhighlighted and unwrapped, which is the whole point.

          These are read to check an exact value — a matcher, a path, a
          permission — and a rendering that reflows or prettifies them is a
          rendering you cannot trust to be what is on disk. Nothing below
          changes a character: the numbers are drawn by CSS from a counter, so a
          selection copies the source and not the gutter, and the anchor ids sit
          on lines the file already marked for itself. */}
      <div className="card code-card" hidden={!entry.code.length}>
        <pre className="harness-code" data-lang={entry.lang}>
          <code>
            {entry.code.map((line) => (
              <span
                key={line.n}
                id={line.id}
                className={`code-line${line.id ? ' is-mark' : ''}`}
                data-n={line.n}
              >
                {/* A run with no kind is bare text, not an empty span. The
                    majority of these files is comment prose and indentation, so
                    wrapping only what is coloured is most of the difference
                    between a span per word and a handful per line. */}
                {line.parts.map((part, i) =>
                  part.k ? (
                    <span key={i} className={`syn-${part.k}`}>
                      {part.t}
                    </span>
                  ) : (
                    part.t
                  ),
                )}
              </span>
            ))}
          </code>
        </pre>
      </div>
    </>
  );
}

// What a file with nothing to say about itself is called instead.
//
// Only JSON reaches this now — it has no comment syntax to have written a header
// in, as settings.json explains at length inside the `_note` key it had to
// invent for the purpose.
function sourceSub(name) {
  if (name === 'settings.json') return 'What is wired up, and what is permitted. Shown exactly as it is on disk.';
  if (name.endsWith('.json')) return 'Shown exactly as it is on disk.';
  return 'Source, shown exactly as it is on disk.';
}

// A file this view will not open: not a text format, or too large to render.
//
// Said plainly rather than rendered as an empty page. A file that exists and
// shows as blank reads as a file with nothing in it, and that is the one wrong
// thing this page could say about the harness.
function Opaque({ entry, route }) {
  return (
    <>
      <PageHead route={route} icon={markFor(entry)} title={entry.name} />
      <Banner>
        This one is not shown here — it is either not a text file, or larger than
        this view will render. It is still in the harness and still doing
        whatever it does; open it in an editor to read it.
      </Banner>
    </>
  );
}
