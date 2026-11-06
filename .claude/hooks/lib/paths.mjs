// Where the proprietary zone sits (ARC-007, FND-007): the developer's alone,
// never on a copy. Repository-relative, forward slashes; each reader joins them
// onto its own root, so moving the zone is a change to this file and nothing
// else. Naming a path is not reading it: a copy without dev/ still loads this,
// and every reader of these paths is development tooling (ARC-008).

export const DEV_DIR = 'dev';
export const SPECS_DIR = `${DEV_DIR}/specs`;
export const SKILLS_DIR = `${DEV_DIR}/skills`;
// What waits on the developer, and nothing else (A-152, DEV-013).
export const FOR_YOU_FILE = `${DEV_DIR}/for-you.md`;
// Every idea from a dev chat, his and the agents', until he builds, parks or drops it (A-125, WKB-017).
export const IDEAS_FILE = `${DEV_DIR}/ideas.md`;
// Each chat's end-of-session review, by the commit it was made at (DEV-020).
export const SESSION_REVIEWS_FILE = `${DEV_DIR}/session-reviews.md`;
export const HYGIENE_LOG_FILE = `${DEV_DIR}/hygiene-log.jsonl`;
