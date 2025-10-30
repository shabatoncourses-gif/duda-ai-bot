import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import fetch from "node-fetch";

// 🧠 Cache לזיכרון זמני
const cache = {
  data: null,
  timestamp: 0,
  ttl: 10 * 60 * 1000 // 10 דקות
};

// 🧮 חישוב דמיון קוסינוס
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}

// 📦 טעינת אינדקסים מה־GitHub (עם cache)
async function loadIndexes() {
  const now = Date.now();

  if (cache.data && now - cache.timestamp < cache.ttl) {
    console.log("⚡ Using cached indexes from memory");
    return cache.data;
  }

  const repo = process.env.GITHUB_REPO || "shabatoncourses-gif/duda-ai-bot";
  const branch = process.env.GITHUB_BRANCH || "main";

  const urls = {
    shabaton: `https://raw.githubusercontent.com/${repo}/${branch}/data/shabaton_index.json`,
    morim: `https://raw.githubusercontent.com/${repo}/${branch}/data/morim_index.json`
  };

  console.log("🌐 Fetching fresh indexes from GitHub...");

  const [shabatonRes, morimRes] = await Promise.all([
    fetch(urls.shabaton),
    fetch(urls.morim)
  ]);

  if (!shabatonRes.ok || !morimRes.ok)
    throw new Error("❌ Failed to load indexes from GitHub");

  const [shabatonIndex, morimIndex] = await Promise.all([
    shabatonRes.json(),
    morimRes.json()
  ]);

  cache.data = { shabatonIndex, morimIndex };
  cache.timestamp = now;
  console.log("✅ Indexes cached in memory");

  return cache.data;
}

export default async function handler(req, res) {
  console.log("💬 Incoming request to /api/chat");

  // 🧩 הגדרות קידוד ו־CORS
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.charset = "utf-8";
  res.setHeader("Content-Language", "he");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // בדיקה מהירה בדפדפן
  if (req.method === "GET") {
    console.log("🟢 GET check OK");
    return res.status(200).json({
      message: "✅ /api/chat פעיל. שלח POST עם { message: 'השאלה שלך' } כדי לשאול."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "❌ יש להשתמש ב־POST בלבד." });
  }

  try {
    const { message } = req.body || {};
    if (!message)
      return res.status(400).json({ error: "❌ חסר שדה 'message' בבקשה." });

    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({ error: "❌ חסר מפתח OpenAI ב־.env" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // ניקוי השאילתה — הסרת תווים מיותרים, רווחים, ניקוד
    const cleanMessage = message
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim();

    // טעינת אינדקסים מה־GitHub (או מה־cache)
    const { shabatonIndex, morimIndex } = await loadIndexes();
    console.log("📦 Loaded indexes successfully");

    // יצירת embedding לשאלה
    const queryEmbedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMessage
    });
    const queryVector = queryEmbedding.data[0].embedding;

    // איחוד שני האתרים
    const allPages = [
      ...shabatonIndex.map((p) => ({ ...p, source: "Shabaton" })),
      ...morimIndex.map((p) => ({ ...p, source: "Morim" }))
    ];

    // דירוג לפי דמיון עם סף רגיש יותר
    const ranked = allPages
      .map((p) => ({ ...p, score: cosineSimilarity(queryVector, p.vector) }))
      .filter((p) => p.score > 0.55) // ✅ סף רלוונטיות מתון
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log(
      "🏆 Relevant matches:",
      ranked.map((r) => `${r.title} (${r.score.toFixed(2)})`)
    );

    if (ranked.length === 0) {
      return res.status(200).json({
        reply: "לא נמצאו תוצאות מתאימות. נסי לנסח אחרת או להשתמש במילים נוספות."
      });
    }

    // ✅ יצירת הקשרים עם קישורים בעברית תקינה וללא סוגריים מיותרים
    const context = ranked
      .map((p) => {
        const cleanUrl = p.url.trim().replace(/[)\]]+$/, "");
        let displayUrl;
        try {
          displayUrl = decodeURI(cleanUrl);
        } catch {
          displayUrl = cleanUrl;
        }
        return `🔹 <strong>${p.title}</strong> [${p.source}]<br>
        <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${displayUrl}</a>`;
      })
      .join("<br><br>");

    // יצירת תשובה בעזרת GPT
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "אתה עוזר חכם המספק תשובות רלוונטיות מתוך אתרי שבתון ומורים. השב בעברית בלבד, בצורה טבעית וידידותית, והצג קישורים רלוונטיים בתשובה בפורמט HTML תקין."
        },
        {
          role: "user",
          content: `שאלה: ${cleanMessage}\n\nהקשרים רלוונטיים:\n${context}`
        }
      ],
      temperature: 0.3
    });

    const reply =
      response.choices?.[0]?.message?.content ||
      "לא נמצאה תשובה מתאימה.";

    console.log("✅ Reply sent successfully");

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("💥 Error during /api/chat:", err);
    return res.status(500).json({
      error: "אירעה שגיאה במהלך עיבוד הבקשה.",
      details: err.message
    });
  }
}
