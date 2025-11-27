// =============================================
// pages/api/chat.js – גרסה מלאה ומעודכנת
// =============================================

export const config = {
  runtime: "nodejs",
};

// export const dynamic = "force-dynamic";

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import getRawBody from "raw-body";

/* -------------------------------------- */
/* טעינת JSON API                         */
/* -------------------------------------- */

const dataPath = path.join(process.cwd(), "data");

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataPath, file), "utf8"));
  } catch (err) {
    console.error(`❌ שגיאה בטעינת ${file}:`, err);
    return {};
  }
}

const cityToRegionRaw = loadJson("city_to_region.json");
const regionKeywordsRaw = loadJson("region_keywords.json");
const REGION_SLUGS = loadJson("region_slugs.json");
const REGION_LABELS = loadJson("region_labels.json");
const SOON_REGION_SLUGS = loadJson("soon_region_slugs.json");
const SUBJECT_SLUGS = loadJson("subjects.json");
const subjectStopwordsRaw = loadJson("subject_stopwords.json");
const subjectSynonymsRaw = loadJson("subject_synonyms.json");
const MONTHS = loadJson("months.json");

console.log("📦 JSON נטענו בהצלחה");

/* -------------------------------------- */
/* Utility                                */
/* -------------------------------------- */

/**
 * תיקון שגיאות כתיב נפוצות
 * למשל: "קטרס מחשבים" → "קורס מחשבים"
 */
function fixTypos(t) {
  return (t || "")
    .replace(/קטרס/g, "קורס")
    .replace(/קרוס/g, "קורס")
    .replace(/כוריס/g, "קורס")
    .replace(/מחשביים/g, "מחשבים");
}

function normalizeHebrew(t) {
  return fixTypos(t || "")
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function cleanText(t) {
  return normalizeHebrew(
    (t || "")
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/רוצים להיות מעודכנים[^\.]+/gi, "")
      .replace(/לוח מועדי קורסים/gi, "")
      .replace(/למידה מרחוק/gi, "")
      .replace(/קורסים בלמידה מרחוק/gi, "")
      .replace(/קורסים|מאמרים|צרו קשר|אודות|כניסה|מורים/gi, "")
  );
}

/* -------------------------------------- */
/* ערים → אזורים (נטען מ-JSON)           */
/* -------------------------------------- */

const CITY_TO_REGION = {};
for (const [city, region] of Object.entries(cityToRegionRaw || {})) {
  CITY_TO_REGION[normalizeHebrew(city)] = region;
}

/* מילים שמגדירות אזור ישירות (בלי עיר ספציפית) */
const REGION_KEYWORDS = {};
for (const [kw, region] of Object.entries(regionKeywordsRaw || {})) {
  REGION_KEYWORDS[normalizeHebrew(kw)] = region;
}

/* SUBJECT_STOPWORDS, SUBJECTS, SUBJECT_SYNONYMS         */
/* -------------------------------------- */

const SUBJECT_STOPWORDS = new Set(
  (Array.isArray(subjectStopwordsRaw) ? subjectStopwordsRaw : []).map((w) =>
    normalizeHebrew(w)
  )
);

const SUBJECTS = (Array.isArray(SUBJECT_SLUGS) ? SUBJECT_SLUGS : []).map(
  (slug) => {
    const norm = normalizeHebrew(slug);
    const tokens = norm
      .split(" ")
      .filter((tok) => tok && tok.length > 1 && !SUBJECT_STOPWORDS.has(tok));
    return { slug, norm, tokens };
  }
);

const SUBJECT_SYNONYMS = (Array.isArray(subjectSynonymsRaw)
  ? subjectSynonymsRaw
  : []
).map((item) => ({
  slug: item.slug,
  tokens: (item.tokens || []).map((tok) => normalizeHebrew(tok)),
}));


/* -------------------------------------- */
/* זיהוי תחום לימוד מהשאלה               */
/* -------------------------------------- */
function detectSubject(cleanMsg) {
  // 🔹 קודם – מילים נרדפות
  for (const syn of SUBJECT_SYNONYMS) {
    if (syn.tokens.some((tok) => cleanMsg.includes(tok))) {
      return SUBJECTS.find(s =>
        normalizeHebrew(s.slug) === normalizeHebrew(syn.slug)
      ) || null;
    }
  }

  // 🔹 אם נאמר "קורס מחשבים / קורסי מחשבים" → להכריח מחשבים
  if (/קורס(י)?\s+מחש/i.test(cleanMsg)) {
    return SUBJECTS.find(s =>
      normalizeHebrew(s.slug).includes("טכנולוגיה") &&
      normalizeHebrew(s.slug).includes("דיגיטל")
    ) || null;
  }

  // 🔹 ניקוד לפי התאמת מילים
  let best = null;
  let bestScore = 0;
  for (const s of SUBJECTS) {
    let score = 0;
    for (const tok of s.tokens) {
      if (cleanMsg.includes(tok)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }

  return best || null;
}



/* -------------------------------------- */
/* בניית URL קיים לפי אזור ותחום         */
/* -------------------------------------- */
function buildExistingResultsUrl(regionId, subjectSlug, pages) {
  const base = "https://www.shabaton.online";
  const regionPath = REGION_SLUGS[regionId] || REGION_SLUGS.all;

  // בניית URL גם אם יש רווחים/מקפים/עברית
  const candidate = `${base}/${regionPath}/${subjectSlug}`
    .replace(/\s+/g, " ")
    .trim();

  // בדיקה גם אם ה־URL בפועל מכיל תווים שונים
  const exists = pages.some((p) => {
    const url = (p.url || "").replace(/\s+/g, " ").trim().toLowerCase();
    return (
      url.includes(regionPath.toLowerCase()) &&
      url.includes(normalizeHebrew(subjectSlug))
    );
  });

  return exists ? candidate : null;
}


function getRegionLabel(regionId) {
  return REGION_LABELS[regionId] || "";
}

/* -------------------------------------- */
/* טעינת אינדקס                          */
/* -------------------------------------- */
async function loadIndexes() {
  const base =
    "https://raw.githubusercontent.com/shabatoncourses-gif/duda-ai-bot/main/data";

  const files = [
    "shabaton_index_part1.json",
    "shabaton_index_part2.json",
    "shabaton_index_part3.json",
    "morim_index_part1.json",
  ];

  const out = [];
  for (const f of files) {
    try {
      const res = await fetch(`${base}/${f}`);
      if (!res.ok) continue;
      const arr = await res.json();
      if (Array.isArray(arr)) out.push(...arr);
    } catch (err) {
      console.error("❌ index load error:", f, err);
    }
  }
  return out;
}

/* -------------------------------------- */
/* סיווג דפים                            */
/* -------------------------------------- */
function classifyPage(p) {
  const url = (p.url || "").toLowerCase();
  const title = normalizeHebrew(p.title || "");
  const h1 = normalizeHebrew(p.h1 || "");

  if (url === "https://www.morim.boutique/" || url === "https://morim.boutique/") {
    return "blocked";
  }

  if (
    url.includes("results-") ||
    url.includes("/results/") ||
    url.includes("/results-all/") ||
    url.includes("search-results-")
  ) {
    return "results";
  }

  if (url.includes("courses-per-month-")) {
    return "soonpage";
  }

  if (url.includes("thank") || url.includes("contact") || url.includes("/mosad-index/")) {
    return "blocked";
  }

  if (title.includes("מאמר") || h1.includes("מאמר") || url.includes("/article")) {
    return "article";
  }

  return "course"; // דפי מוסדות / קורס
}

function extractStartDate(text) {
  if (!text) return null;
  const t = text.toLowerCase();

  let month = null;
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (t.includes(name)) {
      month = idx;
      break;
    }
  }

  const yearMatch = /20\d{2}/.exec(t);
  if (!yearMatch || month === null) return null;

  return new Date(parseInt(yearMatch[0]), month, 1);
}

function isSoon(date) {
  if (!date) return false;
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const dYear = date.getFullYear();
  const dMonth = date.getMonth();
  const diffMonths = (dYear - currentYear) * 12 + (dMonth - currentMonth);
  return diffMonths >= 0 && diffMonths <= 2;
}

/* -------------------------------------- */
/* Handler                                */
/* -------------------------------------- */
export default async function handler(req, res) {
  const allowedOrigins = [
    "https://www.shabaton.online",
    "https://shabaton.online",
    "https://morim.boutique",
    "https://www.morim.boutique",
  ];

  const origin = req.headers.origin || "";
  res.setHeader(
    "Access-Control-Allow-Origin",
    allowedOrigins.includes(origin) ? origin : "https://www.shabaton.online"
  );
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.json({ ok: true });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  let message = "";
  try {
    const raw = await getRawBody(req, { encoding: "utf8" });
    const data = JSON.parse(raw);
    message = data.message || "";
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (!message) return res.status(400).json({ error: "Message missing" });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // 🔹 נרמול + תיקון שגיאות כתיב
    const cleanMsg = normalizeHebrew(message);

    // ❌ אם מדובר בשאלה כללית (חישוב) → לא לחפש קורסים
const generalCalcQuestion = /(איך|כמה|מה)\s+(מחשבים|מחשב)/.test(message);


    // 🔹 Embedding לשאילתה
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg,
    });
    const queryVector = emb.data[0].embedding;

    // 🔹 טעינת אינדקס
    const all = await loadIndexes();

    /* -------------------------------------- */
    /* זיהוי עיר / אזור                      */
    /* -------------------------------------- */
    const cityMatch = Object.keys(CITY_TO_REGION).find((c) => cleanMsg.includes(c));
    let region = cityMatch ? CITY_TO_REGION[cityMatch] : null;

    if (!region) {
      for (const [kw, regId] of Object.entries(REGION_KEYWORDS)) {
        if (cleanMsg.includes(kw)) {
          region = regId;
          break;
        }
      }
    }

    /* -------------------------------------- */
    /* זיהוי תחום (subject)                  */
    /* -------------------------------------- */
  /* -------------------------------------- */
/* זיהוי תחום (subject)                  */
/* -------------------------------------- */

// אם זו שאלה כללית (איך מחשבים מענק / כמה מחשבים...), לא להציע קורסים
let detectedSubject = generalCalcQuestion ? null : detectSubject(cleanMsg);

// 🩹 זיהוי מתקדם לשאלות מחשבים – כולל מילים נלוות
if (!detectedSubject) {
  const computerKeywords = [
    "קורס מחשבים",
    "מחשבים",
    "מחשב",
    "טכנולוגיה",
    "עיצוב אתרים",
    "בניית אתרים",
    "דיגיטל"
  ];
  if (
    computerKeywords.some((w) =>
      normalizeHebrew(cleanMsg).includes(normalizeHebrew(w))
    )
  ) {
    detectedSubject =
      SUBJECTS.find(
        (s) =>
          normalizeHebrew(s.slug).includes("טכנולוגיה") &&
          normalizeHebrew(s.slug).includes("דיגיטל")
      ) || null;
  }
}

// הגדרת subjectSlug לשימוש בהמשך
const subjectSlug = detectedSubject ? detectedSubject.slug : null;


    // בדיקת תואר
    const msgHasDegree = /תואר/.test(message);

    /* ---------------------------------------------------------- */
    /* מכאן מתחיל חישוב הציונים (score) - יגיע בחלק 4/6          */
    /* ---------------------------------------------------------- */
/* --- חישוב ציון לכל דף --- */
const pages = all

  .map((p) => {
    const type = classifyPage(p);
    if (type === "blocked") return null;

    const fullTitle = [p.title, p.h1, ...(p.h2 || [])]
      .filter(Boolean)
      .join(" ");

    const html = p.text || "";
    const listItems = (html.match(/<li>(.*?)<\/li>/gi) || [])
      .map((li) => li.replace(/<\/?li>/gi, ""))
      .join(" ");

    const txt = cleanText(
      (p.description || "") +
        " " +
        (p.h1 || "") +
        " " +
        ((p.h2 || []).join(" ")) +
        " " +
        listItems
    );

    let score = cosineSimilarity(queryVector, p.vector || []);

    // ⭐ בוסט לעיר
    if (cityMatch && txt.includes(cityMatch)) score += 0.25;

    // ⭐ בוסט / ענישה לפי תחום
    
if (detectedSubject) {
  const normTitle = normalizeHebrew(fullTitle);
  const normalizedSubject = normalizeHebrew(detectedSubject.slug);

  const subjectMatch = (
    normalizeHebrew(fullTitle).includes(normalizedSubject) ||
    detectedSubject.tokens.some(tok =>
      normalizeHebrew(fullTitle).includes(tok) || txt.includes(tok)
    )
  ); 

  if (subjectMatch) score += 0.6;
  else score -= 0.7;

  const degreeWords = ["תואר", "מגיסטר", "ma"];
  if (!msgHasDegree && degreeWords.some(d => normTitle.includes(normalizeHebrew(d)))) {
    return null;
  }

  if (cleanMsg.includes("מחש") && detectedSubject) {
    if (detectedSubject.tokens.some(tok => normTitle.includes(tok) || txt.includes(tok))) {
      score += 2.0;
    } else {
      score -= 0.3;
    }
  }
} 
// ❗ אם מדובר במחשבים – לא למחוק לגמרי, רק להוריד ציון
if (detectedSubject && score < 0.5) {
  if (cleanMsg.includes("מחש")) {
    score = Math.max(score, 0.3);
  } else {
    return null;
  }
}

    // ❗ החזרת הדף – תמיד
    return { ...p, type, fullTitle, clean: txt, score };
  })
  .filter(Boolean);

/* --- קורסים פרטיים --- */
const courses = pages
  .filter((p) => p.type === "course")
  .sort((a, b) => b.score - a.score)
  .slice(0, 8);


/* כאן אנחנו משתמשים רק בדפי לוח חודשיים ("courses-per-month-...")
    ורק אם גם האזור מתאים וגם בטקסט הדף מופיע התחום המבוקש */

let soon = [];        // כרגע לא מציגים קורסים בודדים "נפתחים בקרוב"
let soonMonthly = []; // כאן יהיה דף הלוח החודשי הרלוונטי

const soonPages = pages.filter((p) => p.type === "soonpage");

if (region && SOON_REGION_SLUGS[region]) {
  const slugPart = SOON_REGION_SLUGS[region].toLowerCase();
soonMonthly = soonPages
  .filter((p) => (p.url || "").toLowerCase().includes(slugPart))
  .map(p => ({
    ...p,
    date: extractStartDate((p.fullTitle || "") + " " + (p.clean || "")),
  }))
  .filter(p => {
    // 🎯 רק אם התאריך קיים ועדיין רלוונטי (לא עבר)
    return p.date && isSoon(p.date);
  })
  .filter(p => {
    // 🔍 התאמה לתחום – לפי תוכן העמוד
    if (!detectedSubject) return true;
    return detectedSubject.tokens.some(tok => p.clean.includes(tok));
  })
  .sort((a, b) => a.date - b.date) // תאריכים קרובים יותר תחילה
  .slice(0, 1); // רק דף אחד
 }
/* --- דפי תוצאות (results) לפי תחום ואזור --- */
let regionalResults = [];
let allCountryResults = [];

const resultPages = pages.filter((p) => p.type === "results");

if (subjectSlug) {
  // 🔹 דף תוצאות לאזור המבוקש (אם קיים URL מדויק)
  if (region) {
    const regionalUrl = buildExistingResultsUrl(region, subjectSlug, pages);

    if (regionalUrl) {
      regionalResults.push({
        type: "results",
        title: subjectSlug + " " + (getRegionLabel(region) || "").trim(),
        url: regionalUrl,
      });
    } else {
      // 🔹 fallback: לחפש דף results שיש בו גם אזור וגם תחום בכותרת/טקסט
      const altResult = resultPages.find((p) => {
        const t = normalizeHebrew(p.title || "");
        const txt = p.clean || "";
        const regionLabel = normalizeHebrew(getRegionLabel(region) || "");
        const hasRegion = regionLabel && t.includes(regionLabel);
        const hasSubject = detectedSubject.tokens.some(
          (tok) => t.includes(tok) || txt.includes(tok)
        );
        return hasRegion && hasSubject;
      });

      if (altResult) {
        regionalResults.push({
          type: "results",
          title: altResult.title,
          url: altResult.url,
        });
      }
    }
  }

  // 🔹 דף תוצאות בכל הארץ – רק אם הוא באמת לתחום הזה
  const allUrl = buildExistingResultsUrl("all", subjectSlug, pages);
  if (allUrl) {
    allCountryResults.push({
      type: "results",
      title: subjectSlug + " בכל הארץ",
      url: allUrl,
    });
  }
} else {
  // 🔹 fallback כללי כשלא זוהה תחום – מותר לקחת תוצאות כלליות
  const rawResults = resultPages
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((p) => ({
      type: "results",
      title: p.title,
      url: p.url,
    }));

  rawResults.forEach((r) => {
    const url = (r.url || "").toLowerCase();
    if (url.includes("results-all")) allCountryResults.push(r);
    else regionalResults.push(r);
  });
}
/* --- מאמרים רלוונטיים --- */
const articles = pages
  .filter((p) => p.type === "article")
  .sort((a, b) => b.score - a.score)
  .slice(0, 5);

/* --- סדר סופי של התוצאות --- */
let finalList;

if (subjectSlug) {
  finalList = [
    ...courses,           // 1️⃣ קורסים פרטיים מתאימים (מוסדות)
    ...regionalResults,   // 2️⃣ דף תוצאות לאזור המבוקש
    ...soon,              // 3️⃣ (כרגע ריק – נשאר בשביל סדר הסעיפים)
    ...soonMonthly,       // 3️⃣ קורסים הנפתחים בקרוב (לוח חודשי לפי אזור+תחום)
    ...allCountryResults, // 4️⃣ קורסים / תוצאות בכל הארץ לאותו תחום
    ...articles,          // 5️⃣ מאמרים רלוונטיים אם יש
  ];
} else {
  finalList = [
    ...courses,
    ...regionalResults,
    ...soon,
    ...soonMonthly,
    ...allCountryResults,
    ...articles,
  ];
}



/* --- ללא תוצאות → הצעת חלופה --- */
if (!finalList || finalList.length === 0) {
  let suggestion = detectedSubject ? detectedSubject.slug : "נסי ניסוח אחר";

  return res.json({
    reply: `
לא נמצאו תוצאות מתאימות לשאילתה: "${message}".

📌 ייתכן שהתחום באתר מופיע בשם מעט שונה.
למשל: "${message}" → **"${suggestion}"**

🔹 מומלץ לנסות שוב:
👉 <b>${suggestion}</b>

או שאוכל לחפש עבורך מיד את התחום הזה.
`,
  });
}


    if (courses.length === 0 && subjectSlug) {
  const allUrl = buildExistingResultsUrl("all", subjectSlug, pages);
  if (allUrl) {
    finalList.unshift({
      type: "results",
      title: subjectSlug + " בכל הארץ",
      url: allUrl,
    });
  }
}

/* --- בניית Context ל־GPT --- */
const context = finalList
  .map((p, i) => {
    if (p.type === "results" || p.type === "soonpage") {
      return `# Item ${i + 1}
Type: results
Title: ${p.title}
URL: <url>${p.url}</url>`;
    }
    return `# Item ${i + 1}
Type: ${p.type}
Title: ${p.title}
Description: ${p.description || ""}
Text: ${p.clean || ""}
URL: <url>${p.url}</url>`;
  })
  .join("\n\n");
/* --- קריאת GPT --- */
const completion = await client.chat.completions.create({
  model: "gpt-4o-mini",
  temperature: 0.15,
  messages: [
    {
      role: "system",
      content: `
ענה אך ורק מתוך ה־Context.
אל תמציא מידע.
אל תמציא קישורים.
אסור להחזיר URL שלא מופיע במפורש ב-Context.
כשאתה כותב קישור, השתמש תמיד בפורמט: URL: <url>https://....</url>
הצג את התוצאות בצורה מסודרת, לפי הסדר הבא:

1. דפי קורסים פרטיים מתאימים (מוסדות).
2. אחריהם דף תוצאות לאזור המבוקש.
3. אחריהם קורסים הנפתחים בקרוב (3 חודשים) + דפי לוח חודשיים.
4. אחריהם קורסים / תוצאות בכל הארץ.

סגנון תשובה:
• קצר, ענייני וידידותי.
• ללא קישורים מומצאים.
• אם קיימים רק חלקים – להציג אותם בלבד.

אם אין תוצאות כלל → אל תמציא, רק כתוב שאין תוצאות.
      `,
    },
    {
      role: "user",
      content: `Question: ${message}\n\nContext:\n${context}`,
    },
  ],
});

let reply = completion?.choices?.[0]?.message?.content || "";

/* --- המרת תגיות URL לכפתור HTML --- */
reply = reply.replace(
  /<url>(.*?)<\/url>/g,
  (match, url) =>
    `<a href="${url.trim()}" target="_blank" class="info-button">למידע נוסף ↗️</a>`
);

// להסרה אם נשארו <url> בלי תכולה
reply = reply.replace(/<\/?url>/g, "");

/* --- החזרת תשובה --- */
return res.json({ reply });

} catch (err) {
  console.error("ERROR:", err);
  return res.status(500).json({ error: err.message });
}

} // ← סוף פונקציית handler

