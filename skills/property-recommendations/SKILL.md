---
name: property-recommendations
description: Recommend five active listings similar to a liked listing, with six-month sold-comp price assessments.
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["node"] } } }
---

When a user supplies an active MLS listing ID they like, run:

```bash
node {baseDir}/scripts/recommend-listings.mjs --listing-id '<numeric MLS ID>'
```

Explain the top five results and comp assessments from the JSON. State when recent comps are unavailable. The target must be in the local Week 6 index; build a broader index if needed. Never invent listings or prices.
