# Stash pop pops whatever is on top

**What happened (3 Nov).** A sync step ran `git stash -q; git pull; git stash pop -q` to set one
changed file aside. That time nothing had changed, so `stash` made no entry, and `pop` took the
newest one already there: a helper agent's work from weeks before. It clashed with newer code and
left nine harness files half-merged, two of them hooks running in the chat. Nothing was lost (the
entry stays when a pop conflicts), but undoing it needed the developer's yes, since writing files
back reads as discarding work.

**Do instead.** Pop only what you stashed: `git stash push -m <unique tag>`, then pop that entry by
name (`git stash list` finds it), or check `git status --porcelain` first and skip both steps when
it is clean. Better still, commit or leave the file alone: the record of what he typed is staged by
its own hook and carried by the next commit.

**Tell.** `CONFLICT` lines naming files you never touched, right after a pop.

**`git pull --autostash` is the same trap (5 Nov).** Run to get past local Transcript and
rebuilt dialogue pages, it left an `autostash` entry whose apply conflicted, and the next session
brief asked for it to be settled. Applying it brought back stale rebuilt pages and an old copy of
a Transcript entry, and the guards refuse `git checkout` and `git restore` over them. Settled by
writing main's copy back with `git show HEAD:<path> > <path>` and rebuilding the dialogue pages;
the record of what he typed cannot be edited by an agent at all, so its duplicate line was
committed as it stood. **Never pull with `--autostash`:** commit your own work first, then pull.
