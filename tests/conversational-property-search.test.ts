import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  createConversationAgent,
  mergeFilters,
} from "../skills/conversational-property-search/scripts/conversation-agent.mjs";
import {
  createFileSessionStore,
  createSession,
  EMPTY_FILTERS,
} from "../skills/conversational-property-search/scripts/session-store.mjs";

const DEMO_LISTING = {
  L_ListingID: "123",
  L_DisplayId: "OC123",
  L_Address: "1 Main St",
  L_City: "Irvine",
  L_Zip: "92602",
  price: 1_100_000,
  beds: 3,
  baths: 2,
  sqft: 1_800,
  type: "SingleFamilyResidence",
  status: "Active",
  DaysOnMarket: 5,
  PhotoCount: 20,
};

async function fixture(searchListings = async () => [DEMO_LISTING]) {
  const directory = await mkdtemp(join(tmpdir(), "idx-week4-"));
  const sessionStore = createFileSessionStore({ directory });
  return {
    directory,
    sessionStore,
    agent: createConversationAgent({ sessionStore, searchListings }),
  };
}

test("merges only newly supplied filters into remembered preferences", () => {
  assert.deepEqual(
    mergeFilters({ ...EMPTY_FILTERS, city: "Irvine", beds: 2 }, { ...EMPTY_FILTERS, maxPrice: 1_200_000 }),
    { ...EMPTY_FILTERS, city: "Irvine", maxPrice: 1_200_000, beds: 2 },
  );
});

test("asks for budget after remembering a city", async () => {
  const { agent } = await fixture();
  const result = await agent({ userId: "alice", message: "Find homes in Irvine" });

  assert.equal(result.status, "needs-input");
  assert.match(result.message, /maximum budget/);
  assert.equal(result.session.filters.city, "Irvine");
  assert.equal(result.session.conversationStep, 1);
});

test("adds a budget on the next turn and asks for home preferences", async () => {
  const { agent } = await fixture();
  await agent({ userId: "alice", message: "Find homes in Irvine" });
  const result = await agent({ userId: "alice", message: "Under $1.2M" });

  assert.equal(result.status, "needs-input");
  assert.match(result.message, /property type.*bedrooms/i);
  assert.equal(result.session.filters.city, "Irvine");
  assert.equal(result.session.filters.maxPrice, 1_200_000);
  assert.equal(result.session.conversationStep, 2);
});

test("third turn queries listings with all remembered filters", async () => {
  let searchedFilters: typeof EMPTY_FILTERS | null = null;
  const { agent } = await fixture(async (filters) => {
    searchedFilters = filters;
    return [DEMO_LISTING];
  });
  await agent({ userId: "alice", message: "Find homes in Irvine" });
  await agent({ userId: "alice", message: "Under $1.2M" });
  const result = await agent({ userId: "alice", message: "Single family with at least 3 beds" });

  assert.equal(result.status, "results");
  assert.deepEqual(searchedFilters, {
    ...EMPTY_FILTERS,
    city: "Irvine",
    maxPrice: 1_200_000,
    beds: 3,
    type: "SingleFamilyResidence",
  });
  assert.match(result.message, /1 Main St/);
  assert.match(result.message, /20 photos/);
  assert.deepEqual(result.session.lastResultIds, ["123"]);
});

test("a later preference refines and reruns the previous search", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const { agent } = await fixture(async (filters) => {
    calls.push(filters);
    return [DEMO_LISTING];
  });
  await agent({ userId: "alice", message: "Homes in Irvine under $1.2M with 3 beds" });
  const result = await agent({ userId: "alice", message: "Only ones with a pool" });

  assert.equal(result.status, "results");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].city, "Irvine");
  assert.equal(calls[1].pool, "True");
});

test("sessions are isolated between users", async () => {
  const { agent } = await fixture();
  await agent({ userId: "alice", message: "Find homes in Irvine" });
  const bob = await agent({ userId: "bob", message: "Under $900k" });

  assert.equal(bob.session.filters.city, null);
  assert.equal(bob.session.filters.maxPrice, 900_000);
  assert.match(bob.message, /Which California city/);
});

test("reset removes saved filters", async () => {
  const { agent, sessionStore } = await fixture();
  await agent({ userId: "alice", message: "Find homes in Irvine" });
  const result = await agent({ userId: "alice", message: "reset" });
  const stored = await sessionStore.getSession("alice");

  assert.equal(result.status, "reset");
  assert.deepEqual(stored.filters, EMPTY_FILTERS);
});

test("expired sessions are discarded", async () => {
  const directory = await mkdtemp(join(tmpdir(), "idx-week4-expiry-"));
  let clock = 1_000;
  const store = createFileSessionStore({ directory, ttlMs: 100, now: () => clock });
  await store.updateSession("alice", { ...createSession(clock, 100), filters: { ...EMPTY_FILTERS, city: "Irvine" } });
  clock = 1_101;

  assert.deepEqual((await store.getSession("alice")).filters, EMPTY_FILTERS);
});

test("session filenames do not expose channel identifiers", async () => {
  const { directory, sessionStore } = await fixture();
  await sessionStore.updateSession("+18324976714", createSession());
  const files = await import("node:fs/promises").then(({ readdir }) => readdir(directory));
  assert.equal(files.length, 1);
  assert.doesNotMatch(files[0], /18324976714/);
  assert.doesNotMatch(await readFile(join(directory, files[0]), "utf8"), /18324976714/);
});

test("no-result searches keep preferences for another refinement", async () => {
  const { agent } = await fixture(async () => []);
  const result = await agent({
    userId: "alice",
    message: "3 bedroom condos in Irvine under $500k",
  });

  assert.equal(result.status, "no-results");
  assert.match(result.message, /preferences are saved/);
  assert.equal(result.session.filters.city, "Irvine");
});
