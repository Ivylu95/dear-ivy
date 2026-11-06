# How to write what people read here

Everything she reads, and everything the developer reads, should flow like a good
book (A-171). This page says how. It holds for her chats, development replies,
published pages, skills, notes and anything else a person will read.

**When the developer says something reads hard**, add the passage to `dev/hard-to-read.md`, word for word, with its file: harness files only, never her record. The check fails until it is rewritten (A-171).

## The sentence

- **One idea per sentence.** If a sentence has two ideas, make it two sentences.
- **About twenty words or fewer.** A check flags anything past thirty.
- **Someone or something does a plain verb.** Write "the check refuses it", not
  "refusal occurs". Put the doer first, then what it does.
- **Pick up where the last sentence ended.** Start with something the reader
  already knows, and put the new part at the end. The next sentence can then
  start from that new part.

## What to avoid

- **Stacked nouns.** "The development hook's lines" makes the reader unpack it.
  Write "the lines the development hook adds".
- **Colons and semicolons standing in for sentences.** "Hers by default; his
  only in development mode" is two sentences squeezed into one. Write them out.
- **Shorthand only the agents know.** A row number, a file name or a coined
  word needs a few plain words around it the first time it appears.
- **Things doing what only people do.** A check doesn't "decide" or "want".
  Say what it actually does.
- **Leaving out the subject.** "Checks the crisis first" leaves the reader
  guessing who checks. Write "It checks for a crisis first".

## An example

Hard to read:

> Checks the crisis first, then picks one route: hers by default; his only when
> this turn carries the development hook's lines. When unsure, hers.

Easy to read:

> First it checks whether anyone is in danger. If not, it decides who the
> picture is for. Usually that's her. It only uses the developer's route in
> development mode. If it can't tell, it assumes the picture is for her.

The second version is longer. It is still faster to read, because you only
read it once.

## What stays the same

Lists, tables, headings and the reply shapes all stay. Only the sentences
inside them change. A block a check protects changes only on the developer's
yes. Set-up's **Must hold** list and a skill's **Goal:** line are two such
blocks. A rewrite leaves them exactly as they were, unless he asked. Quotes keep their writer's words exactly. A skill that
grows past its word limit because of plain sentences gets split into parts,
never squeezed back into shorthand.

## Why

Researchers at NYU and UT Austin found that AI models write sentences that are
harder to process than people's. They stack nouns, leave long gaps between
words that belong together, and give objects actions only people take. Their
explanation is that training rewards packing in information rather than
explaining it ("Why is AI-generated language so hard to understand?", arXiv
2610.29162, October 2026). Plain-language guides say the same thing about human
writing.
