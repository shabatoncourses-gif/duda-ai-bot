export const config = {
  runtime: "nodejs",
};
export const dynamic = "force-dynamic";

import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import getRawBody from "raw-body";

/* -------------------------------------- */
/* Utility                                */
/* -------------------------------------- */

function normalizeHebrew(t) {
  return (t || "")
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
/* Cities → Regions                       */
/* -------------------------------------- */

const CITY_TO_REGION = {
  // מרכז
  [normalizeHebrew("פתח תקווה")]: "merkaz",
  [normalizeHebrew("רמת גן")]: "merkaz",
  [normalizeHebrew("חולון")]: "merkaz",
  [normalizeHebrew("גבעתיים")]: "merkaz",
  [normalizeHebrew("תל אביב")]: "merkaz",
  [normalizeHebrew("ראשון לציון")]: "merkaz",
  [normalizeHebrew("בת ים")]: "merkaz",

  // השרון
  [normalizeHebrew("הרצליה")]: "sharon",
  [normalizeHebrew("נתניה")]: "sharon",
  [normalizeHebrew("חדרה")]: "sharon",
  [normalizeHebrew("רעננה")]: "sharon",
  [normalizeHebrew("כפר סבא")]: "sharon",
  [normalizeHebrew("הוד השרון")]: "sharon",
  [normalizeHebrew("קדימה")]: "sharon",

  // שפלה ודרום
  [normalizeHebrew("מודיעין")]: "darom",
  [normalizeHebrew("נס ציונה")]: "darom",
  [normalizeHebrew("רחובות")]: "darom",
  [normalizeHebrew("כפר ורבורג")]: "darom",
  [normalizeHebrew("באר שבע")]: "darom",
  [normalizeHebrew("גדרה")]: "darom",

  // צפון
  [normalizeHebrew("קריית טבעון")]: "zafon",
  [normalizeHebrew("חיפה")]: "zafon",
  [normalizeHebrew("מסד")]: "zafon",
  [normalizeHebrew("כפר תבור")]: "zafon",

  // ירושלים והסביבה
  [normalizeHebrew("ירושלים")]: "jerusalem",
  [normalizeHebrew("גוש עציון")]: "jerusalem",
  [normalizeHebrew("מבשרת ציון")]: "jerusalem",
};

// מילים כלליות לאזורים (אם לא צוינה עיר ספציפית)
const REGION_KEYWORDS = {
  zafon: [normalizeHebrew("צפון"), normalizeHebrew("חיפה")],
  merkaz: [normalizeHebrew("מרכז"), normalizeHebrew("גוש דן")],
  sharon: [normalizeHebrew("שרון")],
  darom: [normalizeHebrew("דרום"), normalizeHebrew("שפלה")],
  jerusalem: [
    normalizeHebrew("ירושלים"),
    normalizeHebrew("ירושלים והסביבה"),
  ],
};

// הפוך: אזור → ערי האזור (מהמיפוי הקיים)
const REGION_TO_CITY_NAMES = {};
for (const [cityNorm, region] of Object.entries(CITY_TO_REGION)) {
  if (!REGION_TO_CITY_NAMES[region]) REGION_TO_CITY_NAMES[region] = [];
  REGION_TO_CITY_NAMES[region].push(cityNorm);
}

/* -------------------------------------- */
/* תחומי לימוד (קטגוריות)                */
/* -------------------------------------- */

const RAW_CATEGORIES = [
  "קורסי אופק חדש - עוז לתמורה",
  "קורסי אימון - NLP",
  "קורסי איפור, טיפוח אישי וסטיילינג",
  "קורסי אמנות ואומנויות",
  "לימודי תואר שני בחינוך ובהוראה",
  "קורסי בישול - קורסי קונדיטוריה",
  "קורסי בריאות ותזונה נכונה",
  "קורסים לגיל רך - חינוך קדם יסודי",
  "קורסי גישור",
  "קורסי גרפולוגיה ונומרולוגיה",
  "קורסי דרמה, פסיכודרמה, קורסי תיאטרון בובות",
  "קורסי הדרכת הורים, זוגיות ומשפחה",
  "קורסי הוראה מתקנת - קורסי הוראה מותאמת",
  "קורסי הנחיית קבוצות",
  "קורסי העצמה והתפתחות אישית",
  "קורסי העצמה נשית",
  "קורסי חברה וקהילה",
  "לימודי חינוך גופני",
  "קורסי חינוך והוראה",
  "קורסי חינוך סביבתי - לימודי ארץ ישראל",
  "קורסי טיולים - סיורים לימודיים",
  "קורסי טכנולוגיה דיגיטלית ואינטרנט",
  "קורסי יהדות, מורשת ישראל ודתות",
  "קורסי ייעוץ ארגוני",
  "לימודי ייעוץ חינוכי",
  "קורסי כתיבה יוצרת - קורסי כתיבה עיונית - כתיבה אקדמית",
  "קורסים לגימלאים",
  "קורסים בלמידה מרחוק",
  "קורסים לציבור הדתי",
  "קורסי אבחון וטיפול בלקויות למידה - קורסים לחינוך מיוחד",
  "קורסים במדעי הרוח",
  "קורסי מוסיקה - קונצרטים מודרכים",
  "קורסי מידענות וספרנות",
  "לימודי מיינדפולנס ומדיטציה",
  "מנהל עסקים - פיננסים - יזמות",
  "קורסי הוראת מתמטיקה ומדעים",
  "לימודי ניהול חינוכי",
  "קורסי ניתוח התנהגות",
  "ספורט, מחול ותנועה",
  "קורסי עיצוב אופנה - קורסי תפירה",
  "קורסי עיצוב הסביבה",
  "קורסי  עיצוב פנים - הום סטיילינג",
  "קורסי עריכה לשונית",
  "קורסים לפיתוח מקצועי למורים",
  "קורסי פסיכולוגיה וייעוץ",
  "קורסי צורפות ותכשיטנות",
  "קורסי צילום",
  "קורסי קולנוע",
  "לימודי רפואה משלימה",
  "קורסי  שפות - הוראת שפות - לימודי תרגום",
  "לימודי תואר שלישי - דוקטורט",
  "לימודי תואר שני",
  "קורסי תיירות",
  "קורסי תקשורת בין-אישית",
  "קורסי תרבות העשרה ואקטואליה",
  "לימודי תרפיה וטיפול",
];

// מילים "חלשות" שלא נשתמש בהן לזיהוי תחום
const CATEGORY_STOPWORDS = new Set([
  normalizeHebrew("קורס"),
  normalizeHebrew("קורסי"),
  normalizeHebrew("קורסים"),
  normalizeHebrew("לימודי"),
  normalizeHebrew("לימודים"),
  normalizeHebrew("בהוראה"),
  normalizeHebrew("בחינוך"),
  normalizeHebrew("הוראה"),
  normalizeHebrew("חינוך"),
  normalizeHebrew("תואר"),
  normalizeHebrew("שני"),
  normalizeHebrew("שלישי"),
]);

const CATEGORIES = RAW_CATEGORIES.map((name) => {
  const norm = normalizeHebrew(name);
  const tokens = norm
    .split(" ")
    .filter((w) => w && !CATEGORY_STOPWORDS.has(w));
  return { name, norm, tokens };
});

/**
 * זיהוי תחום לימוד מתוך הטקסט של הגולש.
 * בודקים חפיפה בין מילים "חזקות" של הקטגוריה לבין ההודעה.
 */
function detectCategory(cleanMsg) {
  let best = null;
  let bestScore = 0;

  for (const cat of CATEGORIES) {
    let hits = 0;
    for (const token of cat.tokens) {
      if (cleanMsg.includes(token)) hits++;
    }
    if (!hits) continue;
    const score = hits / (cat.tokens.length || 1);
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }

  // אפשר להחמיר אם תרצי – כרגע מספיק לפחות התאמה אחת
  return best;
}

/* -------------------------------------- */
/* Region → slug prefix for results pages */
/* -------------------------------------- */

const REGION_SLUG_PREFIX = {
  zafon: "results-zafon",
  merkaz: "search-results-merkaz",
  sharon: "results-sharon",
  darom: "results-shfea-darom",
  jerusalem: "results-jerusalem",
  all: "results-all",
};

/* -------------------------------------- */
/* Load Index                              */
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

  const sh = [],
    mo = [];

  for (const f of files) {
    try {
      const res = await fetch(`${base}/${f}`);
      if (!res.ok) continue;
      const arr = await res.json();
      if (Array.isArray(arr)) {
        if (f.startsWith("shabaton")) sh.push(...arr);
        else mo.push(...arr);
      }
    } catch (err) {
      console.error("index load error:", f, err);
    }
  }

  return [...sh, ...mo];
}

/* -------------------------------------- */
/* Classify page                           */
/* -------------------------------------- */

function classifyPage(p) {
  const url = (p.url || "").toLowerCase();

  // דפי תוצאות (כל ה-results / search-results)
  if (
    url.includes("results-") ||
    url.includes("/results/") ||
    url.includes("/results-all/") ||
    url.includes("search-results-")
  ) {
    return "results";
  }

  if (url.includes("thank") || url.includes("contact")) return "blocked";
  if (url.includes("/mosad-index/")) return "blocked";

  const title = normalizeHebrew(p.title || "");
  const h1 = normalizeHebrew(p.h1 || "");

  if (
    title.includes("מאמר") ||
    h1.includes("מאמר") ||
    url.includes("/article")
  ) {
    return "article";
  }

  return "course";
}

/* -------------------------------------- */
/* Soon (3 חודשים קדימה)                  */
/* -------------------------------------- */

const MONTHS = {
  ינואר: 0,
  פברואר: 1,
  מרץ: 2,
  אפריל: 3,
  מאי: 4,
  יוני: 5,
  יולי: 6,
  אוגוסט: 7,
  ספטמבר: 8,
  אוקטובר: 9,
  נובמבר: 10,
  דצמבר: 11,
};

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

// 0–2 חודשים קדימה (חודש נוכחי + עוד 2)
function isSoon(date) {
  if (!date) return false;
  const now = new Date();
  const diffMonths =
    (date.getFullYear() - now.getFullYear()) * 12 +
    (date.getMonth() - now.getMonth());
  return diffMonths >= 0 && diffMonths <= 2;
}

/* -------------------------------------- */
/* Region / category matching helpers      */
/* -------------------------------------- */

function detectRegion(cleanMsg) {
  // קודם – לפי עיר
  for (const [cityNorm, region] of Object.entries(CITY_TO_REGION)) {
    if (cleanMsg.includes(cityNorm)) {
      return region;
    }
  }

  // אח"כ – לפי מילת אזור
  for (const [region, words] of Object.entries(REGION_KEYWORDS)) {
    if (words.some((w) => cleanMsg.includes(w))) return region;
  }

  return null;
}

function pageMatchesCategory(p, category) {
  if (!category) return true;
  const text = (p.clean || "") + " " + normalizeHebrew(p.title || "");
  let hits = 0;
  for (const token of category.tokens) {
    if (text.includes(token)) hits++;
  }
  return hits > 0;
}

function pageMatchesRegion(p, region) {
  if (!region) return true;
  const text = p.clean || "";
  const cities = REGION_TO_CITY_NAMES[region] || [];
  if (cities.some((c) => text.includes(c))) return true;

  const regionWords = REGION_KEYWORDS[region] || [];
  if (regionWords.some((w) => text.includes(w))) return true;

  return false;
}

function isResultsUrl(url = "") {
  const u = url.toLowerCase();
  return (
    u.includes("results-") ||
    u.includes("/results/") ||
    u.includes("/results-all/") ||
    u.includes("search-results-")
  );
}

// מציאת דף תוצאות לפי אזור + תחום
function findResultsPage(pages, regionCode, category) {
  const prefix = REGION_SLUG_PREFIX[regionCode];
  if (!prefix) return null;

  const prefixLower = prefix.toLowerCase();
  const candidates = pages.filter(
    (p) =>
      p.type === "results" &&
      p.url &&
      p.url.toLowerCase().includes(prefixLower)
  );
  if (!candidates.length) return null;

  if (category) {
    const catTokens = category.tokens;
    const withCat = candidates
      .map((p) => ({
        p,
        hits: catTokens.filter((tok) => (p.clean || "").includes(tok)).length,
      }))
      .filter((x) => x.hits > 0)
      .sort(
        (a, b) =>
          b.hits - a.hits ||
          (b.p.score || 0) - (a.p.score || 0)
      );
    if (withCat[0]) return withCat[0].p;
  }

  return candidates.sort(
    (a, b) => (b.score || 0) - (a.score || 0)
  )[0];
}

/* -------------------------------------- */
/* Handler                                 */
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
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  let message = "";
  try {
    const raw = await getRawBody(req, { encoding: "utf8" });
    const data = JSON.parse(raw);
    message = data.message || "";
  } catch (err) {
    console.error("JSON parse error:", err);
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (!message) return res.status(400).json({ error: "Message missing" });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const cleanMsg = normalizeHebrew(message);

    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg,
    });

    const queryVector = emb.data[0].embedding;

    const all = await loadIndexes();

    // ---- זיהוי אזור + תחום ----
    const region = detectRegion(cleanMsg);
    const category = detectCategory(cleanMsg);
    const isCategoryQuery = !!category;

    // ---- הבניית רשימת דפים עם ניקוי וטקסט ----
    const pages = all.map((p) => {
      const type = classifyPage(p);

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

      // בוסט לפי התאמת תחום
      if (category && pageMatchesCategory({ clean: txt, title: p.title }, category)) {
        score += 0.2;
      }

      // בוסט לפי התאמת אזור
      if (region && pageMatchesRegion({ clean: txt }, region)) {
        score += 0.2;
      }

      return { ...p, type, fullTitle, clean: txt, score };
    });

    // מסננים דפים חסומים
    const usablePages = pages.filter((p) => p.type !== "blocked");

    /* -------------------------------------- */
    /* בניית רשימות לפי סדר ההעדפות          */
    /* -------------------------------------- */

    let finalList = [];

    if (isCategoryQuery) {
      // 1) דפים פרטיים של מוסדות (course, לא results) בתחום + אזור
      const institutionCourses = usablePages
        .filter((p) => p.type === "course" && !isResultsUrl(p.url))
        .filter((p) => pageMatchesCategory(p, category))
        .filter((p) => pageMatchesRegion(p, region))
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 8); // אפשר לשנות כמות אם תרצי

      finalList.push(...institutionCourses);

      // 2) דף תוצאות אזורי (results-<region>/категория)
      const regionResultPage =
        region && findResultsPage(usablePages, region, category);

      if (regionResultPage) {
        finalList.push({
          ...regionResultPage,
          type: "results",
        });
      }

      // 3) קורסים בתחום הנפתחים בקרוב (3 חודשים)
      const soonCourses = usablePages
        .filter((p) => p.type === "course")
        .filter((p) => pageMatchesCategory(p, category))
        .map((p) => ({
          ...p,
          date: extractStartDate(p.fullTitle + " " + p.clean),
        }))
        .filter((p) => isSoon(p.date))
        .sort((a, b) => a.date - b.date)
        .slice(0, 8);

      finalList.push(...soonCourses);

      // 4) דף תוצאות "כל הארץ" לאותו תחום (results-all/קטגוריה)
      const allResultsPage = findResultsPage(usablePages, "all", category);
      if (allResultsPage) {
        finalList.push({
          ...allResultsPage,
          type: "results",
        });
      }

      // 5) מאמרים רלוונטיים בתחום
      const articles = usablePages
        .filter((p) => p.type === "article")
        .filter((p) => pageMatchesCategory(p, category))
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);

      finalList.push(...articles);
    } else {
      // ❖ ברירת מחדל – ללא תחום ברור: נשמר לוגיקה כללית
      const results = usablePages
        .filter((p) => p.type === "results")
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 3);

      const courses = usablePages
        .filter((p) => p.type === "course")
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 8);

      const soon = courses
        .map((p) => ({
          ...p,
          date: extractStartDate(p.fullTitle + " " + p.clean),
        }))
        .filter((p) => isSoon(p.date))
        .sort((a, b) => a.date - b.date);

      const articles = usablePages
        .filter((p) => p.type === "article")
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);

      finalList = [...results, ...courses, ...soon, ...articles];
    }

    // הסרת כפילויות לפי URL ושמירה על סדר
    const seenUrls = new Set();
    finalList = finalList.filter((p) => {
      if (!p.url) return true;
      if (seenUrls.has(p.url)) return false;
      seenUrls.add(p.url);
      return true;
    });

    /* ---------- Context for GPT ---------- */

    const context = finalList
      .map((p, i) => {
        if (p.type === "results") {
          return `# Item ${i + 1}
Type: results
Title: ${p.title}
URL: ${p.url}`;
        }

        return `# Item ${i + 1}
Type: ${p.type}
Title: ${p.title}
Description: ${p.description || ""}
Text: ${p.clean || ""}
URL: ${p.url}`;
      })
      .join("\n\n");

    /* ---------- GPT Completion ---------- */

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.15,
      messages: [
        {
          role: "system",
          content: `
ענה רק מתוך ה־Context.
אל תמציא מידע.
אל תמציא קישורים.
אל תוסיף "למידה מרחוק" אם לא הופיע בטקסט.
ב־results השתמש רק ב־title ו־URL.
הצג את התוצאות בצורה מסודרת וברורה.
הקפד לשמור על סדר התוצאות כפי שהן מופיעות ב-Context (מוסדות, דפי תוצאות אזוריים, נפתחים בקרוב, כל הארץ, מאמרים).
סגנון ידידותי וקצר.
          `,
        },
        {
          role: "user",
          content: `Question: ${message}\n\nContext:\n${context}`,
        },
      ],
    });

    let reply = completion?.choices?.[0]?.message?.content || "";

    /* ---------- הפיכת קישורים לכפתור "למידע נוסף" ---------- */
    // לא עושים encode / decode — משתמשים ב-URL כמו שהוא כדי להימנע מקידוד כפול.
    reply = reply.replace(
      /https?:\/\/[^\s<)]+/g,
      (url) =>
        `<a href="${url}" target="_blank" class="info-button">למידע נוסף ↗️</a>`
    );

    return res.json({ reply });
  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
