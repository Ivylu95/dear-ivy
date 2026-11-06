# Writing the message

Read when writing the message of any commit but a save of her record. `SKILL.md`'s privacy and push rules hold here too.

## The shape

    type(scope): summary

    Why, in plain text, hand-wrapped.

    Trailers.

## Type

The type picks the tag the Changes row is scanned by. The ones in use:

| Type | For | In Changes |
|---|---|---|
| `record` | Her record. Written by the agent, in `data/`. | Green tag |
| `feat` | Something new that was not there. | Accent tag |
| `fix` | Something that was wrong. | Warn tag |
| `refactor` | The same behaviour, said better. | Plain tag |
| `perf` | The same behaviour, faster. | Plain tag |
| `docs` | Prose about the thing — specs, READMEs, reviews. | Plain tag |
| `style` | How it looks. Not formatting-only churn. | Plain tag |
| `research` | What was looked up, and what it said. | Plain tag |
| `test` | Something checked. | Plain tag |
| `ci` | The build. | Plain tag |
| `chore` | Housekeeping that is none of the above. | Plain tag |

**A type not in this list renders with no tag at all**, unmarked in the column
the list is scanned by. So inventing a type is two edits: this table, and
`TYPES` in `dev/ui/lib/git.js`. If neither is worth doing, neither was the type. `checkpoint` is in this log once, means
nothing, and is the example.

## Scope

**One short word, in brackets, naming the part of the repository** — `ux`, `specs`,
`review`, `harness`, `hooks`, `skills`, `theme`, `safety`, `auth`, `deploy`.

It renders in a narrow column before the summary, so a long scope eats the
summary's line. Prefer the existing ones; scopes invented per commit make a
column of words that never repeat, saying nothing.

Omit it rather than stretch it. `record: session update` is better than
`record(therapy-session-file): update`.

## Summary

- **Imperative, lowercase, no full stop.** "raise the ARC-004 altitude
  question", not "Raised" and not "Raises".
- **About sixty characters, scope counted in.** Scope and summary share one
  line in the Changes row; past sixty it wraps, which is allowed and costs the
  row its shape.
- **Say what changed, not which files.** The paths are already on the row, and
  the areas they belong to are already marked on it. A line like "put the harness
  on the surface, with hooks under it" earns its place, and "update
  HarnessIndex.jsx" does not.
- **One commit, one change** (**MNT-003**), so it reverts alone. A summary that
  needs an "and" in the middle is usually two commits — unless the two halves
  genuinely have to land together, in which case say so in the body.

## Body

The body is where the **why** goes, and it is the half written for the later
reader rather than the scanning one.

- **It is rendered as plain text, not markdown:** `**bold**` shows its
  asterisks, a backtick a backtick. Hand-wrap at about seventy-two columns; that
  wrap is the shape the reader gets. Plain `-` bullets read fine.
- **Cite the spec ID** for anything that changes a design (**MNT-008**). That is
  what makes the log searchable by argument rather than by memory:
  `git log --grep=DEP-005` returns every commit that moved that requirement. An
  ID in the body is worth more than a paragraph without one.
- **A commit that changes a register row must name that row's ID.** `commit-msg`
  refuses one that does not. A stale copy once undid an approved amendment that
  way (9755c5d over e3787b0). A register reshaped as a whole says
  `Rows: all in <path>` on a line of its own; a merge is let through.
- **Either way it also quotes the owner's yes**, `Approved: "<their words>"`, on a
  line of its own (MNT-008 design 2): naming a row proves which rows moved, not
  that anyone agreed. The quote is words he typed, copied from his entry in the
  Transcript, and `commit-msg` refuses any other. The same quote is required
  for a commit changing a skill's `**Goal:**` line or set-up's Must hold block
  (PMM-007 design 4). No yes yet means the register is unstaged, not the line
  invented.
- **A note listing rows whose design names a file you changed** (MNT-008 design 5)
  refuses nothing: read each row, and name any it no longer describes.
- **A commit that leaves a hook's selftest cases, or a rule test's, fewer than it
  found them is refused** (SFG-014). A case retired on purpose says
  `Cases-removed: <hook or test path> — <why>` on a line of its own.
- **Say what you rejected**, where you rejected something. The next session will
  consider the same alternative and needs to know it was already weighed.
- **Skip it entirely for a commit whose summary is the whole truth.** An empty body
  is honest; a body restating the summary is noise on a surface.

## Trailers

**Co-authorship and generated-with lines go last.** The Changes view strips them
before rendering, so they cost nothing on the surface and stay in the commit
where they belong.
