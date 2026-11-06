#!/usr/bin/env node
import { closePool } from "../../mls-database-search/scripts/database.mjs";
import { buildSemanticIndex } from "./build-index.mjs";

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function usage() {
  return "Usage: node build-listing-index.mjs (--limit <count> | --all) [--batch-size 50] [--output <path>]";
}

async function main() {
  const args = process.argv.slice(2);
  const all = args.includes("--all");
  const limitText = option(args, "--limit");
  if (all === Boolean(limitText)) throw new Error(usage());
  const result = await buildSemanticIndex({
    limit: all ? Infinity : Number(limitText),
    batchSize: Number(option(args, "--batch-size") ?? "50"),
    path: option(args, "--output") ?? undefined,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  const safeMessage = error instanceof TypeError || error instanceof RangeError || error.message === usage()
    || /OPENAI_API_KEY|Semantic index/.test(error.message)
    ? error.message
    : "Unable to build the semantic index. Check the API and database configuration.";
  process.stderr.write(`${safeMessage}\n`);
  process.exitCode = 1;
} finally {
  await closePool();
}
