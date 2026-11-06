import { createReadStream, createWriteStream } from "node:fs";
import { access, mkdir, rename, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { once } from "node:events";
import { randomUUID } from "node:crypto";

export const INDEX_VERSION = 1;

export function defaultIndexPath(env = process.env) {
  const configuredPath = env.IDX_SEMANTIC_INDEX;
  if (!configuredPath) return join(homedir(), ".openclaw", "state", "idx-semantic-index.jsonl");
  // Shells expand `~` in commands, but values loaded from an env file do not.
  // Supporting it here keeps the documented `.env.example` path portable.
  if (configuredPath === "~") return homedir();
  if (configuredPath.startsWith("~/")) return join(homedir(), configuredPath.slice(2));
  return resolve(configuredPath);
}

export async function indexExists(path = defaultIndexPath()) {
  try {
    await access(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function writeLine(stream, value) {
  if (!stream.write(`${JSON.stringify(value)}\n`)) await once(stream, "drain");
}

/** Atomic JSONL writer so an interrupted build never replaces a valid index. */
export async function createIndexWriter({ path = defaultIndexPath(), provider, model, dimensions }) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
  const stream = createWriteStream(temporaryPath, { encoding: "utf8", mode: 0o600 });
  await writeLine(stream, {
    recordType: "metadata",
    version: INDEX_VERSION,
    provider,
    model,
    dimensions,
    createdAt: new Date().toISOString(),
  });
  let count = 0;
  return {
    path,
    async append(entry) {
      await writeLine(stream, { recordType: "listing", ...entry });
      count += 1;
    },
    async commit() {
      stream.end();
      await once(stream, "finish");
      await rename(temporaryPath, path);
      return { path, count, model, dimensions };
    },
    async abort() {
      stream.destroy();
      await rm(temporaryPath, { force: true });
    },
  };
}

/** Stream entries so a full MLS index does not need to be loaded into memory. */
export async function scanIndex(path, onListing) {
  if (!(await indexExists(path))) {
    throw new Error(`Semantic index not found at ${path}. Build it before searching.`);
  }
  const lines = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity });
  let metadata = null;
  let count = 0;
  for await (const line of lines) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error("Semantic index contains invalid JSON", { cause: error });
    }
    if (record.recordType === "metadata") {
      metadata = record;
      if (record.version !== INDEX_VERSION) throw new Error(`Unsupported semantic index version: ${record.version}`);
      continue;
    }
    if (record.recordType !== "listing" || !Array.isArray(record.embedding)) {
      throw new Error("Semantic index contains an invalid listing record");
    }
    count += 1;
    await onListing(record, metadata);
  }
  if (!metadata) throw new Error("Semantic index metadata is missing");
  return { metadata, count };
}
