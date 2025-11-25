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
/* ערים → אזורים                          */
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

/* מילים שמגדירות אזור ישירות (בלי עיר ספציפית) */
const REGION_KEYWORDS = {
  [normalizeHebrew("בשרון")]: "sharon",
  [normalizeHebrew("שרון")]: "sharon",
  [normalizeHebrew("במרכז")]: "merkaz",
  [normalizeHebrew("מרכז")]: "merkaz",
  [normalizeHebrew("בצפון")]: "zafon",
  [normalizeHebrew("צפון")]: "zafon",
  [normalizeHebrew("בחיפה")]: "zafon",
  [normalizeHebrew("בשפלה")]: "darom",
  [normalizeHebrew("בדרום")]: "darom",
  [normalizeHebrew("שפלה")]: "darom",
  [normalizeHebrew("דרום")]: "darom",
  [normalizeHebrew("בירושלים")]: "jerusalem",
  [normalizeHebrew("ירושלים")]: "jerusalem",
};

/* Slugs של דפי תוצאות לפי אזור */
const REGION_SLUGS = {
  sharon: "results-Sharon",
  merkaz: "search-results-merkaz",
  zafon: "results-zafon",
  darom: "results-shfea-darom",
  jerusalem: "results-jerusalem",
  all: "results-all",
};

/* תיאור ידידותי לאזור (לכותרות בלבד) */
const REGION_LABELS = {
  sharon: "בשרון",
  merkaz: "בתל אביב והמרכז",
  zafon: "בחיפה והצפון",
  darom: "בשפלה ובדרום",
  jerusalem: "בירושלים והסביבה",
};

/* Slugs של "קורסים נפתחים בקרוב" לפי אזור (לוח חודשי) */
const SOON_REGION_SLUGS = {
  merkaz: "courses-per-month-Merkaz",
  sharon: "courses-per-month-sharon",
  zafon: "courses-per-month-zafon",
  darom: "courses-per-month-darom",
  jerusalem: "courses-per-month-jerusalem",
};

/* -------------------------------------- */
/* תחומי לימוד (slugs של התחומים)       */
/* -------------------------------------- */

const SUBJECT_SLUGS = [
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
];

/* מילים שאנחנו מתעלמים מהן בזיהוי תחום */
const SUBJECT_STOPWORDS = new Set([
  normalizeHebrew("קורס"),
  normalizeHebrew("קורסי"),
  normalizeHebrew("קורסים"),
  normalizeHebrew("לימודי"),
  normalizeHebrew("לימודים"),
  normalizeHebrew("תואר"),
  normalizeHebrew("בחינוך"),
  normalizeHebrew("ובהוראה"),
  normalizeHebrew("בהוראה"),
  normalizeHebrew("ב"),
  normalizeHebrew("ו"),
]);

/* בניית אובייקטים של תחומים עם טוקנים לניקוד */
const SUBJECTS = SUBJECT_SLUGS.map((slug) => {
  const norm = normalizeHebrew(slug);
  const tokens = norm
    .split(" ")
    .filter((tok) => tok && tok.length > 1 && !SUBJECT_STOPWORDS.has(tok));
  return { slug, norm, tokens };
});

/* מילון מילים נרדפות → תחום (למשל "מחשבים" → טכנולוגיה דיגיטלית) */

const SUBJECT_SYNONYMS = [
  {
    slug: "קורסי טכנולוגיה דיגיטלית ואינטרנט",
    tokens: [
      "מחשבים", "מחשב", "טכנולוגיה", "דיגיטל", "דיגיטלי",
      "אינטרנט", "רשת", "גלישה", "התמצאות דיגיטלית",
      "סייבר", "עבודה במחשב", "מיומנויות מחשב",
      "קורס מחשבים", "קורס אופיס", "office", "יישומי מחשב",
      "אקסל", "excel", "וורד", "word", "פאוורפוינט", "powerpoint",
      "מצגות", "תכנות", "קוד", "פיתוח", "html", "css", "javascript",
      "ai", "בינה מלאכותית", "למידת מכונה", "machine learning",
      "קורס דיגיטל", "קורס טכנולוגיה", "קורס מחשבים למורים",
      "זום", "zoom"
    ].map(normalizeHebrew),
  },
  {
    tokens: [normalizeHebrew("צילום"), normalizeHebrew("מצלמה")],
    slug: "קורסי צילום",
  },
  // שאר התחומים…
];

/* זיהוי תחום לימוד מהשאלה */
function detectSubject(cleanMsg) {
  // קודם – מילים נרדפות (מחשבים → טכנולוגיה וכו')
  for (const syn of SUBJECT_SYNONYMS) {
    if (syn.tokens.some((tok) => cleanMsg.includes(tok))) {
      const found = SUBJECTS.find(
        (s) => normalizeHebrew(s.slug) === normalizeHebrew(syn.slug)
      );
      if (found) return found;
    }
  }

  // אחר כך – ניקוד לפי כמה טוקנים מתוך ה־slug מופיעים בשאלה
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
  return bestScore > 0 ? best : null;
}

/* בניית URL לדף תוצאות לפי אזור + תחום – רק אם קיים באמת באינדקס */
function buildExistingResultsUrl(regionId, subjectSlug, pages) {
  const base = "https://www.shabaton.online";
  const regionPath = REGION_SLUGS[regionId] || REGION_SLUGS.all;

  // לא מקודדים עברית, הדפדפן/שרת מטפלים בזה
  const candidate = `${base}/${regionPath}/${subjectSlug}`.replace(/\s+/g, " ");

  // בודקים אם ה־URL הזה קיים באינדקס
  const exists = pages.some(
    (p) => (p.url || "").replace(/\s+/g, " ") === candidate
  );

  return exists ? candidate : null;
}

function getRegionLabel(regionId) {
  return REGION_LABELS[regionId] || "";
}

/* -------------------------------------- */
/* טעינת אינדקס                           */
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
/* סיווג דפים                             */
/* -------------------------------------- */

function classifyPage(p) {
  const url = (p.url || "").toLowerCase();
  const title = normalizeHebrew(p.title || "");
  const h1 = normalizeHebrew(p.h1 || "");

  // חוסמים שורש של מורيم בוטיק (תוצאה כללית מדי)
  if (url === "https://www.morim.boutique/" || url === "https://morim.boutique/") {
    return "blocked";
  }

  // דפי תוצאות
  if (
    url.includes("results-") ||
    url.includes("/results/") ||
    url.includes("/results-all/") ||
    url.includes("search-results-")
  ) {
    return "results";
  }

  // דפי לוח חודשים "courses-per-month-..."
  if (url.includes("courses-per-month-")) {
    return "soonpage";
  }

  // חסומים
  if (url.includes("thank") || url.includes("contact")) return "blocked";
  if (url.includes("/mosad-index/")) return "blocked";

  // מאמרים
  if (
    title.includes("מאמר") ||
    h1.includes("מאמר") ||
    url.includes("/article")
  ) {
    return "article";
  }

  // ברירת מחדל — קורס (דף מוסד/קורס)
  return "course";
}

/* -------------------------------------- */
/* קורסים שנפתחים בקרוב (3 חודשים)       */
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
  let monthName = null;
  for (const [name, idx] of Object.entries(MONTHS)) {
    if (t.includes(name)) {
      month = idx;
      monthName = name;
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
  // שלושת החודשים הקרובים (0,1,2)
  return diffMonths >= 0 && diffMonths <= 2;
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
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  if (!message) return res.status(400).json({ error: "Message missing" });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const cleanMsg = normalizeHebrew(message);

    /* --- Embedding לשאילתה --- */
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg,
    });
    const queryVector = emb.data[0].embedding;

    /* --- טעינת אינדקס --- */
    const all = await loadIndexes();

    /* --- זיהוי עיר / אזור --- */
    const cityMatch = Object.keys(CITY_TO_REGION).find((c) =>
      cleanMsg.includes(c)
    );

    let region = cityMatch ? CITY_TO_REGION[cityMatch] : null;

    if (!region) {
      for (const [kw, regId] of Object.entries(REGION_KEYWORDS)) {
        if (cleanMsg.includes(kw)) {
          region = regId;
          break;
        }
      }
    }

    /* --- זיהוי תחום לימוד (slug) --- */
    const detectedSubject = detectSubject(cleanMsg);
    const subjectSlug = detectedSubject ? detectedSubject.slug : null;

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

        // בוסט לעיר
        if (cityMatch && txt.includes(cityMatch)) score += 0.25;

        // בוסט לתחום (אם זוהה)
        if (detectedSubject) {
          if (
            detectedSubject.tokens.some((tok) => txt.includes(tok)) ||
            normalizeHebrew(fullTitle).includes(
              detectedSubject.tokens[0] || ""
            )
          ) {
            score += 0.2;
          }
        }

        return { ...p, type, fullTitle, clean: txt, score };
      })
      .filter(Boolean);

    /* --- קורסים (דפים פרטיים של מוסדות) --- */
    const courses = pages
      .filter((p) => p.type === "course")
      .sort((a, b) => b.score - a.score)
      .slice(0, 8); // דפי מוסדות – תמיד ראשונים

    /* --- "נפתחים בקרוב" כקורסים בודדים (3 חודשים קדימה) --- */
    const soon = courses
      .filter((p) => /(נפתחים בקרוב|פתיחה|נפתח)/i.test(p.fullTitle))
      .map((p) => ({
        ...p,
        date: extractStartDate(p.fullTitle + " " + p.clean),
      }))
      .filter((p) => isSoon(p.date))
      .sort((a, b) => a.date - b.date);

    /* --- דפי לוח חודשים קיימים (courses-per-month-...) מתוך האינדקס --- */
    const soonPages = pages.filter((p) => p.type === "soonpage");

    let soonMonthly = [];
    if (region && SOON_REGION_SLUGS[region]) {
      const slugPart = SOON_REGION_SLUGS[region].toLowerCase();
      // בוחרים רק דפים מתאימים ל־slug של האזור
      soonMonthly = soonPages.filter((p) =>
        (p.url || "").toLowerCase().includes(slugPart)
      );
      // ממיינים לפי ציון, ליתר ביטחון
      soonMonthly = soonMonthly.sort((a, b) => b.score - a.score).slice(0, 2);
    }

    /* --- דפי תוצאות לפי תחום ואזור (ללא המצאת URL) --- */

    let regionalResults = [];
    let allCountryResults = [];

    if (subjectSlug) {
      // קודם: דף תוצאות אזורי אם קיים כזה באינדקס
      if (region) {
        const regionalUrl = buildExistingResultsUrl(region, subjectSlug, pages);
        if (regionalUrl) {
          const titleRegion =
            subjectSlug + " " + (getRegionLabel(region) || "").trim();

          regionalResults.push({
            type: "results",
            title: titleRegion.trim(),
            url: regionalUrl,
          });
        }
      }

      // אחר כך: קורסים בכל הארץ – רק אם קיים URL כזה באמת
      const allUrl = buildExistingResultsUrl("all", subjectSlug, pages);
      if (allUrl) {
        allCountryResults.push({
          type: "results",
          title: subjectSlug + " בכל הארץ",
          url: allUrl,
        });
      }
    } else {
      // לא זוהה תחום ספציפי – נשתמש ב־results מהאינדקס בלבד
      const rawResults = pages
        .filter((p) => p.type === "results")
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((p) => ({
          type: "results",
          title: p.title,
          url: p.url,
        }));

      // מחלקים באופן גס בין "אזוריים" ל"כל הארץ" לפי ה־slug
      rawResults.forEach((r) => {
        const url = (r.url || "").toLowerCase();
        if (url.includes("results-all")) allCountryResults.push(r);
        else regionalResults.push(r);
      });
    }

    /* --- מאמרים --- */

    const articles = pages
      .filter((p) => p.type === "article")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    /* --- סדר סופי של רשימת הפריטים --- */
    // 1. קורסים פרטיים (מוסדות)
    // 2. דפי תוצאות לאזור המתאים
    // 3. קורסים הנפתחים בקרוב (3 חודשים) + דפי "courses-per-month-..." קיימים
    // 4. דפי תוצאות לכל הארץ
    // 5. מאמרים
    const finalList = [
      ...courses,
      ...regionalResults,
      ...soon,
      ...soonMonthly,
      ...allCountryResults,
      ...articles,
    ];

    /* --- Context ל־GPT (עם תגיות <url>...) --- */

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
ענה רק מתוך ה־Context.
אל תמציא מידע.
אל תמציא קישורים.
אסור להחזיר URL שלא מופיע במפורש ב-Context.
כשאתה כותב קישור, השתמש בפורמט: URL: <url>https://....</url>
ב־results השתמש רק בכותרת ו־URL.
הצג את התוצאות בצורה מסודרת, עם דגש על:
1. דפי קורסים פרטיים מתאימים (מוסדות).
2. אחריהם דף תוצאות לאזור המתאים.
3. אחריהם קורסים הנפתחים בקרוב (3 חודשים) ודפי לוח חודשים מתאימים.
4. אחריהם קורסים / תוצאות בכל הארץ.
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

    /* --- המרה של <url>... לקישור "למידע נוסף" --- */

    reply = reply.replace(
      /<url>(.*?)<\/url>/g,
      (match, url) =>
        `<a href="${url.trim()}" target="_blank" class="info-button">למידע נוסף ↗️</a>`
    );

    // לניקוי בטוח אם נשארו תגיות url גולמיות
    reply = reply.replace(/<\/?url>/g, "");

    return res.json({ reply });
  } catch (err) {
    console.error("ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}

