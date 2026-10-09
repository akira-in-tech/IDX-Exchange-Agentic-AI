/**
 * Deterministic natural-language parser used by the Week 2 OpenClaw skill.
 *
 * This module deliberately does not call an LLM or MySQL. It converts a
 * sentence into a stable filter object that the Week 3 database layer can map
 * to parameterized SQL. Every key is always present; `null` means the user did
 * not provide that constraint.
 */

// User-facing property words mapped to the canonical values stored in
// rets_property.L_Type_. Put specific phrases before broad ones so that the
// first match is the most useful classification.
const PROPERTY_TYPES = [
  [/\b(?:single[-\s]?family(?:\s+(?:home|house|residence))?|detached\s+(?:home|house))\b/i, "SingleFamilyResidence"],
  [/\b(?:condo|condominium)s?\b/i, "Condominium"],
  [/\b(?:townhome|townhouse)s?\b/i, "Townhouse"],
  [/\b(?:multi[-\s]?family|duplex|triplex|fourplex)\b/i, "MultiFamily"],
  [/\b(?:vacant\s+land|unimproved\s+land|land)\b/i, "UnimprovedLand"],
];

// A city begins after "in" and ends before one of these phrases. For example,
// "in Newport Beach under $2M" captures "Newport Beach", not the budget text.
const CITY_STOP_WORDS = [
  "under", "below", "less than", "up to", "with", "without", "at least",
  "minimum", "min", "over", "above", "more than", "between", "for", "that", "having",
];

const CITY_PATTERN = new RegExp(
  `\\bin\\s+([A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*)*?)(?=\\s+(?:${CITY_STOP_WORDS.join("|")})\\b|[,.!?]|$)`,
  "i",
);

/** Convert comma-formatted text such as "1,800" into a JavaScript number. */
function toNumber(value) {
  return Number(value.replace(/,/g, ""));
}

/** Expand real-estate price shorthand: 900k -> 900000 and 1.5M -> 1500000. */
function parseAbbreviatedAmount(value, suffix) {
  const amount = toNumber(value);
  if (suffix?.toLowerCase() === "k") return Math.round(amount * 1_000);
  if (suffix?.toLowerCase() === "m") return Math.round(amount * 1_000_000);
  return Math.round(amount);
}

/** Try equivalent language patterns in priority order and return the first number. */
function firstNumber(query, patterns) {
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return toNumber(match[1]);
  }
  return null;
}

function parseMaxPrice(query) {
  // A request may contain both "under $900k" and "HOA under $500". Remove
  // the HOA clause before parsing price so $500 cannot become the home budget.
  const priceQuery = query.replace(
    /\bhoa(?:\s+(?:fee|dues))?\s*(?:under|below|less\s+than|up\s+to|max(?:imum)?(?:\s+of)?|<=?)\s*\$?[\d,]+\b/gi,
    "",
  );
  const patterns = [
    /(?:under|below|less\s+than|up\s+to|max(?:imum)?(?:\s+price)?(?:\s+of)?)\s*\$?([\d,.]+)\s*([km])?\b/i,
    /(?:budget(?:\s+of)?|priced?(?:\s+at)?)\s*\$?([\d,.]+)\s*([km])?\s*(?:or\s+less|max(?:imum)?)?\b/i,
  ];
  for (const pattern of patterns) {
    const match = priceQuery.match(pattern);
    if (match) return parseAbbreviatedAmount(match[1], match[2]);
  }
  return null;
}

/** Extract a monthly HOA ceiling without treating it as the property budget. */
function parseMaxHoa(query) {
  const match = query.match(
    /\bhoa(?:\s+(?:fee|dues))?\s*(?:under|below|less\s+than|up\s+to|max(?:imum)?(?:\s+of)?|<=?)\s*\$?([\d,]+)\b/i,
  );
  return match ? toNumber(match[1]) : null;
}

/** Return the MLS text flag for a requested or explicitly excluded amenity. */
function parseAmenity(query, amenity) {
  // Check negative intent first; otherwise "without a pool" would still match
  // the positive word "pool". MLS stores these flags as "True"/"False" text.
  const negative = new RegExp(`\\b(?:no|without)\\s+(?:a\\s+|an\\s+)?${amenity}s?\\b`, "i");
  if (negative.test(query)) return "False";
  return new RegExp(`\\b${amenity}s?\\b`, "i").test(query) ? "True" : null;
}

/** Translate a user-facing home type into the database's canonical subtype. */
function parsePropertyType(query) {
  for (const [pattern, propertyType] of PROPERTY_TYPES) {
    if (pattern.test(query)) return propertyType;
  }
  return null;
}

/**
 * Parse one property-search sentence into the public Week 2 filter contract.
 *
 * @param {string} query Free-text request, for example
 *   "Show me 3-bedroom condos in Irvine under $1.5M".
 * @returns {{
 *   city: string | null,
 *   maxPrice: number | null,
 *   beds: number | null,
 *   baths: number | null,
 *   sqft: number | null,
 *   type: string | null,
 *   pool: "True" | "False" | null,
 *   hasView: "True" | "False" | null,
 *   maxHoa: number | null
 * }} Structured filters that map to rets_property fields.
 */
export function parsePropertyQuery(query) {
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new TypeError("query must be a non-empty string");
  }

  // Normalize typographic hyphens copied from rich text and collapse repeated
  // whitespace so all regular expressions operate on predictable input.
  const normalized = query.replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim();
  const cityMatch = normalized.match(CITY_PATTERN);

  // These names match the handbook and planned Week 3 query API. A complete,
  // stable shape makes downstream validation and SQL construction simpler.
  return {
    city: cityMatch?.[1]?.trim() ?? null,
    maxPrice: parseMaxPrice(normalized),
    // Each numeric field accepts both explicit minimum wording ("at least 3")
    // and common compact notation ("3+" or "3-bedroom").
    beds: firstNumber(normalized, [
      /\b(?:at\s+least|min(?:imum)?(?:\s+of)?)\s*([\d,.]+)\s*(?:bed|beds|bedroom|bedrooms)\b/i,
      /\b([\d,.]+)\s*\+?[-\s]*(?:bed|beds|bedroom|bedrooms)\b/i,
    ]),
    baths: firstNumber(normalized, [
      /\b(?:at\s+least|min(?:imum)?(?:\s+of)?)\s*([\d,.]+)\s*(?:bath|baths|bathroom|bathrooms)\b/i,
      /\b([\d,.]+)\s*\+?[-\s]*(?:bath|baths|bathroom|bathrooms)\b/i,
    ]),
    sqft: firstNumber(normalized, [
      /\b(?:at\s+least|min(?:imum)?(?:\s+of)?|over|above|more\s+than)\s*([\d,]+)\s*(?:sq\.?\s*ft\.?|sqft|square\s+feet)\b/i,
      /\b([\d,]+)\s*\+?\s*(?:sq\.?\s*ft\.?|sqft|square\s+feet)\b/i,
    ]),
    type: parsePropertyType(normalized),
    pool: parseAmenity(normalized, "pool"),
    hasView: parseAmenity(normalized, "view"),
    maxHoa: parseMaxHoa(normalized),
  };
}
