---
name: see-it
description: She asks to see something drawn rather than read - "can you show me", "draw it out", "I can't read all that, show me", "map my week", "put it on a timeline" - drawn plainly in her chat from her own words. In development mode only, the developer's diagrams too - "draw", "diagram", "map out" an architecture, a flow or the privacy boundary - as Mermaid or a page with vetted logos. Events, steps and people, never how she feels (a mood is journal's); not charts of numbers, food or lifts; not in a crisis, never offered on a hard day.
---

# See it

**Goal:** What was asked to be seen is drawn plainly, at a glance, on a phone: hers from her own words, the developer's with every logo the real one.

**Audience:** The person, in her own chats, on her route, the default; the developer, only while development mode is on, on his.

**Reads:** what the route's part names, and only that.

Binds FIT-004, *"When reading is too much, she can see it drawn"*, and card
A-167. On the developer's route it also binds `DEV-004`, *"A development reply
fits a phone, unless the developer chose wide for that chat."*

**Every run reads:** this page, then the part its row below names.

**Material, not counted:** [`logos/SOURCES.md`](logos/SOURCES.md) lists the logos both routes share. [`template.html`](template.html) and [`template-steps.html`](template-steps.html) are the two pages to tap. `dev/skills/see-it/log.md` is the grounding log, with the next due date, in the development half.

## First, the crisis block

Unsafe, or unsure: the crisis block in `CLAUDE.md`, on either route. Nothing is
drawn or offered; a picture is not what helps then.

## Which route

**Development mode is on for this message** when this turn's context carries
the development hook's lines (*DEVELOPMENT REPLY SHAPE*, *DEV SKILLS
(ARC-005)*) and `dev/` exists. Never run `.claude/hooks/lib/dev-mode.mjs` to
find out: running it switches the chat on. A plain request for development
work in a chat where it is off is `dev/commands/dev-mode.md`'s to switch, as
the session brief says, never this skill's.

| The message | Route | Read |
|---|---|---|
| Any message not in development mode: every one of her chats, a copy without `dev/`, and in a development chat a message about her life (her day, her week, food, sleep: card A-146) | Hers, the default | [`her.md`](her.md) |
| On her route, a page she asked for or said yes to | Hers | [`her-page.md`](her-page.md), [`tap.md`](tap.md), [`draw.md`](draw.md) |
| Development mode on, and the developer asks for a diagram of the harness, the specs or another project | His | [`developer.md`](developer.md), [`draw.md`](draw.md), [`tap.md`](tap.md) |

When you can't tell which route, take hers. Her route never publishes without
a yes, and it never reads more than the picture needs. So a wrong pick only
costs a plainer drawing, never her privacy.

## Across both routes

- **The logos are one shared set**, in [`logos/`](logos/SOURCES.md), inlined by
  `scripts/build.mjs`, which runs `scripts/check-logos.mjs` first and refuses
  a logo that fails it. A logo is added only on his route (`draw.md` §
  *Adding a logo*), never from her chat.
- **Every picture can become a page to tap** (A-168). A simple picture is
  drawn in the chat. Under each one, a single line offers a page to tap
  through. The page is made only when someone asks for it or says yes. On her
  route, it is never offered in a crisis or on a hard day. Both templates and
  their rules are in [`tap.md`](tap.md).
- **Nothing leaves the chat without a yes.** Her page is made only on her yes,
  after one line on where it would go and who could open it. His pages are
  published as he asked, and hold nothing from `data/` but the folder's name.
- **The two never both serve one reply.** One route, one drawing, then back to
  the person.

## Where this falls short

The route turns on the development hook's lines being in context; a session
whose hook did not run reads as hers, which is the safe way to fail. A hard day
is the agent's judgment, on her route.
