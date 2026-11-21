#!/usr/bin/env node
import { recommendSimilarListings } from "./recommend.mjs";
import { closePool } from "../../mls-database-search/scripts/database.mjs";
try {
  const index = process.argv.indexOf("--listing-id");
  if (index < 0 || !process.argv[index + 1]) throw new Error("Usage: --listing-id <active MLS ID>");
  console.log(JSON.stringify(await recommendSimilarListings({ listingId: process.argv[index + 1] }), null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await closePool(); }
