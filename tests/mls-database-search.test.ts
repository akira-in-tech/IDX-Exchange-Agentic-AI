import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { getDatabaseConfig } from "../skills/mls-database-search/scripts/database.mjs";
import {
  buildActiveListingQuery,
  buildSoldCompsQuery,
  hasRecognizedFilters,
  searchActiveListings,
} from "../skills/mls-database-search/scripts/mls-query.mjs";
import {
  formatActiveListingCards,
  formatSoldCompCards,
} from "../skills/mls-database-search/scripts/format-results.mjs";

const EMPTY_FILTERS = {
  city: null,
  maxPrice: null,
  beds: null,
  baths: null,
  sqft: null,
  type: null,
  pool: null,
  hasView: null,
  maxHoa: null,
};

test("database config reads environment values without exposing unrelated data", () => {
  const config = getDatabaseConfig({
    MYSQL_HOST: "db.internal",
    MYSQL_PORT: "3307",
    MYSQL_USER: "reader",
    MYSQL_PASSWORD: "secret",
    MYSQL_DATABASE: "idx_test",
    MYSQL_CONNECTION_LIMIT: "3",
  });

  assert.equal(config.host, "db.internal");
  assert.equal(config.port, 3307);
  assert.equal(config.user, "reader");
  assert.equal(config.password, "secret");
  assert.equal(config.database, "idx_test");
  assert.equal(config.connectionLimit, 3);
});

test("builds a fully parameterized active-listing query", () => {
  const statement = buildActiveListingQuery({
    ...EMPTY_FILTERS,
    city: "Irvine",
    maxPrice: 1_500_000,
    beds: 3,
    type: "Condominium",
    pool: "True",
    maxHoa: 500,
  }, 2, 5);

  assert.match(statement.sql, /L_City = \?/);
  assert.match(statement.sql, /L_SystemPrice <= \?/);
  assert.match(statement.sql, /L_Keyword2 >= \?/);
  assert.match(statement.sql, /L_Type_ = \?/);
  assert.match(statement.sql, /PoolPrivateYN IN \('True', 'true', '1'\)/);
  assert.match(statement.sql, /AssociationFee <= \?/);
  assert.deepEqual(statement.params, ["Irvine", 1_500_000, 3, "Condominium", 500, 5, 5]);
});

test("keeps SQL injection text in parameters instead of SQL", () => {
  const maliciousCity = "Irvine' OR 1=1 --";
  const statement = buildActiveListingQuery({ ...EMPTY_FILTERS, city: maliciousCity });

  assert.doesNotMatch(statement.sql, /OR 1=1/);
  assert.equal(statement.params[0], maliciousCity);
});

test("enforces the handbook 50-row safety limit", () => {
  assert.throws(() => buildActiveListingQuery(EMPTY_FILTERS, 1, 51), /between 1 and 50/);
  assert.throws(() => buildSoldCompsQuery("Irvine", 12, 51), /between 1 and 50/);
});

test("rejects unsupported filter keys and invalid amenity values", () => {
  assert.throws(
    () => buildActiveListingQuery({ ...EMPTY_FILTERS, rawSql: "DROP TABLE rets_property" }),
    /unsupported filter keys/,
  );
  assert.throws(
    () => buildActiveListingQuery({ ...EMPTY_FILTERS, pool: "yes" }),
    /pool must be "True", "False", or null/,
  );
});

test("recognizes useful filters but not an all-null parser response", () => {
  assert.equal(hasRecognizedFilters(EMPTY_FILTERS), false);
  assert.equal(hasRecognizedFilters({ ...EMPTY_FILTERS, city: "Irvine" }), true);
});

test("search function passes prepared SQL and parameters to its query dependency", async () => {
  let receivedSql = "";
  let receivedParams: unknown[] = [];
  const fakeQuery = async (sql: string, params: unknown[]) => {
    receivedSql = sql;
    receivedParams = params;
    return [{ L_ListingID: "demo" }];
  };

  const rows = await searchActiveListings({ ...EMPTY_FILTERS, city: "Irvine" }, 1, 3, fakeQuery);
  assert.deepEqual(rows, [{ L_ListingID: "demo" }]);
  assert.match(receivedSql, /LIMIT \? OFFSET \?/);
  assert.deepEqual(receivedParams, ["Irvine", 3, 0]);
});

test("formats active listings and sold comps as readable cards", () => {
  const active = formatActiveListingCards([{
    L_Address: "1 Main St",
    L_City: "Irvine",
    L_Zip: "92602",
    price: 1_250_000,
    beds: 3,
    baths: 2.5,
    sqft: 1_900,
    type: "Condominium",
    DaysOnMarket: 8,
    PhotoCount: 24,
    L_DisplayId: "OC123",
    LA1_UserFirstName: "Alex",
    LA1_UserLastName: "Lee",
  }]);
  assert.match(active, /\$1,250,000/);
  assert.match(active, /3 bd \/ 2\.5 ba/);
  assert.match(active, /MLS: OC123/);

  const sold = formatSoldCompCards([{
    ListingKey: 123,
    UnparsedAddress: "2 Main St",
    City: "Irvine",
    PostalCode: "92602",
    CloseDate: "2026-05-01",
    ClosePrice: 1_100_000,
    BedroomsTotal: 3,
    BathroomsTotalInteger: 2,
    LivingArea: 1_800,
    PropertySubType: "Condominium",
    DaysOnMarket: 12,
  }]);
  assert.match(sold, /Closed 2026-05-01 for \$1,100,000/);
  assert.match(sold, /Listing 123/);
});

test("CLI rejects a query with no recognized property filters before database access", () => {
  const result = spawnSync(
    process.execPath,
    ["skills/mls-database-search/scripts/search-mls.mjs", "--query", "What is the weather?"],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /no supported property filters were recognized/);
});
