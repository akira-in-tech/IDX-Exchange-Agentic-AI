# Week 8: Retrieval-Augmented Generation

The `real-estate-rag` OpenClaw skill answers real estate terminology and MLS metadata questions using cited source material. It indexes the supplied Real Estate Data Analyst Primer, Trestle Property MetaData PDF, and a live Week 5 city market summary.

## Data flow

```text
Primer PDF + Trestle PDF + Week 5 market summary
  -> extract text by page -> overlapping 600-character chunks
  -> Gemini embeddings -> private local index (273 demo chunks)

question -> embed -> retrieve four relevant excerpts
  -> grounded Gemini answer -> numbered document and page citations
```

For an exact `california_sold` column list, the skill queries local MySQL `information_schema` and cites that live schema. If Gemini generation returns 503 for a DOM question, it can give the definition directly from the indexed Primer with a page citation. Other 503 responses return relevant excerpts rather than an invented answer.

## Configuration and commands

The PDF files are expected in `/Users/akira/Documents/IDX/`. Extraction uses `venv/bin/python` with `pypdf`. The ignored project `.env` supplies `GEMINI_API_KEY` for direct CLI runs. Indexing sends extracted source text to Gemini and writes the index to `~/.openclaw/state/idx-rag-index.json` outside Git.

```bash
npm test
node --env-file=.env skills/real-estate-rag/scripts/index-documents.mjs --city Irvine
node --env-file=.env skills/real-estate-rag/scripts/answer-question.mjs --question 'What does DOM mean?'
node --env-file=.env skills/real-estate-rag/scripts/answer-question.mjs --question 'What columns are in california_sold?'
node --env-file=.env skills/real-estate-rag/scripts/answer-question.mjs --question 'What is a list-to-close ratio?'
```

The three handbook questions have been exercised against the local index. Gemini can return 503 under load; the CLI retries temporary failures before using the documented fallback.

## OpenClaw registration

```bash
openclaw skills install ./skills/real-estate-rag --force
npm install --omit=dev --prefix ~/.openclaw/workspace/skills/real-estate-rag
openclaw skills info real-estate-rag
```

Invoke in OpenClaw with:

```text
/real-estate-rag What does DOM mean?
```
