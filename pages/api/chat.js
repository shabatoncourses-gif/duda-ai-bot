import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import fetch from "node-fetch";

// ===== Cache =====
const cache = { data: null, timestamp: 0, ttl: 10 * 60 * 1000 };

// ===== חישוב דמיון קוסינוס =====
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((s, ai) => s + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((s, bi) => s + bi * bi, 0));
  return dot / (normA * normB || 1);
}

// ===== מילים כלליות להסרה =====
const STOP_WORDS = new Set([
  "לימוד", "לימודים", "לימודי", "בלימודי",
  "קורס", "קורסים", "קורסי", "קורסון",
  "של", "עם", "על", "ב", "ל", "ה", "מה", "איך", "יש", "אין", "או", "אם", "וכן",
  "מורה", "מורים", "גננות", "גננת", "חינוך", "תחום", "תחומים",
  "לימודיים", "מסלול", "מסלולים", "לימודית", "במסלול", "בתחום",
  "בתחומים", "להוראה", "בהוראה", "הוראה", "להשתלמות", "בהשתלמות"
]);

// ===== ניקוי טקסט עברי =====
function normalizeHebrew(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "") // ניקוד
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ===== חילוץ מילות מפתח חכמות =====
function extractKeywordsHeb(str) {
  return normalizeHebrew(str)
    .split(" ")
    .map((w) =>
      w
        .replace(/^[לבכמוהשה]/, "") // תחיליות
        .replace(/(יים|ים|ות|ית|יי|י)$/, "") // סיומות
    )
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

// ===== טעינת אינדקסים =====
async function loadIndexes() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < cache.ttl) return cache.data;

  const repo = process.env.GITHUB_REPO || "shabatoncourses-gif/duda-ai-bot";
  const branch = process.env.GITHUB_BRANCH || "main";

  const [shRes, moRes] = await Promise.all([
    fetch(`https://raw.githubusercontent.com/${repo}/${branch}/data/shabaton_index.json`),
    fetch(`https://raw.githubusercontent.com/${repo}/${branch}/data/morim_index.json`)
  ]);

  if (!shRes.ok || !moRes.ok)
    throw new Error("❌ Failed to load indexes");

  const [shabatonIndex, morimIndex] = await Promise.all([
    shRes.json(),
    moRes.json()
  ]);

  cache.data = { shabatonIndex, morimIndex };
  cache.timestamp = now;
  return cache.data;
}

// ====== סינון תוכן תפריטים פנימיים ======
function removeMenuText(text) {
  if (!text) return "";
  return text
    .replace(/(\||\•|\-|\–|\—|›|»|<|>|\[|\]|\(|\)).{0,30}(https?:\/\/|www\.|shabaton|morim)/gi, "")
    .replace(/(קורסים|מאמרים|יצירת קשר|צרו קשר|כניסה|כניסת מורים|אודות|שבתון|מורִים בוטיק)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ===== נתיב API =====
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET")
    return res.status(200).json({ message: "✅ /api/chat פעיל." });
  if (req.method !== "POST")
    return res.status(405).json({ error: "❌ יש להשתמש בבקשת POST בלבד." });

  try {
    const { message, debug } = req.body || {};
    if (!message) return res.status(400).json({ error: "❌ חסר message." });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const cleanMsg = normalizeHebrew(message);
    const keywords = extractKeywordsHeb(cleanMsg);

    // === נבנה גם רצף מלא וגם גרסה מקוצרת ===
    const [embeddingFull, embeddingKeywords] = await Promise.all([
      client.embeddings.create({ model: "text-embedding-3-small", input: cleanMsg }),
      client.embeddings.create({ model: "text-embedding-3-small", input: keywords.join(" ") || cleanMsg })
    ]);

    const queryVectorFull = embeddingFull.data[0].embedding;
    const queryVectorKeywords = embeddingKeywords.data[0].embedding;

    const { shabatonIndex, morimIndex } = await loadIndexes();

    const allPages = [
      ...shabatonIndex.map((p) => ({ ...p, source: "Shabaton" })),
      ...morimIndex.map((p) => ({ ...p, source: "Morim" }))
    ];

    // === ניקוי טקסטים לפני השוואה (הסרת תפריטים) ===
    const ranked = allPages
      .map((p) => {
        const cleanText = removeMenuText(normalizeHebrew((p.text || "") + " " + (p.title || "")));
        const simFull = cosineSimilarity(queryVectorFull, p.vector);
        const simKey = cosineSimilarity(queryVectorKeywords, p.vector);
        const matched = keywords.filter((kw) => cleanText.includes(kw));
        const phraseBonus = cleanText.includes(cleanMsg) ? 0.25 : 0;
        const keywordBoost = matched.length * 0.05;
        const score = Math.max(simFull, simKey) + phraseBonus + keywordBoost;
        return { ...p, score, matches: matched };
      })
      .filter((p) => p.score > 0.25)
      .sort((a, b) => b.score - a.score);

    const uniqueRanked = ranked.filter(
      (p, i, arr) => arr.findIndex((x) => x.url === p.url) === i
    ).slice(0, 6);

    if (uniqueRanked.length === 0) {
      return res.status(200).json({
        reply: "לא נמצאו תוצאות רלוונטיות.",
        ...(debug && { debug: [], debug_keywords: keywords })
      });
    }

    // === יצירת קונטקסט יפה ללא ציון מקור ===
    const context = uniqueRanked
      .map((p) => {
        const decodedUrl = decodeURI(p.url.trim());
        const cleanTitle = (p.title || "")
          .replace(/\[.*?\]/g, "")
          .replace(/["<>]/g, "")
          .trim();
        return `
          🔹 <strong>${cleanTitle}</strong><br>
          <a href="${decodedUrl}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block; background:#0078ff; color:white; padding:6px 10px;
             border-radius:6px; font-weight:bold; text-decoration:none; margin-top:4px;">
             למידע נוסף ↗️
          </a>`;
      })
      .join("<br><br>");

    // === יצירת תשובה עם GPT ===
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "אתה עוזר חכם המספק תשובות רלוונטיות מתוך מאגרי שבתון ומורים בלבד. השב בעברית בלבד, בצורה ידידותית וברורה. אל תציין מאיזה אתר נלקח המידע ואל תשתמש בסוגריים מרובעים. הצג קישורים רק ככפתור 'למידע נוסף ↗️'."
        },
        {
          role: "user",
          content: `שאלה: ${cleanMsg}\n\nעמודים רלוונטיים:\n${context}`
        }
      ],
      temperature: 0.3
    });

    const reply = completion.choices?.[0]?.message?.content || "לא נמצאה תשובה.";

    // ✅ תשובה ללקוח כולל debug
    return res.status(200).json({
      reply,
      ...(debug && {
        debug: uniqueRanked.map((r) => ({
          title: r.title,
          score: r.score.toFixed(3),
          matches: r.matches,
          url: r.url
        })),
        debug_keywords: keywords
      })
    });
  } catch (err) {
    console.error("💥 Error during /api/chat:", err);
    return res.status(500).json({ error: err.message });
  }
}
