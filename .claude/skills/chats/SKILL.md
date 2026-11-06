---
name: chats
description: The brief says "A CHAT TO OFFER" or "THIS CHAT is not on her chat list", she asks for a new chat for something, or brings up what another of her chats is for.
---

# Chats

**Goal:** Each lasting part of her life here has its own chat that already knows it, so she never has to know to make one or explain herself again.

**Audience:** The person, in her own chats.

**Reads:** her chat list, `data/core/state/chats.json` (its `chats` and `offers`), what each area's chat is (`"chat"` in each `modules/<name>/module.json`), and the brief's `THIS CHAT` and `A CHAT TO OFFER` lines.

Card A-158, FIT-002. One chat for how she is and her days (core's), and one for each area she
uses that names a chat of its own, like food and training. Nothing here is personal.

## Offering one

The brief names an area she uses with no open everyday chat, and no answer kept for it.

- **When:** once, at a calm, natural pause, after whatever she came with and after any
  profile question. Never on a hard day, never in a crisis, never while she is telling
  something that matters to her, and one offer a session at most. Not today means later,
  not never: leave it for the next calm session.
- **How:** one plain line, about her life, never about the system: _"Would a chat just for
  your training and food help? It'd keep all of that in one place, and remember it."_ Name
  what it is for in her terms, never "module".
- **Her answer is kept** under `offers` in `chats.json`, whatever it is:
  `"<module>": { "date": "YYYY-MM-DD", "answer": "yes" | "no" | "<her words>" }`. Any answer
  there stops the offer for good; only she brings it up again.
- **"Use this one" or another she has:** add the area to that chat's `modules` and keep
  `"answer": "this chat"`. One chat may cover several areas.
- **Handing an area to another chat** is part of this protocol, every time. Where this
  session has the remote-session message tool (`send_message`), send that chat the handover
  yourself. Say what it now covers and what to read. Ask it to open with a short summary and
  one question, in her everyday voice, saying nothing of how the message arrived. Never hand her
  a message to paste. Where there is no such tool, the chat picks the area up from her list
  the next time she opens it.

## Starting one, on her yes

1. **Start it**, where this session has the remote-session tool (`create_session`, Claude
   Code on the web). Title it `"<emoji> <title>"` from the module's `chat`, with no prompt.
   A prompt would read as her first message. Nothing is started without her plain yes.
2. **Put it on her list:** `{ "url": "https://claude.ai/code/<session id>", "title": …,
   "for": <the module's for, in her terms>, "kind": "everyday", "state": "open",
   "modules": ["<module>"] }`, and `"answer": "yes"` under `offers`. Push it, as any record
   write.
3. **Hand her the link** in one line, named: _"Here it is: 🏋️ Food and training."_ Never
   the raw address alone.

Where no such tool is here (a desktop or phone copy): tell her in one line to start a new
chat and call it that name. The first time she talks in it, the brief says `THIS CHAT is not
on her chat list`: add it then, with what she is talking about as its area, never asking her
to.

## Something that has its own chat

The brief's `THIS CHAT` line says what this chat is for and what her others are for.

- **Answer it here, briefly:** a few lines, just the headline of what she asked. Never send her
  away with no answer, and never the whole picture either: this chat is not a second copy of
  that one.
- **Then name where it lives**, in the same reply: _"The rest of this lives in your Weekend
  plans chat, if you want to carry on there."_
- **Nothing that carries it on here:** no closing question about that topic, no follow-up that
  invites more of it in this chat. If she keeps going with it here anyway, answer short again
  and point once more, never a lecture.
- **Once a session, offer to start it off there.** Where this session has `send_message`, offer
  in one line to have that chat open the conversation. On her yes, send it the handover as in
  *Handing an area to another chat*.
- Never on a hard day or in a crisis: there she is answered fully, wherever she is.
- A message that mixes this chat's topic with another's: this chat's part in full, the other's
  briefly, then where it lives.
- Whatever she told you is kept in her record as always; every chat reads the same record.

## Keeping the list current

- **Its name is the app's.** On a chat's first turn here, and whenever she says she renamed it,
  the brief's `CHAT NAME` line asks for one lookup: `get_session`, then
  `node .claude/hooks/lib/chats.mjs app-name "<its title>"`, which keeps the old name under
  `formerly` and marks the entry `"title_from": "app"`; the turn is held once until it is done.
  Silently, unless the name changed.
- A chat she says she has finished with is marked `"state": "closed"`, never removed.
- What a chat is for changes when she uses it for something else for good: update `for`
  and `modules`, said in her words.

## Never

- Never a chat started, renamed or closed without her saying so.
- Never offered twice once she has answered; never on a hard day or in a crisis.
- Never a development chat offered, linked or counted: they are the developer's.
