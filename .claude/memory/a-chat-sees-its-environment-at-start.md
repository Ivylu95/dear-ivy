# A chat sees its environment only from when its machine started

**Seen 2026-11-03.** The developer added a key to the Default environment and asked
twice for it to be checked; both checks, run in the chat he was talking to, read
"not set". A fresh helper chat, started after the save, saw the key at once.

A cloud chat's machine reads the environment's variables and network list when it
starts, and never again. So a key or an allowed domain added since is invisible to
every chat already running, which is not the key failing.

- **Check from a chat started after the save**: start a short helper session in that
  environment, read-only, reporting only whether each key is set and what Telegram's
  `getMe` names; archive it after.
- **Say so plainly** to the developer: the old chat is in the right environment and
  works as before; it sees the new settings once its machine is next replaced, after
  a quiet spell. An agent cannot restart its own machine.
