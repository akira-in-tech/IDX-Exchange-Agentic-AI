/**
 * Provider adapters for converting listing text into numeric vectors.
 * Gemini is the project default; OpenAI remains available for compatibility.
 * Both adapters expose the same small interface so tests can inject a free,
 * deterministic implementation instead of making paid network calls.
 */
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";

export const DEFAULT_GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";
export const DEFAULT_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_EMBEDDING_MODEL = DEFAULT_GEMINI_EMBEDDING_MODEL;
export const DEFAULT_EMBEDDING_DIMENSIONS = 768;
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
  model = process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_OPENAI_EMBEDDING_MODEL,
  dimensions = Number(process.env.OPENAI_EMBEDDING_DIMENSIONS) || 256,
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
    provider: "openai",
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

/** Gemini adapter using Google's current server-side @google/genai SDK. */
export function createGeminiEmbeddingClient({
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_GEMINI_EMBEDDING_MODEL,
  dimensions = Number(process.env.GEMINI_EMBEDDING_DIMENSIONS) || DEFAULT_EMBEDDING_DIMENSIONS,
  client,
} = {}) {
  if (!client && (!apiKey || typeof apiKey !== "string")) {
    throw new Error("GEMINI_API_KEY is required to generate Gemini embeddings");
  }
  if (!Number.isInteger(dimensions) || dimensions < 1 || dimensions > 3072) {
    throw new RangeError("Gemini embedding dimensions must be an integer between 1 and 3072");
  }
  const gemini = client ?? new GoogleGenAI({ apiKey });

  async function embed(texts, taskType) {
    if (!Array.isArray(texts) || texts.length === 0) {
      throw new TypeError("texts must be a non-empty array");
    }
    const response = await gemini.models.embedContent({
      model,
      contents: texts.map(normalizeEmbeddingText),
      config: { outputDimensionality: dimensions, taskType },
    });
    const embeddings = response.embeddings?.map((item) => item.values);
    if (!embeddings || embeddings.length !== texts.length || embeddings.some((values) => !Array.isArray(values))) {
      throw new Error("Gemini returned an unexpected embedding response");
    }
    return embeddings;
  }

  return {
    provider: "gemini",
    model,
    dimensions,
    embedMany(texts) {
      return embed(texts, "RETRIEVAL_DOCUMENT");
    },
    async embedOne(text) {
      return (await embed([text], "RETRIEVAL_QUERY"))[0];
    },
  };
}

/** Select Gemini by default while retaining OpenAI for compatibility. */
export function createEmbeddingClient({ provider = process.env.EMBEDDING_PROVIDER || "gemini", ...options } = {}) {
  const normalizedProvider = String(provider).trim().toLowerCase();
  if (normalizedProvider === "gemini") return createGeminiEmbeddingClient(options);
  if (normalizedProvider === "openai") return createOpenAIEmbeddingClient(options);
  throw new Error(`Unsupported embedding provider: ${provider}. Use gemini or openai.`);
}
