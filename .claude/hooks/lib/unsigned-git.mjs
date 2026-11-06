// Tests make throwaway repositories and commit in them, hundreds of times a run. On a
// machine whose global git config signs every commit (commit.gpgsign=true, as cloud
// sessions do), each of those commits is signed through the machine's signer, and that
// signer has been seen to hold one connection open per signature and never close it:
// after a day of runs it reached its open-file limit (20,000) and every commit on the
// machine, real saves included, failed with "too many open files" (T-781, 2026-11-05).
//
// So a test runner hands its tests this environment: git's own GIT_CONFIG_COUNT
// mechanism, which outranks every config file, turns signing off for everything the
// tests run, and only for them. A real save, made by git outside a test, still signs.
// A test that checks signing itself drops these keys again with `withoutUnsigned`.

const KEYS = [['commit.gpgsign', 'false'], ['tag.gpgsign', 'false']];

/** The environment `base` with signing turned off for every git command run under it. */
export function unsignedEnv(base = process.env) {
  const env = { ...base };
  let n = Number.parseInt(env.GIT_CONFIG_COUNT ?? '0', 10);
  if (!Number.isInteger(n) || n < 0) n = 0;
  for (const [key, value] of KEYS) {
    env[`GIT_CONFIG_KEY_${n}`] = key;
    env[`GIT_CONFIG_VALUE_${n}`] = value;
    n += 1;
  }
  env.GIT_CONFIG_COUNT = String(n);
  return env;
}

/** The environment `base` with every GIT_CONFIG_* key removed, for a test of signing itself. */
export function withoutUnsigned(base = process.env) {
  return Object.fromEntries(Object.entries(base).filter(([k]) => !/^GIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+)$/.test(k)));
}
