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

// ===== חילוץ מילות מפתח =====
function extractKeywordsHeb(str) {
  return normalizeHebrew(str)
    .split(" ")
    .map((w) =>
      w.replace(/^[לבכמוהשה]/, "").replace(/(יים|ים|ות|ית|יי|י)$/, "")
    )
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

// ===== זיהוי אזורים ופורמטים מרובים =====
function detectRegions(text) {
  const t = normalizeHebrew(text);
  const regions = [];

  if (/ירושלים|ירושלמ/.test(t)) regions.push("jerusalem");
  if (/תל ?אביב|מרכז|גוש דן|הרצליה|פתח תקוה|רמת גן|גבעתיים|חולון|בת ים|המרכז/.test(t)) regions.push("merkaz");
  if (/צפון|חיפה|גליל|נהריה|טבריה|עמק/.test(t)) regions.push("north");
  if (/דרום|באר ?שבע|אשדוד|אשקלון|נגב/.test(t)) regions.push("south");
  if (/אונליין|מקוון|zoom|זום|למידה מרחוק|למידה מקוונת|קורס מקוון|קורס בזום/.test(t)) regions.push("online");

  return regions.length ? regions : null;
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

  if (!shRes.ok || !moRes.ok) throw new Error("❌ Failed to load indexes");

  const [shabatonIndex, morimIndex] = await Promise.all([
    shRes.json(),
    moRes.json()
  ]);

  cache.data = { shabatonIndex, morimIndex };
  cache.timestamp = now;
  return cache.data;
}

// ===== ניקוי טקסטים פנימיים =====
function removeMenuText(text) {
  if (!text) return "";
  return text
    .replace(/(\||\•|\-|\–|\—|›|»|<|>|\[|\]|\(|\)).{0,30}(https?:\/\/|www\.|shabaton|morim)/gi, "")
    .replace(/(קורסים|מאמרים|יצירת קשר|צרו קשר|כניסה|כניסת מורים|אודות|שבתון|מורִים בוטיק)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ===== API =====
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ message: "✅ /api/chat פעיל." });
  if (req.method !== "POST") return res.status(405).json({ error: "❌ יש להשתמש בבקשת POST בלבד." });

  try {
    const { message, debug } = req.body || {};
    if (!message) return res.status(400).json({ error: "❌ חסר message." });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const cleanMsg = normalizeHebrew(message);
    const keywords = extractKeywordsHeb(cleanMsg);
    const userRegions = detectRegions(cleanMsg); // ⬅️ רשימה של אזורים/פורמטים שזוהו

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

    // === דירוג חכם עם אזורים מרובים ===
    const ranked = allPages
      .map((p) => {
        const cleanText = removeMenuText(normalizeHebrew((p.text || "") + " " + (p.title || "")));
        const simFull = cosineSimilarity(queryVectorFull, p.vector);
        const simKey = cosineSimilarity(queryVectorKeywords, p.vector);
        const matched = keywords.filter((kw) => cleanText.includes(kw));
        const phraseBonus = cleanText.includes(cleanMsg) ? 0.25 : 0;
        const keywordBoost = matched.length * 0.05;

        // 🎯 בונוס לפי אזור ופורמט
        let regionBoost = 0;
        if (userRegions) {
          for (const region of userRegions) {
            if (p.url.includes(region)) regionBoost += 0.25; // התאמה מלאה
          }
          if (/results-all|courses-per-month/.test(p.url)) regionBoost += 0.05;
          if (regionBoost === 0 && userRegions.length) regionBoost = -0.15; // לא באזורים שצוינו
        }

        const score = Math.max(simFull, simKey) + phraseBonus + keywordBoost + regionBoost;
        return { ...p, score, matches: matched };
      })
      .filter((p) => p.score > 0.25)
      .sort((a, b) => b.score - a.score);

    const uniqueRanked = ranked.filter(
      (p, i, arr) => arr.findIndex((x) => x.url === p.url) === i
    ).slice(0, 6);

    if (uniqueRanked.length === 0) {
      return res.status(200).json({ reply: "לא נמצאו תוצאות רלוונטיות." });
    }

    // === הצגת קונטקסט יפה ===
    const context = uniqueRanked.map((p) => {
      const decodedUrl = decodeURI(p.url.trim());
      const cleanTitle = (p.title || "")
        .replace(/\[.*?\]|\(.*?\)/g, "")
        .replace(/["<>]/g, "")
        .trim();

      return `
        🔹 <strong>${cleanTitle}</strong><br>
        <a href="${decodedUrl}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block; background:#0078ff; color:white; padding:6px 10px;
           border-radius:6px; font-weight:bold; text-decoration:none; margin-top:4px;">
           למידע נוסף ↗️
        </a>`;
    }).join("<br><br>");

    // === תשובה עם GPT ===
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
            אתה עוזר חכם המספק תשובות מדויקות על קורסים מתוך מאגרי שבתון ומורים בלבד.
            עליך להבין את כוונת המשתמש, כולל אזור (כמו ירושלים, תל אביב, צפון, דרום)
            וגם סוג למידה (כמו אונליין, בזום, למידה מרחוק).
            אם המשתמש מזכיר אזור ופורמט, הצג רק קורסים הרלוונטיים לשניהם.
            השב בעברית בלבד, בצורה ברורה וידידותית.
            אל תציין מאיזה אתר נלקח המידע, ואל תשתמש בסוגריים מכל סוג.
            הצג רק קישורים ככפתור 'למידע נוסף ↗️'.
          `
        },
        {
          role: "user",
          content: `שאלה: ${cleanMsg}\n\nעמודים רלוונטיים:\n${context}`
        }
      ],
      temperature: 0.3
    });

    const reply = completion.choices?.[0]?.message?.content || "לא נמצאה תשובה.";

    return res.status(200).json({
      reply,
      ...(debug && {
        debug: uniqueRanked.map((r) => ({
          title: r.title,
          score: r.score.toFixed(3),
          matches: r.matches,
          url: r.url
        })),
        debug_regions: userRegions
      })
    });
  } catch (err) {
    console.error("💥 Error during /api/chat:", err);
    return res.status(500).json({ error: err.message });
  }
}
