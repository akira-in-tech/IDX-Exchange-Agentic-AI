import assert from "node:assert/strict";
import test from "node:test";

import {
  parsePropertyQuery,
  propertyQuerySkill,
  type PropertyFilters,
} from "../src/skills/property-query.ts";

function expectFilters(query: string, expected: Partial<PropertyFilters>) {
  const actual = parsePropertyQuery(query);
  assert.deepEqual(actual, {
    city: null,
    maxPrice: null,
    minBeds: null,
    minBaths: null,
    minSqft: null,
    propertyType: null,
    pool: null,
    hasView: null,
    maxHoa: null,
    ...expected,
  });
}

test("parses the handbook example", () => {
  expectFilters("Show me 3-bedroom condos in Irvine under $1.5M with a pool.", {
    city: "Irvine",
    maxPrice: 1_500_000,
    minBeds: 3,
    propertyType: "Condominium",
    pool: "True",
  });
});

test("parses a multi-word city and thousand price suffix", () => {
  expectFilters("Homes under $900k in Long Beach with 2 beds", {
    city: "Long Beach",
    maxPrice: 900_000,
    minBeds: 2,
  });
});

test("parses decimal bathrooms", () => {
  expectFilters("Find townhouses in Pasadena with at least 2.5 bathrooms", {
    city: "Pasadena",
    minBaths: 2.5,
    propertyType: "Townhouse",
  });
});

test("parses square footage with commas", () => {
  expectFilters("Single-family homes in San Diego over 2,000 square feet", {
    city: "San Diego",
    minSqft: 2_000,
    propertyType: "SingleFamilyResidence",
  });
});

test("parses pool and view amenities", () => {
  expectFilters("Condos in Newport Beach with a pool and ocean view", {
    city: "Newport Beach",
    propertyType: "Condominium",
    pool: "True",
    hasView: "True",
  });
});

test("parses explicitly excluded amenities", () => {
  expectFilters("Land in Joshua Tree without a pool and no view", {
    city: "Joshua Tree",
    propertyType: "UnimprovedLand",
    pool: "False",
    hasView: "False",
  });
});

test("parses an HOA ceiling", () => {
  expectFilters("A condo in Anaheim with HOA under $500", {
    city: "Anaheim",
    propertyType: "Condominium",
    maxHoa: 500,
  });
});

test("parses plus notation for beds, baths, and area", () => {
  expectFilters("4+ bed 3+ bath homes in Sacramento with 2,500+ sqft", {
    city: "Sacramento",
    minBeds: 4,
    minBaths: 3,
    minSqft: 2_500,
  });
});

test("parses a plain dollar budget", () => {
  expectFilters("Single family house in Oakland with a budget of $1,250,000", {
    city: "Oakland",
    maxPrice: 1_250_000,
    propertyType: "SingleFamilyResidence",
  });
});

test("parses case-insensitively", () => {
  expectFilters("CONDOS IN SANTA MONICA BELOW $2M WITH 2 BEDROOMS", {
    city: "SANTA MONICA",
    maxPrice: 2_000_000,
    minBeds: 2,
    propertyType: "Condominium",
  });
});

test("parses a request without a city", () => {
  expectFilters("Show 3 bed homes below $750,000 with a view", {
    maxPrice: 750_000,
    minBeds: 3,
    hasView: "True",
  });
});

test("leaves unsupported filters null", () => {
  expectFilters("Show me properties", {});
});

test("normalizes Unicode hyphens", () => {
  expectFilters("Find 3‑bedroom condos in Irvine", {
    city: "Irvine",
    minBeds: 3,
    propertyType: "Condominium",
  });
});

test("rejects an empty query", () => {
  assert.throws(() => parsePropertyQuery("   "), {
    name: "TypeError",
    message: "query must be a non-empty string",
  });
});

test("skill adapter returns the parser result", async () => {
  const result = await propertyQuerySkill.execute({
    query: "Townhome in Irvine under $1m",
  });

  assert.equal(propertyQuerySkill.name, "parse_property_query");
  assert.equal(result.city, "Irvine");
  assert.equal(result.maxPrice, 1_000_000);
  assert.equal(result.propertyType, "Townhouse");
});
