# Take a new version

**Read when** she asks for a new version, pastes an update key, or asks to go back.

A new version reaches her only when she asks, signed by the person who set this up
and passed by this copy's own checks before any of its code runs. Then only her
typed phrase lets it in. The checks, quarantine and undo are in
[`update.mjs`](../../hooks/lib/update/update.mjs); this is the conversation around them.

## Must hold, whatever else happens

- **Never in a crisis.** If she is distressed or unsafe, the update waits: the
  crisis section of `CLAUDE.md` comes first, and nothing here is mentioned.
- **Her key is used once and kept nowhere.** It is the one secret she pastes, and
  the only one ever asked of her. Never in a file, the record, a
  commit message, a reply or a summary, and never repeated back, not even part of
  it. It passes once, on step 2's command line, the one way the key guard allows;
  the chat holds only what she pasted.
- **Her words, not the machinery's.** She hears what changes in plain words and
  the result in one line (`CON-013`). No file names, versions beyond the one in
  the phrase, commands or counts.
- **Only her typed phrase approves.** Never type it for her, never accept "yes"
  in its place, never write the record of it.
- **A key or phrase that reaches anyone but her is not used.** One plain line and
  a setup note; its issuer revokes it and sends another.

## Steps

1. **She asks, with a key.** If she asked without one, say in one line that the
   person who set this up sends a key with each update, and stop there.
2. **Fetch and check.** Run, with her key in place of `<key>` and nothing else
   on the line:
   `DEAR_RELEASE_KEY='<key>' node .claude/hooks/lib/update/update.mjs fetch`
3. **Held back, or any other failure** (it exits non-zero). If the key was refused, ask
   her once to paste it again and fetch again. If a change was not declared and releases were skipped since hers, fetch the versions in between as a fallback.
   Fetch them one at a time, oldest first, each as step 2, with the version after `fetch` and her key pasted again.
   **Each goes through steps 4 and 5 (its summary, her typed phrase) before the next.** The reply asking for her key again says so: one at a time, oldest first, each told in plain words and in only when she types its phrase. Otherwise, one plain line says the update did not go in, nothing changed, and the person who set this up will be told.
   A setup note names the failure in setup terms. Commit and push the update log. Stop.
4. **Passed:** tell her in a sentence or two what it changes, from the notes it
   printed, and that nothing in her record changes. It may list changes of her own after *It replaces changes made in this copy*. They are files outside `data/` she changed since the last update, which this one overwrites or removes (a job's run record is never one). Name them as replaced (kept in the history), unless first moved into a `local-` skill, which no update touches. A change to `policies/` (the terms she agreed to) is named on its own line before the phrase. Then give
   her the phrase it printed, on its own line. Ask her to send it exactly, as a message of its own, if she wants it. The phrase alone on the first line counts, lines after it don't spoil it, and capitals don't matter. The phrase is never translated: she types it as printed, in any language.
5. **She types the phrase:** run `node .claude/hooks/lib/update/update.mjs apply`.
   Push, then tell her the result in one line.
   A mistyped phrase changes nothing: say so gently, that it goes alone on its first line, exactly as shown, and let her try again. *Fetch again*: nothing changed, so ask her once to paste
   the key again. *Did not take* (this copy's own checks refused its commit): all is put back, then as step 3. Other files staged: commit them first, then run it again.
6. **After it applies,** the doctor again; a second copy is level once its pull has
   run since. In her chat, a setup note for it, never steps.
7. **She asks to go back:** run `node .claude/hooks/lib/update/update.mjs rollback`,
   push, and tell her in one line that she is back on the version before. Refused,
   or not undone cleanly, nothing changed: go on as step 3. **If her reminders misfire
   since an update, the same reply offers to pause them, on her word, through the
   `reminders` skill.** The developer ships the fix as a new release.

## A copy without the updater

A copy older than these steps takes the one-time message its helper sends:
follow it as written, under the same must-holds.
