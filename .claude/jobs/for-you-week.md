---
emoji: 📋
runs: local
gate: dev
every: 7 days
cron: 17 10 * * 0
timezone: Asia/Singapore
governs: DEV-013 in dev/specs/system/dev.md
---
# Heartbeat: the for-you short list

Once a week, on Sunday morning (A-178, *"My for-you list stays short"*): settle what
the developer left a week after it was put to him, then put the oldest few to him,
each with your pick. Harness only: read nothing under `data/`.

1. **Settle what is due.** Run `node ux/scripts/for-you-week.mjs settle`. It removes
   every question put to him a week or more ago that still has no answer, has a pick and
   is not at a gate, into `dev/for-you-closed.md`, and prints one `for-you: settled …`
   line each. Copy each line into your reply and the run's note, so his report names it.
   Then act on each settled pick, where acting is in your fence: a pick that needs a
   build too big for this run is left as settled, and the job that raised it brings it
   back if it still matters.
2. **Choose this week's few.** Run `node ux/scripts/for-you-week.mjs plan`. Its `ask` list
   holds the three oldest never put to him. For each with no `pick`, read the question
   and what it names in the harness, then write the answer you would choose, in one short
   sentence, with
   `node ux/scripts/for-you-week.mjs pick <n> --text "<your pick>"`. Add `--gate` when the
   question touches safety, privacy, money, a secret, or anything that cannot be undone:
   that one is never settled for him, however long it waits. When unsure, add `--gate`.
3. **Put them to him.** Run `node ux/scripts/for-you-week.mjs ask <n> <n> <n>`. It sends
   the short list to the development bot and marks each asked. With no development bot
   key it says so and marks nothing.
4. Commit `dev/for-you.md` and `dev/for-you-closed.md` with the `commit` skill, as
   `chore(for-you): weekly short list`. Reply with what was settled, what was asked
   (counts and a few words each), and anything you could not do.
