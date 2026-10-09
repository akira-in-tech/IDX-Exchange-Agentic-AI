---
name: property-search-parser
description: Parse free-text real estate searches into structured IDX MLS filter objects for city, price, beds, baths, area, type, pool, view, and HOA.
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["node"] } } }
---

# Property Search Parser

Convert the user's property-search request into a structured filter object.

1. Pass the complete user query as one argument to the deterministic parser:

   ```bash
   node {baseDir}/scripts/parse-property-query.mjs --query '<complete property query>'
   ```

2. Return the command's JSON object unchanged. Do not rename keys, infer additional filters, or add prose.
3. If the helper reports invalid input, ask the user for a non-empty property-search query.

The output contract is:

```json
{
  "city": "Irvine",
  "maxPrice": 1500000,
  "beds": 3,
  "baths": null,
  "sqft": null,
  "type": "Condominium",
  "pool": "True",
  "hasView": null,
  "maxHoa": null
}
```

This skill only parses filters. Do not query MySQL or claim that listings were searched.
