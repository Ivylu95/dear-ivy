import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // `next dev` otherwise appends a block of its own instructions to CLAUDE.md on
  // every start, and re-adds it if removed.
  //
  // CLAUDE.md is this repository's constitution, and its closing line says the
  // agent must never edit it — a rule change goes to data/state/proposals.md for
  // a person to apply by hand. A framework quietly writing into that file defeats
  // the rule from outside it, and the appended text would then be loaded as
  // instruction in every session thereafter.
  //
  // Off. Next's own docs stay readable in node_modules/next/dist/docs/ for anyone
  // who needs them.
  agentRules: false,

  // The repository root, not ux/, so the app may import the profile's rules from
  // .claude/hooks/lib/profile-schema.mjs. They live there because keeping the
  // profile valid is harness enforcement that must hold whether or not the
  // dashboard is running; the app is one reader among several, not the owner.
  turbopack: {
    root: join(dirname(fileURLToPath(import.meta.url)), '..'),
  },

  // No file-tracing settings, deliberately. They existed to pack data/ and
  // .claude/ into a serverless bundle for a hosted deployment, and there is none:
  // the surface runs on her machine only, and reads both folders straight off
  // disk at request time.
};

export default nextConfig;
