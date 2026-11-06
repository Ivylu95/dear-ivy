# .claude

The agent harness, laid out the way Claude Code expects: `commands/`, `hooks/`,
`skills/`, `CLAUDE.md` and `settings.json` are the tool's own, and its
documentation describes them. Only the folders below are this project's design,
so only they are listed here (FND-002). What each part must hold is in
[`dev/specs/system/ARCHITECTURE.md`](../dev/specs/system/ARCHITECTURE.md). Superseded
harness material is not kept here: git history holds every earlier version.

| Folder | What it holds |
|---|---|
| [`memory/`](memory/README.md) | What past sessions learned the hard way about the harness |
| [`jobs/`](jobs/README.md) | The heartbeat: its orchestrator's prompt and record, one file per job, and each run's summary |
| [`migrations/`](migrations/README.md) | How a record moves to a new shape when a release changes how it is read: each format's version, and one numbered script per change |
