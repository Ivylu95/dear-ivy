# Say a scheduled run happened only from its record

**What happened (5 Nov).** Asked whether the night message was working, a chat told the
developer "tonight's roster went out at 11:05". No run had happened: the job's record in
`.claude/jobs/state.json` still showed the morning's by-hand run, and no plan file for that
night existed. He would have waited for a message that was never coming.

**Do instead.** Before saying a scheduled job sent, ran or will run, read what proves it:
its line in `.claude/jobs/state.json` as GitHub's main holds it (`git show` it from the remote main),
the run's commit (`chore(heartbeats): finish …`), or the file it writes. When none shows it,
say it has not run yet, and when it is next due (`heartbeats.mjs` `due`).

**Tell.** A sentence about a run in the past tense with no commit or record behind it.
