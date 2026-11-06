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
