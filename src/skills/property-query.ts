import { parsePropertyQuery as parseSkillQuery } from "../../skills/property-search-parser/scripts/property-query-parser.mjs";

/** Structured filters consumed by the Week 3 MLS query layer. */
export interface PropertyFilters {
  city: string | null;
  maxPrice: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  type: string | null;
  pool: "True" | "False" | null;
  hasView: "True" | "False" | null;
  maxHoa: number | null;
}

export interface PropertyQuerySkillInput {
  query: string;
}

/** Typed application entry point backed by the self-contained OpenClaw skill. */
export function parsePropertyQuery(query: string): PropertyFilters {
  return parseSkillQuery(query) as PropertyFilters;
}

export const propertyQuerySkill = {
  name: "parse_property_query",
  description: "Parse a natural-language property request into MLS search filters.",
  async execute(input: PropertyQuerySkillInput): Promise<PropertyFilters> {
    return parsePropertyQuery(input.query);
  },
} as const;
