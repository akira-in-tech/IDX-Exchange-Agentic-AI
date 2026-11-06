# Week 6: Embeddings and Vector Search

The `semantic-property-search` OpenClaw skill uses Gemini embeddings and cosine
similarity to find active properties whose descriptions match a free-text idea,
even when the words are not exact keyword matches.

## Data flow

```text
active rets_property rows with L_Remarks
  -> type, city, beds, baths, sqft, year, price, remarks
  -> Gemini gemini-embedding-001 (768 dimensions)
  -> private local JSONL index

free-text query
  -> same Gemini embedding model
  -> cosine similarity against streamed index
  -> best candidates
  -> live rets_property active-status recheck
  -> top 5 property cards with similarity scores
```

Google's official Gemini embeddings documentation defines `embedContent`,
retrieval task types, reduced output dimensions, and semantic search usage.
The code also retains the previous OpenAI provider as an optional fallback.

## Configuration

Set secrets outside Git:

```bash
export EMBEDDING_PROVIDER=gemini
export GEMINI_API_KEY='<your key>'
export IDX_SEMANTIC_INDEX="$HOME/.openclaw/state/idx-semantic-index.jsonl"
```

Build a small demonstration index first:

```bash
node skills/semantic-property-search/scripts/build-listing-index.mjs --limit 100 --batch-size 50
```

After confirming API usage and cost, index all active listings with remarks:

```bash
node skills/semantic-property-search/scripts/build-listing-index.mjs --all --batch-size 50
```

Search:

```bash
node skills/semantic-property-search/scripts/search-similar-properties.mjs \
  --query 'charming craftsman with mountain views and character' \
  --top-k 5
```

## Tests

```bash
npm test
npm run test:semantic-db
npm run test:embeddings
```

Normal tests use deterministic mock embeddings and spend no API credits. The
database suite builds a temporary index from live MLS rows. The Gemini test is
explicitly opt-in and requires `GEMINI_API_KEY`. To verify the optional OpenAI
provider, run `npm run test:embeddings:openai` with `OPENAI_API_KEY` set.

## OpenClaw installation

```bash
openclaw skills install ./skills/semantic-property-search --force
npm install --omit=dev --prefix ~/.openclaw/workspace/skills/semantic-property-search
openclaw skills info semantic-property-search
```

Generated indexes contain MLS-derived data, use file mode `0600`, live outside
the repository, and must never be committed.
