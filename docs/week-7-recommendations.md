# Week 7: Recommendation Engine

The `property-recommendations` OpenClaw skill takes an active MLS listing ID and recommends up to five similar active properties. It uses the private Week 6 embedding index and rechecks listing status in `rets_property` before returning results.

## Scoring and price assessment

- Structured similarity contributes up to 60 points: price 20, bedrooms 15, city 15, and square footage 10.
- Cosine similarity between listing embeddings contributes up to 40 points.
- Each recommendation includes a price comparison against residential sales in the same city from the last six months. Comps must have living area within 80–120% of the recommended listing.
- When there are no recent comps or the listing lacks required data, the assessment reports that explicitly.

The price comparison is descriptive market context, not an appraisal. Recommendations are ranked within the *indexed sample*. The current 100-listing demo index does not cover every active MLS listing.

## Commands

The target listing must already be in the Week 6 index. From the repository root:

```bash
npm test
node skills/property-recommendations/scripts/recommend-listings.mjs --listing-id 1015664683
```

To expand coverage, rebuild the Week 6 index after checking Gemini API usage:

```bash
node --env-file=.env skills/semantic-property-search/scripts/build-listing-index.mjs --all --batch-size 50
```

## OpenClaw registration

```bash
openclaw skills install ./skills/property-recommendations --force
openclaw skills info property-recommendations
```

Invoke in OpenClaw with:

```text
/property-recommendations Recommend homes similar to MLS listing 1015664683.
```
