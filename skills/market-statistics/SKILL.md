---
name: market-statistics
description: Answer California city housing-market questions with median price, price per sqft, days on market, list-to-close ratio, inventory, and monthly trends from MLS data.
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["node"] } } }
---

# Market Statistics

Use this skill when the user asks about residential market conditions, prices,
days on market, negotiation leverage, inventory, or trends for a California city.

```bash
node {baseDir}/scripts/analyze-market.mjs --city '<complete city>' --months 12
```

Return the JSON `message` field unchanged. Do not add unsupported predictions or
claim that the statistics are financial advice.

## Safety and data rules

- Never write SQL or interpolate user text into SQL.
- This skill reads `california_sold` and `rets_property` only.
- It excludes invalid future close dates and non-residential sales.
- Never expose database credentials, stack traces, or raw connection errors.
