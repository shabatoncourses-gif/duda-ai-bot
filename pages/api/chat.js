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
  "לימוד","לימודים","לימודי","בלימודי",
  "קורס","קורסים","קורסי",
  "של","עם","על","ב","ל","ה","מה","איך","יש","אין","או","אם","וכן",
  "מורה","מורים","גננות","גננת","חינוך","תחום","תחומים","לימודיים",
  "מסלול","מסלולים","לימודית","במסלול","בתחום","בתחומים","להוראה","בהוראה","הוראה",
  "להשתלמות","בהשתלמות"
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

  const [shabatonIndex, morimIndex] = await Promise.all([shRes.json(), moRes.json()]);

  cache.data = { shabatonIndex, morimIndex };
  cache.timestamp = now;
  return cache.data;
}

// ===== זיהוי אזור/אונליין מהרמזים בשאלה =====
const REGION_HINTS = [
  { key: "all",    terms: ["כל הארץ","בכל הארץ","בארץ","result all","results all","results-all"] , urlMatch: /\/results-all\//i, boost: 0.35 },
  { key: "merkaz", terms: ["מרכז","תל אביב","תל־אביב","תל אביב והמרכז","גוש דן"], urlMatch: /(search-results-merkaz|results-merkaz)/i, boost: 0.25 },
  { key: "sharon", terms: ["שרון"], urlMatch: /results-sharon/i, boost: 0.22 },
  { key: "zafon",  terms: ["צפון","חיפה","חיפה והצפון"], urlMatch: /results-zafon/i, boost: 0.22 },
  { key: "shfela", terms: ["שפלה","דרום","שפלה ודרום"], urlMatch: /results-shfela-darom/i, boost: 0.22 },
  { key: "zoom",   terms: ["זום","און ליין","אונליין","למידה מרחוק","מרחוק","zoom","online"], urlMatch: /(zoom|online|remote|מרחוק)/i, boost: 0.28 },
];

function detectRegionHints(q) {
  const nq = normalizeHebrew(q);
  const hits = new Set();
  for (const r of REGION_HINTS) {
    if (r.terms.some(t => nq.includes(normalizeHebrew(t)))) hits.add(r.key);
  }
  return hits;
}

// ===== סינון טקסט תפריטים פנימיים =====
function removeMenuText(text) {
  if (!text) return "";
  return text
    .replace(/(\||\•|\-|\–|\—|›|»|<|>|\[|\]|\(|\)).{0,30}(https?:\/\/|www\.|shabaton|morim)/gi, "")
    .replace(/(קורסים|מאמרים|יצירת קשר|צרו קשר|כניסה|כניסת מורים|אודות)/gi, "")
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
    if (!process.env.OPENAI_API_KEY)
      return res.status(500).json({ error: "❌ חסר OPENAI_API_KEY" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // ננקה ונחלץ
    const cleanMsg = normalizeHebrew(message);
    const keywords = extractKeywordsHeb(cleanMsg);

    // נזהה רמזי אזור/זום
    const regionHits = detectRegionHints(message);

    // ניצור embedding לשאלה – גם מלא וגם לפי מילות מפתח
    const [embFull, embKeys] = await Promise.all([
      client.embeddings.create({ model: "text-embedding-3-small", input: cleanMsg }),
      client.embeddings.create({ model: "text-embedding-3-small", input: keywords.join(" ") || cleanMsg })
    ]);
    const qvFull = embFull.data[0].embedding;
    const qvKeys = embKeys.data[0].embedding;

    // נטען אינדקסים
    const { shabatonIndex, morimIndex } = await loadIndexes();
    const allPages = [
      ...shabatonIndex.map((p) => ({ ...p, source: "Shabaton" })),
      ...morimIndex.map((p) => ({ ...p, source: "Morim" })),
    ];

    // האם השאלה "מידע/זכויות" (info) – להגביר דפי מידע
    const infoIntent = /(ביטוח לאומי|שבתון|זכאות|זכויות|מלגה|מענק|פנסיה|קרן|טופס|תשלום|קבלה|מדיניות|נהלים|מידע|שאלות נפוצות|FAQ)/i.test(message);

    // ניקוד/דירוג
    const ranked = allPages
      .map((p) => {
        const pageText = removeMenuText(
          normalizeHebrew(
            [
              p.title,
              p.h1,
              ...(Array.isArray(p.h2) ? p.h2 : []),
              p.description,
              p.text
            ].filter(Boolean).join(" ")
          )
        );

        // דמיון סמנטי
        const simFull = cosineSimilarity(qvFull, p.vector);
        const simKeys = cosineSimilarity(qvKeys, p.vector);
        let score = Math.max(simFull, simKeys);

        // בונוס לרצף מילים מלא (למשל "קורס גישור")
        if (pageText.includes(cleanMsg)) score += 0.30;

        // בוסט למילות מפתח שנמצאו בטקסט
        const matched = keywords.filter((kw) => pageText.includes(kw));
        score += Math.min(matched.length * 0.05, 0.25);

        // קדימות מבוססת מבנה אתר:
        // 1) results-all (כל הארץ)  2) לפי אזור  3) בקרוב/פתיחות
        const url = (p.url || "").toLowerCase();
        if (/\/results-all\//i.test(url)) score += 0.35;

        // אם המשתמש לא ציין אזור – ניתן בוסטר קטן ל-results-all כברירת מחדל
        if (regionHits.size === 0 && /\/results-all\//i.test(url)) score += 0.15;

        // בוסטר אזורי לפי מה שהתבקש
        for (const r of REGION_HINTS) {
          if (regionHits.has(r.key) && r.urlMatch.test(url)) score += r.boost;
        }

        // בוסטר אונליין/זום אם התבקש
        if (regionHits.has("zoom") && /(zoom|online|remote|מרחוק)/i.test(url)) score += 0.25;

        // בוסטר לדפי מידע אם הכוונה מידע/זכויות
        if (infoIntent && p.type === "info") score += 0.30;

        // הענשה לדפי נושאים כלליים כשביקשו אזור ספציפי
        if (regionHits.size > 0 && /blog|article/i.test(p.type || "")) score -= 0.10;

        return { ...p, score, matches: matched };
      })
      .filter((p) => p.score > 0.25)
      .sort((a, b) => b.score - a.score);

    // ייחודיות לפי URL
    const uniqueRanked = ranked.filter(
      (p, i, arr) => arr.findIndex((x) => x.url === p.url) === i
    ).slice(0, 6);

    if (uniqueRanked.length === 0) {
      return res.status(200).json({
        reply: "לא נמצאו תוצאות רלוונטיות. נסי לנסח אחרת (למשל: \"קורסי גישור\", \"קורס גישור במרכז\", \"למידה מרחוק בגישור\").",
        ...(debug && { debug: [], debug_keywords: keywords })
      });
    }

    // === בניית קונטקסט להצגה: H1 + Description + H2 (עד 3) + כפתור ===
    const context = uniqueRanked
      .map((p) => {
        const decodedUrl = decodeURI((p.url || "").trim());
        const H1 = (p.h1 || p.title || "").toString()
          .replace(/\[.*?\]|\(.*?\)/g, "")
          .replace(/["<>]/g, "")
          .trim();

        const desc = (p.description || "").toString().trim();
        const h2List = Array.isArray(p.h2) ? p.h2.filter(Boolean).map(s => s.trim()).slice(0, 3) : [];

        const h2Html = h2List.length
          ? `<div style="margin-top:6px; font-size:13px; color:#333;">
               ${h2List.map(s => `• ${s.replace(/["<>]/g,"")}`).join("<br>")}
             </div>`
          : "";

        const descHtml = desc
          ? `<div style="margin-top:4px; font-size:13px; color:#444;">${desc.replace(/["<>]/g,"")}</div>`
          : "";

        return `
          <div style="margin:0 0 10px 0;">
            <div style="font-weight:700;">${H1 || "פרטים"}</div>
            ${descHtml}
            ${h2Html}
            <a href="${decodedUrl}" target="_blank" rel="noopener noreferrer"
               style="display:inline-block; background:#0078ff; color:white; padding:6px 10px;
               border-radius:6px; font-weight:bold; text-decoration:none; margin-top:6px;">
               למידע נוסף ↗️
            </a>
          </div>
        `;
      })
      .join("");

    // === יצירת תשובה עם GPT – בלי שמות אתרים, בעברית, קצר ומדויק ===
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `
            אתה עוזר חכם המספק תשובות מדויקות על קורסים ומידע רלוונטי מתוך המאגרים בלבד.
            הצג תשובה קצרה וברורה בעברית. אל תזכיר את שם האתר/מקור המידע.
            אין להשתמש בסוגריים מרובעים/עגולים לשמות מקורות.
            הצג את הפריטים שסופקו (כולל כפתור "למידע נוסף") כפי שהם, ללא הוספת שמות אתרים.
          `
        },
        {
          role: "user",
          content: `שאלה: ${cleanMsg}\n\nפריטים רלוונטיים:\n${context}`
        }
      ],
      temperature: 0.2
    });

    const reply = completion.choices?.[0]?.message?.content || "לא נמצאה תשובה.";

    // ✅ תשובה ללקוח כולל debug
    return res.status(200).json({
      reply,
      ...(debug && {
        debug: uniqueRanked.map((r) => ({
          title: r.title,
          h1: r.h1,
          h2: Array.isArray(r.h2) ? r.h2.slice(0, 3) : [],
          description: r.description,
          score: r.score.toFixed(3),
          matches: r.matches,
          url: r.url,
          type: r.type
        })),
        debug_keywords: keywords,
        debug_region_hits: Array.from(regionHits)
      })
    });
  } catch (err) {
    console.error("💥 Error during /api/chat:", err);
    return res.status(500).json({ error: err.message });
  }
}
