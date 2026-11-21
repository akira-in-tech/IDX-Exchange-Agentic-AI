#!/usr/bin/env node
/** Read the two supplied PDFs, add current market data, and embed their chunks. */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { indexDocuments, marketSummarySource } from "./rag.mjs";
import { closePool } from "../../mls-database-search/scripts/database.mjs";

const base = "/Users/akira/Documents/IDX";
const python = resolve("venv/bin/python");
function pdfPages(filename) {
  const script = "import json,pypdf,sys; d=pypdf.PdfReader(sys.argv[1]); print(json.dumps([{'page':i+1,'text':p.extract_text()} for i,p in enumerate(d.pages)]))";
  return JSON.parse(execFileSync(python, ["-c", script, `${base}/${filename}`], { encoding: "utf8", maxBuffer: 5_000_000 }));
}
try {
  const city = process.argv[process.argv.indexOf("--city") + 1] || "Irvine";
  const sources = [
    { title: "Real Estate Data Analyst Primer", pages: pdfPages("Real_Estate_Data_Analys_Primer.pdf") },
    { title: "Trestle Property MetaData", pages: pdfPages("Trestle Property MetaData.pdf") },
    await marketSummarySource(city),
  ];
  console.log(JSON.stringify(await indexDocuments(sources)));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { await closePool(); }
