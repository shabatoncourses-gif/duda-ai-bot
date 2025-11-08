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

// ===== זיהוי אזורים ופורמטים =====
function detectRegions(text) {
  const t = normalizeHebrew(text);
  const regions = [];

  if (/תל.?אביב|מרכז|גוש.?דן|הרצליה|רמת.?גן|פתח.?תקוה|בת.?ים|חולון/.test(t)) regions.push("merkaz");
  if (/שרון|נתניה|רעננה|כפר.?סבא|השרון/.test(t)) regions.push("sharon");
  if (/חיפה|צפון|גליל|נהריה|עכו|טבריה|עמק/.test(t)) regions.push("north");
  if (/דרום|שפלה|אשדוד|אשקלון|באר.?שבע|נגב/.test(t)) regions.push("south");
  if (/אונליין|מקוון|zoom|זום|למידה.?מרחוק|למידה.?מקוונת|קורס.?מקוון/.test(t)) regions.push("online");

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

// ===== ניקוי תפריטים ומידע טכני =====
function removeMenuText(text) {
  if (!text) return "";
  return text
    .replace(/(\||\•|\-|\–|\—|›|»|<|>|\[|\]|\(|\)).{0,30}(https?:\/\/|www\.|shabaton|morim)/gi, "")
    .replace(/(קורסים|מאמרים|יצירת קשר|צרו קשר|כניסה|כניסת מורים|אודות|שבתון|מורִים בוטיק)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ===== API ראשי =====
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
    const userRegions = detectRegions(cleanMsg);

    // === Embeddings ===
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
// === דירוג חכם ומעמיק ===
const ranked = allPages
  .map((p) => {
    const cleanTitle = normalizeHebrew(p.title || "");
    const cleanText = removeMenuText(normalizeHebrew(`${p.text || ""}`));
    const fullContent = `${cleanTitle} ${cleanText}`;

    const simFull = cosineSimilarity(queryVectorFull, p.vector);
    const simKey = cosineSimilarity(queryVectorKeywords, p.vector);
    const matched = keywords.filter((kw) => fullContent.includes(kw));

    // 🧭 זיהוי אזור
    let regionBoost = 0;
    if (userRegions) {
      for (const region of userRegions) {
        if (p.url.toLowerCase().includes(region)) regionBoost += 0.25;
      }
      if (regionBoost === 0 && userRegions.length) regionBoost = -0.15;
    }

    // 🗂️ עדיפות לפי סוג עמוד
    let priorityBoost = 0;
    const url = p.url.toLowerCase();
    if (url.includes("/results-all/")) priorityBoost = 0.5;
    else if (url.includes("/search-results-")) priorityBoost = 0.3;
    else if (url.includes("/courses-per-month/")) priorityBoost = -0.1;
    else if (url.includes("/articles/") || url.includes("/blog/")) priorityBoost = -0.25;

    // 💬 דפי מידע כלליים (לא קורסים)
    const infoPages = ["btl", "שבתון", "קרן", "faq", "מסים", "גמול"];
    const isInfoPage = infoPages.some((kw) => url.includes(kw) || cleanTitle.includes(kw));
    const infoBoost = (!cleanMsg.includes("קורס") && isInfoPage) ? 0.6 : 0;

    // 🎯 בונוס חזק להתאמה בכותרת / H1 / description
    const titleMatch = keywords.some((kw) => cleanTitle.includes(kw)) ? 0.5 : 0;
    const descMatch = keywords.some((kw) => fullContent.slice(0, 300).includes(kw)) ? 0.2 : 0;

    const score =
      Math.max(simFull, simKey) +
      regionBoost +
      priorityBoost +
      infoBoost +
      titleMatch +
      descMatch;

    return { ...p, score, matches: matched };
  })
  .filter((p) => p.score > 0.25)
  .sort((a, b) => b.score - a.score);

    // === יצירת קונטקסט יפה ===
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
            חשוב מאוד שתשתמש במידע מתוך כותרות הדפים, תיאורי המטא, h1–h3 והטקסט עצמו.
            עליך להבין גם אזור (תל אביב והמרכז, שרון, חיפה והצפון, שפלה ודרום, למידה מרחוק).
            השב רק בעברית, בצורה ברורה וידידותית.
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
