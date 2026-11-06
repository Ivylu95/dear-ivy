# A limit needs its reason first

**Seen 2026-10-29.** Asked whether the agreements would grow unbounded, a session built a hard cap
(80 agreed cards, refused past it), then offered a per-group cap of 20. The owner turned both down
("Agreements should just grow ultimately"). The number was a guess fitted to the count that day,
and the growth was never the risk: contradictions, overlaps, staleness and losing track are, and
none of them depends on the count. The cap came out the same night (fd69c513), replaced by a clash
check on every new card and reviews at several timings.

- **Name what actually goes wrong before proposing a limit,** and check whether a count is what
  causes it. Often the fix is a check on quality (clashes, duplicates, staleness), not a ceiling.
- **A number in a rule needs a source,** measured or researched; say plainly when it is a guess.
- **Separate what is kept from what is read.** Storage that grows is cheap; what costs is what an
  agent or the owner must read at once, and that is bounded by retrieval, not by deletion.
