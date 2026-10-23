import { parsePropertyQuery } from "../../property-search-parser/scripts/property-query-parser.mjs";
import { formatActiveListingCards } from "../../mls-database-search/scripts/format-results.mjs";
import { searchActiveListings } from "../../mls-database-search/scripts/mls-query.mjs";
import { createFileSessionStore, EMPTY_FILTERS } from "./session-store.mjs";

const RESET_PATTERN = /^(?:reset|start over|new search|clear search)$/i;

/** Keep prior preferences unless the latest message explicitly supplies a value. */
export function mergeFilters(previous, incoming) {
  return Object.fromEntries(
    Object.keys(EMPTY_FILTERS).map((key) => [key, incoming[key] ?? previous[key] ?? null]),
  );
}

function summarizeFilters(filters) {
  const labels = [];
  if (filters.city) labels.push(filters.city);
  if (filters.maxPrice) labels.push(`up to $${filters.maxPrice.toLocaleString("en-US")}`);
  if (filters.beds) labels.push(`${filters.beds}+ beds`);
  if (filters.baths) labels.push(`${filters.baths}+ baths`);
  if (filters.sqft) labels.push(`${filters.sqft.toLocaleString("en-US")}+ sqft`);
  if (filters.type) labels.push(filters.type);
  if (filters.pool === "True") labels.push("pool");
  if (filters.pool === "False") labels.push("no pool");
  if (filters.hasView === "True") labels.push("view");
  if (filters.hasView === "False") labels.push("no view");
  if (filters.maxHoa) labels.push(`HOA up to $${filters.maxHoa.toLocaleString("en-US")}`);
  return labels.join(", ");
}

/** Ask one focused question instead of querying a broad, expensive result set. */
function nextQuestion(filters) {
  if (!filters.city) return "Which California city would you like to search in?";
  if (!filters.maxPrice) return `What is your maximum budget for a home in ${filters.city}?`;
  if (!filters.type && !filters.beds) {
    return "What property type and minimum number of bedrooms do you prefer? For example: single family with at least 3 beds.";
  }
  return null;
}

function listingId(row) {
  return String(row.L_ListingID ?? row.L_DisplayId ?? "");
}

/**
 * Build the multi-turn coordinator with injectable dependencies. Production
 * uses the real parser/MySQL functions; tests replace the database function so
 * conversation behavior can be checked without needing MySQL.
 */
export function createConversationAgent({
  sessionStore = createFileSessionStore(),
  parseQuery = parsePropertyQuery,
  searchListings = searchActiveListings,
  formatListings = formatActiveListingCards,
} = {}) {
  return async function handleMessage({ userId, message, limit = 5 }) {
    if (typeof message !== "string" || message.trim() === "") {
      throw new TypeError("message must be a non-empty string");
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new RangeError("limit must be an integer between 1 and 50");
    }

    if (RESET_PATTERN.test(message.trim())) {
      await sessionStore.clearSession(userId);
      return {
        status: "reset",
        message: "Your property-search preferences have been cleared. Which California city would you like to search in?",
        session: { ...createEmptyPublicSession(), conversationStep: 0 },
        listings: [],
      };
    }

    const current = await sessionStore.getSession(userId);
    const filters = mergeFilters(current.filters, parseQuery(message));
    const pendingQuestion = nextQuestion(filters);
    const baseSession = {
      ...current,
      filters,
      conversationStep: current.conversationStep + 1,
    };

    if (pendingQuestion) {
      const saved = await sessionStore.updateSession(userId, baseSession);
      return {
        status: "needs-input",
        message: pendingQuestion,
        session: publicSession(saved),
        listings: [],
      };
    }

    const rows = await searchListings(filters, 1, limit);
    const saved = await sessionStore.updateSession(userId, {
      ...baseSession,
      lastResultIds: rows.map(listingId).filter(Boolean).slice(0, limit),
    });
    const criteria = summarizeFilters(filters);
    const intro = rows.length === 0
      ? `I found no active listings for ${criteria}. Your preferences are saved; try relaxing one filter.`
      : `I found ${rows.length} active listing${rows.length === 1 ? "" : "s"} for ${criteria}:`;
    const cards = rows.length > 0 ? `\n\n${formatListings(rows)}` : "";
    return {
      status: rows.length > 0 ? "results" : "no-results",
      message: `${intro}${cards}\n\nReply with another preference to refine these results, or say \"reset\" to start over.`,
      session: publicSession(saved),
      listings: rows,
    };
  };
}

function createEmptyPublicSession() {
  return { filters: { ...EMPTY_FILTERS }, lastResultIds: [] };
}

function publicSession(session) {
  return {
    filters: session.filters,
    lastResultIds: session.lastResultIds,
    conversationStep: session.conversationStep,
  };
}

export const handleConversationMessage = createConversationAgent();
