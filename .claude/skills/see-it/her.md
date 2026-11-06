# See it: her route

Read when this message is not in development mode (`SKILL.md` § *Which route*), after `SKILL.md`: every one of her chats, and every chat in a copy without `dev/`.

**Goal:** What she asked to see is drawn plainly in her chat, from her own words, so she can take it in at a glance.

**Reads:** Only what the picture is of, in the retrieval order `CLAUDE.md` gives: `data/core/state/now.md`, then `data/core/timeline.md` for the range she named, then the two or three files it points at.

Binds FIT-004, *"When reading is too much, she can see it drawn"*. Binds FIT-005,
*"Any picture can become a page that answers a tap"* (card A-168). FIT-001 sets narrow or wide.

## First, whether to draw at all

- **A crisis, unsafe, or you're unsure** → the crisis block in `CLAUDE.md`.
  Nothing is drawn or offered; a picture of her life is not what helps then.
- **A hard day** (she is raw, upset, venting, or `now.md` marks the day hard) →
  never offer one, nor a page. If she asks, draw it plainly and short, from
  her words only. Then come back to what she's carrying. If she asks for a
  page, make it as below. Being refused her own ask on a hard day lands as being shut out.
- **She asked** → draw it; for a page or *"something I can tap"*,
  [`her-page.md`](her-page.md). **She didn't** → offer one only where your reply
  would otherwise be a long run of dates or steps, once in a chat, in one line.

## Drawing it

Every box, line and date is something she said or a line of her record.
Nothing is filled in to complete the shape: a gap stays a gap, or a `?`.

**Default: a text layout that reads on any phone**, narrow until she has said
wide in this chat (FIT-001). Put one item on each line, with the date or step first.
Use an emoji as a marker only where she would read it the same way. Put `↓` or
`→` between steps, and keep each line to about thirty characters. Put it in a code block only when
spacing carries meaning.

```
Mon 📅 appointment
 ↓
Wed 🏃 first run back
 ↓
Sat 🎂 a birthday
```

| She asked for | Shape |
|---|---|
| A timeline, *"put it in order"* | Dates down the left, oldest first, one event a line |
| *"Map my week"* | The days down, what she named under each |
| How something works, a plan's steps | Steps top to bottom with arrows |
| Who is involved | Her in the middle line, each person she named on a line of their own, with her words for them |

**Mermaid** only where you know her chat draws it, and then top to bottom
(`flowchart TD`, `timeline`). Where you're not sure, the text layout: an
undrawn Mermaid block is harder to read than the text it replaced. Wide, once
she has said she is on a desktop, may run left to right.

Plainly: her words for things, no labels that judge (*"bad week"*, *"setback"*)
unless they are hers, no colour or emoji standing for a mood she did not give.
No logos or images unless she asks. A logo appears only on a page she asked
for and said yes to. It comes only from the shared set in `logos/`, put in by
`scripts/build.mjs`. A guessed logo is never used, and none is added from her chat.

## What it never draws

- **A pattern, cause or verdict she did not name.** An arrow means *then*, never
  *because*, unless she said one led to the other. No grouping into triggers or
  themes, no trend, no highlight, no caption that reads her. Side by side, in
  order, is all; what it means is hers (`CLAUDE.md`, *name a pattern*).
- **How she feels.** A mood is said back in words (`journal`), never drawn.
- **A reading of anyone else.** What she said of them, nothing about why they
  acted.
- **Anything she asked to keep out of the record.**

## Where it stays

In the chat, by default. **With each picture, one line offers a page she can
tap** (A-168), said as a line, not a question, with where it would live:
*"If you'd like, I can make this a page you can tap through, one at a time;
it'd be private to your Claude account."* Worded fresh, once per picture,
before the line back to her, which stays the reply's one question. It is never made in a crisis or on a hard day.
It is also not made where this chat has no way to make a page, because an offer
that can't be kept shouldn't be made. On her ask or her yes, [`her-page.md`](her-page.md).

Never a file, an image link or a message to anywhere else unless she asks. The
picture itself is not filed: her record already holds what it shows. Something
new she says while looking at it is kept as anything else she says is, with
its 📝 line.

## Then

Draw one diagram, with one line saying what it shows, such as *"Here's October,
in the order you told it"*. Add the one line offering the page. Then come back
to her, with one line on how she is, never about the picture. No menu of other diagrams to
make, no other question about the picture. If she corrects it, redraw it, and where the record
was wrong too, fix the record (Repair).

## Cases

| Trigger | Do | Because |
|---|---|---|
| *"Show me"* about food, protein or lifts | The nutrition skill that keeps those numbers; not this | A chart of numbers is theirs, with its own rules |
| She asks for a nice version to keep or share | Say where it would go and who could open it; make it only on her yes | A diagram of her life leaves the chat only on her yes (A-167) |
| A hard day, and she asks to see it | Draw it in the chat, with no offer of a page | Never offered on a hard day; her own ask still drawn (T-721) |
| The record has nothing for the range she named | Say so in one line and draw what she tells you now | A shape filled in by guess is a record that lies |
