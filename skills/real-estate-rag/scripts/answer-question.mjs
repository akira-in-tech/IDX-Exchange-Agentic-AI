#!/usr/bin/env node
import { GoogleGenAI } from "@google/genai";
import { answerQuestion } from "./rag.mjs";
const index = process.argv.indexOf("--question");
if (index < 0 || !process.argv[index + 1]) { console.error("Usage: --question '<question>'"); process.exit(1); }
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
try {
  const response = await answerQuestion(process.argv[index + 1], {
    generator: async (prompt) => (await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt })).text,
  });
  console.log(JSON.stringify(response, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
