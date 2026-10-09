import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
    beds: null,
    baths: null,
    sqft: null,
    type: null,
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
    beds: 3,
    type: "Condominium",
    pool: "True",
  });
});

test("parses a multi-word city and thousand price suffix", () => {
  expectFilters("Homes under $900k in Long Beach with 2 beds", {
    city: "Long Beach",
    maxPrice: 900_000,
    beds: 2,
  });
});

test("parses decimal bathrooms", () => {
  expectFilters("Find townhouses in Pasadena with at least 2.5 bathrooms", {
    city: "Pasadena",
    baths: 2.5,
    type: "Townhouse",
  });
});

test("parses square footage with commas", () => {
  expectFilters("Single-family homes in San Diego over 2,000 square feet", {
    city: "San Diego",
    sqft: 2_000,
    type: "SingleFamilyResidence",
  });
});

test("parses pool and view amenities", () => {
  expectFilters("Condos in Newport Beach with a pool and ocean view", {
    city: "Newport Beach",
    type: "Condominium",
    pool: "True",
    hasView: "True",
  });
});

test("parses explicitly excluded amenities", () => {
  expectFilters("Land in Joshua Tree without a pool and no view", {
    city: "Joshua Tree",
    type: "UnimprovedLand",
    pool: "False",
    hasView: "False",
  });
});

test("parses an HOA ceiling", () => {
  expectFilters("A condo in Anaheim with HOA under $500", {
    city: "Anaheim",
    type: "Condominium",
    maxHoa: 500,
  });
});

test("parses plus notation for beds, baths, and area", () => {
  expectFilters("4+ bed 3+ bath homes in Sacramento with 2,500+ sqft", {
    city: "Sacramento",
    beds: 4,
    baths: 3,
    sqft: 2_500,
  });
});

test("parses a plain dollar budget", () => {
  expectFilters("Single family house in Oakland with a budget of $1,250,000", {
    city: "Oakland",
    maxPrice: 1_250_000,
    type: "SingleFamilyResidence",
  });
});

test("parses case-insensitively", () => {
  expectFilters("CONDOS IN SANTA MONICA BELOW $2M WITH 2 BEDROOMS", {
    city: "SANTA MONICA",
    maxPrice: 2_000_000,
    beds: 2,
    type: "Condominium",
  });
});

test("parses a request without a city", () => {
  expectFilters("Show 3 bed homes below $750,000 with a view", {
    maxPrice: 750_000,
    beds: 3,
    hasView: "True",
  });
});

test("leaves unsupported filters null", () => {
  expectFilters("Show me properties", {});
});

test("normalizes Unicode hyphens", () => {
  expectFilters("Find 3‑bedroom condos in Irvine", {
    city: "Irvine",
    beds: 3,
    type: "Condominium",
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
  assert.equal(result.type, "Townhouse");
});

test("OpenClaw skill entry declares the registered workspace skill", () => {
  const skill = readFileSync("skills/property-search-parser/SKILL.md", "utf8");

  assert.match(skill, /^---\nname: property-search-parser\n/m);
  assert.match(skill, /user-invocable: true/);
  assert.match(skill, /\{baseDir\}\/scripts\/parse-property-query\.mjs/);
});

test("OpenClaw skill helper returns the public filter contract", () => {
  const result = spawnSync(
    process.execPath,
    [
      "skills/property-search-parser/scripts/parse-property-query.mjs",
      "--query",
      "Show me 3-bedroom condos in Irvine under $1.5M with a pool.",
    ],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    city: "Irvine",
    maxPrice: 1_500_000,
    beds: 3,
    baths: null,
    sqft: null,
    type: "Condominium",
    pool: "True",
    hasView: null,
    maxHoa: null,
  });
});
