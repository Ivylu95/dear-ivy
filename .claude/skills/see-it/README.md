# see-it

The one skill that draws: what she asks to see, in her chat (her route, the
default), and the developer's diagrams, only in development mode (his route).
Start at [`SKILL.md`](SKILL.md), which picks the route.

| File or folder | What it is |
|---|---|
| [`her.md`](her.md) | Her route: drawing in her chat, from her words and record |
| [`developer.md`](developer.md) | The developer's route: a Mermaid block or a published page with vetted logos |
| [`her-page.md`](her-page.md) | Her page to tap, made only when she asks or says yes |
| [`draw.md`](draw.md) | The rules a page meets, on either route |
| [`tap.md`](tap.md) | What a tap does on each page, and how it is proven |
| [`logos/`](logos/SOURCES.md) | The vetted logo set, one SVG each, listed with its official source and sha256 in `logos/SOURCES.md`; it ships, shared by both routes |
| [`template.html`](template.html) | The page copied for each diagram: tap a box for its detail and the lines it joins, a chip to hide a part |
| [`template-steps.html`](template-steps.html) | The page for a timeline, a week or steps: tap a line to open it, step one at a time, show only what a chip names |
| [`scripts/`](scripts/build.mjs) | `build.mjs` inlines the logos into a page, after the logo check; `check-logos.mjs` refuses an unsafe, unlisted or changed logo and reports a stale one, tested by `test-check-logos.mjs` |

Its grounding log and tests are in `dev/skills/see-it/`, so nothing of how it
was made travels to her copy.
