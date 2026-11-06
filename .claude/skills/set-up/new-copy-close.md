# A new copy, steps 12 to 16 and the close

**Read when** a new copy reaches step 12 after [`new-copy-finish.md`](new-copy-finish.md)'s steps 8 to 11, or its close, a port's cut-over, or a part's step here named in `components.md`. [`new-copy.md`](new-copy.md)'s opening holds here too: every account theirs, signed in as them, placeholders, the nevers, and what each step says. Never: gitignore `data/` (it is the memory) · host the dashboard (localhost only) · leave a token in a remote URL · open a pull request or protect `main`. Until step 12, whoever types is setting it up, and is asked no profile question; an open case in `cases.md` is warned of before its step.

### 12. The first conversation

**On a port, first**, its cut-over ([`port.md`](port.md)). Step 9 adds the new repository to the Claude app's access, and step 11 picks it on her phone (one still on the old has not). In the new folder, fetch the old repository again and import anything saved there since (import step 4's check, again). The old repository's app access is removed only after a second session reads the new one back (step 13), then its last fetch and check; never archived first. Then, on their phone, they open a session in the Claude app's **Code** tab, on their repository, branch `main`. A *branch* is a line of saves, and `main` is the one that counts. They say anything ("hi"), since it cannot speak first. It is theirs; nobody reads over their shoulder.

**You should see** the profile questions, one at a time.

**If not:** check the session is on `dear-<name>`, branch `main`, and start again; still not, step 13's doctor first.

### 13. Check it is saving

**Where:** their computer, in the copy's folder. Run `node ux/scripts/setup-doctor.mjs --fetch` (*the doctor*).

**You should see** the session's commit on `main` within seconds, and a green `merge-sessions` run in the repository's **Actions** tab.

**If not:** on its own branch with a failed run: step 10. No commit and no run: step 9. A stranded commit is not lost (`repair.md`). A **second** session that knows the first closes the loop.

### 14. The second copy

**Where:** their own computer. A second copy is a clone kept up to date on a schedule, so the record exists off GitHub too.

Run `git clone https://github.com/<them>/dear-<name>.git`. **On a port**, clone into a new folder, since the old clone cannot fast-forward, so its scheduled pull moves. Pull it on a schedule as them, with `git -C <folder> pull --ff-only` from Task Scheduler, `cron` or a LaunchAgent, whichever the system has, its current steps from its own page, fetched now. Git's credential manager holds their sign-in. Keep it off a synced drive (on Windows, Documents is often OneDrive, so not there), on an encrypted disk (BitLocker, Device encryption, FileVault).

**You should see** after the first scheduled run, `git -C <folder> log -1` match main on GitHub. Nothing notices if the pull stops later.

**If not:** run `git -C <folder> pull --ff-only` by hand and read its message. A sign-in prompt means the credential manager lacks theirs. *Not possible to fast-forward* means the folder is not a clone of this repository (on a port, the old one).

### 15. The check-in nudge and reminders on Telegram (only if wanted)

Only if they want messages between conversations: its items, 15.1 to 15.4, are in [`telegram.md`](telegram.md), 15.5 in [`telegram-routine.md`](telegram-routine.md). **Declined: this session disables `heartbeats.yml` (it starts every two hours whatever is set), no question asked, and that same reply begins step 16.**

### 16. Leave no access

Only for a setup done for someone else, last. **Where:** their computer and the helper's own devices. Revoke every token the helper made, on the token settings page of its account, its path fetched now. Sign the helper out of their machine's browser and git credential store, and clear shell history that held a token. Sign out of their accounts on the helper's devices. Check every token's end is in the setup notes (step 15). On a port, the old repository too loses its collaborators and any token of the helper's that reaches it.

**You should see** their GitHub sessions list only their devices, collaborators list nobody, and the read token gone.

**If not:** any of them still there: removed now, by them, signed in as themselves, and looked at again.

## The two steps invisible when missed

Never bundle or pass on a setting alone **the Actions write permission** (step 10, `🔵` until a phone save is carried into main). The same goes for **the crisis numbers** (step 7, judged against the recorded country).

## Finish on evidence

Done is a conversation saved and read back by a second session, not the last step run, and never while the doctor reads `failed`. Say which marks rest on a confirmation alone, and what would prove each. Close with what is now true, what is outstanding, the tokens that expire and when, and that her own answers are `first-contact`'s, never collected here.
