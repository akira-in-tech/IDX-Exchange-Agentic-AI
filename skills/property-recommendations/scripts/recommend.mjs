/** Hybrid recommendation: 60 structured points plus 40 cosine points. */
import { query as databaseQuery } from "../../mls-database-search/scripts/database.mjs";
import { cosineSimilarity } from "../../semantic-property-search/scripts/semantic-search.mjs";
import { hydrateActiveListings } from "../../semantic-property-search/scripts/listing-source.mjs";
import { defaultIndexPath, scanIndex } from "../../semantic-property-search/scripts/vector-store.mjs";

export function structuredScore(target, candidate) {
  let score = 0;
  const price = Math.abs(Number(target.price) - Number(candidate.price));
  if (Number.isFinite(price)) score += price < 50_000 ? 20 : price < 150_000 ? 12 : price < 300_000 ? 5 : 0;
  if (target.beds != null && candidate.beds != null && Number(target.beds) === Number(candidate.beds)) score += 15;
  if (target.L_City && candidate.L_City && target.L_City.toLowerCase() === candidate.L_City.toLowerCase()) score += 15;
  const area = Math.abs(Number(target.sqft) - Number(candidate.sqft));
  if (target.sqft != null && candidate.sqft != null && Number.isFinite(area)) score += area < 300 ? 10 : area < 700 ? 5 : 0;
  return score;
}

export function hybridScore(target, candidate, targetVector, candidateVector) {
  return Math.round((structuredScore(target, candidate) + Math.max(0, cosineSimilarity(targetVector, candidateVector)) * 40) * 100) / 100;
}

export function buildCompQuery(city, sqft) {
  if (!city || !Number.isFinite(Number(sqft)) || Number(sqft) <= 0) throw new Error("Valid city and square footage required");
  return {
    sql: `SELECT COUNT(*) AS comp_count, AVG(ClosePrice / NULLIF(LivingArea,0)) AS avg_ppsf
      FROM california_sold WHERE City = ? AND PropertyType = 'Residential'
      AND LivingArea BETWEEN ? AND ? AND ClosePrice > 0
      AND STR_TO_DATE(NULLIF(CloseDate,''), '%Y-%m-%d')
          BETWEEN DATE_SUB(CURDATE(), INTERVAL 6 MONTH) AND CURDATE()`,
    params: [city, Math.round(sqft * 0.8), Math.round(sqft * 1.2)],
  };
}

export async function validateWithComps(listing, queryFn = databaseQuery) {
  if (!listing.L_City || !Number(listing.sqft) || !Number(listing.price)) return { status: "insufficient-listing-data", compCount: 0 };
  const statement = buildCompQuery(listing.L_City, Number(listing.sqft));
  const [row] = await queryFn(statement.sql, statement.params);
  if (!row || !Number(row.comp_count) || !Number(row.avg_ppsf)) return { status: "no-recent-comps", compCount: 0 };
  const compPrice = Math.round(Number(row.avg_ppsf) * Number(listing.sqft));
  return { status: "available", compCount: Number(row.comp_count), compPrice,
    listPrice: Number(listing.price), deltaPct: Math.round((Number(listing.price) / compPrice - 1) * 1000) / 10 };
}

export async function recommendSimilarListings({ listingId, path = defaultIndexPath(), topK = 5,
  hydrate = hydrateActiveListings, comps = validateWithComps } = {}) {
  if (!/^[0-9]+$/.test(String(listingId))) throw new Error("listingId must be numeric");
  if (!Number.isInteger(topK) || topK < 1 || topK > 5) throw new Error("topK must be between 1 and 5");
  const vectors = [];
  let targetVector;
  await scanIndex(path, async (record) => {
    if (record.listingId === String(listingId)) targetVector = record.embedding;
    else vectors.push(record);
  });
  if (!targetVector) throw new Error("Listing is not indexed; rebuild the semantic index with --all or a larger limit");
  const [target] = await hydrate([String(listingId)]);
  if (!target) throw new Error("Target listing is no longer active");
  const candidates = [];
  // Hydration is capped at 100 IDs per prepared query; scan every indexed ID.
  for (let start = 0; start < vectors.length; start += 100) {
    candidates.push(...await hydrate(vectors.slice(start, start + 100).map((row) => row.listingId)));
  }
  const byId = new Map(vectors.map((record) => [record.listingId, record.embedding]));
  const ranked = candidates.map((listing) => ({ listing, score: hybridScore(target, listing, targetVector, byId.get(String(listing.L_ListingID))) }))
    .sort((a, b) => b.score - a.score).slice(0, topK);
  return { target, results: await Promise.all(ranked.map(async ({ listing, score }) => ({ listing, score, comps: await comps(listing) }))) };
}
