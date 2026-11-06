# A new copy, steps 8 to 11

**Read when** a new copy reaches step 8 after [`new-copy-download.md`](new-copy-download.md)'s 3 to 7, or a part's step here named in `components.md`; [`new-copy-close.md`](new-copy-close.md) holds 12 to 16 and the close. [`new-copy.md`](new-copy.md)'s opening holds here too: every account theirs, signed in as them, placeholders, the nevers, and what each step says. Step 8 needs a computer, theirs. Steps 9 and 10 need a browser signed in to their GitHub, and step 11 needs their phone. Never: gitignore `data/` (it is the memory) · host the dashboard (localhost only) · leave a token in a remote URL · open a pull request or protect `main`. Until step 12, whoever is typing is setting it up, and is asked no profile question; an open case in `cases.md` is warned of before its step.

### 8. Commit and push to their repository

The agent runs it, in the copy's folder on their computer; the login is theirs. A *commit* is a saved snapshot of the files, and a *push* sends commits to GitHub. `origin` is the name git gives their repository. Git opens a browser sign-in the first time it pushes. Before that, check which account the browser already holds. If it is the helper's, sign out or use a private window (one that keeps no sign-in afterwards).

```sh
git add -A
git commit -m "record: start a new record"
git remote add origin https://github.com/<them>/dear-<name>.git
git push -u origin main
```

**You should see** `main -> main`, and one commit on their GitHub with `data/` in it: one commit proves the history was cut (after an import, several, none older than the download). **A refused push**: [`repair-push.md`](repair-push.md). **Refused by the gate** (`pre-commit: commit refused`): `running.md`'s rule, an import's earlier commits standing. An open case in `cases.md` may name it.

### 9. Let Claude reach the repository

**Where:** a browser, signed in to their GitHub. A *GitHub App* is a permission given to a service, here Claude, for the repositories chosen.

Install the [Claude GitHub App](https://github.com/apps/claude) on their account, granted that one repository. **On a port**, add the new one, and remove the old one's access only after a second session reads the new one back.

**You should see** it under Settings → Applications, one repository (two during a port); only step 13 proves it.

**If not:** when it is not listed, open the app's link again, signed in as them, and install it. When it is listed without `dear-<name>`, add it at Settings → Applications → Installed GitHub Apps → Claude → Configure → Repository access. Every repository granted rather than one: narrow it to this one.

### 10. Let the saves reach `main`

**Where:** a browser, in their repository's own **Settings** tab (the repository's, not the account's). *Actions* is GitHub's way of running small programs, called *workflows*, inside the repository. `merge-sessions` is the one that carries each phone conversation's save into `main`, and it needs leave to write.

Settings → Actions → General → Workflow permissions → **Read and write permissions**, then save; `main` unprotected, no required reviews (`DEP-007`).

**You should see** **Read and write permissions** still selected when the page is opened again; only step 13 proves it.

**If not:** if the option cannot be chosen, ask for a screenshot (`running.md`). The repository should be on their own account (step 1). A rule protecting `main`, or requiring reviews, listed in the repository's settings: removed by them.

### 11. Their phone

**Where:** their phone. Open the **Claude** app, signed in as them, then the **Code** tab, with GitHub connected. Use the **Default** environment, with network **Trusted**, never Full. An *environment* is the settings a cloud session runs with: which websites it may reach, and values it can read. Where the app's screens differ from these names, its help page is fetched now (`running.md`).

**You should see** `dear-<name>` selectable in the Code tab.

**If not:** no repositories at all: GitHub is not connected in the app, or as another account. Others listed but not this one: step 9 did not grant it.

Then [`new-copy-close.md`](new-copy-close.md), steps 12 to 16.
