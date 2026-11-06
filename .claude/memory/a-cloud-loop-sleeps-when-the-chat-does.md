# A cloud loop sleeps when the chat does

**What happened (3 to 4 Nov).** A six-hour heartbeat stress test ran on the loop skill, self-paced
with ScheduleWakeup. Round 1 ran; round 2, set for 03:11, never fired: the cloud chat stayed idle
until the developer's next message the morning after, so the extra sweeps he asked for were never
started and the "stress test" was only the ordinary scheduled runs.

**Do instead.** For unattended work over hours, use what runs without the chat: a scheduled task
(`send_later` or `create_trigger`, which fire into the session or a fresh one), or fire the work
itself on its own schedule (`fire_trigger` on the sweep), and check the result afterwards. Say up
front that a loop in this chat needs the chat awake.

**Tell.** A loop's next round never reports, and the chat's next turn is the person's message.
