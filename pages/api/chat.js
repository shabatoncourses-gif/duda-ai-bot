import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import fetch from "node-fetch";

// 🧠 Cache לזיכרון זמני כדי לחסוך טעינות
const cache = {
  data: null,
  timestamp: 0,
  ttl: 10 * 60 * 1000, // 10 דקות
};

// 🧮 חישוב דמיון קוסינוס
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
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
    morim: `https://raw.githubusercontent.com/${repo}/${branch}/data/morim_index.json`,
  };

  console.log("🌐 Fetching fresh indexes from GitHub...");

  const [shabatonRes, morimRes] = await Promise.all([
    fetch(urls.shabaton),
    fetch(urls.morim),
  ]);

  if (!shabatonRes.ok || !morimRes.ok)
    throw new Error("❌ Failed to load indexes from GitHub");

  const [shabatonIndex, morimIndex] = await Promise.all([
    shabatonRes.json(),
    morimRes.json(),
  ]);

  cache.data = { shabatonIndex, morimIndex };
  cache.timestamp = now;
  console.log("✅ Indexes cached in memory");

  return cache.data;
}

export default async function handler(req, res) {
  console.log("💬 Incoming request to /api/chat");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.charset = "utf-8";
  res.setHeader("Content-Language", "he");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    console.log("✅ GET check OK");
    return res.status(200).json({
      message: "✅ /api/chat פעיל. שלח POST עם { message: 'השאלה שלך' } כדי לשאול.",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "❌ יש להשתמש בבקשת POST בלבד." });
  }

  try {
    const { message, debug } = req.body || {};
    if (!message)
      return res.status(400).json({ error: "❌ חסר שדה 'message' בבקשה." });

    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({ error: "❌ חסר מפתח OpenAI בקובץ .env" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // ✨ ניקוי השאלה
    const cleanMessage = message
      .replace(/[^\p{L}\p{N}\s]/gu, "")
      .replace(/\s+/g, " ")
      .trim();

    // 📚 טעינת אינדקסים
    const { shabatonIndex, morimIndex } = await loadIndexes();
    console.log("📦 Indexes loaded successfully");

    // 🧠 יצירת embedding לשאלה
    const queryEmbedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMessage,
    });
    const queryVector = queryEmbedding.data[0].embedding;

    // 🧩 איחוד הנתונים
    const allPages = [
      ...shabatonIndex.map((p) => ({ ...p, source: "Shabaton" })),
      ...morimIndex.map((p) => ({ ...p, source: "Morim" })),
    ];

    // 🧠 מילות מפתח מתוך השאלה
    const keywords = cleanMessage
      .split(" ")
      .filter((w) => w.length > 2)
      .map((w) => w.toLowerCase());

    // 📊 דירוג לפי דמיון + בוסט למילות מפתח תואמות
    const ranked = allPages
      .map((p) => {
        const score = cosineSimilarity(queryVector, p.vector);
        const text = (p.text + " " + p.title).toLowerCase();
        const matched = keywords.filter((kw) => text.includes(kw));
        const keywordBoost = matched.length > 0 ? 0.15 * matched.length : 0;
        const finalScore = score + keywordBoost;

        return {
          ...p,
          score: finalScore,
          matches: matched,
        };
      })
      .filter((p) => p.score > 0.35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    // 🔍 Debug mode — מציג מידע בקונסול
    console.log("🔎 Query:", cleanMessage);
    console.log("🧩 Keywords:", keywords);
    console.table(
      ranked.map((r) => ({
        Title: r.title,
        Score: r.score.toFixed(3),
        Matches: r.matches.join(", ") || "—",
      }))
    );

    if (ranked.length === 0) {
      return res.status(200).json({
        reply:
          "לא נמצאו תוצאות מתאימות. נסי לנסח אחרת או להוסיף מילות מפתח רלוונטיות.",
        debug: debug ? { keywords } : undefined,
      });
    }

    // 🧩 יצירת קונטקסט יפה בעברית עם קישורים תקינים
   const context = ranked
  .map((p) => {
    const decodedUrl = decodeURI(p.url.trim());
    const safeTitle = p.title?.replace(/["<>]/g, "") || "קישור";
    return `
      🔹 <strong>${safeTitle}</strong><br>
      <a href="${decodedUrl}" target="_blank" rel="noopener noreferrer"
         style="display:inline-block; background:#0078ff; color:white; padding:6px 10px;
         border-radius:6px; font-weight:bold; text-decoration:none; margin-top:4px;">
         למידע נוסף ↗️
      </a>`;
  })
  .join("<br><br>");

    // 🤖 יצירת תשובה עם GPT
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "אתה עוזר חכם המספק תשובות רלוונטיות מתוך אתרי שבתון ומורים. השב בעברית בלבד ובצורה טבעית וברורה. הצג תשובה תמציתית, ידידותית וברורה. כלול קישורים רק ככפתור 'למידע נוסף ↗️' (בפורמט HTML).",
        },
        {
          role: "user",
          content: `שאלה: ${cleanMessage}\n\nעמודים רלוונטיים:\n${context}`,
        },
      ],
      temperature: 0.3,
    });

    const reply =
      response.choices?.[0]?.message?.content ||
      "לא נמצאה תשובה מתאימה.";

    console.log("✅ Reply sent successfully");

    // ✅ החזרה ללקוח (כולל debug אם הופעל)
    return res.status(200).json({
      reply,
      ...(debug && {
        debug: ranked.map((r) => ({
          title: r.title,
          score: r.score.toFixed(3),
          matches: r.matches,
          url: r.url,
        })),
      }),
    });
  } catch (err) {
    console.error("💥 Error during /api/chat:", err);
    return res.status(500).json({
      error: "אירעה שגיאה במהלך עיבוד הבקשה.",
      details: err.message,
    });
  }
}
return res.status(200).json({
  reply,
  ...(debug && {
    debug: ranked.map((r) => ({
      title: r.title,
      score: r.score.toFixed(3),
      matches: r.matches,
      url: r.url,
    })),
  }),
});
