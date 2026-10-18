#!/usr/bin/env node

import { parsePropertyQuery } from "../../property-search-parser/scripts/property-query-parser.mjs";
import { closePool } from "./database.mjs";
import { formatActiveListingCards, formatSoldCompCards } from "./format-results.mjs";
import { getSoldComps, hasRecognizedFilters, searchActiveListings } from "./mls-query.mjs";

function option(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  if (index === args.length - 1) throw new TypeError(`${name} requires a value`);
  return args[index + 1];
}

function integerOption(args, name, fallback) {
  const value = option(args, name);
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new TypeError(`${name} must be an integer`);
  return parsed;
}

async function main(args) {
  const queryText = option(args, "--query");
  const soldCity = option(args, "--sold-city");
  const limit = integerOption(args, "--limit", 5);
  if ((queryText === null) === (soldCity === null)) {
    throw new TypeError("provide exactly one of --query or --sold-city");
  }

  if (queryText !== null) {
    const filters = parsePropertyQuery(queryText);
    if (!hasRecognizedFilters(filters)) {
      throw new TypeError("no supported property filters were recognized");
    }
    const page = integerOption(args, "--page", 1);
    const listings = await searchActiveListings(filters, page, limit);
    return {
      mode: "active-listings", filters, page, limit, count: listings.length, listings,
      message: formatActiveListingCards(listings),
    };
  }

  const months = integerOption(args, "--months", 12);
  const comps = await getSoldComps(soldCity, months, limit);
  return {
    mode: "sold-comps", city: soldCity, months, limit, count: comps.length, comps,
    message: formatSoldCompCards(comps),
  };
}

function safeErrorMessage(error) {
  if (!(error instanceof Error)) return "MLS search failed";
  const databaseCodes = new Set([
    "ECONNREFUSED", "ETIMEDOUT", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR",
    "ER_NO_SUCH_TABLE", "PROTOCOL_CONNECTION_LOST",
  ]);
  if ("code" in error && databaseCodes.has(error.code)) {
    return "Database query failed; check the MySQL service and MYSQL_* configuration.";
  }
  return error.message;
}

try {
  const result = await main(process.argv.slice(2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${safeErrorMessage(error)}\n`);
  process.exitCode = 1;
} finally {
  await closePool();
}
