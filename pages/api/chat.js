﻿﻿// pages/api/chat.js
export const config = { runtime: "nodejs" };
export const dynamic = "force-dynamic";

import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";

// ===== Cache =====
const cache = { data: null, timestamp: 0, ttl: 10 * 60 * 1000 };

// ===== פונקציות עזר =====
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

function normalizeHebrew(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "של","עם","על","ב","ל","ה","מה","איך","יש","אין","או","אם","וכן",
  "קורס","קורסים","לימודים","בלימודי","לימודי","בהוראה","להוראה",
  "להשתלמות","בהשתלמות","תחום","תחומים"
]);

function extractKeywordsHeb(str) {
  return normalizeHebrew(str)
    .split(" ")
    .map((w) => w.replace(/^[לבכמוהשה]/, "").replace(/(יים|ים|ות|ית|יי|י)$/, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

function removeMenuText(text) {
  if (!text) return "";
  return text
    .replace(/(\||›|»|<|>|\[|\]|\(|\)).{0,20}(https?:\/\/|www\.|shabaton|morim)/gi, "")
    .replace(/(קורסים|מאמרים|צרו קשר|אודות|כניסה|מורים)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ===== מיפוי חודשים =====
const MONTHS_MAP = {
  ינואר: 1, פברואר: 2, מרץ: 3, אפריל: 4, מאי: 5, יוני: 6,
  יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function extractStartDate(str) {
  if (!str) return null;
  const text = str.toLowerCase();
  let monthNum = null, yearNum = null;
  for (const [m, n] of Object.entries(MONTHS_MAP)) {
    if (text.includes(m)) { monthNum = n; break; }
  }
  const y = text.match(/20\d{2}/);
  if (y) yearNum = parseInt(y[0]);
  return (monthNum && yearNum) ? new Date(yearNum, monthNum - 1, 1) : null;
}

// ===== טעינת אינדקסים =====
async function loadIndexes() {
  console.log("🌐 Fetching fresh indexes from GitHub (with fallback)...");
  const base = "https://raw.githubusercontent.com/shabatoncourses-gif/duda-ai-bot/main/data";
  const files = [
    "shabaton_index_part1.json",
    "shabaton_index_part2.json",
    "shabaton_index_part3.json",
    "morim_index_part1.json",
  ];

  const shabatonAll = [];
  const morimAll = [];

  for (const f of files) {
    const url = `${base}/${f}`;
    try {
      const res = await fetch(url);
      console.log(`📥 Fetch ${f} → ${res.status}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (f.startsWith("shabaton")) shabatonAll.push(...data);
      else if (f.startsWith("morim")) morimAll.push(...data);
    } catch (err) {
      console.warn(`⚠️ ${f} failed: ${err.message}`);
    }
  }

  console.log(`✅ Loaded Shabaton=${shabatonAll.length}, Morim=${morimAll.length}`);
  if (shabatonAll.length === 0 && morimAll.length === 0)
    throw new Error("❌ Failed to load indexes from GitHub (no data)");

  cache.data = { shabatonIndex: shabatonAll, morimIndex: morimAll };
  cache.timestamp = Date.now();
  return cache.data;
}

// ===== API HANDLER =====
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ message: "✅ /api/chat פעיל." });

  try {
    console.log("💬 Incoming request to /api/chat");
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "❌ חסר message" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const cleanMsg = normalizeHebrew(message);
    const keywords = extractKeywordsHeb(cleanMsg);

    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg
    });
    const qv = emb.data[0].embedding;

    const { shabatonIndex, morimIndex } = await loadIndexes();
    const allPages = [...shabatonIndex, ...morimIndex];

    // === חישוב דמיון ===
    let ranked = allPages
      .map(p => ({
        ...p,
        score: cosineSimilarity(qv, p.vector)
      }))
      .filter(p => p.score > 0.25)
      .sort((a, b) => b.score - a.score);

    // === מיון קורסים נפתחים בקרוב ===
    const soonCourses = ranked.filter(p =>
      /(נפתח|יפתח|פתיחה|נפתחים בקרוב)/i.test([p.title, p.h1, ...(p.h2 || [])].join(" "))
    );

    if (soonCourses.length > 0) {
      soonCourses.sort((a, b) => {
        const da = extractStartDate([a.title, a.h1, ...(a.h2 || [])].join(" "));
        const db = extractStartDate([b.title, b.h1, ...(b.h2 || [])].join(" "));
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });
      const others = ranked.filter(p => !soonCourses.includes(p));
      ranked = [...soonCourses, ...others];
    }

    ranked = ranked.slice(0, 8);
    if (ranked.length === 0)
      return res.status(200).json({ reply: "לא נמצאו תוצאות רלוונטיות." });

    const context = ranked.map(p => `
      <div style="margin:0 0 10px 0;">
        <div style="font-weight:700;">${p.h1 || p.title}</div>
        <div style="font-size:13px;color:#444;">${p.description || ""}</div>
        <a href="${decodeURI(p.url)}" target="_blank" rel="noopener noreferrer"
          style="display:inline-block;background:#0078ff;color:#fff;padding:6px 10px;
          border-radius:6px;font-weight:bold;text-decoration:none;margin-top:6px;">
          למידע נוסף ↗️
        </a>
      </div>`).join("");

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        { role: "system", content: `אתה עוזר חכם המספק תשובות ממאגרים של שבתון ומורים בלבד. 
        השב בעברית בלבד. הצג קורסים עם כותרת, תיאור וכפתור "למידע נוסף ↗️".
        סדר קורסים נפתחים לפי חודשים.` },
        { role: "user", content: `שאלה: ${cleanMsg}\n\nדפים רלוונטיים:\n${context}` }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content || "לא נמצאה תשובה.";
    return res.status(200).json({ reply });

  } catch (err) {
    console.error("💥 Error during /api/chat:", err);
    return res.status(500).json({ error: err.message });
  }
}