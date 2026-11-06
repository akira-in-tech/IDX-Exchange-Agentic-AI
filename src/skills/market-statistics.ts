import { getMarketStatistics as runtimeGetMarketStatistics } from "../../skills/market-statistics/scripts/market-query.mjs";

export interface MonthlyMarketTrend {
  month: string;
  monthsAgo: number;
  sales: number;
  avgPrice: number;
  avgPricePerSqft: number | null;
  avgDom: number | null;
  listToClosePct: number | null;
  priceChangeMomPct: number | null;
  priceChangeYoyPct: number | null;
}

export interface MarketStatistics {
  city: string;
  months: number;
  soldCount: number;
  activeCount: number;
  avgClosePrice: number | null;
  medianClosePrice: number | null;
  avgPricePerSqft: number | null;
  avgDom: number | null;
  listToClosePct: number | null;
  trend: MonthlyMarketTrend[];
}

export function getMarketStatistics(city: string, months = 12): Promise<MarketStatistics> {
  return runtimeGetMarketStatistics(city, months) as Promise<MarketStatistics>;
}
