---
name: real-estate-rag
description: Answer real estate terminology and MLS metadata questions using indexed source documents with citations.
user-invocable: true
metadata: { "openclaw": { "requires": { "bins": ["node"], "env": ["GEMINI_API_KEY"] } } }
---

For questions about DOM, list-to-close ratio, MLS columns, or market concepts, run:

```bash
node {baseDir}/scripts/answer-question.mjs --question '<full question>'
```

Use the answer and numbered source citations from the JSON. If the excerpts are insufficient, say so. Build the source index once using `node {baseDir}/scripts/index-documents.mjs --city Irvine` from the repository root with its Python environment installed.
