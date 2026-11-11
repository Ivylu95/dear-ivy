# Feedback for the developer

What should change in how this works, kept for the developer. It lives in her
folder because she asked, on 2026-11-06, that nothing outside it is ever edited.
New feedback is added here, newest at the end, and also curated in the
💬 Any Feedback chat: a short version for her, a full one for the developer.

## Entries

- Rule: ship what the steps point at in a person's copy, or point the steps elsewhere.
  Why: this copy has no developer folder, no commands folder and no workflows folder, yet the main instructions, the dev-mode switch and set-up's running file name them; a run's dated case has nowhere to go, and the messaging and merge workflows are absent from the copy and its history.
- Rule: teach the harness-lock guard to tell arrows and commit-message lines from shell writes.
  Why: it refused an arrow function inside node -e and a session link line inside git commit -m, both as writes; a message file and jq got round it.
- Rule: check scheduled-task prompts against the record layout whenever a migration moves files.
  Why: two scheduled check-ins made before the core layout still name the old folders, and nothing caught it.
- Rule: allow the messaging service's docs host in the cloud network, or ground its click paths another way.
  Why: its docs page would not resolve from the cloud session, so the bot steps could not be checked against the service's own page before handing them over.
- Rule: show the chat ID address in the bot step with a made-up token already filled in, saying the angle brackets go and nothing else changes.
  Why: the placeholder form left the person asking how to put the token in and which site gives the chat ID.
- Rule: make the crisis-continuation hook key on the chat it is running in, and the profile hook read the current profile path.
  Why: in a chat with no crisis message, the safety-floor hook said a crisis had happened and that she had said where something was; the profile hook also said seven questions were owed when the current profile has them answered.
- Rule: have the routine step say which connectors to keep, the calendar one only, since the check-in refreshes the calendar copy through it.
  Why: the step said to remove every connector, which would starve the check-in of the calendar; the person kept them all instead.
- Rule: make the run claim time out and say why, rather than hang until the run is aborted.
  Why: the first run by hand stopped at the claim step after a minute and a half and ended as an error, with no line saying what it waited on.
- Rule: have the routine step say a run by hand only proves the pipe once the reminders flag has reached main.
  Why: the first run by hand read main before the flag landed, so it reported reminders as not sent.
- Rule: name the scheduled task as the heartbeat in the routine step, and say how to see a run started, its run list on the task page.
  Why: the person asked whether the test lived in the heartbeat and whether running it was the test, and the task showed no new run after they reported trying.
- Rule: when the set-up skill asks for a dated case in a person's copy, point it at this file, since the developer folder is absent.
  Why: the gap rule named a cases file that a person's copy cannot hold or write.
- Rule: ship a person's copy with no development mode at all: no dev-mode switch or command, no dev reply shapes or menus (DEV-003), no developer route in skills, no development-mode lines in the session hooks or the main instructions.
  Why: the person, in their own copy with no developer folder, asked that every development mode and development reply template be removed from it; the copy cannot change its own harness (DEP-013), so it has to come in a release.
- Rule: give a first install over an old-shape copy its own import inside apply: renames in a commit of their own, link rewrites inside backticks and link targets only, blank and module files, the index folded into the README, the profile header, the release source.
  Why: v1.0.2 carried no import, so all of it was a hand-run runbook of eleven steps; the scripts that did it went to the developer.
- Rule: have apply remove the old harness files the release does not carry, in its own code, keeping the copy's update log.
  Why: the old copy denies rm and git rm to agents, a settings edit does not take effect mid-session, and a cloud chat cannot run commands the person types into it, so the removal needed a workaround and a separate yes.
- Rule: have apply install the release's ux packages before its commit.
  Why: the release's dependencies differ from the old copy's, and the commit gate failed on packages that were not installed.
- Rule: run verify's trial on a scratch copy of the real record, outside the repository, through the full commit gate, before the phrase is printed.
  Why: v1.0.1 passed verify on a blank record, then failed in place on the record's layout, and next was refused by seventeen checks at commit.
- Rule: when apply is refused, print which checks failed, with names redacted.
  Why: the refusal line hid seventeen failing checks; the commit had to be rebuilt by hand in a throwaway clone to see them.
- Rule: push the update to main only after the in-place self-test passes, and push the revert when it rolls back.
  Why: the post-commit hook pushed the update to main first; the rollback's revert stayed local, so main held a broken harness until it was pushed by hand.
- Rule: unset core.hooksPath when an update rolls back.
  Why: it outlived the rollback, pointing at a folder that no longer existed.
- Rule: clear the empty folders that moves and removals leave, or have the working-tree checks ignore empty folders.
  Why: 85 were left; the sample and record-names checks failed on them although the commit gate never saw them.
- Rule: count a file written by the harness's own scripts as the session's own in the refused-staged gate.
  Why: it refused the dev-mode switch's own write to its chat list as a file the session never touched.
- Rule: never have a person paste a release key into a chat; keep a read-only key as an environment secret, or publish releases openly and trust the signature alone.
  Why: the same key was pasted twice and stays live; the paste-in fetch also carried rm, which the old copy refuses.
- Rule: write release notes that say what changes for the copy: layout, removed files, policies, dependencies.
  Why: the first release's one-line note told neither the owner nor the agent what the first install would do.
- Rule: check every invented record, the sandbox's included, against the names in the real record at install.
  Why: the old sandbox's invented person shared a first name with someone in the record.
- Rule: ship what the release's own files point at: a hooks-state README and a placeholder in each module's growing folder.
  Why: both were missing from v1.0.2 and were written by hand to pass the link check.

## From her, 2026-11-06

Her short version:

- 📱 Easy to read on my phone. Lists, not wide tables.
- 🙈 No techy stuff in my chats. Only my life.
- 🔒 Only my own notes get changed. Nothing else.
- 💬 All feedback goes to my "Any Feedback" chat.

The full version, for the developer:

1. **Phone first, everywhere.** Every reply reads easily on a phone, narrow by default: a list led by bold labels, a table only when the chat chose wide. The reminders skill's `seeing.md` shows reminders as one 8-column table "whatever the chat's view", with no line on switching; make the narrow list the default there, and the same in `check-ins.md`. Check every skill for other forced tables.
2. **No development mode in her copy** (no `dev/` folder). It never switches on: remove `dev-mode.mjs` and the dev-mode-reset, dev-reply-shape, dev-reply-check and dev-done-notify hooks, and the everyday-voice hook's line that switches development mode on for a plain development request. A development request gets one plain line: this copy can't change how it works, and changes come in an update. Ship none of the development reply shapes, the developer routes in skills (e.g. see-it's `developer.md`), or the development-mode rules in `CLAUDE.md` and the session hooks.
3. **Nothing written outside her record.** In her copy, a guard refuses every write outside `data/`, `temp/` included. Developer feedback lives in `data/FEEDBACK.md` (moved here from the root on 2026-11-06); point CON-017, the privacy check's FEEDBACK rules and every 🔧 instruction at it. Git work (merging, pushing her saves) touches only `data/`.
4. **One place for feedback.** Any request to change how the system works, in any chat, goes to the 💬 Any Feedback chat by default, and a chat that notices an improvement suggests sending it there. Build it in: a router row in `CLAUDE.md`, a step in the chats skill, `send_message` where the chat has it, and the chat marked as the feedback chat in `data/core/state/chats.json`. The feedback chat records each item here and curates it twice: a short version for her, a full one for the developer.

## From her, 2026-11-06, later

Her short version:

- ⏰ Messages come at the time I set, not up to an hour late.
- 📨 "Send it now" means now.
- 💾 Saving works on the first try.
- 🌙 Only my own things run in the background in my copy.

The full version, for the developer:

5. **On-time messages.** Reminders and check-ins go out with the hourly sweep, so an 8am message can land near 9am, and a 12:30 reminder as late as 1:30. She wants each at the time she set. Options: a one-off scheduled task at each due time, or a sweep that runs just after each due time.
6. **"Send it now" sends now.** Asked for a message right away, the reminders skill queued it for the next sweep. `send-one` already exists and worked; route "send it now" and "just send" straight to it, and say so in `setting.md`.
7. **Saves land on the first try.** Saving her record took several tries tonight:
   - the shell guard read `<` and a run of `>` inside a script, and a commit-message trailer, as file writes;
   - the pre-push gate refused a merge where one side already contained the other, until an empty "Kept one side" commit was added;
   - pushes raced her other chats.
8. **Only her jobs run in her copy** (curated by the feedback chat, not raised by her). The one hourly heartbeat runs every due job, the developer's included. Code maintenance, the heartbeat doctor, the safeguard check and the privacy check all change files outside `data/`, which breaks item 3. Only the dialogue loop stands down when there is no `dev/` folder. In a copy without `dev/`:
   - run only reminders and check-ins;
   - turn the safeguard, privacy and restore checks into report-only checks;
   - ship none of the developer jobs.
9. **Scheduled tasks follow the record when it moves** (curated by the feedback chat). Her evening check-in, a separate scheduled task, still names the record's old paths after the 1.0.2 move. Re-point every scheduled task whenever a migration moves files.
10. **Recommendations as a small table** (from her). Recommendations always come as a table that reads well on a phone: two or three short columns, short cells, never a list. This is the one exception to the narrow-by-default rule in item 1. Her short version: 📊 Recommendations in a small table that fits my phone.
11. **The recommendation table's shape** (from her). The structure she liked, for reminder ideas and drafts: three short columns, emoji first in the first cell, cells of a few words.

    | Reminder | When | Says something like |
    |---|---|---|
    | 💆 Facial | Fri 13 Nov, 5 pm | Facial at 6. Ask for the free eye treatment |

    Use this shape (thing · when · a few words) for any recommendation, and for showing her reminders, in every chat. Her short version: 📊 Keep that 3-column table for ideas and reminders.
12. **Show her reminders without being asked** (from her). She wants to see her current reminders proactively, so she can change them: in every morning update (set up), and in any chat right after a reminder is set, sent or changed, in the 3-column table of item 11, ending on a line that she can change any of them. The reminders skill only shows the list when she asks; build this in. Her short version: 🔔 Show me my reminders after any change, so I can tweak them.
13. **Suggest reminders from her calendar** (from her). She wants reminders suggested without asking: from time to time, look at her Google Calendar and recommend the reminders she may need, in the item 11 table, each set only on her yes. The reminders skill says "Never offers a reminder unasked" (CON-009); her ask overrides it for her, and the harness should let a person opt in to this. Her short version: 🗓️ Look at my calendar and suggest reminders I might need.
    *Curated by the feedback chat:* two rules stand in the way, not one.
    - CON-009, "never offers a reminder unasked". Make it an opt-in she can switch on and off, kept in her record like the check-in nudge.
    - The calendar row in `CLAUDE.md` says the calendar is "never from a heartbeat" (A-121). If the suggestions come "from time to time" unattended, that rule needs a read-only exception for this opt-in. Otherwise, suggest only inside a chat she has open, such as the morning update.
    - Either way, nothing is set or changed without her yes to the table.
14. **Scheduled tasks can be fixed from one place** (curated by the feedback chat). A scheduled task's instructions can only be changed from the chat it posts into. Her check-in chat rightly refused a change asked for by another chat. So after the 1.0.2 move, her evening check-in still names the old paths until she asks in that chat. Fix: write each scheduled task as a one-line pointer to a file in her record, the way the heartbeat points at its own file. Then a move only changes the file.
15. **The shell guard stops misreading writes** (curated by the feedback chat). In this chat it read a `$VARIABLE` path and `console.log(` inside a short script as file writes. This adds to item 7 and the existing harness-lock entry.
16. **Commit messages that quote an instruction** (curated by the feedback chat). The instructions ask every commit to quote the instruction it carries. The commit-message check refuses any message holding a name from her record, which is right. So when her instruction names her, the two clash. Say once which wins: quote without the name.
17. **The setup check sees the hourly routine** (found 2026-11-07, in a workouts chat). The setup check said the hourly routine was missing and that nothing reaches her phone. The routine was there, running every hour, its last run a success. So a new reminder was drafted with a false warning, and had to be corrected. Fix: let the setup check read the scheduled tasks themselves, or say "not checked" rather than "missing" when it can't.
18. **Reminders at the exact minute she asks** (from her, 2026-11-07). Her words: *"send the reminders at the exact time I asked you to send"*. Today they go out within the hour after their time, because one sender runs once an hour. She was told a 9:30 pm reminder could land near 10 pm and asked for that to stop. Fix: send each reminder at its own minute, for example a scheduled send per reminder time (the unused per-reminder option), or a sender that runs often enough to be on time. Her short version: ⏰ Send my reminders at the exact time I set.
    *Curated by the feedback chat:* this is item 5 again, asked for a second time, in a different chat, a day later. Treat on-time sending as one of her top asks.
    *Asked a third time, 2026-11-11, "strongly wanted":* the hourly sweep runs at :53, so her chosen times had to be moved to :53 slots. Breakfast "by 8:30" became 7:53am, and her evening medication "by 9:30 pm" became 8:53pm. She wants the medication reminder at 9:30pm on the dot and the breakfast nudge at 8:30am on the dot. Turn on exact-time sending: the per-reminder routine option already in `reminders.mjs`, or a sweep timed to each due time. Her short version: ⏰ Luna at the exact time I pick.
19. **The start-of-session git note can merge things that are not her saves** (curated by the feedback chat, 2026-11-07). Rehearsing the 1.0.2 install in throwaway clones outside the repository ran the release's own git hooks there. Their post-commit push sent the rehearsal commits back into this copy, as three `rescue/…` branches and two commits on local `main`, all under a test identity. At the next session start, the brief told the agent to merge each "rescue" branch into main and push, which would have put rehearsal commits into her real copy. They were renamed `rehearsal/…` and left unmerged, and local `main` was left as it is (force-moving it is refused). Fix:
    - don't push from a clone whose origin is a local path;
    - have the brief check a branch's author before calling it a save to rescue;
    - never tell an agent to merge a branch it hasn't checked.
20. **An unanswered setup question was dropped when the topic changed** (2026-11-07). She asked for food-logging check-ins. The reply asked her usual meal times, then she moved on to another reminder, and the check-ins were never set or asked about again. She later found nothing had come. Fix: keep an open setup question as a pending item, and bring it back once, at the next pause, before the turn closes.
21. **The pre-push gate reads a newer counter as a lost change** (curated by the feedback chat, 2026-11-08). The session start asked for two branches holding reminder-sent logs to be merged into main. The merge was settled by comparing entries: every sent entry of theirs was already in main's copy. The only difference was a send counter, which read 1 on their side and 2 on main's, because a later message went out. The gate compares lines, so it called that "a real loss" and refused the push, even with a "Kept one side" line. The two branches stay unmerged, though nothing of theirs is missing. Fix:
    - let the gate compare JSON record files by entry, and accept a counter that only went up;
    - or have the sender merge its own log as it saves, so its branches never conflict with main.
22. **Food nudges don't guess that a meal happened** (from her, 2026-11-08). This morning the food nudges were held back: "breakfast just under two hours past, lunch over an hour away". She hadn't eaten breakfast or logged anything. Her usual meal times aren't in her record at all, so the sweep guessed a breakfast time and treated it as eaten. She wants food nudges whether or not a meal is logged. Fix:
    - never assume a meal happened from the clock;
    - with no usual times on record, ask her for them once, or use fixed times;
    - an unlogged meal brings a nudge on, never holds one back.

    Item 20 is the same gap: her meal times were asked for once and then dropped. Her short version: 🍽️ Nudge me about food even if I haven't logged anything.
23. **Every message from Luna is easy to scan** (from her, 2026-11-11; Luna is her name for the Telegram bot). Every reminder and check-in uses short words and short phrases, in point form. Put one blank line between points, or group them by kind (work, food, health). The sweep applies this to every message it writes, so it doesn't depend on each reminder's own text. This goes with item 1: phone first, at a glance. Her short version: 📱 Luna: short points, gaps between, easy to scan.
    *Added the same day:* one emoji on each point, so she can spot each item at a glance. Her short version: 😊 Emojis on each point in Luna's messages.
    *And:* this style applies to every kind of Luna message: reminders, food and water nudges, medication, check-ins, workout check-ins, and any kind added later. Make it the sweep's default for all of them, the modules' too (fitness).