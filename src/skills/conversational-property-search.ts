import { handleConversationMessage as runtimeHandler } from "../../skills/conversational-property-search/scripts/conversation-agent.mjs";
import type { ActiveListing } from "./mls-database-search.ts";
import type { PropertyFilters } from "./property-query.ts";

export type ConversationStatus = "needs-input" | "results" | "no-results" | "reset";

export interface PropertySearchSession {
  filters: PropertyFilters;
  lastResultIds: string[];
  conversationStep: number;
}

export interface ConversationResult {
  status: ConversationStatus;
  message: string;
  session: PropertySearchSession;
  listings: ActiveListing[];
}

/** Typed application entry point backed by the same runtime OpenClaw executes. */
export function handleConversationMessage(input: {
  userId: string;
  message: string;
  limit?: number;
}): Promise<ConversationResult> {
  return runtimeHandler(input) as Promise<ConversationResult>;
}
