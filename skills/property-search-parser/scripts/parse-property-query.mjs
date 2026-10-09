#!/usr/bin/env node

// Command-line bridge used by OpenClaw's SKILL.md. The parsing logic lives in
// a separate module so the CLI, TypeScript adapter, and tests share one source
// of truth.
import { parsePropertyQuery } from "./property-query-parser.mjs";

/** Read everything after --query, allowing a query to contain many words. */
function readQuery(argv) {
  const queryFlag = argv.indexOf("--query");
  if (queryFlag === -1 || queryFlag === argv.length - 1) {
    throw new TypeError("usage: parse-property-query.mjs --query <property query>");
  }

  return argv.slice(queryFlag + 1).join(" ").trim();
}

try {
  const query = readQuery(process.argv.slice(2));
  const filters = parsePropertyQuery(query);

  // stdout is reserved for machine-readable JSON because OpenClaw returns it
  // directly to the user. Errors are written to stderr below.
  process.stdout.write(`${JSON.stringify(filters, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown parser error";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
