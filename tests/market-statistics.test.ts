/** Week 5 unit tests cover SQL safety, trend math, orchestration, and output. */
import assert from "node:assert/strict";
import test from "node:test";

import { formatMarketSummary } from "../skills/market-statistics/scripts/format-market-summary.mjs";
import {
  buildActiveInventoryQuery,
  buildMarketSummaryQuery,
  buildMonthlyTrendQuery,
  calculateTrend,
  getMarketStatistics,
} from "../skills/market-statistics/scripts/market-query.mjs";

test("builds parameterized market summary SQL and excludes future dates", () => {
  const statement = buildMarketSummaryQuery("Irvine", 12);
  assert.match(statement.sql, /City = \?/);
  assert.match(statement.sql, /STR_TO_DATE/);
  assert.match(statement.sql, /AND CURDATE\(\)/);
  assert.match(statement.sql, /ROW_NUMBER\(\) OVER/);
  assert.deepEqual(statement.params, ["Irvine", 12]);
});

test("keeps malicious city text in parameters", () => {
  const city = "Irvine' OR 1=1 --";
  const statement = buildMonthlyTrendQuery(city, 12);
  assert.doesNotMatch(statement.sql, /OR 1=1/);
  assert.equal(statement.params[0], city);
});

test("validates city and trend range", () => {
  assert.throws(() => buildMarketSummaryQuery("", 12), /city must be/);
  assert.throws(() => buildMonthlyTrendQuery("Irvine", 61), /between 1 and 60/);
  assert.deepEqual(buildActiveInventoryQuery("Irvine").params, ["Irvine"]);
});

test("calculates exact-calendar month-over-month and year-over-year changes", () => {
  const trend = calculateTrend([
    { month: "2025-09", months_ago: 12, sales: 5, avg_price: 800_000, avg_price_per_sqft: 500, avg_dom: 20, list_to_close_pct: 98 },
    { month: "2026-08", months_ago: 1, sales: 8, avg_price: 900_000, avg_price_per_sqft: 550, avg_dom: 18, list_to_close_pct: 99 },
    { month: "2026-09", months_ago: 0, sales: 10, avg_price: 1_000_000, avg_price_per_sqft: 600, avg_dom: 15, list_to_close_pct: 100 },
  ], 12);
  assert.equal(trend.length, 2);
  assert.equal(trend[1].priceChangeMomPct, 11.1);
  assert.equal(trend[1].priceChangeYoyPct, 25);
});

test("combines summary, inventory, and monthly trend query results", async () => {
  const responses = [
    [{ sold_count: 20, avg_close_price: 900_000, median_close_price: 850_000, avg_price_per_sqft: 550, avg_dom: 18.2, list_to_close_pct: 99.1 }],
    [{ month: "2026-09", months_ago: 0, sales: 4, avg_price: 900_000, avg_price_per_sqft: 550, avg_dom: 18, list_to_close_pct: 99 }],
    [{ active_count: 7 }],
  ];
  const calls: unknown[][] = [];
  const fakeQuery = async (_sql: string, params: unknown[]) => {
    calls.push(params);
    return responses.shift();
  };
  const stats = await getMarketStatistics("Irvine", 12, fakeQuery);
  assert.equal(stats.medianClosePrice, 850_000);
  assert.equal(stats.activeCount, 7);
  assert.equal(stats.trend.length, 1);
  assert.deepEqual(calls, [["Irvine", 12], ["Irvine", 24], ["Irvine"]]);
});

test("formats every handbook deliverable metric", () => {
  const message = formatMarketSummary({
    city: "Irvine", months: 12, soldCount: 20, activeCount: 7,
    avgClosePrice: 900_000, medianClosePrice: 850_000, avgPricePerSqft: 550,
    avgDom: 18.2, listToClosePct: 99.1,
    trend: [{ month: "2026-09", sales: 4, avgPrice: 900_000, avgDom: 18, priceChangeMomPct: 2.5, priceChangeYoyPct: -1.2 }],
  });
  assert.match(message, /Median close price: \$850,000/);
  assert.match(message, /Average days on market: 18\.2/);
  assert.match(message, /List-to-close ratio: 99\.1%/);
  assert.match(message, /MoM up 2\.5%; YoY down 1\.2%/);
});
