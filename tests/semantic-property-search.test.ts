/**
 * Week 6 unit suite. Provider clients and listing sources are mocked so normal
 * tests are deterministic, offline, and cannot spend embedding API credits.
 */
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  MAX_EMBEDDING_TEXT_CHARS,
  createEmbeddingClient,
  createGeminiEmbeddingClient,
  createOpenAIEmbeddingClient,
  normalizeEmbeddingText,
} from "../skills/semantic-property-search/scripts/embedding-client.mjs";
import { buildSemanticIndex } from "../skills/semantic-property-search/scripts/build-index.mjs";
import {
  buildActiveEmbeddingSourceQuery,
  buildActiveHydrationQuery,
  buildListingEmbeddingText,
} from "../skills/semantic-property-search/scripts/listing-source.mjs";
import {
  cosineSimilarity,
  formatSemanticResults,
  rankSemanticCandidates,
  searchSemanticListings,
} from "../skills/semantic-property-search/scripts/semantic-search.mjs";
import { createIndexWriter, scanIndex } from "../skills/semantic-property-search/scripts/vector-store.mjs";

async function fixtureIndex(entries: Array<{ listingId: string; embedding: number[] }>) {
  const directory = await mkdtemp(join(tmpdir(), "idx-week6-"));
  const path = join(directory, "index.jsonl");
  const writer = await createIndexWriter({ path, model: "mock-embedding", dimensions: 3 });
  for (const entry of entries) await writer.append(entry);
  await writer.commit();
  return path;
}

test("normalizes whitespace and enforces the handbook text boundary", () => {
  assert.equal(normalizeEmbeddingText("  mountain\n\nview  home "), "mountain view home");
  assert.equal(normalizeEmbeddingText("x".repeat(MAX_EMBEDDING_TEXT_CHARS + 20)).length, MAX_EMBEDDING_TEXT_CHARS);
  assert.throws(() => normalizeEmbeddingText("  "), /non-empty string/);
});

test("OpenAI adapter follows the official embeddings request shape", async () => {
  let request: Record<string, unknown> | null = null;
  const client = {
    embeddings: {
      create: async (input: Record<string, unknown>) => {
        request = input;
        return { data: [{ index: 1, embedding: [0, 1] }, { index: 0, embedding: [1, 0] }] };
      },
    },
  };
  const embeddings = await createOpenAIEmbeddingClient({ client, model: "text-embedding-3-small", dimensions: 2 })
    .embedMany(["first", "second"]);
  assert.deepEqual(request, {
    model: "text-embedding-3-small",
    input: ["first", "second"],
    dimensions: 2,
    encoding_format: "float",
  });
  assert.deepEqual(embeddings, [[1, 0], [0, 1]]);
});

test("Gemini adapter uses document and query retrieval task types", async () => {
  const requests: Array<Record<string, unknown>> = [];
  const client = {
    models: {
      embedContent: async (request: Record<string, unknown>) => {
        requests.push(request);
        const contents = request.contents as string[];
        return { embeddings: contents.map((_, index) => ({ values: [index, 1] })) };
      },
    },
  };
  const gemini = createGeminiEmbeddingClient({ client, model: "gemini-embedding-001", dimensions: 2 });
  assert.deepEqual(await gemini.embedMany(["first", "second"]), [[0, 1], [1, 1]]);
  assert.deepEqual(await gemini.embedOne("query"), [0, 1]);
  assert.deepEqual(requests[0], {
    model: "gemini-embedding-001",
    contents: ["first", "second"],
    config: { outputDimensionality: 2, taskType: "RETRIEVAL_DOCUMENT" },
  });
  assert.deepEqual((requests[1].config as Record<string, unknown>).taskType, "RETRIEVAL_QUERY");
});

test("provider selection defaults to Gemini and retains OpenAI support", () => {
  const mockGemini = { models: { embedContent: async () => ({ embeddings: [] }) } };
  assert.equal(createEmbeddingClient({ client: mockGemini }).provider, "gemini");
  assert.throws(() => createEmbeddingClient({ provider: "unknown" }), /Unsupported embedding provider/);
});

test("builds parameterized active-listing source and hydration SQL", () => {
  const source = buildActiveEmbeddingSourceQuery("100", 25);
  assert.match(source.sql, /L_Status = 'Active'/);
  assert.match(source.sql, /L_ListingID > \?/);
  assert.deepEqual(source.params, ["100", 25]);

  const malicious = "1') OR 1=1 --";
  const hydrate = buildActiveHydrationQuery([malicious, "2"]);
  assert.doesNotMatch(hydrate.sql, /OR 1=1/);
  assert.deepEqual(hydrate.params, [malicious, "2"]);
});

test("combines all handbook listing fields into embedding text", () => {
  const text = buildListingEmbeddingText({
    type: "Craftsman", L_City: "Pasadena", beds: 3, baths: 2,
    sqft: 1800, YearBuilt: 1912, price: 1_200_000,
    remarks: "Original character and mountain views.",
  });
  assert.match(text, /Craftsman in Pasadena/);
  assert.match(text, /3 beds, 2 baths, 1800 square feet/);
  assert.match(text, /Built 1912.*1200000 dollars/);
  assert.match(text, /mountain views/);
});

test("calculates cosine similarity and rejects incompatible vectors", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.throws(() => cosineSimilarity([1], [1, 2]), /equal dimensions/);
});

test("writes and streams a versioned local vector index", async () => {
  const path = await fixtureIndex([{ listingId: "1", embedding: [1, 0, 0] }]);
  const records: string[] = [];
  const result = await scanIndex(path, async (record) => records.push(record.listingId));
  assert.deepEqual(records, ["1"]);
  assert.equal(result.metadata.model, "mock-embedding");
  assert.equal(result.count, 1);
});

test("builds an index in batches without calling the real API", async () => {
  const directory = await mkdtemp(join(tmpdir(), "idx-week6-build-"));
  const path = join(directory, "built.jsonl");
  const rows = [
    { L_ListingID: "1", type: "House", L_City: "Irvine", beds: 3, baths: 2, sqft: 1500, YearBuilt: 2000, price: 900000, remarks: "quiet" },
    { L_ListingID: "2", type: "Condo", L_City: "Irvine", beds: 2, baths: 2, sqft: 1000, YearBuilt: 2010, price: 700000, remarks: "modern" },
  ];
  const result = await buildSemanticIndex({
    limit: 2,
    batchSize: 2,
    path,
    fetchListings: async () => rows,
    embeddingClient: { model: "mock", dimensions: 3, embedMany: async () => [[1, 0, 0], [0, 1, 0]] },
  });
  assert.equal(result.count, 2);
  assert.equal((await scanIndex(path, async () => {})).count, 2);
});

test("ranks the most similar vectors first", async () => {
  const path = await fixtureIndex([
    { listingId: "low", embedding: [0, 1, 0] },
    { listingId: "high", embedding: [0.9, 0.1, 0] },
  ]);
  const ranked = await rankSemanticCandidates({ query: "craftsman", queryEmbedding: [1, 0, 0], path });
  assert.deepEqual(ranked.candidates.map((item) => item.listingId), ["high", "low"]);
});

test("rejects an index built by a different embedding provider", async () => {
  const directory = await mkdtemp(join(tmpdir(), "idx-week6-provider-"));
  const path = join(directory, "index.jsonl");
  const writer = await createIndexWriter({ path, provider: "openai", model: "old-model", dimensions: 3 });
  await writer.append({ listingId: "1", embedding: [1, 0, 0] });
  await writer.commit();
  await assert.rejects(
    rankSemanticCandidates({
      query: "home",
      queryEmbedding: [1, 0, 0],
      path,
      expectedProvider: "gemini",
      expectedModel: "gemini-embedding-001",
    }),
    /does not match query provider/,
  );
});

test("returns only hydrated active listings and formats scores", async () => {
  const path = await fixtureIndex([
    { listingId: "1", embedding: [1, 0, 0] },
    { listingId: "2", embedding: [0.9, 0.1, 0] },
    { listingId: "inactive", embedding: [0.99, 0.01, 0] },
  ]);
  const search = await searchSemanticListings({
    query: "mountain view",
    topK: 2,
    path,
    embeddingClient: { embedOne: async () => [1, 0, 0] },
    hydrateListings: async () => [
      { L_ListingID: "1", L_Address: "1 Hill St", L_City: "Pasadena", price: 1_000_000, beds: 3, baths: 2, sqft: 1600, PhotoCount: 20 },
      { L_ListingID: "2", L_Address: "2 Hill St", L_City: "Pasadena", price: 1_100_000, beds: 3, baths: 2, sqft: 1700, PhotoCount: 25 },
    ],
  });
  assert.deepEqual(search.results.map((row) => row.L_ListingID), ["1", "2"]);
  const message = formatSemanticResults(search);
  assert.match(message, /1 Hill St/);
  assert.match(message, /Similarity: 1\.000/);
});
