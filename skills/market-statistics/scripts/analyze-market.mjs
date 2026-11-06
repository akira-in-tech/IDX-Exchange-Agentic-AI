#!/usr/bin/env node
/** CLI adapter: validate arguments, run Week 5 analysis, print JSON, and exit. */
import { closePool } from "../../mls-database-search/scripts/database.mjs";
import { formatMarketSummary } from "./format-market-summary.mjs";
import { getMarketStatistics } from "./market-query.mjs";

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? null : args[index + 1] ?? null;
}

function usage() {
  return "Usage: node analyze-market.mjs --city <California city> [--months 12]";
}

async function main() {
  const args = process.argv.slice(2);
  const city = option(args, "--city");
  const monthsText = option(args, "--months") ?? "12";
  if (!city) throw new Error(usage());
  const statistics = await getMarketStatistics(city, Number(monthsText));
  process.stdout.write(`${JSON.stringify({ statistics, message: formatMarketSummary(statistics) }, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  const safeMessage = error instanceof TypeError || error instanceof RangeError || error.message === usage()
    ? error.message
    : "Market statistics are temporarily unavailable. Please try again shortly.";
  process.stderr.write(`${safeMessage}\n`);
  process.exitCode = 1;
} finally {
  await closePool();
}
