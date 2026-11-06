#!/usr/bin/env node
import { closePool } from "../../mls-database-search/scripts/database.mjs";
import { formatSemanticResults, searchSemanticListings } from "./semantic-search.mjs";

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function usage() {
  return "Usage: node search-similar-properties.mjs --query <description> [--top-k 5] [--index <path>]";
}

async function main() {
  const args = process.argv.slice(2);
  const query = option(args, "--query");
  if (!query) throw new Error(usage());
  const search = await searchSemanticListings({
    query,
    topK: Number(option(args, "--top-k") ?? "5"),
    path: option(args, "--index") ?? undefined,
  });
  process.stdout.write(`${JSON.stringify({ search, message: formatSemanticResults(search) }, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  const safeMessage = error instanceof TypeError || error instanceof RangeError || error.message === usage()
    || /GEMINI_API_KEY|OPENAI_API_KEY|Semantic index/.test(error.message)
    ? error.message
    : "Semantic property search is temporarily unavailable. Please try again shortly.";
  process.stderr.write(`${safeMessage}\n`);
  process.exitCode = 1;
} finally {
  await closePool();
}
