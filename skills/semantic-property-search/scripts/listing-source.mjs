import { query } from "../../mls-database-search/scripts/database.mjs";

export const MAX_SOURCE_BATCH_SIZE = 100;

function requireLimit(value, maximum = MAX_SOURCE_BATCH_SIZE) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`limit must be an integer between 1 and ${maximum}`);
  }
  return value;
}

export function buildActiveEmbeddingSourceQuery(afterId = "", limit = 50) {
  if (typeof afterId !== "string") throw new TypeError("afterId must be a string");
  const safeLimit = requireLimit(limit);
  return {
    sql: `
      SELECT
        L_ListingID, L_DisplayId, L_Address, L_City, L_Zip,
        L_SystemPrice AS price, L_Keyword2 AS beds, LM_Dec_3 AS baths,
        LM_Int2_3 AS sqft, L_Type_ AS type, YearBuilt,
        L_Remarks AS remarks, PhotoCount
      FROM rets_property
      WHERE L_Status = 'Active'
        AND L_ListingID IS NOT NULL
        AND L_ListingID > ?
        AND L_Remarks IS NOT NULL
        AND L_Remarks <> ''
      ORDER BY L_ListingID
      LIMIT ?
    `,
    params: [afterId, safeLimit],
  };
}

export async function fetchActiveListingsForEmbedding(afterId = "", limit = 50, queryFn = query) {
  const statement = buildActiveEmbeddingSourceQuery(afterId, limit);
  return queryFn(statement.sql, statement.params);
}

export function buildActiveHydrationQuery(listingIds) {
  if (!Array.isArray(listingIds) || listingIds.length === 0 || listingIds.length > 100) {
    throw new RangeError("listingIds must contain between 1 and 100 IDs");
  }
  const ids = listingIds.map((id) => {
    if (typeof id !== "string" || id.trim() === "") throw new TypeError("listing ID must be a non-empty string");
    return id.trim();
  });
  const placeholders = ids.map(() => "?").join(", ");
  return {
    sql: `
      SELECT
        L_ListingID, L_DisplayId, L_Address, L_City, L_Zip,
        L_SystemPrice AS price, L_Keyword2 AS beds, LM_Dec_3 AS baths,
        LM_Int2_3 AS sqft, L_Type_ AS type, YearBuilt,
        L_Remarks AS remarks, PhotoCount, L_Status AS status
      FROM rets_property
      WHERE L_Status = 'Active' AND L_ListingID IN (${placeholders})
    `,
    params: ids,
  };
}

export async function hydrateActiveListings(listingIds, queryFn = query) {
  const statement = buildActiveHydrationQuery(listingIds);
  return queryFn(statement.sql, statement.params);
}

function display(value, fallback = "unknown") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

/** Combine the exact listing fields required by the Week 6 handbook. */
export function buildListingEmbeddingText(row) {
  return [
    `${display(row.type)} in ${display(row.L_City)}, California.`,
    `${display(row.beds)} beds, ${display(row.baths)} baths, ${display(row.sqft)} square feet.`,
    `Built ${display(row.YearBuilt)}. Price ${display(row.price)} dollars.`,
    display(row.remarks, "No listing remarks."),
  ].join(" ");
}
