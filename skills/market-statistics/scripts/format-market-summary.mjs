function money(value) {
  return value === null ? "N/A" : `$${Math.round(value).toLocaleString("en-US")}`;
}

function value(value, suffix = "") {
  return value === null ? "N/A" : `${value}${suffix}`;
}

function direction(change) {
  if (change === null) return "not available";
  if (change > 0) return `up ${change}%`;
  if (change < 0) return `down ${Math.abs(change)}%`;
  return "unchanged";
}

/** Format a compact, factual summary suitable for OpenClaw or WhatsApp. */
export function formatMarketSummary(stats) {
  if (stats.soldCount === 0) {
    return `No valid residential sales were found for ${stats.city} in the last ${stats.months} months.`;
  }
  const latest = stats.trend.at(-1);
  const trendLines = stats.trend.map((row) =>
    `- ${row.month}: ${row.sales} sales, ${money(row.avgPrice)} avg, ${value(row.avgDom, " DOM")}`,
  );
  return [
    `${stats.city} residential market - last ${stats.months} months`,
    `Sales analyzed: ${stats.soldCount} | Active inventory: ${stats.activeCount}`,
    `Median close price: ${money(stats.medianClosePrice)}`,
    `Average close price: ${money(stats.avgClosePrice)}`,
    `Average price/sqft: ${money(stats.avgPricePerSqft)}`,
    `Average days on market: ${value(stats.avgDom)}`,
    `List-to-close ratio: ${value(stats.listToClosePct, "%")}`,
    latest
      ? `Latest month (${latest.month}): MoM ${direction(latest.priceChangeMomPct)}; YoY ${direction(latest.priceChangeYoyPct)}.`
      : "No monthly trend rows were available.",
    "",
    "Monthly trend:",
    ...trendLines,
    "",
    "This is a data summary, not financial advice.",
  ].join("\n");
}
