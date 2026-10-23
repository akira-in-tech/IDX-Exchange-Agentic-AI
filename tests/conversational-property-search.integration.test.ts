import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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

test("CLI exits cleanly after returning live database results", { skip: !runLive }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "idx-week4-cli-live-"));
  const result = spawnSync(process.execPath, [
    "skills/conversational-property-search/scripts/conversation.mjs",
    "--user-id", "cli-live-user",
    "--message", "Show me 2 bedroom homes in Irvine under $2M",
    "--limit", "1",
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: { ...process.env, IDX_SESSION_STORE: directory },
    timeout: 5_000,
  });

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "results");
  assert.equal(output.listings.length, 1);
  assert.ok(output.listings[0].L_Address);
  assert.ok(Number(output.listings[0].price) > 0);
  assert.ok(Number(output.listings[0].beds) >= 2);
  assert.notEqual(output.listings[0].baths, undefined);
  assert.notEqual(output.listings[0].PhotoCount, undefined);
});
