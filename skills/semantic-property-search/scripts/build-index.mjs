import { createIndexWriter, defaultIndexPath } from "./vector-store.mjs";
import { createOpenAIEmbeddingClient } from "./embedding-client.mjs";
import {
  buildListingEmbeddingText,
  fetchActiveListingsForEmbedding,
  MAX_SOURCE_BATCH_SIZE,
} from "./listing-source.mjs";

function requireBuildLimit(value) {
  if (value === Infinity) return value;
  if (!Number.isInteger(value) || value < 1 || value > 100_000) {
    throw new RangeError("index limit must be an integer between 1 and 100000, or Infinity");
  }
  return value;
}

export async function buildSemanticIndex({
  limit,
  batchSize = 50,
  path = defaultIndexPath(),
  embeddingClient = createOpenAIEmbeddingClient(),
  fetchListings = fetchActiveListingsForEmbedding,
} = {}) {
  const safeLimit = requireBuildLimit(limit);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_SOURCE_BATCH_SIZE) {
    throw new RangeError(`batchSize must be an integer between 1 and ${MAX_SOURCE_BATCH_SIZE}`);
  }
  const writer = await createIndexWriter({
    path,
    model: embeddingClient.model,
    dimensions: embeddingClient.dimensions,
  });
  let afterId = "";
  let indexed = 0;
  try {
    while (indexed < safeLimit) {
      const requestSize = Math.min(batchSize, safeLimit - indexed);
      const rows = await fetchListings(afterId, requestSize);
      if (rows.length === 0) break;
      const texts = rows.map(buildListingEmbeddingText);
      const embeddings = await embeddingClient.embedMany(texts);
      if (embeddings.length !== rows.length) throw new Error("Embedding count did not match listing count");
      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        await writer.append({
          listingId: String(row.L_ListingID),
          embedding: embeddings[index],
        });
      }
      indexed += rows.length;
      afterId = String(rows.at(-1).L_ListingID);
      if (rows.length < requestSize) break;
    }
    return writer.commit();
  } catch (error) {
    await writer.abort();
    throw error;
  }
}
