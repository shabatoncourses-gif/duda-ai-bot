// pages/api/chat.js
export const config = { runtime: "nodejs" };
export const dynamic = "force-dynamic";

import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import fetch from "node-fetch";

/* -------------------------------------- */
/* Utility                                */
/* -------------------------------------- */

function normalizeHebrew(t) {
  return (t || "")
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function cleanText(t) {
  return normalizeHebrew(
    (t || "")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/רוצים להיות מעודכנים[^\.]+/gi, "")
      .replace(/לוח מועדי קורסים/gi, "")
      .replace(/למידה מרחוק/gi, "")
      .replace(/קורסים בלמידה מרחוק/gi, "")
      .replace(/קורסים|מאמרים|צרו קשר|אודות|כניסה|מורים/gi, "")
  );
}

/* -------------------------------------- */
/* Load Index                              */
/* -------------------------------------- */

async function loadIndexes() {
  const base =
    "https://raw.githubusercontent.com/shabatoncourses-gif/duda-ai-bot/main/data";

  const files = [
    "shabaton_index_part1.json",
    "shabaton_index_part2.json",
    "shabaton_index_part3.json",
    "morim_index_part1.json"
  ];

  const sh = [];
  const mo = [];

  for (const f of files) {
    try {
      const res = await fetch(`${base}/${f}`);
      if (!res.ok) continue;
      const arr = await res.json();
      if (Array.isArray(arr)) {
        if (f.startsWith("shabaton")) sh.push(...arr);
        else mo.push(...arr);
      }
    } catch (err) {
      console.error("index load error:", f, err);
    }
  }

  return [...sh, ...mo];
}

/* -------------------------------------- */
/* Classify Page                           */
/* -------------------------------------- */

function classifyPage(p) {
  const url = (p.url || "").toLowerCase();

  if (url.includes("/results-all/")) return "results";
  if (url.includes("thank") || url.includes("contact")) return "blocked";
  if (url.includes("/mosad-index/")) return "blocked";

  const title = normalizeHebrew(p.title || "");
  const h1 = normalizeHebrew(p.h1 || "");

  if (title.includes("מאמר") || h1.includes("מאמר") || url.includes("/article"))
    return "article";

  return "course";
}

/* -------------------------------------- */
/* Soon courses                            */
/* -------------------------------------- */

const MONTHS = {
  "ינואר": 0,
  "פברואר": 1,
  "מרץ": 2,
  "אפריל": 3,
  "מאי": 4,
  "יוני": 5,
  "יולי": 6,
  "אוגוסט": 7,
  "ספטמבר": 8,
  "אוקטובר": 9,
  "נובמבר": 10,
  "דצמבר": 11
};

function extractStartDate(text) {
  if (!text) return null;
  const t = text.toLowerCase();

  let month = null;
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (t.includes(name)) {
      month = idx;
      break;
    }
  }

  const yearMatch = /20\d{2}/.exec(t);
  if (!yearMatch || month === null) return null;

  return new Date(parseInt(yearMatch[0]), month, 1);
}

function isSoon(date) {
  if (!date) return false;
  const now = new Date();
  const m = now.getMonth();
  const next = (m + 1) % 12;
  return date.getMonth() === m || date.getMonth() === next;
}

/* -------------------------------------- */
/* Handler                                 */
/* -------------------------------------- */

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.json({ ok: true });
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  try {
    const { message } = req.body || {};
    if (!message)
      return res.status(400).json({ error: "missing message" });

    if (!process.env.OPENAI_API_KEY) {
      console.error("Missing OPENAI_API_KEY");
      return res.status(500).json({ error: "Missing API key" });
    }

    const cleanMsg = normalizeHebrew(message);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg
    });

    const queryVector = emb.data[0].embedding;

    const all = await loadIndexes();

    const pages = all.map((p) => {
      const type = classifyPage(p);
      const full = [p.title, p.h1, ...(p.h2 || [])]
        .filter(Boolean)
        .join(" ");
      const txt = cleanText((p.description || "") + " " + (p.text || ""));
      const score = cosineSimilarity(queryVector, p.vector || []);
      return { ...p, type, fullTitle: full, clean: txt, score };
    });

    const bestResults = pages
      .filter((p) => p.type === "results")
      .sort((a, b) => b.score - a.score)
      .slice(0, 1);

    const courses = pages
      .filter(
        (p) =>
          p.type === "course" &&
          !p.url.includes("/results-all/") &&
          !p.url.includes("/mosad-index/") &&
          !p.url.includes("thank") &&
          !p.url.includes("contact")
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    const soon = courses
      .filter((p) => /(נפתחים בקרוב|פתיחה|נפתח)/i.test(p.fullTitle))
      .map((p) => ({
        ...p,
        date: extractStartDate(p.fullTitle + " " + p.clean)
      }))
      .filter((p) => isSoon(p.date))
      .sort((a, b) => a.date - b.date);

    const articles = pages
      .filter((p) => p.type === "article")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const finalList = [...bestResults, ...courses, ...soon, ...articles];

    const context = finalList
      .map(
        (p, i) =>
          `# Item ${i + 1}\nType: ${p.type}\nTitle: ${p.fullTitle}\nText: ${p.clean}\nURL: ${p.url}`
      )
      .join("\n\n");

    const systemPrompt =
      "Answer only from context. No invented URLs. No invented pages.";

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Question: ${message}\n\nContext:\n${context}` }
      ]
    });

    const reply =
      completion?.choices?.[0]?.message?.content || "";

    return res.json({ reply });
  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
