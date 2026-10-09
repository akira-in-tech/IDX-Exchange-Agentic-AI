/**
 * Structured filters understood by the future MLS query layer.
 *
 * Field names deliberately describe user intent. Week 3 will map them to the
 * corresponding rets_property columns before issuing parameterized SQL.
 */
export interface PropertyFilters {
  city: string | null;
  maxPrice: number | null;
  minBeds: number | null;
  minBaths: number | null;
  minSqft: number | null;
  propertyType: string | null;
  pool: "True" | "False" | null;
  hasView: "True" | "False" | null;
  maxHoa: number | null;
}

export interface PropertyQuerySkillInput {
  query: string;
}

const PROPERTY_TYPES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:single[-\s]?family(?:\s+(?:home|house|residence))?|detached\s+(?:home|house))\b/i, "SingleFamilyResidence"],
  [/\b(?:condo|condominium)s?\b/i, "Condominium"],
  [/\b(?:townhome|townhouse)s?\b/i, "Townhouse"],
  [/\b(?:multi[-\s]?family|duplex|triplex|fourplex)\b/i, "MultiFamily"],
  [/\b(?:vacant\s+land|unimproved\s+land|land)\b/i, "UnimprovedLand"],
];

const CITY_STOP_WORDS = [
  "under",
  "below",
  "less than",
  "up to",
  "with",
  "without",
  "at least",
  "minimum",
  "min",
  "over",
  "above",
  "more than",
  "between",
  "for",
  "that",
  "having",
];

const CITY_PATTERN = new RegExp(
  `\\bin\\s+([A-Za-z][A-Za-z.'-]*(?:\\s+[A-Za-z][A-Za-z.'-]*)*?)(?=\\s+(?:${CITY_STOP_WORDS.join("|")})\\b|[,.!?]|$)`,
  "i",
);

function toNumber(value: string): number {
  return Number(value.replace(/,/g, ""));
}

function parseAbbreviatedAmount(value: string, suffix?: string): number {
  const amount = toNumber(value);
  if (suffix?.toLowerCase() === "k") return Math.round(amount * 1_000);
  if (suffix?.toLowerCase() === "m") return Math.round(amount * 1_000_000);
  return Math.round(amount);
}

function firstNumber(query: string, patterns: ReadonlyArray<RegExp>): number | null {
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return toNumber(match[1]);
  }
  return null;
}

function parseMaxPrice(query: string): number | null {
  // Remove HOA clauses first so "HOA under $500" cannot become a $500 home
  // price ceiling. The same clause is parsed independently by parseMaxHoa.
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

function parseMaxHoa(query: string): number | null {
  const match = query.match(
    /\bhoa(?:\s+(?:fee|dues))?\s*(?:under|below|less\s+than|up\s+to|max(?:imum)?(?:\s+of)?|<=?)\s*\$?([\d,]+)\b/i,
  );
  return match ? toNumber(match[1]) : null;
}

function parseAmenity(
  query: string,
  amenity: "pool" | "view",
): "True" | "False" | null {
  const negative = new RegExp(`\\b(?:no|without)\\s+(?:a\\s+|an\\s+)?${amenity}s?\\b`, "i");
  if (negative.test(query)) return "False";

  const positive = new RegExp(`\\b${amenity}s?\\b`, "i");
  return positive.test(query) ? "True" : null;
}

function parsePropertyType(query: string): string | null {
  for (const [pattern, propertyType] of PROPERTY_TYPES) {
    if (pattern.test(query)) return propertyType;
  }
  return null;
}

/** Convert one free-text property request into a deterministic filter object. */
export function parsePropertyQuery(query: string): PropertyFilters {
  if (typeof query !== "string" || query.trim().length === 0) {
    throw new TypeError("query must be a non-empty string");
  }

  const normalized = query.replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim();
  const cityMatch = normalized.match(CITY_PATTERN);

  return {
    city: cityMatch?.[1]?.trim() ?? null,
    maxPrice: parseMaxPrice(normalized),
    minBeds: firstNumber(normalized, [
      /\b(?:at\s+least|min(?:imum)?(?:\s+of)?)\s*([\d,.]+)\s*(?:bed|beds|bedroom|bedrooms)\b/i,
      /\b([\d,.]+)\s*\+?[-\s]*(?:bed|beds|bedroom|bedrooms)\b/i,
    ]),
    minBaths: firstNumber(normalized, [
      /\b(?:at\s+least|min(?:imum)?(?:\s+of)?)\s*([\d,.]+)\s*(?:bath|baths|bathroom|bathrooms)\b/i,
      /\b([\d,.]+)\s*\+?[-\s]*(?:bath|baths|bathroom|bathrooms)\b/i,
    ]),
    minSqft: firstNumber(normalized, [
      /\b(?:at\s+least|min(?:imum)?(?:\s+of)?|over|above|more\s+than)\s*([\d,]+)\s*(?:sq\.?\s*ft\.?|sqft|square\s+feet)\b/i,
      /\b([\d,]+)\s*\+?\s*(?:sq\.?\s*ft\.?|sqft|square\s+feet)\b/i,
    ]),
    propertyType: parsePropertyType(normalized),
    pool: parseAmenity(normalized, "pool"),
    hasView: parseAmenity(normalized, "view"),
    maxHoa: parseMaxHoa(normalized),
  };
}

/**
 * Framework-neutral OpenClaw skill adapter. It can be registered with the
 * runtime without coupling the deterministic parser to channel code.
 */
export const propertyQuerySkill = {
  name: "parse_property_query",
  description: "Parse a natural-language property request into MLS search filters.",
  async execute(input: PropertyQuerySkillInput): Promise<PropertyFilters> {
    return parsePropertyQuery(input.query);
  },
} as const;
