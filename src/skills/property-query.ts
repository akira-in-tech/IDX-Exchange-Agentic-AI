// Application-facing TypeScript adapter. The self-contained OpenClaw bundle
// owns the runtime implementation so installing the skill copies everything it
// needs; this file adds types for future application and database code.
import { parsePropertyQuery as parseSkillQuery } from "../../skills/property-search-parser/scripts/property-query-parser.mjs";

/**
 * Structured filters consumed by the Week 3 MLS query layer.
 * `null` means the SQL builder should omit that constraint.
 */
export interface PropertyFilters {
  /** Exact city match -> rets_property.L_City. */
  city: string | null;
  /** Maximum listing price in dollars -> rets_property.L_SystemPrice. */
  maxPrice: number | null;
  /** Minimum bedroom count -> rets_property.L_Keyword2. */
  beds: number | null;
  /** Minimum bathroom count, including half baths -> rets_property.LM_Dec_3. */
  baths: number | null;
  /** Minimum finished living area -> rets_property.LM_Int2_3. */
  sqft: number | null;
  /** Canonical MLS property subtype -> rets_property.L_Type_. */
  type: string | null;
  /** Required or excluded private pool -> rets_property.PoolPrivateYN. */
  pool: "True" | "False" | null;
  /** Required or excluded view -> rets_property.ViewYN. */
  hasView: "True" | "False" | null;
  /** Maximum monthly association fee -> rets_property.AssociationFee. */
  maxHoa: number | null;
}

/** Input accepted by the typed skill adapter. */
export interface PropertyQuerySkillInput {
  query: string;
}

/** Typed application entry point backed by the self-contained OpenClaw parser. */
export function parsePropertyQuery(query: string): PropertyFilters {
  return parseSkillQuery(query) as PropertyFilters;
}

// OpenClaw uses SKILL.md for runtime discovery. This object provides the
// equivalent programmatic interface for future orchestrator code and tests.
export const propertyQuerySkill = {
  name: "parse_property_query",
  description: "Parse a natural-language property request into MLS search filters.",
  async execute(input: PropertyQuerySkillInput): Promise<PropertyFilters> {
    return parsePropertyQuery(input.query);
  },
} as const;
