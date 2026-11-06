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
