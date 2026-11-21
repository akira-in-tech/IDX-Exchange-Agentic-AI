/** Document grounded retrieval and answering with page-level citations. */
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";
import { createEmbeddingClient } from "../../semantic-property-search/scripts/embedding-client.mjs";
import { cosineSimilarity } from "../../semantic-property-search/scripts/semantic-search.mjs";
import { getMarketStatistics } from "../../market-statistics/scripts/market-query.mjs";
import { formatMarketSummary } from "../../market-statistics/scripts/format-market-summary.mjs";

export const INDEX_PATH = `${homedir()}/.openclaw/state/idx-rag-index.json`;
export function chunkText(text, size = 600, overlap = 100) {
  if (!Number.isInteger(size) || !Number.isInteger(overlap) || size <= overlap || overlap < 0) throw new Error("Invalid chunk size or overlap");
  const chunks = [];
  for (let start = 0; start < text.length; start += size - overlap) {
    const chunk = text.slice(start, start + size).trim();
    if (chunk) chunks.push(chunk);
    if (start + size >= text.length) break;
  }
  return chunks;
}

export async function indexDocuments(documents, embedder = createEmbeddingClient(), path = INDEX_PATH) {
  const entries = documents.flatMap(({ title, pages }) => pages.flatMap(({ page, text }) =>
    chunkText(text).map((chunk) => ({ title, page, chunk }))));
  if (!entries.length) throw new Error("No source text to index");
  for (let start = 0; start < entries.length; start += 20) {
    const batch = entries.slice(start, start + 20);
    const vectors = await embedder.embedMany(batch.map((entry) => entry.chunk));
    batch.forEach((entry, index) => { entry.embedding = vectors[index]; });
  }
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify({ provider: embedder.provider, model: embedder.model, entries }), { mode: 0o600 });
  await rename(temporary, path);
  return { path, chunks: entries.length };
}

export async function retrieve(query, { path = INDEX_PATH, embedder = createEmbeddingClient(), topK = 4 } = {}) {
  if (!query?.trim() || !Number.isInteger(topK) || topK < 1 || topK > 8) throw new Error("Valid query and topK required");
  const index = JSON.parse(await readFile(path, "utf8"));
  if (index.provider !== embedder.provider || index.model !== embedder.model) throw new Error("RAG index provider/model mismatch; rebuild index");
  const vector = await embedder.embedOne(query);
  return index.entries.map(({ embedding, ...entry }) => ({ ...entry, score: cosineSimilarity(vector, embedding) }))
    .sort((a, b) => b.score - a.score).slice(0, topK);
}

/** Source text is the only authority; callers should not accept uncited prose. */
export async function answerQuestion(question, { embedder = createEmbeddingClient(), generator, path = INDEX_PATH } = {}) {
  const matches = await retrieve(question, { embedder, path });
  const context = matches.map((entry, index) => `[${index + 1}] ${entry.title}, page ${entry.page}: ${entry.chunk}`).join("\n\n");
  const prompt = `Answer the question using only the numbered excerpts. Cite each factual claim with [number]. If the excerpts do not answer it, say the sources do not establish the answer.\n\n${context}\n\nQuestion: ${question}`;
  const answer = generator ? await generator(prompt) : `Relevant source excerpts:\n${context}`;
  return { question, answer, sources: matches.map(({ title, page, score }, i) => ({ citation: `[${i + 1}]`, title, page, score })) };
}

export async function marketSummarySource(city) {
  const stats = await getMarketStatistics(city, 12);
  return { title: `Week 5 market summary: ${city}`, pages: [{ page: 1, text: formatMarketSummary(stats) }] };
}
