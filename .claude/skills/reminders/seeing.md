# Seeing her reminders

Read when she asks what reminders she has, or what reaches her (then `check-ins.md` for its two groups). The must-holds in `SKILL.md` apply.

**Every Reminder cell opens with its emoji**, then a short name ("💊 Supplements"); one without an emoji gets a fitting one in the table only.

- **"What reminders do I have?"** Run `node ux/scripts/reminders.mjs list --json`
  and show the reminders still on or paused, as one table, whatever the chat's
  view (a table is what this view is). Stopped ones are not in it: they live in
  the archive. Columns, in this order:

  | # | Created | Reminder | Description | When | Times sent | Last went out | Status |
  |---|---|---|---|---|---|---|---|

  **#** numbers the rows shown 1, 2, 3, in the order they were set, one number per
  row however many reminders it holds; **Created** is the day (`created`).
  **Reminder** is its emoji, then a short name ("💊 Supplements"); one without
  an emoji gets a fitting one in the table only. **Description** says in a few
  plain words what it is for and, where it reads a file, what from ("what your
  supplement list has for that time"). **When** is one line of prose that says
  how often and at what times together. Examples are "Daily at 12 pm, 6 pm and
  11 pm" and "Once, Fri 24 Oct at 3 pm". There is no separate repeats column.
  **Times sent** and **Last went out** come from `sent` and `last`. With
  `"send": "routine"` (`counted: accepted`), they are what Telegram accepted,
  and the minute it did. Otherwise they are worked out from the schedule.
  **Status** is on or paused. When it is on, it says when it ends, if it does,
  and the next time. When `missed` is set, the status leads with it, such as
  _"⚠️ Missed 12:00 pm"_. That means a time passed with nothing sent. It is a
  fault for the developer, not something she did.
  A run of near-identical ones gets one row. This could be the same message in
  parts, or a batch of one-offs. The row has one #, and Created gives the range
  of days ("16–17 Oct"). The Reminder cell names them once, with no count.
  When sums them up in a few words. Last went out is the latest in the group.
  The count goes in Times sent, such as "12, one each" or "25 across 12".
  Times are said plainly ("Today, 5:20 pm", "Fri, 4:54 pm"). One plain line may
  lead in. Under the table, add one line about the times. With the sweep
  sending, they are when Telegram accepted each. Otherwise they are when each
  was due, since nothing came back. Accepted is not delivered: never say one reached her, arrived or
  was delivered, nor head a column that way. When `archived` is above nought, add one
  more line, such as _"3 stopped, kept in the archive. Ask to see them."_ Asked, show
  them from `list --json --all`, the same table, Status finished. No line on
  switching view: this table is the same on every screen.
