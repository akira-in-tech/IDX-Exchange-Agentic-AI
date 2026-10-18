import { query } from "./database.mjs";

export const MAX_PAGE_SIZE = 50;
const FILTER_KEYS = [
  "city", "maxPrice", "beds", "baths", "sqft", "type", "pool", "hasView", "maxHoa",
];

function requirePositiveInteger(value, name, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new RangeError(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function optionalNumber(value, name) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative number or null`);
  }
  return value;
}

function optionalString(value, name) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${name} must be a non-empty string or null`);
  }
  return value.trim();
}

/** Reject unsupported keys and normalize every Week 2 filter value. */
export function validateFilters(filters) {
  if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
    throw new TypeError("filters must be an object");
  }
  const unsupported = Object.keys(filters).filter((key) => !FILTER_KEYS.includes(key));
  if (unsupported.length > 0) {
    throw new TypeError(`unsupported filter keys: ${unsupported.join(", ")}`);
  }

  const pool = optionalString(filters.pool, "pool");
  const hasView = optionalString(filters.hasView, "hasView");
  for (const [name, value] of [["pool", pool], ["hasView", hasView]]) {
    if (value !== null && value !== "True" && value !== "False") {
      throw new TypeError(`${name} must be "True", "False", or null`);
    }
  }

  return {
    city: optionalString(filters.city, "city"),
    maxPrice: optionalNumber(filters.maxPrice, "maxPrice"),
    beds: optionalNumber(filters.beds, "beds"),
    baths: optionalNumber(filters.baths, "baths"),
    sqft: optionalNumber(filters.sqft, "sqft"),
    type: optionalString(filters.type, "type"),
    pool,
    hasView,
    maxHoa: optionalNumber(filters.maxHoa, "maxHoa"),
  };
}

export function hasRecognizedFilters(filters) {
  return Object.values(validateFilters(filters)).some((value) => value !== null);
}

/** Build a parameterized active-listing statement from fixed SQL fragments. */
export function buildActiveListingQuery(filters, page = 1, limit = 10) {
  const safeFilters = validateFilters(filters);
  const safePage = requirePositiveInteger(page, "page", 100_000);
  const safeLimit = requirePositiveInteger(limit, "limit", MAX_PAGE_SIZE);
  const offset = (safePage - 1) * safeLimit;

  let sql = `
    SELECT
      L_ListingID, L_DisplayId, L_Address, L_City, L_Zip,
      L_SystemPrice AS price, L_Keyword2 AS beds, LM_Dec_3 AS baths,
      LM_Int2_3 AS sqft, L_Type_ AS type, L_Status AS status,
      LMD_MP_Latitude AS lat, LMD_MP_Longitude AS lng,
      YearBuilt, AssociationFee, DaysOnMarket,
      PoolPrivateYN, ViewYN, FireplaceYN, PhotoCount,
      LA1_UserFirstName, LA1_UserLastName, LO1_OrganizationName
    FROM rets_property
    WHERE L_Status = 'Active'
  `;
  const params = [];
  const conditions = [
    [safeFilters.city !== null, " AND L_City = ?", safeFilters.city],
    [safeFilters.maxPrice !== null, " AND L_SystemPrice <= ?", safeFilters.maxPrice],
    [safeFilters.beds !== null, " AND L_Keyword2 >= ?", safeFilters.beds],
    [safeFilters.baths !== null, " AND LM_Dec_3 >= ?", safeFilters.baths],
    [safeFilters.sqft !== null, " AND LM_Int2_3 >= ?", safeFilters.sqft],
    [safeFilters.type !== null, " AND L_Type_ = ?", safeFilters.type],
    [safeFilters.maxHoa !== null, " AND AssociationFee <= ?", safeFilters.maxHoa],
  ];
  for (const [enabled, fragment, value] of conditions) {
    if (!enabled) continue;
    sql += fragment;
    params.push(value);
  }

  // The handbook describes RESO booleans as "True"/"False", while the local
  // SQL import encodes true as "1" and false as an empty string. These fixed
  // fragments support both representations without interpolating user input.
  if (safeFilters.pool === "True") sql += " AND PoolPrivateYN IN ('True', 'true', '1')";
  if (safeFilters.pool === "False") sql += " AND PoolPrivateYN IN ('False', 'false', '0', '')";
  if (safeFilters.hasView === "True") sql += " AND ViewYN IN ('True', 'true', '1')";
  if (safeFilters.hasView === "False") sql += " AND ViewYN IN ('False', 'false', '0', '')";

  sql += " ORDER BY L_SystemPrice ASC, L_ListingID ASC LIMIT ? OFFSET ?";
  params.push(safeLimit, offset);
  return { sql, params, page: safePage, limit: safeLimit };
}

export async function searchActiveListings(filters, page = 1, limit = 10, queryFn = query) {
  const statement = buildActiveListingQuery(filters, page, limit);
  return queryFn(statement.sql, statement.params);
}

/** Build a recent sold-comps statement while excluding invalid future dates. */
export function buildSoldCompsQuery(city, months = 12, limit = 10) {
  const safeCity = optionalString(city, "city");
  if (safeCity === null) throw new TypeError("city is required");
  const safeMonths = requirePositiveInteger(months, "months", 60);
  const safeLimit = requirePositiveInteger(limit, "limit", MAX_PAGE_SIZE);
  return {
    sql: `
      SELECT
        ListingKey, UnparsedAddress, City, PostalCode, CloseDate, ClosePrice,
        OriginalListPrice, ListPrice, DaysOnMarket,
        BedroomsTotal, BathroomsTotalInteger, LivingArea,
        PropertyType, PropertySubType, YearBuilt,
        ListAgentFullName, ListOfficeName, BuyerOfficeName
      FROM california_sold
      WHERE City = ?
        AND PropertyType = 'Residential'
        AND STR_TO_DATE(CloseDate, '%Y-%m-%d') BETWEEN DATE_SUB(CURDATE(), INTERVAL ? MONTH) AND CURDATE()
      ORDER BY STR_TO_DATE(CloseDate, '%Y-%m-%d') DESC, ListingKey DESC
      LIMIT ?
    `,
    params: [safeCity, safeMonths, safeLimit],
    months: safeMonths,
    limit: safeLimit,
  };
}

export async function getSoldComps(city, months = 12, limit = 10, queryFn = query) {
  const statement = buildSoldCompsQuery(city, months, limit);
  return queryFn(statement.sql, statement.params);
}
