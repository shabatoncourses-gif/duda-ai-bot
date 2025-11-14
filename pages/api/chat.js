// pages/api/chat.js
export const config = { runtime: "nodejs" };
export const dynamic = "force-dynamic";

import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";

// ===== Cache (10 דקות) =====
const cache = { data: null, timestamp: 0, ttl: 10 * 60 * 1000 };

// ===== פונקציות עזר בסיסיות =====
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

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
    .map((w) =>
      w
        .replace(/^[לבכמוהשה]/, "")         // תחיליות
        .replace(/(יים|ים|ות|ית|יי|י)$/, "") // סיומות
    )
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

// ניקוי תפריטים (שימושי אם נוסיף text בעתיד)
function removeMenuText(text) {
  if (!text) return "";
  return text
    .replace(/(\||›|»|<|>|\[|\]|\(|\)).{0,20}(https?:\/\/|www\.|shabaton|morim)/gi, "")
    .replace(/(קורסים|מאמרים|צרו קשר|אודות|כניסה|מורים)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ===== מיפוי חודשים לנפתחים בקרוב =====
const MONTHS_MAP = {
  ינואר: 1, פברואר: 2, מרץ: 3, אפריל: 4, מאי: 5, יוני: 6,
  יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7,
  aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function extractStartDate(str) {
  if (!str) return null;
  const text = str.toLowerCase();
  let monthNum = null;
  let yearNum = null;

  for (const [m, n] of Object.entries(MONTHS_MAP)) {
    if (text.includes(m)) {
      monthNum = n;
      break;
    }
  }
  const y = text.match(/20\d{2}/);
  if (y) yearNum = parseInt(y[0], 10);

  return monthNum && yearNum ? new Date(yearNum, monthNum - 1, 1) : null;
}

// ===== זיהוי אזורים / ערים =====
const REGION_TERMS = {
  merkaz: [
    "מרכז","תל אביב","תל־אביב","תל-אביב","גוש דן",
    "רמת גן","גבעתיים","פתח תקוה","פתח תקווה","רחובות",
    "ראשון לציון","בת ים","חולון","הרצליה"
  ],
  sharon: ["שרון","נתניה","רעננה","כפר סבא","כפר־סבא","כפר-סבא","הוד השרון","השרון"],
  north: ["צפון","חיפה","גליל","נהריה","עכו","טבריה","כרמיאל","עמק יזרעאל"],
  south: ["דרום","שפלה","אשדוד","אשקלון","באר שבע","באר-שבע","נגב","שדרות","נתיבות"],
  online: ["אונליין","מקוון","zoom","זום","למידה מרחוק","למידה מקוונת","קורס מקוון"]
};

function detectRegions(text) {
  const t = normalizeHebrew(text);
  const regions = [];
  for (const [key, terms] of Object.entries(REGION_TERMS)) {
    if (terms.some((term) => t.includes(normalizeHebrew(term)))) {
      regions.push(key);
    }
  }
  return regions;
}

// ===== סינון דפי תודה / צור קשר / טלפון =====
function isThanksOrContactPage(p) {
  const url = (p.url || "").toLowerCase();
  const text = normalizeHebrew(
    [p.title, p.h1, ...(p.h2 || []), p.description].filter(Boolean).join(" ")
  );

  const badPatterns = [
    "thank", "thanks", "תודה", "נרשמת", "נרשמתם", "הטופס נשלח",
    "צור קשר","צרו קשר","יצירת קשר","contact",
    "טלפון","להרשמה טלפונית","פרטי קשר"
  ];

  if (badPatterns.some((w) => url.includes(encodeURI(w).toLowerCase()))) return true;
  if (badPatterns.some((w) => text.includes(normalizeHebrew(w)))) return true;
  if (/\/thanks/i.test(url)) return true;

  return false;
}

// ===== טעינת אינדקסים (עם Cache + חלקים) =====
async function loadIndexes() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < cache.ttl) {
    return cache.data;
  }

  console.log("🌐 Fetching fresh indexes from GitHub (with fallback)...");
  const base = "https://raw.githubusercontent.com/shabatoncourses-gif/duda-ai-bot/main/data";
  const files = [
    "shabaton_index_part1.json",
    "shabaton_index_part2.json",
    "shabaton_index_part3.json",
    "morim_index_part1.json"
  ];

  const shabatonAll = [];
  const morimAll = [];

  for (const f of files) {
    const url = `${base}/${f}`;
    try {
      const res = await fetch(url);
      console.log(`📥 Fetch ${f} → ${res.status}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;

      if (f.startsWith("shabaton")) shabatonAll.push(...data);
      else if (f.startsWith("morim")) morimAll.push(...data);
    } catch (err) {
      console.warn(`⚠️ ${f} failed: ${err.message}`);
    }
  }

  console.log(`✅ Loaded Shabaton=${shabatonAll.length}, Morim=${morimAll.length}`);
  if (shabatonAll.length === 0 && morimAll.length === 0) {
    throw new Error("❌ Failed to load indexes from GitHub (no data)");
  }

  cache.data = { shabatonIndex: shabatonAll, morimIndex: morimAll };
  cache.timestamp = Date.now();
  return cache.data;
}

// ===== API HANDLER =====
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") {
    return res.status(200).json({
      message: "✅ /api/chat פעיל. שלח POST עם { message: 'השאלה שלך' }."
    });
  }

  try {
    console.log("💬 Incoming request to /api/chat");
    const { message } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "❌ חסר message" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const cleanMsg = normalizeHebrew(message);
    const keywords = extractKeywordsHeb(cleanMsg);
    const userRegions = detectRegions(message);

    // === Embedding לשאילתה ===
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg
    });
    const qv = emb.data[0].embedding;

    // === טעינת אינדקסים ===
    const { shabatonIndex, morimIndex } = await loadIndexes();
    const allPages = [...shabatonIndex, ...morimIndex];

    // === חישוב דמיון + ניקוד חכם ===
    const scored = allPages
      .map((p) => {
        if (!p.vector || !Array.isArray(p.vector)) return null;

        const baseSim = cosineSimilarity(qv, p.vector);
        if (!isFinite(baseSim)) return null;

        const url = (p.url || "").toLowerCase();
        const textRaw = [p.title, p.h1, ...(p.h2 || []), p.description]
          .filter(Boolean)
          .join(" ");
        const textNorm = normalizeHebrew(textRaw);

        // חיזוק לפי התאמת מילות מפתח
        const matchedKeywords = keywords.filter((kw) => textNorm.includes(kw));
        let score = baseSim + matchedKeywords.length * 0.05;

        // חיזוק דף תוצאות כלליות (results-all) – חשוב שיהיה ראשון
        if (/\/results-all\//i.test(url)) score += 0.8;

        // חיזוק דפי מוסדות (mosad-index)
        if (/\/mosad-index\//i.test(url)) score += 0.35;

        // חיזוק קל לעמודי "קורסים נפתחים בקרוב" רלוונטיים
        if (/courses-next-2weeks|courses-per-month|courses-next/i.test(url)) {
          score += 0.15;
        }

        // חיזוק לפי אזור אם המשתמש ציין אזור / עיר
        if (userRegions.length) {
          for (const region of userRegions) {
            const regionTerms = REGION_TERMS[region] || [];
            if (regionTerms.some((term) => textNorm.includes(normalizeHebrew(term)))) {
              score += 0.3;
            }
          }
        }

        return { ...p, _textNorm: textNorm, score };
      })
      .filter(Boolean)
      // סינון דפי תודה / צור קשר וכו'
      .filter((p) => !isThanksOrContactPage(p))
      .sort((a, b) => b.score - a.score);

    if (!scored.length) {
      return res.status(200).json({ reply: "לא נמצאו תוצאות רלוונטיות." });
    }

    // === סידור לפי קטגוריות: results-all → מוסדות → נפתחים בקרוב (חודש נוכחי + הבא) → אחרים ===
    const now = new Date();
    const curMonth = now.getMonth();       // 0-11
    const curYear = now.getFullYear();
    const nextMonth = (curMonth + 1) % 12;
    const nextYear = curMonth === 11 ? curYear + 1 : curYear;

    const used = new Set();
    const catResultsAll = [];
    const catMosad = [];
    const catSoon = [];
    const catOthers = [];

    // עזרה: האם עמוד קורס נפתח בקרוב, ורק החודש/חודש הבא, ושייך לנושא השאלה
    function classifySoon(p) {
      const textRaw = [p.title, p.h1, ...(p.h2 || []), p.description]
        .filter(Boolean)
        .join(" ");
      const hasSoonWord = /(נפתח|יפתח|פתיחה|נפתחים בקרוב)/i.test(textRaw);
      if (!hasSoonWord) return null;

      const d = extractStartDate(textRaw);
      if (!d) return null;

      const m = d.getMonth();
      const y = d.getFullYear();
      const inCurrentOrNext =
        (y === curYear && m === curMonth) ||
        (y === nextYear && m === nextMonth);

      if (!inCurrentOrNext) return null;

      // דרישה: שיהיה רלוונטי לשאילתה (לפחות מילת מפתח אחת)
      if (keywords.length) {
        const textNorm = p._textNorm || normalizeHebrew(textRaw);
        const hasKw = keywords.some((kw) => textNorm.includes(kw));
        if (!hasKw) return null;
      }

      return d;
    }

    // 1. תוצאות כלליות /results-all/ רלוונטיות
    for (const p of scored) {
      if (used.has(p.url)) continue;
      const url = (p.url || "").toLowerCase();
      const isResultsAll = /\/results-all\//i.test(url);

      if (isResultsAll) {
        used.add(p.url);
        catResultsAll.push(p);
      }
    }

    // 2. דפי מוסדות /mosad-index/
    for (const p of scored) {
      if (used.has(p.url)) continue;
      const url = (p.url || "").toLowerCase();
      const isMosad = /\/mosad-index\//i.test(url);
      if (isMosad) {
        used.add(p.url);
        catMosad.push(p);
      }
    }

    // 3. קורסים נפתחים בקרוב (רק חודש נוכחי + הבא)
    const tmpSoon = [];
    for (const p of scored) {
      if (used.has(p.url)) continue;
      const startDate = classifySoon(p);
      if (startDate) {
        tmpSoon.push({ ...p, _startDate: startDate });
        used.add(p.url);
      }
    }

    tmpSoon.sort((a, b) => a._startDate - b._startDate);
    catSoon.push(...tmpSoon);

    // 4. כל השאר (דפים רלוונטיים נוספים)
    for (const p of scored) {
      if (used.has(p.url)) continue;
      used.add(p.url);
      catOthers.push(p);
    }

    // איחוד סופי והגבלה ל־8 תוצאות
    const finalRanked = [
      ...catResultsAll,
      ...catMosad,
      ...catSoon,
      ...catOthers
    ].slice(0, 8);

    if (!finalRanked.length) {
      return res.status(200).json({ reply: "לא נמצאו תוצאות רלוונטיות." });
    }

    // === בניית קונטקסט HTML לתשובת המודל ===
    const context = finalRanked
      .map((p) => {
        const safeUrl = (() => {
          try {
            return decodeURI(p.url);
          } catch {
            return p.url;
          }
        })();

        const title = (p.h1 || p.title || "פרטים").toString().trim();
        const h2List = (p.h2 || []).filter(Boolean).slice(0, 3);
        const h2Html = h2List.length
          ? `<div style="margin-top:5px;font-size:13px;color:#333;">${h2List
              .map((h) => `• ${h}`)
              .join("<br>")}</div>`
          : "";
        const desc = p.description
          ? `<div style='font-size:13px;color:#444;'>${p.description}</div>`
          : "";

        return `
          <div style="margin:0 0 10px 0;">
            <div style="font-weight:700;">${title}</div>
            ${desc}
            ${h2Html}
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer"
              style="display:inline-block;background:#0078ff;color:#fff;padding:6px 10px;
              border-radius:6px;font-weight:bold;text-decoration:none;margin-top:6px;">
              למידע נוסף ↗️
            </a>
          </div>
        `;
      })
      .join("");

    // === קריאה ל-GPT לנסח תשובה סופית ===
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content: `
אתה עוזר חכם המספק תשובות ממאגרים של שבתון ומורים בלבד.
השב בעברית טבעית וברורה.
סדר ההצגה:
1. קודם דף תוצאות כולל (אם קיים) המתאים לשאלה (results-all).
2. אחריו דפי מוסדות רלוונטיים (עם תיאור קצר וכפתור "למידע נוסף ↗️").
3. אחריהם, אם קיימים, קורסים הנפתחים בקרוב רק בחודש הנוכחי והבא, לפי סדר חודשים.
אל תציג דפי תודה או דפי יצירת קשר.
אל תזכיר את שם האתר.`
        },
        {
          role: "user",
          content: `שאלה של המשתמש: ${cleanMsg}\n\nדפים רלוונטיים (עם קישורים):\n${context}`
        }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content || "לא נמצאה תשובה.";
    return res.status(200).json({ reply });

  } catch (err) {
    console.error("💥 Error during /api/chat:", err);
    return res.status(500).json({ error: err.message });
  }
}
