# Week 7: Hybrid recommendations

`property-recommendations` accepts an active MLS listing ID already present in the Week 6 local vector index. It scores active candidates with up to 60 structured points (price 20, bedrooms 15, city 15, square footage 10) and up to 40 cosine similarity points. The five highest scores receive six-month `california_sold` price assessments using same-city residential closings within 80–120% of each candidate's area. Missing recent comps are reported explicitly.

```bash
node skills/property-recommendations/scripts/recommend-listings.mjs --listing-id 1015664683
```

The index is a local demo sample unless built with `--all`, so recommendations are top five *within the indexed sample*, not necessarily all MLS listings. Sold comps are an indicative comparison, not an appraisal.
