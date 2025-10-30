import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import fetch from "node-fetch";

// 🧠 Cache מקומי בזיכרון
const cache = {
  data: null,
  timestamp: 0,
  ttl: 10 * 60 * 1000 // 10 דקות
};

// חישוב דמיון קוסינוס
function cosineSimilarity(a, b) {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB);
}

// 📦 טעינת אינדקסים מגיטהאב (או מה־cache)
async function loadIndexes() {
  const now = Date.now();

  // ✅ אם יש cache בתוקף – נחזיר אותו
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

  console.log("📥 Fetching fresh indexes from GitHub...");

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

  // שמירה בזיכרון
  cache.data = { shabatonIndex, morimIndex };
  cache.timestamp = now;
  console.log("✅ Indexes cached in memory");

  return cache.data;
}

export default async function handler(req, res) {
  console.log("💬 Incoming request to /api/chat");

  // הגדרות תגובה בסיסיות
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    console.log("🟢 GET check OK");
    return res.status(200).json({
      message: "✅ /api/chat פעיל. שלח POST עם { message: 'שאלה כלשהי' } כדי לקבל תשובה."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "❌ מותר רק POST." });
  }

  try {
    const { message } = req.body || {};
    if (!message)
      return res.status(400).json({ error: "❌ חסר שדה 'message' בגוף הבקשה." });

    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({ error: "❌ חסר מפתח OpenAI." });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // ✅ טוען אינדקסים (מה־cache או מגיטהאב)
    const { shabatonIndex, morimIndex } = await loadIndexes();
    console.log("📚 Loaded indexes successfully");

    // 🔍 יוצר embedding לשאלה
    const queryEmbedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: message
    });
    const queryVector = queryEmbedding.data[0].embedding;

    const allPages = [
      ...shabatonIndex.map(p => ({ ...p, source: "Shabaton" })),
      ...morimIndex.map(p => ({ ...p, source: "Morim" }))
    ];

    // מחשב דמיון לפי קוסינוס וממיין
    const ranked = allPages
      .map(p => ({ ...p, score: cosineSimilarity(queryVector, p.vector) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log("🏆 Top matches:", ranked.map(r => r.title));

    if (ranked.length === 0) {
      return res.status(200).json({
        reply: "לא נמצאו תוצאות רלוונטיות כרגע, נסי לשאול אחרת 🙂"
      });
    }

    // מכין הקשר לתשובה
    const context = ranked
      .map(p => `📄 ${p.title} (${p.source})\n${p.url}`)
      .join("\n");

    // שיחה עם GPT
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "אתה עוזר חכם המשיב על שאלות מתוך תוכן של שני אתרים: 'שבתון' ו'מורימ'. דבר בשפה טבעית וברורה."
        },
        {
          role: "user",
          content: `שאלה: ${message}\n\nקטעי מידע רלוונטיים:\n${context}`
        }
      ],
      temperature: 0.4
    });

    const reply = response.choices?.[0]?.message?.content || "לא הצלחתי להבין 😅";
    console.log("✅ Reply sent successfully");

    return res.status(200).json({ reply });
  } catch (err) {
    console.error("❌ Error during /api/chat:", err);
    return res.status(500).json({
      error: "שגיאה במהלך עיבוד הבקשה.",
      details: err.message
    });
  }
}
