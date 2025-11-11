// pages/api/chat.js
import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";

// ===== Cache (10 דקות) =====
const cache = { data: null, timestamp: 0, ttl: 10 * 60 * 1000 };

// (ב-Next 13/14 זה מבטל קאשינג של ה־route)
export const dynamic = "force-dynamic";

// ===== קוסינוס =====
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i], bi = b[i];
    dot += ai * bi; na += ai * ai; nb += bi * bi;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// ===== ניקוי טקסט =====
function normalizeHebrew(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "") // ניקוד
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

function removeMenuText(text) {
  if (!text) return "";
  return text
    .replace(/(\||\•|\-|\–|\—|›|»|<|>|\[|\]|\(|\)).{0,30}(https?:\/\/|www\.|shabaton|morim)/gi, "")
    .replace(/(קורסים|מאמרים|יצירת קשר|צרו קשר|כניסה|כניסת מורים|אודות|שבתון|מורִים בוטיק)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ===== טעינת אינדקסים (RAW GitHub) =====
async function loadIndexes() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < cache.ttl) return cache.data;

  const base = "https://raw.githubusercontent.com/shabatoncourses-gif/duda-ai-bot/main/data";
  // עדכני כאן אם תוסיפי חלקים בעתיד
  const files = [
    "shabaton_index_part1.json",
    "shabaton_index_part2.json",
    "shabaton_index_part3.json",
    "morim_index_part1.json",
  ];

  console.log("🌐 Fetching indexes from RAW GitHub...");
  const shabatonAll = [];
  const morimAll = [];
  const resultsDiag = [];

  for (const f of files) {
    const url = `${base}/${f}`;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "vercel-function" } });
      resultsDiag.push(`${f}: ${res.status}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data)) {
        console.warn(`⚠️ ${f} is not an array`);
        continue;
      }
      if (f.startsWith("shabaton")) shabatonAll.push(...data);
      else if (f.startsWith("morim")) morimAll.push(...data);
    } catch (err) {
      resultsDiag.push(`${f}: ERROR ${err.message}`);
    }
  }

  console.log(`📊 fetch statuses: ${resultsDiag.join(" | ")}`);
  console.log(`✅ counts — Shabaton: ${shabatonAll.length}, Morim: ${morimAll.length}`);

  if (shabatonAll.length === 0 && morimAll.length === 0) {
    throw new Error(`❌ Failed to load indexes from GitHub. Statuses: ${resultsDiag.join(" | ")}`);
  }

  cache.data = { shabatonIndex: shabatonAll, morimIndex: morimAll };
  cache.timestamp = now;
  return cache.data;
}

// ===== API =====
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ message: "✅ /api/chat פעיל." });
  if (req.method !== "POST") return res.status(405).json({ error: "❌ POST בלבד" });

  try {
    console.log("💬 Incoming request to /api/chat");
    const { message, debug } = req.body || {};
    if (!message) return res.status(400).json({ error: "❌ חסר message" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const cleanMsg = normalizeHebrew(message);
    const keywords = extractKeywordsHeb(cleanMsg);
    const userRegions = detectRegions(cleanMsg);

    // Embeddings
    const [embFull, embKeys] = await Promise.all([
      client.embeddings.create({ model: "text-embedding-3-small", input: cleanMsg }),
      client.embeddings.create({ model: "text-embedding-3-small", input: keywords.join(" ") || cleanMsg })
    ]);
    const qvFull = embFull.data[0].embedding;
    const qvKeys = embKeys.data[0].embedding;

    // Indexes
    console.log("🌐 Fetching fresh indexes from GitHub...");
    const { shabatonIndex, morimIndex } = await loadIndexes();
    const allPages = [
      ...shabatonIndex.map(p => ({ ...p, source: "Shabaton" })),
      ...morimIndex.map(p => ({ ...p, source: "Morim" }))
    ];

    // דירוג
    const ranked = allPages
      .map((p) => {
        const url = (p.url || "").toLowerCase();
        const title = normalizeHebrew(p.title || "");
        const text = removeMenuText(normalizeHebrew(p.text || ""));
        const sim = Math.max(cosineSimilarity(qvFull, p.vector), cosineSimilarity(qvKeys, p.vector));

        let score = sim;

        // חיזוקים שימושיים
        if (url.includes("/results-all/")) score += 0.5;
        else if (url.includes("/search-results-")) score += 0.3;

        // מידע כללי (ביטוח לאומי, קרנות וכו')
        const isInfo = /(btl|faq|info|גמול|קרן|שבתון|tax|מס)/i.test(url + " " + title);
        if (!cleanMsg.includes("קורס") && isInfo) score += 0.8;

        // אזורים
        if (userRegions) {
          let regionBoost = 0;
          for (const r of userRegions) if (url.includes(r)) regionBoost += 0.25;
          if (regionBoost === 0 && userRegions.length) regionBoost = -0.15;
          score += regionBoost;
        }

        // התאמה בכותרת/תיאור
        const titleMatch = keywords.some((kw) => title.includes(kw)) ? 0.8 : 0;
        const descMatch = keywords.some((kw) => text.slice(0, 300).includes(kw)) ? 0.2 : 0;
        score += titleMatch + descMatch;

        return { ...p, score };
      })
      .filter((p) => p.score > 0.25)
      .sort((a, b) => b.score - a.score);

    const uniqueRanked = ranked.filter((p, i, arr) => arr.findIndex(x => x.url === p.url) === i).slice(0, 6);
    if (uniqueRanked.length === 0) return res.status(200).json({ reply: "לא נמצאו תוצאות רלוונטיות." });

    // קונטקסט להצגה
    const context = uniqueRanked.map((p) => {
      const cleanTitle = (p.h1 || p.title || "פרטים").replace(/\s{2,}/g, " ").trim();
      const shortText = (p.description || p.text || "").slice(0, 160) + ((p.description || p.text || "").length > 160 ? "..." : "");
      return `
        <div style="border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:14px;background:#fafafa;box-shadow:0 1px 3px rgba(0,0,0,.05);">
          <div style="font-weight:600;font-size:1.05em;color:#111;margin-bottom:6px;">${cleanTitle}</div>
          <div style="font-size:.95em;color:#444;line-height:1.45;">${shortText}</div>
          <a href="${decodeURI(p.url)}" target="_blank" rel="noopener noreferrer"
             style="display:inline-block;margin-top:10px;background:#0078ff;color:#fff;padding:6px 12px;border-radius:8px;font-weight:bold;text-decoration:none;">
            למידע נוסף ↗️
          </a>
        </div>
      `;
    }).join("");

    // תשובה
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "אתה עוזר חכם המספק תשובות מדויקות מתוך מאגרי שבתון ומורים בלבד. אל תציין מאיזה אתר נלקח המידע. אל תשתמש בסוגריים. הנוסח תמיד בעברית." },
        { role: "user", content: `שאלה: ${cleanMsg}\n\nעמודים רלוונטיים:\n${context}` }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content || "לא נמצאה תשובה.";
    return res.status(200).json({
      reply,
      ...(debug && { debug: uniqueRanked.map(p => ({ title: p.title, score: +p.score.toFixed(3), url: p.url })) })
    });
  } catch (err) {
    console.error("💥 Error in /api/chat:", err);
    return res.status(500).json({ error: err.message });
  }
}
