import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { closePool } from "../skills/mls-database-search/scripts/database.mjs";
import { createConversationAgent } from "../skills/conversational-property-search/scripts/conversation-agent.mjs";
import { createFileSessionStore } from "../skills/conversational-property-search/scripts/session-store.mjs";

const runLive = process.env.RUN_DB_TESTS === "1";

test("runs a three-turn conversation against rets_property", { skip: !runLive }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "idx-week4-live-"));
  const agent = createConversationAgent({ sessionStore: createFileSessionStore({ directory }) });
  try {
    const first = await agent({ userId: "live-demo", message: "Find homes in Irvine", limit: 3 });
    const second = await agent({ userId: "live-demo", message: "Under $2M", limit: 3 });
    const third = await agent({ userId: "live-demo", message: "At least 2 bedrooms with a pool", limit: 3 });

    assert.equal(first.status, "needs-input");
    assert.equal(second.status, "needs-input");
    assert.equal(third.status, "results");
    assert.ok(third.listings.length > 0 && third.listings.length <= 3);
    for (const row of third.listings) {
      assert.equal(row.L_City, "Irvine");
      assert.ok(Number(row.price) <= 2_000_000);
      assert.ok(Number(row.beds) >= 2);
    }
  } finally {
    await closePool();
  }
});
