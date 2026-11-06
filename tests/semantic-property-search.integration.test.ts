import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { closePool } from "../skills/mls-database-search/scripts/database.mjs";
import { buildSemanticIndex } from "../skills/semantic-property-search/scripts/build-index.mjs";
import {
  createGeminiEmbeddingClient,
  createOpenAIEmbeddingClient,
} from "../skills/semantic-property-search/scripts/embedding-client.mjs";
import { fetchActiveListingsForEmbedding } from "../skills/semantic-property-search/scripts/listing-source.mjs";
import { searchSemanticListings } from "../skills/semantic-property-search/scripts/semantic-search.mjs";

const runDatabase = process.env.RUN_DB_TESTS === "1";
const runOpenAI = process.env.RUN_OPENAI_TESTS === "1" && Boolean(process.env.OPENAI_API_KEY);
const runGemini = process.env.RUN_GEMINI_TESTS === "1" && Boolean(process.env.GEMINI_API_KEY);

function deterministicVector(text: string): number[] {
  const normalized = text.toLowerCase();
  return [
    normalized.includes("view") ? 1 : 0.1,
    normalized.includes("modern") ? 1 : 0.1,
    normalized.includes("pool") ? 1 : 0.1,
  ];
}

test("builds and searches a live-MLS index with deterministic test embeddings", { skip: !runDatabase }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "idx-week6-live-"));
  const path = join(directory, "index.jsonl");
  const embeddingClient = {
    model: "deterministic-test-embedding",
    dimensions: 3,
    embedMany: async (texts: string[]) => texts.map(deterministicVector),
    embedOne: async (text: string) => deterministicVector(text),
  };
  try {
    const built = await buildSemanticIndex({ limit: 20, batchSize: 10, path, embeddingClient });
    assert.equal(built.count, 20);
    const search = await searchSemanticListings({ query: "home with a view", topK: 5, path, embeddingClient });
    assert.ok(search.results.length > 0 && search.results.length <= 5);
    for (const row of search.results) {
      assert.equal(row.status, "Active");
      assert.ok(row.L_Address);
      assert.ok(Number.isFinite(row.similarity));
    }
  } finally {
    await closePool();
  }
});

test("reads bounded active MLS rows for embedding", { skip: !runDatabase }, async () => {
  try {
    const rows = await fetchActiveListingsForEmbedding("", 3);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((row) => row.L_ListingID && row.remarks));
  } finally {
    await closePool();
  }
});

test("calls the real OpenAI embeddings API when explicitly enabled", { skip: !runOpenAI }, async () => {
  const client = createOpenAIEmbeddingClient({ dimensions: 256 });
  const vectors = await client.embedMany(["craftsman home", "modern condominium"]);
  assert.equal(vectors.length, 2);
  assert.equal(vectors[0].length, 256);
  assert.notDeepEqual(vectors[0], vectors[1]);
});

test("calls the real Gemini embeddings API when explicitly enabled", { skip: !runGemini }, async () => {
  const client = createGeminiEmbeddingClient({ dimensions: 768 });
  const vectors = await client.embedMany(["craftsman home", "modern condominium"]);
  assert.equal(vectors.length, 2);
  assert.equal(vectors[0].length, 768);
  assert.notDeepEqual(vectors[0], vectors[1]);
});
