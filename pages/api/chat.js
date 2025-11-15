// pages/api/chat.js
export const config = { runtime: "nodejs" };
export const dynamic = "force-dynamic";

import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";
import fetch from "node-fetch";

/* ---------------------------------------------------
   Utility Functions
--------------------------------------------------- */

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
  let dot = 0, na = 0, nb = 0;
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
      .replace(/(למידה מרחוק|קורסים בלמידה מרחוק)/gi, "")
      .replace(/(קורסים|מאמרים|צרו קשר|אודות|כניסה|מורים)/gi, "")
  );
}

/* ---------------------------------------------------
   Load Index Files
--------------------------------------------------- */

async function loadIndexes() {
  const base =
    "https://raw.githubusercontent.com/shabatoncourses-gif/duda-ai-bot/main/data";

  const files = [
    "shabaton_index_part1.json",
    "shabaton_index_part2.json",
    "shabaton_index_part3.json",
    "morim_index_part1.json",
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
    } catch (e) {
      console.error("Error loading index:", f, e);
    }
  }

  return [...sh, ...mo];
}

/* ---------------------------------------------------
   Page Type Classification
--------------------------------------------------- */

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

/* ---------------------------------------------------
   Soon Courses Handling
--------------------------------------------------- */

const MONTHS = {
  ינואר: 0,
  פברואר: 1,
  מרץ: 2,
  אפריל: 3,
  מאי: 4,
  יוני: 5,
  יולי: 6,
  אוגוסט: 7,
  ספטמבר: 8,
  אוקטובר: 9,
  נובמבר: 10,
  דצמבר: 11,
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

/* ---------------------------------------------------
   MAIN API HANDLER
--------------------------------------------------- */

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
      console.error("❌ Missing OPENAI_API_KEY");
      return res
        .status(500)
        .json({ error: "server configuration error (no API key)" });
    }

    const cleanMsg = normalizeHebrew(message);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    /* Embedding */
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg,
    });

    const queryVector = emb.data[0].embedding;

    /* Load pages */
    const all = await loadIndexes();

    /* Rank pages */
    const pages = all.map((p) => {
      const type = classifyPage(p);
      const full = [p.title, p.h1, ...(p.h2 || [])]
        .filter(Boolean)
        .join(" ");
      const txt = cleanText((p.description || "") + " " + (p.text || ""));
      const score = cosineSimilarity(queryVector, p.vector || []);
      return { ...p, type, fullTitle: full, clean: txt, score };
    });

    /* Select pages */
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
        date: extractStartDate(p.fullTitle + " " + p.clean),
      }))
      .filter((p) => isSoon(p.date))
      .sort((a, b) => a.date - b.date);

    const articles = pages
      .filter((p) => p.type === "article")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const finalList = [...bestResults, ...courses, ...soon, ...articles];

    /* Build context */
    const context = finalList
      .map((p, i) => {
        return `
# פריט ${i + 1}
סוג: ${p.type}
כותרת: ${p.fullTitle}
תיאור: ${p.clean}
קישור: ${p.url}
`.trim();
      })
      .join("\n\n");

    console.log("=== CONTEXT SENT TO MODEL ===");
    console.log(context);

    /* System Prompt */
    const systemPrompt = `
אתה מספק תשובות אך ורק מתוך הפריטים שבקונטקסט.

❗ אסור:
- להמציא קישורים או דפים
- להמציא results-all
- להציג URL גולמי
- לכתוב "אין מידע...", "אין כרגע...", "מומלץ לבדוק...", "נכון לעכשיו..."
- להשתמש בדפים שאינם בקונטקסט

✔️ סדר:
1. results-all (רק הראשון אם קיים)
2. קורסים (course)
3. נפתחים בקרוב (soon)
4. מאמרים (article)

✔️ תצוגה:
- כל פריט בכרטיס
- כותרת מודגשת
- 1–2 משפטים
- כפתור:
  <a href="URL" class="ai-main-btn">למידע נוסף</a>
`;

    /* Model call */
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `השאלה: ${message}\n\nדפים רלוונטיים:\n${context}`,
        },
      ],
    });
    let replyText = "";
    if (
      completion &&
      completion.choices &&
      completion.choices[0] &&
      completion.choices[0].message &&
      completion.choices[0].message.content
    ) {
      replyText = completion.choices[0].message.content;
    }
    return res.json({ reply: replyText });
  } catch (err) {
    console.error("ERROR in /api/chat:", err);
    return res.status(500).json({ error: err.message });
  }
}
