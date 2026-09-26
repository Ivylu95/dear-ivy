import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';

// The ruleset `next lint` used to apply, run through the ESLint CLI instead: Next 16
// removed `next lint`. `npm run lint` points it at app/, components/ and lib/.
export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // Every view renders markdown from data/ as server-side HTML on purpose. The
      // only writer of those files is the agent she talks to, inside a private
      // single-member repository, so it is not untrusted input.
      'react/no-danger': 'off',

      // core-web-vitals does not turn this on, so an import left behind by the
      // edit that removed its last use passed the gate silently — which is how
      // two of them survived in code written the same afternoon. Dead code in
      // this repository is not a tidiness question: every file here carries the
      // argument for why it is shaped the way it is, and a binding with no use
      // is a line of that argument which is no longer true.
      //
      // `after-used` so a signature can still name the arguments it skips over,
      // and an `_` prefix is the way to say a binding is deliberately unused —
      // see PLAIN in lib/code-highlight.js for the case that is really a name
      // rather than a value.
      'no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'data/**']),
]);
