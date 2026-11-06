# A new copy, steps 1 and 2

**Read when** walking steps 1 and 2 of a new copy (their accounts, then the computer's tools) after [`new-copy-run.md`](new-copy-run.md), or one part's step there; steps 3 to 7 are [`new-copy-download.md`](new-copy-download.md). Walk them one per message. Until step 12, whoever is typing is setting it up, and is asked no profile question; an open case in `cases.md` is warned of before its step.

Numbers are stable, and cited. Every account (GitHub, Claude, Telegram) is **theirs** (`PRV-001`); someone else can pay, nobody else is a collaborator. There are three identities, and git will not guess between them. **The helper's** only reads the source (the clone's read token). **Theirs** writes everything from step 8. Steps 4 to 7 use no network. A command run as the wrong one is the commonest failure. In commands, `<angle brackets>` are placeholders and the rest is literal (`x-access-token` too: git ignores the username when the password is a token). Steps 2 to 8 and `claude setup-token` need a computer, theirs. Never: gitignore `data/` (it is the memory) · host the dashboard (localhost only) · leave a token in a remote URL · open a pull request or protect `main`.

**Every step below says what to do and on which device, what they should see, and what to do if they don't.** A word they may not know is explained the first time, in brackets; a click path not written here comes from the service's page fetched now (`running.md`), never from memory.

### 1. Make their repository

**Where:** in a web browser on any computer, signed in to **their** GitHub (the avatar menu, top right, names them, not the helper). A *repository* is the private folder on GitHub that holds the copy and every past version of it.

Make a private repository named `dear-<name>`: no README, no `.gitignore`, no licence, no collaborators (a *collaborator* is another account given access), the helper included. GitHub's page for creating a repository gives the click path, fetched now. Turn two-factor sign-in on (a second check after the password, such as a code from an app). They keep its recovery codes somewhere other than the phone, printed or in a password manager, never typed into a chat. Recovery codes are one-time codes GitHub shows once, the way back in if the phone is lost. The same goes for their Claude account. The name, ASCII letters, digits and hyphens, used as GitHub shows it, sits outside `data/`, in URLs and clones: say so once, and let them choose it.

**You should see** the empty repository's *quick setup* page at `github.com/<them>/dear-<name>` (a README refuses step 8).

**If not:** a README or other files listed means it was not made empty. Carry on. Step 8's push is then refused, and `repair-push.md`'s *fetch first* settles it. A *404* at that address: check the owner in the address is them, and that they are signed in.

### 2. Git and Node on that computer, with their identity

**Where:** on **their** computer, the one the copy will live on. A *terminal* is the window commands are typed into: Git Bash on Windows (installed with Git), Terminal on macOS.

One install per message, each checked before the next. Git 2.28 or newer (`git --version`): Git for Windows with every default, commands in Git Bash (not PowerShell). On macOS, `git --version` offers the tools. Node.js comes from nodejs.org. Claude Code comes from its install page on code.claude.com, fetched now. They sign in as themselves on a personal Pro or Max plan, or Ultra, in their name (`support.claude.com` 11145838, 2026-11-05). Scheduled tasks need a paid plan (`code.claude.com/docs/en/routines`, 2026-10-29). Never use a work or Team seat, or the helper's, because every session there, an import's included, runs on that account. With no identity the step 8 commit fails (*"Please tell me who you are"*): `git config --global user.name "<their name>"`, `user.email "<their github email>"` (the name and email git writes on every save).

**You should see** `git --version` print 2.28 or newer, `node --version` print a version, and `git config --global user.email` print theirs.

**If not:** *command not found* straight after an install: close the terminal, open a new one, and run it again. If it is still not found, run the installer again. Git older than 2.28: install the current one over it. The email printed is the helper's: set theirs with the line above.

Then [`new-copy-download.md`](new-copy-download.md), steps 3 to 7.
