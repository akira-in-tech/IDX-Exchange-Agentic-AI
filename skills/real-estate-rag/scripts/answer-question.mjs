#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import { answerQuestion } from "./rag.mjs";
const index = process.argv.indexOf("--question");
if (index < 0 || !process.argv[index + 1]) { console.error("Usage: --question '<question>'"); process.exit(1); }
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function generate(prompt) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try { return (await ai.models.generateContent({ model: process.env.GEMINI_RAG_MODEL || "gemini-3.8-flash", contents: prompt })).text; }
    catch (error) {
      if (attempt === 2 || !/503|UNAVAILABLE|high demand/i.test(String(error.message))) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
}
try {
  const response = await answerQuestion(process.argv[index + 1], {
    generator: generate,
  });
  console.log(JSON.stringify(response, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
