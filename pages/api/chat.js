// pages/api/chat.js
export const config = { runtime: "nodejs" };
export const dynamic = "force-dynamic";

import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";

// ===== Cache (לשימוש עתידי) =====
const cache = { data: null, timestamp: 0, ttl: 10 * 60 * 1000 };

// ===== פונקציות עזר =====
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function normalizeHebrew(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "של","עם","על","ב","ל","ה","מה","איך","יש","אין","או","אם","וכן",
  "קורס","קורסים","לימודים","בלימודי","לימודי","בהוראה","להוראה",
  "להשתלמות","בהשתלמות","תחום","תחומים","שבתון","שבתון."
]);

function extractKeywordsHeb(str) {
  return normalizeHebrew(str)
    .split(" ")
    .map((w) => w.replace(/^[לבכמוהשה]/, "").replace(/(יים|ים|ות|ית|יי|י)$/, ""))
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

// הסרת טקסטים חוזרים מיותרים
function removeMenuText(text) {
  if (!text) return "";
  return text
    .replace(/רוצים להיות מעודכנים[^\.]+/gi, "")
    .replace(/לוח מועדי קורסים/gi, "")
    .replace(/(קורסים בלמידה מרחוק|למידה מרחוק)/gi, "")
    .replace(/(קורסים|מאמרים|צרו קשר|אודות|כניסה|מורים)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ===== זיהוי אזורים =====
function detectRegionsFromQuery(text) {
  const t = normalizeHebrew(text);
  const r = [];
  if (/תל.?אביב|מרכז|גוש.?דן|פתח.?תקוה|חולון|בת.?ים|רחובות/.test(t)) r.push("center");
  if (/שרון|נתניה|רעננה|כפר.?סבא|השרון/.test(t)) r.push("sharon");
  if (/חיפה|צפון|גליל|עכו|נהריה|עמק/.test(t)) r.push("north");
  if (/דרום|שפלה|אשדוד|אשקלון|באר.?שבע/.test(t)) r.push("south");
  if (/אונליין|zoom|מקוון|מרחוק/.test(t)) r.push("online");
  return r.length ? r : null;
}

function detectRegionFromPage(text) {
  const t = normalizeHebrew(text);
  if (/תל.?אביב|מרכז|גוש.?דן|פתח.?תקוה|חולון|בת.?ים/.test(t)) return "center";
  if (/שרון|נתניה|רעננה|כפר.?סבא/.test(t)) return "sharon";
  if (/חיפה|צפון|גליל|עכו|נהריה/.test(t)) return "north";
  if (/דרום|שפלה|אשדוד|אשקלון|באר.?שבע/.test(t)) return "south";
  if (/אונליין|zoom|מקוון|מרחוק/.test(t)) return "online";
  return null;
}

// ===== חודשים =====
const MONTHS_MAP = {
  "ינואר": 0, "פברואר": 1, "מרץ": 2, "אפריל": 3, "מאי": 4, "יוני": 5,
  "יולי": 6, "אוגוסט": 7, "ספטמבר": 8, "אוקטובר": 9, "נובמבר": 10, "דצמבר": 11
};

function extractStartDate(str) {
  if (!str) return null;
  const t = str.toLowerCase();
  let m = null, y = null;

  for (const [k, v] of Object.entries(MONTHS_MAP)) {
    if (t.includes(k)) { m = v; break; }
  }
  const yearMatch = t.match(/20\d{2}/);
  if (yearMatch) y = parseInt(yearMatch[0]);

  return m !== null && y !== null ? new Date(y, m, 1) : null;
}

function isInCurrentOrNextMonth(date) {
  if (!date) return false;
  const now = new Date();
  const thisM = now.getMonth();
  const nextM = (thisM + 1) % 12;
  return (
    (date.getMonth() === thisM && date.getFullYear() === now.getFullYear()) ||
    (date.getMonth() === nextM)
  );
}

// ===== טעינת אינדקסים =====
async function loadIndexes() {
  const base = "https://raw.githubusercontent.com/shabatoncourses-gif/duda-ai-bot/main/data";
  const files = [
    "shabaton_index_part1.json",
    "shabaton_index_part2.json",
    "shabaton_index_part3.json",
    "morim_index_part1.json",
  ];

  const sh = [], mo = [];

  for (const f of files) {
    try {
      const res = await fetch(`${base}/${f}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data)) {
        if (f.startsWith("shabaton")) sh.push(...data);
        else mo.push(...data);
      }
    } catch {}
  }

  if (!sh.length && !mo.length) throw new Error("לא נטען אינדקס");
  return { shabatonIndex: sh, morimIndex: mo };
}

// סוג דף לפי URL
function classifyPage(url = "") {
  const u = url.toLowerCase();
  if (u.includes("/results-all/")) return "results";
  if (u.includes("thanks") || u.includes("thank") || u.includes("contact")) return "thanks";
  if (u.includes("/mosad-index/")) return "mosad";
  return "course";
}

// ===== API =====
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET")
    return res.status(200).json({ message: "OK" });
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "missing message" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const cleanMsg = normalizeHebrew(message);
    const keywords = extractKeywordsHeb(cleanMsg);
    const userRegions = detectRegionsFromQuery(cleanMsg);

    // embedding לשאלה
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg
    });
    const qv = emb.data[0].embedding;

    const { shabatonIndex, morimIndex } = await loadIndexes();
    const all = [...shabatonIndex, ...morimIndex];

    // ==== דירוג כל דף ====
    const scored = all.map((p) => {
      const kind = classifyPage(p.url);
      const fullTitle = [p.title, p.h1, ...(p.h2 || [])].filter(Boolean).join(" ");
      const textNorm = removeMenuText(
        normalizeHebrew((p.description || "") + " " + (p.text || ""))
      );

      const region = detectRegionFromPage(fullTitle + " " + p.description);

      let score = cosineSimilarity(qv, p.vector || []);

      // בוסט למילים בכותרת
      for (const kw of keywords) {
        if (normalizeHebrew(fullTitle).includes(kw)) score += 0.9;
        else if (textNorm.includes(kw)) score += 0.4;
      }

      // קדימויות
      if (kind === "results") score += 1.0;
      if (kind === "mosad") score -= 0.4;
      if (kind === "thanks") score -= 2.0;

      // אזור
      if (userRegions && region) {
        if (userRegions.includes(region)) score += 0.7;
        else score -= 0.2;
      }

      return { ...p, kind, fullTitle, textNorm, region, score };
    });

    // === תוצאה ראשית אחת של results-all ===
    const bestResultsAll =
      scored
        .filter(p => p.kind === "results")
        .sort((a, b) => b.score - a.score)[0] || null;

    // === דפי קורסים / מוסדות ===
    const coursePages = scored
      .filter(p => p.kind !== "results" && p.kind !== "thanks")
      .sort((a, b) => b.score - a.score);

    // === קורסים נפתחים בקרוב ===
    const soonRaw = coursePages.filter(p =>
      /(נפתח|יפתח|פתיחה|נפתחים בקרוב)/i.test(
        p.fullTitle + " " + p.description + " " + (p.h2 || []).join(" ")
      )
    );

    const soon = soonRaw
      .map(p => ({ ...p, startDate: extractStartDate(p.fullTitle + " " + p.text) }))
      .filter(p => p.startDate && isInCurrentOrNextMonth(p.startDate))
      .sort((a, b) => a.startDate - b.startDate);

    // === בניית context למודל ===
    const final = [];
    const used = new Set();

    if (bestResultsAll) {
      final.push({ ...bestResultsAll, bucket: "results" });
      used.add(bestResultsAll.url);
    }

    for (const p of coursePages) {
      if (final.length >= 8) break;
      if (!used.has(p.url)) {
        final.push({ ...p, bucket: "course" });
        used.add(p.url);
      }
    }

    for (const p of soon) {
      if (!used.has(p.url)) {
        final.push({ ...p, bucket: "soon" });
        used.add(p.url);
      }
    }

    if (!final.length)
      return res.status(200).json({ reply: "לא נמצאו תוצאות רלוונטיות." });

    const context = final
      .map((p, i) => {
        return `
# פריט ${i + 1}
סוג: ${p.bucket}
כותרת: ${p.fullTitle}
תיאור: ${p.description || p.textNorm}
קישור: ${p.url}
`.trim();
      })
      .join("\n\n");

    // === תשובה סופית מהמודל ===
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content: `
אתה עוזר חכם המספק תשובות מדויקות ממאגר שבתון ומורים בלבד.
התשובה צריכה להיות **בעברית**, **נקייה**, ו**מעוצבת ב־Markdown בלבד**.

כללים:
- אל תשתמש ב־URL חשוף. תמיד הצג קישור כמעוצב: [למידע נוסף ↗️](URL)
- הצג רק:
  1) תוצאה אחת של RESULTS_ALL אם קיימת.
  2) לאחר מכן דפי קורסים/מוסדות רלוונטיים.
  3) לאחר מכן "קורסים הנפתחים בקרוב" — רק אם יש.
- אם אין קורסים נפתחים בקרוב — אל תציג סעיף זה כלל.
- אל תכתוב טקסטים כלליים כמו "לא קיימים קורסים" או "מומלץ לבדוק".
- הימנע מאזכור דפי מוסדות לא רלוונטיים.
- הימנע מאזכור למידה מרחוק אם המשתמש לא ביקש זאת.
- הימנע מאזכור פריטי ניווט כמו "לוח מועדי קורסים", "רוצים להיות מעודכנים".
`
        },
        {
          role: "user",
          content: `השאלה: ${message}\n\nדפים רלוונטיים:\n${context}`
        }
      ]
    });

    return res.status(200).json({
      reply: completion.choices?.[0]?.message?.content || "לא נמצאה תשובה"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
