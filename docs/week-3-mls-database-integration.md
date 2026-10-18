# Week 3: MLS Database Integration

## Deliverable

The `mls-database-search` OpenClaw skill connects the Week 2 natural-language filters to the local `idx_exchange` MySQL database. It supports:

- Parameterized, paginated active-listing searches over `rets_property`
- Recent sold-comp searches over `california_sold`
- A hard limit of 50 rows per request
- Structured JSON plus readable property cards
- Safe rejection of unsupported filters and all-null natural-language queries

## Data flow

```text
Free-text query
  -> property-search-parser (Week 2)
  -> validated PropertyFilters
  -> parameterized mysql2 prepared statement
  -> rets_property or california_sold
  -> structured rows
  -> formatted property cards
```

User input is never concatenated into SQL. Only fixed SQL fragments are selected by validated filter keys; all values use `?` placeholders.

The query layer also normalizes boolean storage differences: the handbook uses `"True"`/`"False"`, while the imported local tables use `"1"`/empty string for several pool and view values. Fixed SQL predicates support both encodings.

## Configuration

The local defaults are `127.0.0.1:3306`, user `root`, and database `idx_exchange`. Override them through environment variables:

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=idx_user
MYSQL_PASSWORD=your_secure_password
MYSQL_DATABASE=idx_exchange
MYSQL_CONNECTION_LIMIT=5
```

For production, use a dedicated read-only MySQL user rather than `root`.

## Commands

Install dependencies and run all offline tests:

```bash
npm install
npm test
```

Run live database integration tests:

```bash
npm run test:db
```

Search active listings:

```bash
node skills/mls-database-search/scripts/search-mls.mjs \
  --query 'Show me 3-bedroom homes in Irvine under $2M' \
  --limit 5
```

Search recent sold comps:

```bash
node skills/mls-database-search/scripts/search-mls.mjs \
  --sold-city 'Los Angeles' \
  --months 12 \
  --limit 5
```

## OpenClaw registration

```bash
openclaw skills install ./skills/property-search-parser --force
openclaw skills install ./skills/mls-database-search --force
npm install --omit=dev --prefix ~/.openclaw/workspace/skills/mls-database-search
openclaw skills info mls-database-search
```

Invoke it in a new OpenClaw session:

```text
/mls-database-search Show me 3-bedroom homes in Irvine under $2M
```

## Scope boundary

This skill is read-only. It does not modify MLS records, send WhatsApp messages, maintain multi-turn preferences, calculate market statistics, or perform semantic search; those capabilities belong to later weeks.
