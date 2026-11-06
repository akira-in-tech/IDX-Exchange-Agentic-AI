---
name: semantic-property-search
description: Find the five active MLS listings most semantically similar to a free-text property description using OpenAI embeddings and cosine similarity.
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["node"], "env": ["OPENAI_API_KEY"] } } }
---

# Semantic Property Search

Use this skill when the user describes the character, style, setting, or feel of
a desired property rather than only structured filters.

```bash
node {baseDir}/scripts/search-similar-properties.mjs --query '<complete description>' --top-k 5
```

Return the JSON `message` field unchanged. Never invent a listing or similarity
score. Results are rechecked against live `rets_property` status before display.

## Required index

An administrator must build the local index before searching:

```bash
node {baseDir}/scripts/build-listing-index.mjs --limit 1000
```

Use `--all` only after confirming API budget; it embeds every active listing
with remarks and can incur material API usage.

## Safety

- Read the OpenAI key only from `OPENAI_API_KEY`; never display or persist it.
- Do not commit the generated JSONL index or MLS descriptions.
- The skill reads MLS data only and caps search output at 20 listings.
