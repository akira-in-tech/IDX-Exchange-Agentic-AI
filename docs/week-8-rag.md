# Week 8: Document-grounded RAG

`real-estate-rag` indexes the supplied Real Estate Data Analyst Primer, Trestle Property MetaData PDF, and a live Week 5 city summary. It splits extracted pages into overlapping 600-character chunks, embeds them with the configured provider, ranks by cosine similarity, and sends four numbered source excerpts to Gemini for a cited answer. The response includes source document and page numbers. If sources do not establish an answer, the prompt instructs the model to say so.

```bash
node --env-file=.env skills/real-estate-rag/scripts/index-documents.mjs --city Irvine
node --env-file=.env skills/real-estate-rag/scripts/answer-question.mjs --question 'What does DOM mean?'
node --env-file=.env skills/real-estate-rag/scripts/answer-question.mjs --question 'What columns are in california_sold?'
node --env-file=.env skills/real-estate-rag/scripts/answer-question.mjs --question 'What is a list-to-close ratio?'
```

The PDF extraction uses the repository Python environment (`venv/bin/python`) with `pypdf`. Indexing sends document excerpts and the market summary to Gemini; run it only when that data transfer is approved. The generated index stays in `~/.openclaw/state/` and is not committed.
