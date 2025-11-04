// pages/api/chat.js
import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import fetch from "node-fetch";

// ===== Cache לזיכרון זמני =====
const cache = {
  data: null,
  timestamp: 0,
  ttl: 10 * 60 * 1000, // 10 דקות
};

// ===== חישוב דמיון קוסינוס =====
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const normB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (normA * normB || 1);
}

// ===== טעינת אינדקסים מ-GitHub (עם cache) =====
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
    morim:    `https://raw.githubusercontent.com/${repo}/${branch}/data/morim_index.json`,
  };

  console.log("🌐 Fetching fresh indexes from GitHub...");
  const [shabatonRes, morimRes] = await Promise.all([fetch(urls.shabaton), fetch(urls.morim)]);
  if (!shabatonRes.ok || !morimRes.ok) throw new Error("❌ Failed to load indexes from GitHub");

  const [shabatonIndex, morimIndex] = await Promise.all([shabatonRes.json(), morimRes.json()]);
  cache.data = { shabatonIndex, morimIndex };
  cache.timestamp = now;
  console.log("✅ Indexes cached in memory");
  return cache.data;
}

// ===== סינון/נירמול עברית + הפקת מילות מפתח =====

// מילים כלליות/עזר להסרה (כולל גרסאות נפוצות)
const HEB_STOP = new Set([
  // כלליות מאוד
  "של","עם","על","אל","אלו","אלה","וכו","וכן","וכן","אם","או","אבל","כי","זה","זו","זאת",
  "הוא","היא","הם","הן","יש","אין","מה","מי","מתי","איך","כאן","פה","שם","כל","גם","עוד",
  "דהיינו","ללא","וכן","וכד","וכו'",
  // תחום-ליבה גנרי – להסרה כפי שביקשת
  "לימוד","לימודי","לימודים","קורס","קורסים","קורסי","קורסים׳","קורסים.", "קורסים,", 
  "לימודיים","לימודית","למידה","קורסון",
  // וריאנטים עם אותיות יחס/יידוע
  "בלימודי","בלימוד","בלימודים","ללימוד","ללימודים","הקורס","בקורס","לקורס","וקורס",
  "הקורסים","קורסיםב","קורסיםל","קורסיםה",
  // תוספות חינוך/כלליות שמטות תוצאות
  "מורים","מורה","גננות","גננת","חינוך","לימודי־המשך","מסלול","מסלולים","תחום","תחומים",
]);

// הסרת ניקוד/תווים מיותרים ונירמול בסיסי
function normalizeHebrew(str) {
  return (str || "")
    .toLowerCase()
    // הסרת ניקוד
    .replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, "")
    // נקוי סימני פיסוק
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    // רווחים מרובים
    .replace(/\s+/g, " ")
    .trim();
}

// גזירת מילים, הורדת מילות עזר וניסיון הטיה פשוט (סיומות)
function extractKeywordsHeb(str) {
  const raw = normalizeHebrew(str).split(" ").filter(Boolean);

  // הסרת אותיות יחס בתחילת מילה (ל/ב/כ/מ/ה/ו)
  const stripPrefix = (w) => w.replace(/^[לבכמוהו](?=[\u0590-\u05FF])/, "");

  // הסרת סיומות נפוצות
  const stripSuffix = (w) =>
    w
      .replace(/(יות|יים|ים|ות|ית|יי|ון|ון|ון)$/g, "")  // סיומות רבים/נקבה/תיויון
      .replace(/(י)$/g, ""); // "לימודי" -> "לימוד"

  const processed = raw
    .map(stripPrefix)
    .map(stripSuffix)
    .filter((w) => w.length > 2 && !HEB_STOP.has(w));

  // ייחוד המילים
  return Array.from(new Set(processed));
}

export default async function handler(req, res) {
  console.log("💬 Incoming request to /api/chat");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Language", "he");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    return res.status(200).json({
      message: "✅ /api/chat פעיל. שלח/י POST עם { message, debug }",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "❌ יש להשתמש בבקשת POST בלבד." });
  }

  try {
    const { message, debug } = req.body || {};
    if (!message) return res.status(400).json({ error: "❌ חסר שדה 'message' בבקשה." });
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "❌ חסר מפתח OpenAI בקובץ .env" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // === ניקוי/נירמול + הפקת מילות מפתח (עם סינון 'לימודי/קורס' וכו') ===
    const cleanMessage = normalizeHebrew(message);
    const keywords = extractKeywordsHeb(cleanMessage);
    console.log("🔎 Query:", cleanMessage);
    console.log("🧩 Keywords after filter:", keywords);

    // === טעינת אינדקסים ===
    const { shabatonIndex, morimIndex } = await loadIndexes();

    // === Embedding לשאלה ===
    const queryEmbedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMessage,
    });
    const queryVector = queryEmbedding.data[0].embedding;

    // === איחוד שתי האתרים ===
    const allPages = [
      ...shabatonIndex.map((p) => ({ ...p, source: "Shabaton" })),
      ...morimIndex.map((p) => ({ ...p, source: "Morim" })),
    ];

    // === דירוג: דמיון + בוסט על התאמות מילות המפתח ===
    const ranked = allPages
      .map((p) => {
        const score = cosineSimilarity(queryVector, p.vector);
        const text = normalizeHebrew((p.text || "") + " " + (p.title || ""));
        const matched = keywords.filter((kw) => text.includes(kw));
        // בוסט מתון לכל מילה תואמת; בוסט נוסף אם מופיע בכותרת
        const inTitle = normalizeHebrew(p.title || "");
        const titleMatches = keywords.filter((kw) => inTitle.includes(kw));
        const keywordBoost = matched.length * 0.12 + titleMatches.length * 0.08;

        return {
          ...p,
          score: score + keywordBoost,
          matches: Array.from(new Set([...matched, ...titleMatches])),
        };
      })
      // מסנן תוצאות חלשות (סף מעט נמוך כדי לא לפספס אחרי סינון מילים כלליות)
      .filter((p) => p.score > 0.30)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

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
          "לא נמצאו תוצאות מתאימות. נסי לנסח אחרת או להוסיף מילות מפתח ייחודיות (ללא מילים כלליות כמו 'לימודי' או 'קורס').",
        ...(debug ? { debug: { keywords } } : {}),
      });
    }

    // === בניית קונטקסט עם כפתור 'למידע נוסף' בלבד (ללא ציון מקור האתר) ===
    const context = ranked
      .map((p) => {
        const url = decodeURI((p.url || "").trim());
        const safeTitle = (p.title || "קישור").replace(/["<>]/g, "");
        return `
        🔹 <strong>${safeTitle}</strong><br>
        <a href="${url}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block; background:#0078ff; color:white; padding:6px 10px;
           border-radius:6px; font-weight:bold; text-decoration:none; margin-top:4px;">
           למידע נוסף ↗️
        </a>`;
      })
      .join("<br><br>");

    // === תשובה עם GPT (התשובה עצמה – לא לציין מקור) ===
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "את/ה עוזר/ת חכם/ה. השב/י בעברית בלבד, תמציתי וידידותי. אל תציין/ני מאיזה אתר הגיע המידע. צרף/י בקצה התשובה כפתורי HTML 'למידע נוסף ↗️' בלבד (מהקונטקסט).",
        },
        {
          role: "user",
          content: `שאלה: ${message}\n\nעמודים רלוונטיים:\n${context}`,
        },
      ],
      temperature: 0.3,
    });

    const reply = response.choices?.[0]?.message?.content || "לא נמצאה תשובה מתאימה.";

    // === תשובה ללקוח + DEBUG אם התבקשה ===
    return res.status(200).json({
      reply,
      ...(debug && {
        debug: ranked.map((r) => ({
          title: r.title,
          score: r.score.toFixed(3),
          matches: r.matches,
          url: r.url,
        })),
        debug_keywords: keywords,
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
