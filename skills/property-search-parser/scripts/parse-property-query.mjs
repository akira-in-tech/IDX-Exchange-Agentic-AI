#!/usr/bin/env node

import { parsePropertyQuery } from "./property-query-parser.mjs";

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
  process.stdout.write(`${JSON.stringify(filters, null, 2)}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : "unknown parser error";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
