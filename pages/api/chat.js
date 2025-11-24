export const config = {
  runtime: "nodejs",
};
export const dynamic = "force-dynamic";

import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import getRawBody from "raw-body";

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
    "morim_index_part1.json",
  ];

  const sh = [], mo = [];

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
/* Classify page                           */
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
/* -------------------------------------- */
/* Handler                                 */
/* -------------------------------------- */

export default async function handler(req, res) {
  /* ---------- CORS ---------- */

  const allowedOrigins = [
    "https://www.shabaton.online",
    "https://shabaton.online",
    "https://morim.boutique",
    "https://www.morim.boutique",
  ];

  const origin = req.headers.origin || "";

  res.setHeader(
    "Access-Control-Allow-Origin",
    allowedOrigins.includes(origin)
      ? origin
      : "https://www.shabaton.online"
  );

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.json({ ok: true });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  /* ---------- Read JSON Body (fixed!) ---------- */

  let message = "";
  try {
    const raw = await getRawBody(req, { encoding: "utf8" });
    const data = JSON.parse(raw);
    message = data.message || "";
  } catch (err) {
    console.error("JSON parse error:", err);
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (!message) return res.status(400).json({ error: "Message missing" });

  /* ---------- Embedding + Search ---------- */

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const cleanMsg = normalizeHebrew(message);

    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg,
    });

    const queryVector = emb.data[0].embedding;

    const all = await loadIndexes();

    /* ---------- Detect city ---------- */

    const cities = [
      "שרון","פתח תקווה","רעננה","הוד השרון","הרצליה","נתניה",
      "מודיעין","שפלה","חיפה","צפון","דרום",
      "מרכז","רמת גן","ירושלים"
    ];

    const cityMatch = cities.find(c =>
      cleanMsg.includes(normalizeHebrew(c))
    );

    /* ---------- Score pages ---------- */

    const pages = all.map(p => {
      const type = classifyPage(p);

      const fullTitle = [p.title, p.h1, ...(p.h2 || [])]
        .filter(Boolean)
        .join(" ");

      const html = p.text || "";
      const listItems = (html.match(/<li>(.*?)<\/li>/gi) || [])
        .map(li => li.replace(/<\/?li>/gi, ""))
        .join(" ");

      const txt = cleanText(
        (p.description || "") +
        " " +
        (p.h1 || "") +
        " " +
        ((p.h2 || []).join(" ")) +
        " " +
        listItems
      );

      let score = cosineSimilarity(queryVector, p.vector || []);

      if (cityMatch && txt.includes(normalizeHebrew(cityMatch))) {
        score += 0.25;
      }

      return { ...p, type, fullTitle, clean: txt, score };
    });

    /* ---------- NEW LOGIC: results = only ONE ---------- */

    const bestResults = pages
      .filter(p => p.type === "results")
      .sort((a, b) => b.score - a.score)
      .slice(0, 1)   // 🔥 רק תוצאה אחת
      .map(p => ({
        title: p.title,      // רק title
        url: p.url
      }));

    /* ---------- Courses ---------- */

    const courses = pages
      .filter(p => p.type === "course")
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    /* ---------- Soon ---------- */

    const soon = courses
      .filter(p => /(נפתחים בקרוב|פתיחה|נפתח)/i.test(p.fullTitle))
      .map(p => ({
        ...p,
        date: extractStartDate(p.fullTitle + " " + p.clean),
      }))
      .filter(p => isSoon(p.date))
      .sort((a, b) => a.date - b.date);

    /* ---------- Articles ---------- */

    const articles = pages
      .filter(p => p.type === "article")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    /* ---------- Merge Final List ---------- */

    const finalList = [
      ...bestResults,
      ...courses,
      ...soon,
      ...articles
    ];

    /* ---------- Context for GPT ---------- */
/* ---------- Context for GPT ---------- */

const context = finalList
  .map((p, i) => {
    // results — only title
    if (p.title && !p.clean && !p.description) {
      return `# Item ${i+1}
Type: results
Title: ${p.title}
URL: ${p.url}`;
    }

    // other pages — full details
    return `# Item ${i+1}
Type: ${p.type}
Title: ${p.title}
Description: ${p.description || ""}
Text: ${p.clean || ""}
URL: ${p.url}`;
  })
  .join("\n\n");


    /* ---------- GPT Completion ---------- */

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.15,
      messages: [
        {
          role: "system",
          content: `
ענה רק מתוך ה־Context.
אל תמציא מידע.
אל תמציא קישורים.
אל תוסיף "למידה מרחוק" אם לא הופיע בטקסט.
ב־results השתמש רק ב־title בלבד.
הצג את התוצאות בצורה מסודרת וברורה.
סגנון ידידותי וקצר.
          `
        },
        {
          role: "user",
          content: `Question: ${message}\n\nContext:\n${context}`
        }
      ]
    });

    let reply = completion?.choices?.[0]?.message?.content || "";

    /* ---------- קישורים → כפתור "למידע נוסף" ---------- */

    reply = reply.replace(
      /https?:\/\/[^\s<]+/g,
      url =>
        `<a href="${encodeURI(url)}" target="_blank" class="info-button">למידע נוסף ↗️</a>`
    );

    return res.json({ reply });

  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
