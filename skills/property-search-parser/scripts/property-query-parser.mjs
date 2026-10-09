const PROPERTY_TYPES = [
  [/\b(?:single[-\s]?family(?:\s+(?:home|house|residence))?|detached\s+(?:home|house))\b/i, "SingleFamilyResidence"],
  [/\b(?:condo|condominium)s?\b/i, "Condominium"],
  [/\b(?:townhome|townhouse)s?\b/i, "Townhouse"],
  [/\b(?:multi[-\s]?family|duplex|triplex|fourplex)\b/i, "MultiFamily"],
  [/\b(?:vacant\s+land|unimproved\s+land|land)\b/i, "UnimprovedLand"],
];

const CITY_STOP_WORDS = [
  "under", "below", "less than", "up to", "with", "without", "at least",
  "minimum", "min", "over", "above", "more than", "between", "for", "that", "having",
];

const CITY_PATTERN = new RegExp(
  `\\bin\\s+([A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*)*?)(?=\\s+(?:${CITY_STOP_WORDS.join("|")})\\b|[,.!?]|$)`,
  "i",
);

function toNumber(value) {
  return Number(value.replace(/,/g, ""));
}

function parseAbbreviatedAmount(value, suffix) {
  const amount = toNumber(value);
  if (suffix?.toLowerCase() === "k") return Math.round(amount * 1_000);
  if (suffix?.toLowerCase() === "m") return Math.round(amount * 1_000_000);
  return Math.round(amount);
}

function firstNumber(query, patterns) {
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return toNumber(match[1]);
  }
  return null;
}

function parseMaxPrice(query) {
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

function parseMaxHoa(query) {
  const match = query.match(
    /\bhoa(?:\s+(?:fee|dues))?\s*(?:under|below|less\s+than|up\s+to|max(?:imum)?(?:\s+of)?|<=?)\s*\$?([\d,]+)\b/i,
  );
  return match ? toNumber(match[1]) : null;
}

function parseAmenity(query, amenity) {
  const negative = new RegExp(`\\b(?:no|without)\\s+(?:a\\s+|an\\s+)?${amenity}s?\\b`, "i");
  if (negative.test(query)) return "False";
  return new RegExp(`\\b${amenity}s?\\b`, "i").test(query) ? "True" : null;
}

function parsePropertyType(query) {
  for (const [pattern, propertyType] of PROPERTY_TYPES) {
    if (pattern.test(query)) return propertyType;
  }
  return null;
}

export function parsePropertyQuery(query) {
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new TypeError("query must be a non-empty string");
  }

  const normalized = query.replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim();
  const cityMatch = normalized.match(CITY_PATTERN);
  return {
    city: cityMatch?.[1]?.trim() ?? null,
    maxPrice: parseMaxPrice(normalized),
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
