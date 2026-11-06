// `node --import ./test/register.mjs --test`: resolves imports as Next does
// (aliases.mjs), so the tests import lib/ modules unchanged.
//
// It also points the real record at the invented one (SMP-001), before any
// lib/ module reads where the record is. Outside a request the read layer
// falls back to the real record, and on 2026-10-09 a timing script run under
// this loader without inRecord(sample) read hers. Now nothing run through it
// can: data-dir.js takes DEAR_DATA first, and it is set here, not defaulted.
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DEAR_DATA = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data-sample');

register('./aliases.mjs', import.meta.url);
