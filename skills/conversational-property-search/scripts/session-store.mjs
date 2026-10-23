import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const SESSION_TTL_MS = 24 * 60 * 60 * 1_000;

export const EMPTY_FILTERS = Object.freeze({
  city: null,
  maxPrice: null,
  beds: null,
  baths: null,
  sqft: null,
  type: null,
  pool: null,
  hasView: null,
  maxHoa: null,
});

/**
 * Create a blank conversation state. The state stores only search preferences
 * and listing identifiers; full MLS records and credentials are never written
 * to the session file.
 */
export function createSession(now = Date.now(), ttlMs = SESSION_TTL_MS) {
  return {
    filters: { ...EMPTY_FILTERS },
    lastResultIds: [],
    conversationStep: 0,
    updatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  };
}

function validateUserId(userId) {
  if (typeof userId !== "string" || userId.trim() === "") {
    throw new TypeError("userId must be a non-empty string");
  }
  if (userId.length > 256) throw new RangeError("userId must be at most 256 characters");
  return userId.trim();
}

/**
 * Hash the channel identity before using it as a filename. Phone numbers and
 * other sender identifiers therefore do not appear in directory listings.
 */
function sessionKey(userId) {
  return createHash("sha256").update(validateUserId(userId)).digest("hex");
}

export function defaultSessionDirectory(env = process.env) {
  return resolve(env.IDX_SESSION_STORE ?? join(homedir(), ".openclaw", "state", "idx-property-sessions"));
}

/**
 * File-backed storage survives separate OpenClaw command invocations. Each
 * user gets a private JSON file and writes use rename(), so readers never see
 * a partly-written document.
 */
export function createFileSessionStore({
  directory = defaultSessionDirectory(),
  ttlMs = SESSION_TTL_MS,
  now = () => Date.now(),
} = {}) {
  const fileFor = (userId) => join(directory, `${sessionKey(userId)}.json`);

  return {
    async getSession(userId) {
      const path = fileFor(userId);
      try {
        const session = JSON.parse(await readFile(path, "utf8"));
        if (Date.parse(session.expiresAt) <= now()) {
          await rm(path, { force: true });
          return createSession(now(), ttlMs);
        }
        return session;
      } catch (error) {
        if (error?.code === "ENOENT") return createSession(now(), ttlMs);
        throw new Error("Unable to read the property-search session", { cause: error });
      }
    },

    async updateSession(userId, session) {
      validateUserId(userId);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const timestamp = now();
      const stored = {
        ...session,
        updatedAt: new Date(timestamp).toISOString(),
        expiresAt: new Date(timestamp + ttlMs).toISOString(),
      };
      const path = fileFor(userId);
      const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(stored, null, 2)}\n`, { mode: 0o600 });
      await rename(temporaryPath, path);
      return stored;
    },

    async clearSession(userId) {
      await rm(fileFor(userId), { force: true });
    },
  };
}
