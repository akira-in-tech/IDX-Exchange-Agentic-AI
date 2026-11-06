import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { closePool } from "../skills/mls-database-search/scripts/database.mjs";
import { getMarketStatistics } from "../skills/market-statistics/scripts/market-query.mjs";

const runLive = process.env.RUN_DB_TESTS === "1";

test("returns all Week 5 metrics for Irvine from live MLS data", { skip: !runLive }, async () => {
  try {
    const stats = await getMarketStatistics("Irvine", 12);
    assert.ok(stats.soldCount > 0);
    assert.ok(stats.activeCount > 0);
    assert.ok(stats.medianClosePrice && stats.medianClosePrice > 0);
    assert.ok(stats.avgPricePerSqft && stats.avgPricePerSqft > 0);
    assert.ok(stats.avgDom !== null && stats.avgDom >= 0);
    assert.ok(stats.listToClosePct && stats.listToClosePct > 0);
    assert.ok(stats.trend.length > 0 && stats.trend.length <= 12);
  } finally {
    await closePool();
  }
});

test("market CLI returns and exits after live database access", { skip: !runLive }, () => {
  const result = spawnSync(process.execPath, [
    "skills/market-statistics/scripts/analyze-market.mjs", "--city", "Irvine", "--months", "12",
  ], { cwd: process.cwd(), encoding: "utf8", timeout: 10_000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.match(output.message, /Irvine residential market/);
  assert.equal(output.statistics.city, "Irvine");
});
