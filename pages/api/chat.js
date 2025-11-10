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

// ===== ניקוי טקסט =====
function normalizeHebrew(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "") // ניקוד
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ===== מילות חיבור להסרה =====
const STOP_WORDS = new Set([
  "של", "עם", "על", "ב", "ל", "ה", "מה", "איך", "יש", "אין", "או", "אם", "וכן",
  "קורס", "קורסים", "לימודים", "בלימודי", "לימודי", "בהוראה", "להוראה",
  "להשתלמות", "בהשתלמות", "תחום", "תחומים"
]);

// ===== חילוץ מילות מפתח =====
function extractKeywordsHeb(str) {
  return normalizeHebrew(str)
    .split(" ")
    .map((w) => w.replace(/^[לבכמוהשה]/, "").replace(/(יים|ים|ות|ית|יי|י)$/, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

// ===== זיהוי אזורים =====
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

// ===== ניקוי תפריטים =====
function removeMenuText(text) {
  if (!text) return "";
  return text
    .replace(/(\||\•|\-|\–|\—|›|»|<|>|\[|\]|\(|\)).{0,30}(https?:\/\/|www\.|shabaton|morim)/gi, "")
    .replace(/(קורסים|מאמרים|יצירת קשר|צרו קשר|כניסה|כניסת מורים|אודות|שבתון|מורִים בוטיק)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ===== טעינת אינדקסים (כולל חלקים, דרך GitHub API רשמי) =====
async function loadIndexes() {
  console.log("🌐 Fetching fresh indexes from GitHub...");
  const now = Date.now();
  if (cache.data && now - cache.timestamp < cache.ttl) return cache.data;

  const repo = process.env.GITHUB_REPO || "shabatoncourses-gif/duda-ai-bot";
  const branch = process.env.GITHUB_BRANCH || "main";
  const token = process.env.GITHUB_TOKEN || null;
  const baseRaw = `https://raw.githubusercontent.com/${repo}/${branch}/data`;

  const indexFiles = [
    "shabaton_index_part1.json",
    "shabaton_index_part2.json",
    "shabaton_index_part3.json",
    "morim_index_part1.json",
  ];

  const shabatonAll = [];
  const morimAll = [];
  let successCount = 0;

  for (const file of indexFiles) {
    const apiUrl = `https://api.github.com/repos/${repo}/contents/data/${file}?ref=${branch}`;
    const rawUrl = `${baseRaw}/${file}`;

    try {
      let res = await fetch(apiUrl, {
        headers: token ? { Authorization: `token ${token}` } : {},
      });

      if (!res.ok) {
        console.warn(`⚠️ API fetch ${file} failed: ${res.status}`);
        console.warn(`➡️ Trying RAW URL...`);
        res = await fetch(rawUrl);
      }

      if (!res.ok) {
        console.warn(`❌ RAW fetch ${file} failed: ${res.status}`);
        continue;
      }

      let data;
      // אם זה מה־API — יש content base64
      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const json = await res.json();
        const decoded = Buffer.from(json.content, "base64").toString("utf8");
        data = JSON.parse(decoded);
      }

      if (file.startsWith("shabaton")) shabatonAll.push(...data);
      if (file.startsWith("morim")) morimAll.push(...data);
      successCount++;
      console.log(`📦 Loaded ${file} (${data.length})`);
    } catch (err) {
      console.warn(`⚠️ Error reading ${file}: ${err.message}`);
    }
  }

  console.log(`✅ Shabaton: ${shabatonAll.length} | Morim: ${morimAll.length}`);
  if (successCount === 0) throw new Error("❌ Failed to load indexes from GitHub");

  cache.data = { shabatonIndex: shabatonAll, morimIndex: morimAll };
  cache.timestamp = now;
  return cache.data;
}


// ===== מסלול API =====
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ message: "✅ /api/chat פעיל." });
  if (req.method !== "POST") return res.status(405).json({ error: "❌ POST בלבד" });

  try {
    const { message, debug } = req.body || {};
    if (!message) return res.status(400).json({ error: "❌ חסר message" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const cleanMsg = normalizeHebrew(message);
    const keywords = extractKeywordsHeb(cleanMsg);
    const userRegions = detectRegions(cleanMsg);

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

    // === דירוג משופר עם חיזוק חזק ל-title ועמודי מידע ===
    const ranked = allPages
      .map((p) => {
        const url = p.url.toLowerCase();
        const title = normalizeHebrew(p.title || "");
        const text = removeMenuText(normalizeHebrew(p.text || ""));
        const fullContent = `${title} ${text}`;
        const simFull = cosineSimilarity(queryVectorFull, p.vector);
        const simKey = cosineSimilarity(queryVectorKeywords, p.vector);
        const matched = keywords.filter((kw) => fullContent.includes(kw));

        // 🧠 זיהוי דפי מידע כלליים
        const infoPages = ["btl", "שבתון", "גמול", "קרן", "faq", "tax", "מס"];
        const isInfoPage = infoPages.some((kw) => url.includes(kw) || title.includes(kw));
        const infoBoost = (!cleanMsg.includes("קורס") && isInfoPage) ? 0.8 : 0;

        // 🧭 אזור
        let regionBoost = 0;
        if (userRegions) {
          for (const region of userRegions) {
            if (url.includes(region)) regionBoost += 0.25;
          }
          if (regionBoost === 0 && userRegions.length) regionBoost = -0.15;
        }

        // ⚙️ סדר עדיפויות לפי סוג עמוד
        let priorityBoost = 0;
        if (url.includes("/results-all/")) priorityBoost = 0.5;
        else if (url.includes("/search-results-")) priorityBoost = 0.3;
        else if (url.includes("/courses-per-month/")) priorityBoost = -0.1;
        else if (url.includes("/articles/") || url.includes("/blog/")) priorityBoost = -0.3;

        // 🎯 חיזוק חזק לכותרת ולתיאור
        const titleMatch = keywords.some((kw) => title.includes(kw)) ? 0.8 : 0;
        const descMatch = keywords.some((kw) => text.slice(0, 300).includes(kw)) ? 0.2 : 0;

        const score = Math.max(simFull, simKey) + infoBoost + titleMatch + descMatch + regionBoost + priorityBoost;

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


// === יצירת קונטקסט מעוצב וידידותי ===
const context = uniqueRanked
  .map((p) => {
    const decodedUrl = decodeURI(p.url.trim());
    const cleanTitle = (p.title || "")
      .replace(/\[.*?\]/g, "")
      .replace(/\(.*?\)/g, "")
      .replace(/["<>]/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    const shortText = (p.text || "").slice(0, 160).trim() + (p.text.length > 160 ? "..." : "");

    return `
      <div style="
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px 16px;
        margin-bottom: 14px;
        background-color: #fafafa;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      ">
        <div style="font-weight:600; font-size:1.05em; color:#111; margin-bottom:6px;">
          ${cleanTitle}
        </div>
        <div style="font-size:0.95em; color:#444; line-height:1.45;">
          ${shortText}
        </div>
        <a href="${decodedUrl}" target="_blank" rel="noopener noreferrer"
          style="display:inline-block; margin-top:10px; background:#0078ff;
          color:white; padding:6px 12px; border-radius:8px; font-weight:bold;
          text-decoration:none; transition:background 0.2s ease;">
          למידע נוסף ↗️
        </a>
      </div>
    `;
  })
  .join("");


    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
          אתה עוזר חכם המספק תשובות מדויקות על קורסים ודפי מידע מתוך מאגרי שבתון ומורים בלבד.
          חשוב מאוד להשתמש בכותרות (title, h1–h3) ובתיאורי הדפים.
          אם השאלה אינה כוללת את המילה "קורס", העדף דפי מידע כלליים (כמו ביטוח לאומי, גמול השתלמות, קרן השתלמות).
          אל תציין מאיזה אתר נלקח המידע, ואל תשתמש בסוגריים.
          הצג רק קישורים ככפתור 'למידע נוסף ↗️' והקפד לנסח תשובה בעברית טבעית וברורה.
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
        }))
      })
    });
  } catch (err) {
    console.error("💥 Error in /api/chat:", err);
    return res.status(500).json({ error: err.message });
  }
}
