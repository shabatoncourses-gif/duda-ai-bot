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
      .replace(/אין קורסים הנפתחים[^\.]+/gi, "")
      .replace(/אם אין[^\.]+לא יוצג/gi, "")
      .replace(/קורסים|מאמרים|צרו קשר|אודות|כניסה|מורים/gi, "")
  );
}

/* -------------------------------------- */
/* Special mappings: ערים ואזורים        */
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

  // ירושלים
  [normalizeHebrew("ירושלים")]: "jerusalem",
  [normalizeHebrew("גוש עציון")]: "jerusalem",
  [normalizeHebrew("מבשרת ציון")]: "jerusalem",
};

/* כותרות יפות */
const REGION_TITLES = {
  sharon: "קורסי צילום בשרון",
  merkaz: "קורסי צילום בתל אביב והמרכז",
  zafon: "קורסי צילום בצפון",
  darom: "קורסי צילום בשפלה ובדרום",
  jerusalem: "קורסי צילום בירושלים והסביבה",
  all: "קורסי צילום בכל הארץ",
};

/* קישורים מדויקים ותקינים לחלוטין */
const PHOTO_RESULTS_URLS = {
  sharon:
    "https://www.shabaton.online/results-Sharon/%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A6%D7%99%D7%9C%D7%95%D7%9D",
  merkaz:
    "https://www.shabaton.online/search-results-merkaz/%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A6%D7%99%D7%9C%D7%95%D7%9D",
  zafon:
    "https://www.shabaton.online/results-Zafon/%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A6%D7%99%D7%9C%D7%95%D7%9D",
  darom:
    "https://www.shabaton.online/results-shfea-darom/%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A6%D7%99%D7%9C%D7%95%D7%9D",
  jerusalem:
    "https://www.shabaton.online/results-jerusalem/%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A6%D7%99%D7%9C%D7%95%D7%9D",
  all:
    "https://www.shabaton.online/results-all/%D7%A7%D7%95%D7%A8%D7%A1%D7%99%20%D7%A6%D7%99%D7%9C%D7%95%D7%9D",
};

function getCitiesForRegion(region) {
  return Object.entries(CITY_TO_REGION)
    .filter(([, r]) => r === region)
    .map(([city]) => city);
}

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
/* Soon                                   */
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

    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg,
    });

    const queryVector = emb.data[0].embedding;

    const all = await loadIndexes();

    const cityMatch = Object.keys(CITY_TO_REGION).find((c) =>
      cleanMsg.includes(c)
    );
    const region = cityMatch ? CITY_TO_REGION[cityMatch] : null;

    // האם השאלה על קורס צילום?
    const hasPhotoQuery =
      cleanMsg.includes(normalizeHebrew("קורס צילום")) ||
      cleanMsg.includes(normalizeHebrew("קורסי צילום")) ||
      (cleanMsg.includes(normalizeHebrew("צילום")) &&
        cleanMsg.includes(normalizeHebrew("קורס")));

    // -----------------------------
    // בניית עמודים עם score וכו'
    // -----------------------------
    const pages = all.map((p) => {
      const type = classifyPage(p);
      const fullTitle =
        [p.title, p.h1, ...(p.h2 || [])].filter(Boolean).join(" ") || "";

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

      if (cityMatch && txt.includes(cityMatch)) score += 0.25;

      return { ...p, type, fullTitle, clean: txt, score };
    });

    const courses = pages
      .filter((p) => p.type === "course")
      .sort((a, b) => b.score - a.score);

    const articles = pages
      .filter((p) => p.type === "article")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    /* ------------------------------------------------------------------ */
    /*  🔵 לוגיקה מיוחדת לשאלות על "קורס צילום" – ללא GPT, רק אינדקס     */
    /* ------------------------------------------------------------------ */

    if (hasPhotoQuery) {
      const courseKeyword = normalizeHebrew("צילום");
      const regionCities = region ? getCitiesForRegion(region) : [];

      // קורסים אמיתיים בלבד (לא ממציאים מוסדות) – רק מתוך האינדקס
      const privateCourses = courses
        .filter((p) => {
          const url = p.url || "";
          const fromRealSite =
            url.includes("shabaton") || url.includes("morim.boutique");

          if (!fromRealSite) return false;

          const txt = p.clean || "";
          const titleNorm = normalizeHebrew(p.fullTitle || p.title || "");
          const hasCourseKeyword =
            txt.includes(courseKeyword) || titleNorm.includes(courseKeyword);
          if (!hasCourseKeyword) return false;

          if (!region) return true;
          // אם יש אזור – מחפשים עיר מהאזור בתוך הטקסט
          return regionCities.some((city) => txt.includes(city));
        })
        .slice(0, 12); // לא להציף יותר מדי

      // קורסים נפתחים בקרוב – עד 3 חודשים קדימה
      const now = new Date();
      const threeMonthsAhead = new Date(
        now.getFullYear(),
        now.getMonth() + 3,
        1
      );

      const soonCourses = privateCourses
        .map((p) => ({
          ...p,
          date: extractStartDate(p.fullTitle + " " + p.clean),
        }))
        .filter((p) => p.date && p.date >= now && p.date < threeMonthsAhead)
        .sort((a, b) => a.date - b.date);

      // בונים HTML ידני, בלי GPT
      const lines = [];

      lines.push("Results #");

      // 1. תוצאת אזור בראש – אם יש אזור
      if (region && PHOTO_RESULTS_URLS[region]) {
        lines.push(REGION_TITLES[region]);
        lines.push(
          `<a href="${PHOTO_RESULTS_URLS[region]}" target="_blank" class="info-button">למידע נוסף ↗️</a>`
        );
        lines.push(""); // שורה ריקה
      }

      // 2. דפים פרטיים – קורסי צילום אמיתיים בלבד
      privateCourses.forEach((p) => {
        const rawUrl = p.url || "";
        const url = rawUrl.startsWith("http")
          ? rawUrl
          : `https://www.shabaton.online${rawUrl}`;

        const title = p.title || p.fullTitle || "קורס צילום";
        lines.push(title);
        lines.push(
          `<a href="${url}" target="_blank" class="info-button">למידע נוסף ↗️</a>`
        );
        lines.push("");
      });

      // 3. קורסים נפתחים בקרוב – אם יש
      if (soonCourses.length > 0) {
        lines.push("קורס
