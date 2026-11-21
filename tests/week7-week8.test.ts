import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { structuredScore, hybridScore, buildCompQuery, validateWithComps, recommendSimilarListings } from "../skills/property-recommendations/scripts/recommend.mjs";
import { createIndexWriter } from "../skills/semantic-property-search/scripts/vector-store.mjs";
import { chunkText, indexDocuments, answerQuestion } from "../skills/real-estate-rag/scripts/rag.mjs";

test("Week 7 uses 60 structured and 40 semantic points", () => {
  const target = { price: 1_000_000, beds: 3, L_City: "Irvine", sqft: 1800 };
  assert.equal(structuredScore(target, { ...target }), 60);
  assert.equal(hybridScore(target, { ...target }, [1, 0], [1, 0]), 100);
});
test("Week 7 comps use bounded, parameterized six-month sales", async () => {
  const statement = buildCompQuery("Irvine", 2000);
  assert.deepEqual(statement.params, ["Irvine", 1600, 2400]);
  assert.match(statement.sql, /INTERVAL 6 MONTH/);
  const result = await validateWithComps({ L_City: "Irvine", sqft: 2000, price: 1_000_000 }, async () => [{ comp_count: 3, avg_ppsf: 450 }]);
  assert.equal(result.compPrice, 900000);
  assert.equal(result.compCount, 3);
});
test("Week 7 returns five active candidates with price assessments", async () => {
  const dir = await mkdtemp(join(tmpdir(), "idx-week7-"));
  const path = join(dir, "index.jsonl");
  const writer = await createIndexWriter({ path, model: "mock", dimensions: 2 });
  for (let id = 1; id <= 8; id++) await writer.append({ listingId: String(id), embedding: [1, 0] });
  await writer.commit();
  const output = await recommendSimilarListings({ listingId: "1", path,
    hydrate: async (ids: string[]) => ids.map((id) => ({ L_ListingID: id, L_City: "Irvine", beds: 3, sqft: 1800, price: 1_000_000 })),
    comps: async () => ({ status: "available", compCount: 2 }),
  });
  assert.equal(output.results.length, 5);
  assert.ok(output.results.every((item) => item.score === 100 && item.comps.compCount === 2));
});
test("Week 8 chunk overlap and cited retrieval", async () => {
  assert.deepEqual(chunkText("abcdefgh", 5, 2), ["abcde", "defgh"]);
  const dir = await mkdtemp(join(tmpdir(), "idx-week8-"));
  const path = join(dir, "index.json");
  const embedder = { provider: "mock", model: "mock", embedMany: async (texts: string[]) => texts.map((text) => text.includes("DOM") ? [1, 0] : [0, 1]), embedOne: async () => [1, 0] };
  await indexDocuments([{ title: "Primer", pages: [{ page: 2, text: "DOM means days on market." }] }], embedder, path);
  const result = await answerQuestion("What does DOM mean?", { embedder, path, generator: async (prompt: string) => {
    assert.match(prompt, /\[1\] Primer, page 2/);
    return "DOM means days on market [1].";
  } });
  assert.equal(result.sources[0].page, 2);
  assert.match(result.answer, /\[1\]/);
});
test("Week 8 reads exact california_sold columns from the live schema adapter", async () => {
  const result = await answerQuestion("What columns are in california_sold?", {
    queryFn: async (sql: string, params: string[]) => {
      assert.match(sql, /information_schema\.COLUMNS/);
      assert.deepEqual(params, ["california_sold"]);
      return [{ COLUMN_NAME: "City" }, { COLUMN_NAME: "ClosePrice" }];
    },
  });
  assert.match(result.answer, /City, ClosePrice \[1\]/);
});
test("Week 8 answers DOM from its cited Primer excerpt on generator 503", async () => {
  const dir = await mkdtemp(join(tmpdir(), "idx-week8-fallback-"));
  const path = join(dir, "index.json");
  const embedder = { provider: "mock", model: "mock", embedMany: async () => [[1, 0]], embedOne: async () => [1, 0] };
  await indexDocuments([{ title: "Real Estate Data Analyst Primer", pages: [{ page: 7, text: "DOM Days on Market Days from listing date to Pending or Close for a single listing period" }] }], embedder, path);
  const result = await answerQuestion("What does DOM mean?", { embedder, path, generator: async () => { throw new Error("503 UNAVAILABLE"); } });
  assert.match(result.answer, /Days on Market.*\[1\]/);
  assert.equal(result.sources[0].page, 7);
});
