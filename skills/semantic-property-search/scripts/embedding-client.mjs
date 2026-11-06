import OpenAI from "openai";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_EMBEDDING_DIMENSIONS = 256;
export const MAX_EMBEDDING_TEXT_CHARS = 8_000;

/** Normalize MLS text and enforce the handbook's input-size safety boundary. */
export function normalizeEmbeddingText(text) {
  if (typeof text !== "string" || text.trim() === "") {
    throw new TypeError("embedding text must be a non-empty string");
  }
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_EMBEDDING_TEXT_CHARS);
}

/**
 * Create the production OpenAI embedding adapter. The API key is read only
 * from OPENAI_API_KEY and is never accepted in CLI arguments or written to the
 * index. Dependencies remain injectable so tests never spend API credits.
 */
export function createOpenAIEmbeddingClient({
  apiKey = process.env.OPENAI_API_KEY,
  model = process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
  dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS) || DEFAULT_EMBEDDING_DIMENSIONS,
  client,
} = {}) {
  if (!client && (!apiKey || typeof apiKey !== "string")) {
    throw new Error("OPENAI_API_KEY is required to generate embeddings");
  }
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 1536) {
    throw new RangeError("embedding dimensions must be an integer between 1 and 1536");
  }
  const openai = client ?? new OpenAI({ apiKey });
  return {
    model,
    dimensions,
    async embedMany(texts) {
      if (!Array.isArray(texts) || texts.length === 0) {
        throw new TypeError("texts must be a non-empty array");
      }
      const input = texts.map(normalizeEmbeddingText);
      const response = await openai.embeddings.create({
        model,
        input,
        dimensions,
        encoding_format: "float",
      });
      return response.data
        .slice()
        .sort((left, right) => left.index - right.index)
        .map((item) => item.embedding);
    },
    async embedOne(text) {
      return (await this.embedMany([text]))[0];
    },
  };
}
