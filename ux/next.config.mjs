import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Opened from the owner's other computer through the remote tunnel (DPV-009,
  // scripts/remote.mjs), the page's host is a trycloudflare.com name, and the dev
  // server refuses its own assets to a host it does not know.
  allowedDevOrigins: ['*.trycloudflare.com'],

  // `next dev` otherwise appends a block of its own instructions to CLAUDE.md on
  // every start, and re-adds it if removed.
  //
  // CLAUDE.md is this repository's constitution, and its closing line says the
  // agent must never edit it — a rule change is raised with the developer for
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

  // How long the client router keeps a dynamic view it has already shown, and
  // serves it again on a client-side navigation without asking the server.
  //
  // Next's default for a dynamic route is 0s, and every route here is
  // force-dynamic, so every tab change was a full server render: 186-300ms a
  // page under `next dev` in the 2026-10-07 audit (DES-008), and the tab that
  // was visited a moment ago paid it again. 30s covers moving back and forth
  // between a few tabs in one sitting.
  //
  // Development only, because only there is the cached copy kept honest. Under
  // `next dev` components/shell/WatchForChanges.jsx hears every change on disk
  // and ends it in router.refresh(), which clears the whole client cache, so a
  // revisit never shows a view a change has overtaken. A build served by
  // `next start` (`npm run work`) has no watcher, and there a cached revisit
  // could be up to 30s behind the disk, against the rule that every view shows
  // what is on disk now. It keeps Next's 0s, and `next start` is fast enough
  // without it (11-20ms a page in the same audit).
  //
  // `static` is left alone: nothing here is statically generated. It would also
  // govern how long a loading.jsx shell is reused, but neither app has one, on
  // purpose: a route-level boundary blanks the page being read the instant a
  // link is clicked, which on a read this fast is a flash, not feedback. The
  // router holds the current page until the next is ready, and a genuinely slow
  // read shows on the clicked link instead (components/ui/Reading.jsx).
  ...(process.env.NODE_ENV !== 'production' && {
    experimental: {
      staleTimes: {
        dynamic: 30,
      },
    },
  }),

  // No file-tracing settings, deliberately. They existed to pack data/ and
  // .claude/ into a serverless bundle for a hosted deployment, and there is none:
  // the surface runs on her machine only, and reads both folders straight off
  // disk at request time.
};

export default nextConfig;
