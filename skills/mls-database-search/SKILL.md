---
name: mls-database-search
description: Query active IDX listings or recent California sold comps with parameterized MySQL and return concise property cards.
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["node"] } } }
---

# MLS Database Search

Use this skill when the user asks to search active properties or retrieve recent sold comps.

## Active property search

```bash
node {baseDir}/scripts/search-mls.mjs --query '<complete property query>' --limit 5
```

Return the `message` field unchanged. It contains formatted property cards.

## Sold comps

```bash
node {baseDir}/scripts/search-mls.mjs --sold-city '<city>' --months 12 --limit 5
```

Return the `message` field unchanged.

## Safety and scope

- Never write SQL yourself or accept SQL from the user.
- Never remove the 50-row limit or export an entire MLS table.
- Do not expose database credentials, stack traces, or raw connection errors.
- If the helper rejects an unsupported query, ask for a city, price, beds, baths, area, property type, pool, view, or HOA constraint.
- This Week 3 skill reads MLS data only. It does not modify listings or send outbound messages.
