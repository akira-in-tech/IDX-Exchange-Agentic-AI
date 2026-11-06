/**
 * Week 5 market-statistics data layer.
 *
 * Queries are returned as `{sql, params}` pairs so user-provided cities never
 * enter SQL text. `CloseDate` is parsed because the source MLS table stores it
 * as text; future and invalid dates are excluded from historical reporting.
 */
import { query } from "../../mls-database-search/scripts/database.mjs";

export const MAX_TREND_MONTHS = 60;

function requireCity(value) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError("city must be a non-empty string");
  }
  return value.trim();
}

function requireMonths(value) {
  if (!Number.isInteger(value) || value < 1 || value > MAX_TREND_MONTHS) {
    throw new RangeError(`months must be an integer between 1 and ${MAX_TREND_MONTHS}`);
  }
  return value;
}

/**
 * Return one parameterized statement for the core Week 5 metrics. CloseDate is
 * VARCHAR in the imported dataset, so every comparison parses it explicitly.
 * The CURDATE upper bound removes malformed future sales found in the source.
 */
export function buildMarketSummaryQuery(city, months = 12) {
  const safeCity = requireCity(city);
  const safeMonths = requireMonths(months);
  return {
    sql: `
      WITH filtered AS (
        SELECT ClosePrice, ListPrice, LivingArea, DaysOnMarket
        FROM california_sold
        WHERE City = ?
          AND PropertyType = 'Residential'
          AND STR_TO_DATE(NULLIF(CloseDate, ''), '%Y-%m-%d')
              BETWEEN DATE_SUB(CURDATE(), INTERVAL ? MONTH) AND CURDATE()
          AND ClosePrice > 0
      ), ranked AS (
        SELECT
          ClosePrice,
          ROW_NUMBER() OVER (ORDER BY ClosePrice) AS price_rank,
          COUNT(*) OVER () AS total_rows
        FROM filtered
      )
      SELECT
        COUNT(*) AS sold_count,
        ROUND(AVG(ClosePrice), 0) AS avg_close_price,
        (
          SELECT ROUND(AVG(ClosePrice), 0)
          FROM ranked
          WHERE price_rank IN ((total_rows + 1) DIV 2, (total_rows + 2) DIV 2)
        ) AS median_close_price,
        ROUND(AVG(CASE WHEN LivingArea > 0 THEN ClosePrice / LivingArea END), 0)
          AS avg_price_per_sqft,
        ROUND(AVG(CASE WHEN DaysOnMarket >= 0 THEN DaysOnMarket END), 1) AS avg_dom,
        ROUND(AVG(CASE WHEN ListPrice > 0 THEN ClosePrice / ListPrice END) * 100, 1)
          AS list_to_close_pct
      FROM filtered
    `,
    params: [safeCity, safeMonths],
    city: safeCity,
    months: safeMonths,
  };
}

/** Fetch enough history to calculate both MoM and YoY for the requested span. */
export function buildMonthlyTrendQuery(city, months = 12) {
  const safeCity = requireCity(city);
  const safeMonths = requireMonths(months);
  const historyMonths = Math.min(safeMonths + 12, MAX_TREND_MONTHS + 12);
  return {
    sql: `
      SELECT
        DATE_FORMAT(STR_TO_DATE(CloseDate, '%Y-%m-%d'), '%Y-%m') AS month,
        TIMESTAMPDIFF(
          MONTH,
          DATE_FORMAT(STR_TO_DATE(CloseDate, '%Y-%m-%d'), '%Y-%m-01'),
          DATE_FORMAT(CURDATE(), '%Y-%m-01')
        ) AS months_ago,
        COUNT(*) AS sales,
        ROUND(AVG(ClosePrice), 0) AS avg_price,
        ROUND(AVG(CASE WHEN LivingArea > 0 THEN ClosePrice / LivingArea END), 0)
          AS avg_price_per_sqft,
        ROUND(AVG(CASE WHEN DaysOnMarket >= 0 THEN DaysOnMarket END), 1) AS avg_dom,
        ROUND(AVG(CASE WHEN ListPrice > 0 THEN ClosePrice / ListPrice END) * 100, 1)
          AS list_to_close_pct
      FROM california_sold
      WHERE City = ?
        AND PropertyType = 'Residential'
        AND STR_TO_DATE(NULLIF(CloseDate, ''), '%Y-%m-%d')
            BETWEEN DATE_SUB(CURDATE(), INTERVAL ? MONTH) AND CURDATE()
        AND ClosePrice > 0
      GROUP BY month, months_ago
      ORDER BY month
    `,
    params: [safeCity, historyMonths],
    city: safeCity,
    months: safeMonths,
  };
}

export function buildActiveInventoryQuery(city) {
  const safeCity = requireCity(city);
  return {
    sql: `
      SELECT COUNT(*) AS active_count
      FROM rets_property
      WHERE L_Status = 'Active' AND L_City = ?
    `,
    params: [safeCity],
    city: safeCity,
  };
}

function percentChange(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1_000) / 10;
}

function shiftMonth(month, offset) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Add exact-calendar MoM and YoY comparisons; missing months remain null. */
export function calculateTrend(rows, months = 12) {
  requireMonths(months);
  const normalized = rows.map((row) => ({
    month: row.month,
    monthsAgo: Number(row.months_ago),
    sales: Number(row.sales),
    avgPrice: Number(row.avg_price),
    avgPricePerSqft: row.avg_price_per_sqft === null ? null : Number(row.avg_price_per_sqft),
    avgDom: row.avg_dom === null ? null : Number(row.avg_dom),
    listToClosePct: row.list_to_close_pct === null ? null : Number(row.list_to_close_pct),
  }));
  const byMonth = new Map(normalized.map((row) => [row.month, row]));
  return normalized
    .filter((row) => row.monthsAgo >= 0 && row.monthsAgo < months)
    .map((row) => ({
      ...row,
      priceChangeMomPct: percentChange(row.avgPrice, byMonth.get(shiftMonth(row.month, -1))?.avgPrice),
      priceChangeYoyPct: percentChange(row.avgPrice, byMonth.get(shiftMonth(row.month, -12))?.avgPrice),
    }));
}

export async function getMarketStatistics(city, months = 12, queryFn = query) {
  const summaryStatement = buildMarketSummaryQuery(city, months);
  const trendStatement = buildMonthlyTrendQuery(city, months);
  const inventoryStatement = buildActiveInventoryQuery(city);
  const [summaryRows, trendRows, inventoryRows] = await Promise.all([
    queryFn(summaryStatement.sql, summaryStatement.params),
    queryFn(trendStatement.sql, trendStatement.params),
    queryFn(inventoryStatement.sql, inventoryStatement.params),
  ]);
  const row = summaryRows[0] ?? {};
  const inventory = inventoryRows[0] ?? {};
  return {
    city: summaryStatement.city,
    months: summaryStatement.months,
    soldCount: Number(row.sold_count ?? 0),
    activeCount: Number(inventory.active_count ?? 0),
    avgClosePrice: row.avg_close_price === null || row.avg_close_price === undefined
      ? null : Number(row.avg_close_price),
    medianClosePrice: row.median_close_price === null || row.median_close_price === undefined
      ? null : Number(row.median_close_price),
    avgPricePerSqft: row.avg_price_per_sqft === null || row.avg_price_per_sqft === undefined
      ? null : Number(row.avg_price_per_sqft),
    avgDom: row.avg_dom === null || row.avg_dom === undefined ? null : Number(row.avg_dom),
    listToClosePct: row.list_to_close_pct === null || row.list_to_close_pct === undefined
      ? null : Number(row.list_to_close_pct),
    trend: calculateTrend(trendRows, months),
  };
}
