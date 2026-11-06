# Build test fixtures through the parser, not by hand

**Seen 2026-10-26.** New code in the dialogue script read a remark's card as `e.card`. Another chat
had since changed the parser to `e.cards`, a list, since one remark can carry several. The new tests
built their own objects in the old shape and passed, while the real report silently counted nothing:
the gates report saw no agreed cards, and the trace counted drafted rows as agreed. Only a later test
whose fixture happened to match the new shape caught it.

- **Write a fixture as the source text,** a few lines of Transcript in a temp folder, and read it with
  `readTranscript`. Then a change to the parser breaks the test, not the report.
- **Read cards through `cardEntries` or `standingCards`,** never `e.card` on an entry.
- **Before trusting a new count, compare it with one run on the real files.** A number that can't be
  wrong is usually not being computed.

**Seen again 2026-10-29.** A test of the agreements cap built its cards as `{ id, ...card }` objects;
`standingCards` reads `e.cards`, so every fake counted as zero and the "one past the cap fails" case
failed for the wrong reason. Same rule: build through the parser, or at least in the parser's shape
(`cards: [ {...} ]`), and break the guard once to see the test fail for the right one.
