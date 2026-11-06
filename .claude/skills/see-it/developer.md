# See it: the developer's route

Read when development mode is on for this message and the developer asks for a diagram (`SKILL.md` § *Which route*), after `SKILL.md`; never in one of her chats.

**Goal:** The developer sees how something works in one picture he can read on his phone, with every logo the real one.

**Reads:** nothing of her record. The thing drawn is read from the harness, the specs, or what the developer describes, never from `data/` or `data-sample/` beyond its folder names. Every run of this route also reads [`draw.md`](draw.md), the content, layout, page and logo rules.

**Material, not counted:** [`template.html`](template.html) is the page copied for each diagram. [`template-steps.html`](template-steps.html) is the tap-through list for a timeline or steps. [`logos/SOURCES.md`](logos/SOURCES.md) lists the vetted logos. `dev/skills/see-it/log.md` holds its sources and next due date.

Binds `DEV-004`, *"A development reply fits a phone, unless the developer chose
wide for that chat."*, and the owner's A-160: a diagram drawn to fit his phone.
The approach comes from stack-diagram, and the log says what was kept and what was left out.

```
- [ ] 1. Page or Mermaid
- [ ] 2. Settle the content
- [ ] 3. Logos
- [ ] 4. Lay out and build
- [ ] 5. Look, then publish
```

## 1. Page or Mermaid

| The request | Gives |
|---|---|
| A flow, sequence or state of a few steps, no products named, to read in the chat | A Mermaid block in the reply, then one line offering the page he can tap (A-168). Nothing built or published unasked |
| Anything with products or services in it, a boundary to show, more than about eight boxes, or *"make it nice"*, *"a page"*, *"something I can share"* | A page, published as an artifact (steps 2 to 5) |
| A chart of numbers | Not this skill: `dataviz` |

When unsure, draw the Mermaid block first, with one line offering the page. **Every picture drawn in the chat ends with that one line** (A-168). It names what tapping would add, such as *"tap a box for what it does, hide a part"*. When he asks for a page, he gets one, never text or Mermaid. **Every page can be tapped.** Each box lights its route and opens its card, and each group that can be hidden has its chip, as [`tap.md`](tap.md) says. A sequence or a timeline uses [`template-steps.html`](template-steps.html) instead. **A name on a page shows its kind:** 📄 file, 📁 folder, ⌨️ command, slanted words for an idea, and a key line (`dev/diagrams/dialogue-loop/page.html`).

## 2. Settle the content

Read what is drawn before drawing it. For this harness, read `dev/specs/` and
the files the request names. For another project, read its README and entry points.
Draw what the question turns on, not an inventory: nodes, groups (a shared
runtime, vendor or repo), and three kinds of edge (main flow, internal,
dev-time or deploy). A data-flow of this harness shows `data/` as one closed
box and its boundary, never a file name, path or line from inside it. Ask only
when the picture would be wrong either way.

## 3. Logos

Only the files in [`logos/`](logos/), each listed in
[`logos/SOURCES.md`](logos/SOURCES.md) with its official source. A product with
no logo there gets a plain line glyph drawn inline, never a guessed mark, a
redraw or an emoji; adding one is in [`draw.md`](draw.md) § *Adding a logo*.

## 4. Lay out and build

Copy [`template.html`](template.html) to the session scratchpad, lay it out by
[`draw.md`](draw.md) § *Layout*, then inline the logos:

```
node .claude/skills/see-it/scripts/build.mjs <scratch>/page.html <scratch>/diagram.html
```

## 5. Look, then publish

Check it against [`tap.md`](tap.md) and [`draw.md`](draw.md) § *Before publishing*, then publish
`diagram.html` with the Artifact tool and give the link. With no Artifact tool, build it and say it is ready. Keep the sources of a
diagram he will reuse in `dev/diagrams/`, once published.

## Re-grounding

Due when `dev/skills/see-it/log.md` says, or when `.claude/hooks/lib/currency.mjs`
brings it forward; the log says what it covers beyond `dev/skills/skill-writer/reground.md`.

## Where this falls short

Coordinates are placed by hand, so a large diagram takes several passes. Some
brand pages are refused by the network; their marks are taken from svgl's copy
and say so.
