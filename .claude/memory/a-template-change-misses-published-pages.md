# A template change does not reach pages already published

**Hit 2026-11-04.** see-it's templates gained tapping, were tested and pushed,
and the architecture page, published that afternoon from the old template,
stayed a picture you could only look at. The developer found it, not a check.
Its sources were also only in the session scratchpad, so a later session could
not have redrawn it.

- **When a template gains something, list the pages drawn from it** (the
  developer's are in `dev/diagrams/README.md`) and redraw and republish each in
  the same piece of work, or say which were left and why.
- **A page the developer will reuse keeps its sources in the repository**,
  `dev/diagrams/<name>/`, the day it is first published, never only in the
  scratchpad, which dies with the machine.
- **Prove the kept sources:** rebuild from them and compare with what was
  published (`cmp`) before calling them kept.
