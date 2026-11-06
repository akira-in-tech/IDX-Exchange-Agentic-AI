import { formatActiveListingCards } from "../../mls-database-search/scripts/format-results.mjs";
import { createOpenAIEmbeddingClient, normalizeEmbeddingText } from "./embedding-client.mjs";
import { hydrateActiveListings } from "./listing-source.mjs";
import { defaultIndexPath, scanIndex } from "./vector-store.mjs";

export function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || left.length !== right.length) {
    throw new TypeError("vectors must be non-empty arrays with equal dimensions");
  }
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    const a = Number(left[index]);
    const b = Number(right[index]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) throw new TypeError("vectors must contain finite numbers");
    dot += a * b;
    leftNorm += a * a;
    rightNorm += b * b;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function requireTopK(value) {
  if (!Number.isInteger(value) || value < 1 || value > 20) {
    throw new RangeError("topK must be an integer between 1 and 20");
  }
  return value;
}

/** Stream the index and retain only the best candidates in memory. */
export async function rankSemanticCandidates({ query, queryEmbedding, path, candidateCount = 25 }) {
  normalizeEmbeddingText(query);
  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    throw new TypeError("queryEmbedding must be a non-empty vector");
  }
  const candidates = [];
  const scan = await scanIndex(path, async (record, metadata) => {
    if (metadata && queryEmbedding.length !== metadata.dimensions) {
      throw new Error(`Query embedding has ${queryEmbedding.length} dimensions; index requires ${metadata.dimensions}`);
    }
    candidates.push({ listingId: record.listingId, similarity: cosineSimilarity(queryEmbedding, record.embedding) });
    candidates.sort((left, right) => right.similarity - left.similarity);
    if (candidates.length > candidateCount) candidates.length = candidateCount;
  });
  return { candidates, indexMetadata: scan.metadata, indexedListings: scan.count };
}

export async function searchSemanticListings({
  query,
  topK = 5,
  path = defaultIndexPath(),
  embeddingClient,
  hydrateListings = hydrateActiveListings,
} = {}) {
  const safeTopK = requireTopK(topK);
  const client = embeddingClient ?? createOpenAIEmbeddingClient();
  const queryEmbedding = await client.embedOne(query);
  const ranked = await rankSemanticCandidates({
    query,
    queryEmbedding,
    path,
    candidateCount: Math.min(safeTopK * 5, 100),
  });
  if (ranked.candidates.length === 0) {
    return { query, results: [], ...ranked };
  }
  const liveRows = await hydrateListings(ranked.candidates.map((candidate) => candidate.listingId));
  const rowsById = new Map(liveRows.map((row) => [String(row.L_ListingID), row]));
  const results = ranked.candidates
    .filter((candidate) => rowsById.has(candidate.listingId))
    .slice(0, safeTopK)
    .map((candidate) => ({ ...rowsById.get(candidate.listingId), similarity: candidate.similarity }));
  return { query, results, ...ranked };
}

export function formatSemanticResults(search) {
  if (search.results.length === 0) return "No active listings in the semantic index matched that description.";
  const rows = search.results.map((row) => ({ ...row }));
  const cards = formatActiveListingCards(rows).split("\n\n");
  const scored = cards.map((card, index) => `${card}\n   Similarity: ${search.results[index].similarity.toFixed(3)}`);
  return [
    `Top ${search.results.length} semantic matches for: "${search.query}"`,
    "",
    scored.join("\n\n"),
  ].join("\n");
}
