import { marked } from 'marked';

// Markdown to HTML, in one place so every view renders her record the same way.
//
// The only writer of the files under data/ is the agent she talks to, inside a
// private single-member repository. That is not untrusted input, so the output is
// not sanitised — the same call the About view makes on the repository README.
marked.setOptions({ gfm: true, breaks: false });

export function toHtml(markdown) {
  return callouts(sourceTags(headingIds(marked.parse(String(markdown ?? '')))));
}

// ── Heading anchors ─────────────────────────────────────────────────────────
//
// marked emits headings without an id — the option that used to do it was
// removed — so an in-page link lands at the top of the document instead of at
// the thing it names. That is not cosmetic here: a source tag links to one
// entry in a reference list, and a reader who arrives at the top of a long file
// has been handed the file rather than the answer.
//
// Slugged the way GitHub does it, deliberately: lowercase, non-word characters
// dropped, spaces to hyphens. The same file is read on GitHub and in this app,
// and a link that works in one place and not the other is worse than one that
// works nowhere, because only half the readers find out.
//
// Duplicate headings get -1, -2 appended, again matching GitHub, so the first
// of a repeated name keeps the bare slug that anything already links to.
export function slug(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

export function headingIds(html) {
  const seen = new Map();
  return String(html ?? '').replace(
    /<h([1-6])>([\s\S]*?)<\/h>/g,
    (whole, level, inner) => {
      const base = slug(inner.replace(/<[^>]*>/g, ''));
      if (!base) return whole;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      const id = n ? `${base}-${n}` : base;
      return `<h${level} id="${id}">${inner}</h${level}>`;
    },
  );
}

// ── Source tags ─────────────────────────────────────────────────────────────
//
// A spec row may carry a [KEY] against the claim a source corroborates. In the
// markdown it is written [[KEY]](url "where it stops applying") — the doubled
// bracket puts the brackets in the LINK TEXT, which does three jobs at once:
// a raw reader sees [KEY] exactly as a rendered one does, the brackets say
// which clause is being cited rather than leaving the tag to read as the last
// two words of the sentence, and the bracketed text is a signal this function
// can match on now that the href is an arbitrary external URL.
//
// The link title becomes a native tooltip. That matters: the tag now goes to
// the work itself, so the limit — every source here was written for a different
// field at a different scale — would otherwise only be found by someone who
// went looking for it in specs/REFERENCES.md. On hover it finds them instead.
// The key may be followed by a locator — [[FAIR F4]], [[ISO-29148 §5.2]] —
// because one work is one row in REFERENCES.md and the clause within it belongs
// at the citation. Everything before the first space is the key.
const SOURCE_TAG = /<a href="([^"]+)"(?: title="([^"]*)")?>\[([A-Za-z][A-Za-z0-9-]*(?: [A-Za-z0-9.§-]+)?)\]<\/a>/g;

export function sourceTags(html) {
  return String(html ?? '').replace(SOURCE_TAG, (_, href, title, key) => {
    const t = title ? ` title="${title}"` : '';
    // Opens in a new tab: these are outbound, and a reader following one mid-row
    // is checking a citation, not leaving the register.
    return `<a class="src-tag" href="${href}"${t} target="_blank" rel="noreferrer">${key}</a>`;
  });
}

// ── Scaffolding ─────────────────────────────────────────────────────────────
//
// Two kinds of text in these files are written FOR THE AGENT, not for her, and
// neither should ever reach the screen.
//
// COMMENTED-OUT TEMPLATES. data/me/patterns.md carries a whole worked example of
// a pattern inside an HTML comment, so there is a shape to copy the first time
// one is named. Markdown containing angle brackets — "## <name of the pattern>"
// — is escaped rather than hidden by the renderer, so the comment came out as
// visible text, and the `##` inside it counted as a real section and made the
// file report itself as written. Stripped before anything else looks at it.
//
// WHOLLY ITALIC PARAGRAPHS. Every template marks its instructions this way:
//
//   ## Coming up
//
//   _Appointments, deadlines, trips, birthdays. Soonest first._
//
// That is a note about what belongs under the heading. Showing it to her is
// showing her the form rather than the answer.
//
// The trade, stated plainly: a paragraph she dictated that happens to be italic
// end to end would be dropped too. Emphasis in her record is inline within a
// sentence, and anything quoted verbatim is marked as a quote, so the case is
// rare — and a dropped line is recoverable by opening the file, where scaffolding
// rendered as her words is not.
export function stripComments(markdown) {
  return String(markdown ?? '').replace(/<!--[\s\S]*?-->/g, '');
}

function dropGuidance(markdown) {
  return String(markdown ?? '')
    .split(/\n\s*\n/)
    .filter((block) => {
      const joined = block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ');
      if (!joined) return true;
      return !/^_[^_]*(?:_\s*_[^_]*)*_$/.test(joined);
    })
    .join('\n\n');
}

// What every view calls to turn a piece of her record into HTML.
export function renderBody(markdown) {
  return toHtml(dropGuidance(markdown));
}

// Strip a leading `# Title` from rendered markdown.
//
// Every file under data/ is a standalone document and its own title belongs in
// it. But a panel that already supplies the heading then prints the same word
// twice. The file is right and the panel is right; only showing both is wrong, so
// the read surface drops one rather than the record giving up a title it needs
// when read on its own.
export function dropLeadingH1(html) {
  return String(html).replace(/^\s*<h1[^>]*>.*?<\/h1>/is, '');
}

// ── Is this file actually written in yet? ───────────────────────────────────
//
// Every file under data/ starts life as a scaffold: a title, some headings, and
// italic guidance to whoever fills it in. Rendering that as content would tell
// her the record holds things it does not, which is the one lie a record cannot
// afford. So a file counts as written only once something survives removing all
// of the following:
//
//   - the title and every heading
//   - italic-only lines, which is how the templates write their guidance
//   - blockquotes and HTML comments, same reason
//   - empty table rows and the header/divider rows above them
//   - bullets with nothing after the marker
//
// Deliberately generous about what counts as scaffolding and mean about what
// counts as content: a false "nothing here yet" is recoverable by opening the
// file, whereas a heading rendered as if it were her words is not.
export function hasContent(markdown) {
  // Paragraph by paragraph, not line by line. The templates wrap their guidance
  // across several lines:
  //
  //   _Three or four lines per quarter: the shape of the period, not its
  //   contents. Rewritten during upkeep._
  //
  // Tested a line at a time, the first line opens an italic and never closes it,
  // so it reads as prose and the whole section reports itself as written. That is
  // the wrong way round for this check to fail: an empty section rendered as if
  // it held something is the one error a record cannot afford.
  const paragraphs = String(markdown ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .join(' ')
        .trim(),
    )
    .filter(Boolean)
    .filter((block) => {
      if (block.startsWith('#')) return false;
      if (block.startsWith('>')) return false;
      if (/^[-*]\s*$/.test(block)) return false;
      if (/^-\s*\[\s*\]\s*$/.test(block)) return false;
      // A table row with nothing in any cell, or the |---|---| divider.
      if (/^\|[\s|:-]*\|$/.test(block)) return false;
      // Wholly italic: the templates' own instructions to whoever fills them in.
      if (/^_[^_]*(?:_\s*_[^_]*)*_$/.test(block)) return false;
      if (/^\*[^*]*\*$/.test(block)) return false;
      // A horizontal rule.
      if (/^-{3,}$/.test(block)) return false;
      return true;
    });

  // What remains may still be a table — a header row (| Who | How | When |) over
  // nothing but empty rows. A header alone is structure, not content.
  return paragraphs.some((block) => !block.startsWith('|'));
}

// Is a whole FILE written in yet?
//
// Distinct from hasContent(), which judges a fragment, because a file's lead —
// everything above the first `##` — is the file describing itself rather than
// holding anything:
//
//   # What I'm working on
//
//   The current focus with my therapist. Keep it short — this is the headline,
//   the detail lives in `sessions/`.
//
//   ## Right now
//
// That paragraph is a note to whoever fills the file in. It carries no italics
// to mark itself as guidance, so hasContent() reads it as prose and the file
// reports itself as written when every section in it is empty.
//
// The rule: where a file has `##` headings, its content lives under them and the
// lead does not count. Where it has none — a journal entry, say — the lead is all
// there is and it counts for everything.
export function fileHasContent(markdown) {
  const parsed = sections(markdown);
  if (parsed.sections.length === 0) return hasContent(parsed.lead);
  return parsed.sections.some((s) => s.filled);
}

// Split a markdown document into its `##` sections, so a view can show one part
// of a file without reproducing the whole thing. The lead is anything before the
// first `##`.
export function sections(markdown) {
  const lines = String(markdown ?? '').split('\n');
  const out = [];
  let lead = [];
  let current = null;

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      if (current) out.push(current);
      current = { heading: match[1], lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      lead.push(line);
    }
  }
  if (current) out.push(current);

  return {
    lead: lead.join('\n').trim(),
    sections: out.map((s) => ({
      heading: s.heading,
      body: s.lines.join('\n').trim(),
      filled: hasContent(s.lines.join('\n')),
    })),
  };
}

// Read a GitHub-flavoured markdown table into rows of objects keyed by the
// header cells, lowercased and underscored. Empty rows are dropped: the
// templates ship one so the table renders, and it is not a record of anything.
//
// `after` names the `##` heading the table sits under, because several files
// here carry more than one table and they mean different things. `parsed` is
// sections(markdown) when the caller already has it, so a file read for three
// tables is split into sections once rather than three times.
export function table(markdown, after, parsed) {
  const body = after
    ? ((parsed ?? sections(markdown)).sections.find((s) => s.heading.toLowerCase().startsWith(after.toLowerCase()))
        ?.body ?? '')
    : String(markdown ?? '');

  const rows = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|'));
  if (rows.length < 2) return [];

  const cells = (line) =>
    line
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim());

  const header = cells(rows[0]).map((h) => h.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));

  return rows
    .slice(1)
    .filter((l) => !/^\|[\s|:-]*\|$/.test(l))
    .map((line) => {
      const values = cells(line);
      const row = {};
      header.forEach((key, i) => {
        row[key] = values[i] ?? '';
      });
      return row;
    })
    .filter((row) => Object.values(row).some((v) => v !== ''));
}

// ── Callouts ────────────────────────────────────────────────────────────────
//
// A blockquote that opens with an emoji is not a quotation, it is a notice —
// the prohibition at the top of ARCHITECTURE.md is the case that forced this.
// Plain `.prose blockquote` styling is a hairline and dimmed ink, which is the
// right treatment for something being quoted and exactly the wrong one for the
// single most binding line in the repository: the rule that reads as least
// important on the page is the rule nobody obeys.
//
// The emoji is the whole syntax. Nothing is added to the markdown, which matters
// because ARCHITECTURE.md forbids an agent editing it and because the file is
// read on GitHub too, where a leading 🔒 already reads as a notice on its own.
//
// The mark is lifted out of the paragraph into a direct child of the blockquote
// so it can sit in its own gutter, rather than indenting the first line and
// leaving every line after it to start further left than the sentence it began.
const CALLOUT = /<blockquote>\s*<p>\s*((?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\uFE0F|\u200D)+)\s*/gu;

export function callouts(html) {
  return String(html ?? '').replace(
    CALLOUT,
    (_, mark) =>
      `<blockquote class="callout"><span class="callout-mark" aria-hidden="true">${mark}</span><p>`,
  );
}
