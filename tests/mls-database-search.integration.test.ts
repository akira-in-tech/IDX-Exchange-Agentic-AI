import assert from "node:assert/strict";
import test from "node:test";

import { closePool } from "../skills/mls-database-search/scripts/database.mjs";
import {
  getSoldComps,
  searchActiveListings,
} from "../skills/mls-database-search/scripts/mls-query.mjs";

const runLive = process.env.RUN_DB_TESTS === "1";

test("queries bounded active Irvine listings from rets_property", { skip: !runLive }, async () => {
  try {
    const rows = await searchActiveListings({
      city: "Irvine",
      maxPrice: 2_000_000,
      beds: 2,
      baths: null,
      sqft: null,
      type: null,
      pool: "True",
      hasView: null,
      maxHoa: null,
    }, 1, 3);

    assert.ok(rows.length > 0 && rows.length <= 3);
    for (const row of rows) {
      assert.equal(row.L_City, "Irvine");
      assert.equal(row.status, "Active");
      assert.ok(Number(row.price) <= 2_000_000);
      assert.ok(Number(row.beds) >= 2);
      assert.ok(["True", "true", "1"].includes(row.PoolPrivateYN));
    }
  } finally {
    await closePool();
  }
});

test("queries bounded non-future Los Angeles sold comps", { skip: !runLive }, async () => {
  try {
    const rows = await getSoldComps("Los Angeles", 12, 3);
    assert.ok(rows.length > 0 && rows.length <= 3);
    const today = new Date().toISOString().slice(0, 10);
    for (const row of rows) {
      assert.equal(row.City, "Los Angeles");
      assert.ok(row.CloseDate <= today);
    }
  } finally {
    await closePool();
  }
});
