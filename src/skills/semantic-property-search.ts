/** Typed application facade for Week 6 semantic search results and metadata. */
import { searchSemanticListings as runtimeSearch } from "../../skills/semantic-property-search/scripts/semantic-search.mjs";
import type { ActiveListing } from "./mls-database-search.ts";

export interface SemanticListing extends ActiveListing {
  similarity: number;
  remarks: string | null;
}

export interface SemanticSearchResult {
  query: string;
  results: SemanticListing[];
  indexedListings: number;
  indexMetadata: {
    /** Embedding provider is present in indexes built by current runtimes. */
    provider?: string;
    model: string;
    dimensions: number;
    createdAt: string;
  };
}

export function searchSemanticListings(input: {
  query: string;
  topK?: number;
  path?: string;
}): Promise<SemanticSearchResult> {
  return runtimeSearch(input) as Promise<SemanticSearchResult>;
}
