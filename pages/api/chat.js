// pages/api/chat.js
export const config = { runtime: "nodejs" };
export const dynamic = "force-dynamic";

import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";

// ===== Cache (10 דקות) =====
const cache = { data: null, timestamp: 0, ttl: 10 * 60 * 1000 };

// ===== פונקציות עזר =====
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i], bi = b[i];
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function normalizeHebrew(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "")        // ניקוד
    .replace(/[^\p{L}\p{N}\s]/gu, " ")      // רק אותיות/מספרים/רווחים
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
        .replace(/^[לבכמוהשה]/, "")            // ל / ב / כ / מ / ו / ה / ש בתחילת מילה
        .replace(/(יים|ים|ות|ית|יי|י)$/, "")   // סיומות ריבוי/שיוך
    )
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i);
}

// ניקוי טקסט מתפריטים / עלון / צור קשר
function removeMenuText(text) {
  if (!text) return "";
  return text
    .replace(/רוצים להיות מעודכנים ? הרשמו לעלון שבתון.*?!/gi, "")
    .replace(/לוח מועדי קורסים/gi, "")
    .replace(/צרו קשר|יצירת קשר|טלפונים|התקשרו אלינו/gi, "")
    .replace(/(\||›|»|<|>|\[|\]|\(|\)).{0,20}(https?:\/\/|www\.|shabaton|morim)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ===== מיפוי חודשים =====
const MONTHS_MAP = {
  ינואר: 1, פברואר: 2, מרץ: 3, אפריל: 4, מאי: 5, יוני: 6,
  יולי: 7, אוגוסט: 8, ספטמבר: 9, אוקטובר: 10, נובמבר: 11, דצמבר: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
};

function extractStartDate(str) {
  if (!str) return null;
  const text = str.toLowerCase();
  let monthNum = null;
  for (const [m, n] of Object.entries(MONTHS_MAP)) {
    if (text.includes(m)) { monthNum = n; break; }
  }
  const y = text.match(/20\d{2}/);
  const yearNum = y ? parseInt(y[0]) : null;
  if (!monthNum || !yearNum) return null;
  return new Date(yearNum, monthNum - 1, 1);
}

// ===== ערים / אזורים לחיזוק =====
const CITY_KEYWORDS = [
  "תל אביב","תל-אביב","חיפה","ירושלים","באר שבע","באר-שבע",
  "פתח תקוה","פתח-תקוה","רחובות","מודיעין","מודיעים","חולון",
  "בת ים","בת-ים","אשדוד","אשקלון","נהריה","נתניה","כפר סבא","כפר-סבא",
  "רעננה","פרדס חנה","פרדס-חנה","חדרה","חיפה"
];

function extractCitiesFromQuery(text) {
  const t = normalizeHebrew(text);
  const result = [];
  for (const city of CITY_KEYWORDS) {
    const normCity = normalizeHebrew(city);
    if (t.includes(normCity)) result.push(normCity);
  }
  return result.length ? result : null;
}

// ===== H2 שאסור להחשיב ככותרות קורס =====
const IGNORED_H2_PATTERNS = [
  /רוצים להיות מעודכנים/i,
  /לוח מועדי קורסים/i,
  /צרו קשר/i,
  /יצירת קשר/i
];

// בחירת כותרת המציגה קורס/דף
function pickDisplayTitle(page, keywords) {
  const h2Arr = Array.isArray(page.h2) ? page.h2 : [];
  const normKeywords = (keywords || []).map(normalizeHebrew);

  // קודם חיפוש h2 שנראה כמו כותרת קורס
  const goodH2 = h2Arr.find((h2) => {
    const nh = normalizeHebrew(h2);
    if (!nh) return false;
    if (IGNORED_H2_PATTERNS.some((re) => re.test(h2))) return false;
    if (nh.includes("קורס")) return true;
    return normKeywords.some((kw) => kw && nh.includes(kw));
  });

  if (goodH2) return goodH2.trim();
  if (page.h1 && page.h1.trim()) return page.h1.trim();
  if (page.title && page.title.trim()) return page.title.trim();
  return "קורס / דף רלוונטי";
}

// ===== טעינת אינדקסים =====
async function loadIndexes() {
  if (cache.data && Date.now() - cache.timestamp < cache.ttl) {
    console.log("♻️ Using cached indexes");
    return cache.data;
  }

  console.log("🌐 Fetching fresh indexes from GitHub...");
  const base = "https://raw.githubusercontent.com/shabatoncourses-gif/duda-ai-bot/main/data";
  const files = [
    "shabaton_index_part1.json",
    "shabaton_index_part2.json",
    "shabaton_index_part3.json",
    "morim_index_part1.json",
  ];

  const shabatonAll = [];
  const morimAll = [];

  for (const f of files) {
    const url = `${base}/${encodeURI(f)}`;
    try {
      const res = await fetch(url);
      console.log(`📥 Fetch ${f} → ${res.status}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length) {
        if (f.startsWith("shabaton")) shabatonAll.push(...data);
        else if (f.startsWith("morim")) morimAll.push(...data);
      }
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
    return res.status(200).json({ message: "✅ /api/chat פעיל." });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "❌ POST בלבד" });
  }

  try {
    console.log("💬 Incoming request to /api/chat");
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "❌ חסר message" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const cleanMsg = normalizeHebrew(message);
    const keywords = extractKeywordsHeb(cleanMsg);
    const citiesInQuery = extractCitiesFromQuery(message);
    const queryHasCourseWord = /קורס|קורסים/.test(cleanMsg);

    // === Embedding לשאילתה ===
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg
    });
    const qv = emb.data[0].embedding;

    // === אינדקסים ===
    const { shabatonIndex, morimIndex } = await loadIndexes();
    const allPagesRaw = [
      ...shabatonIndex.map(p => ({ ...p, source: "Shabaton" })),
      ...morimIndex.map(p => ({ ...p, source: "Morim" }))
    ];

    // סינון דפי תודה / צור קשר
    const allPages = allPagesRaw.filter((p) => {
      const url = (p.url || "").toLowerCase();
      const t = normalizeHebrew((p.title || "") + " " + (p.h1 || ""));
      if (!url) return false;
      if (url.includes("/thanks") || url.includes("thank")) return false;
      if (url.includes("contact")) return false;
      if (t.includes("תודה") && t.includes("הרשמת")) return false;
      return true;
    });

    const now = new Date();
    const currentMonth = now.getMonth();     // 0–11
    const currentYear = now.getFullYear();

    // === דירוג משוקלל ===
    let ranked = allPages
      .map((p) => {
        const url = (p.url || "").toLowerCase();
        const title = normalizeHebrew(p.title || "");
        const h1 = normalizeHebrew(p.h1 || "");
        const h2Arr = Array.isArray(p.h2) ? p.h2 : [];
        const h2Text = normalizeHebrew(h2Arr.join(" "));
        const description = normalizeHebrew(p.description || "");
        const text = removeMenuText(normalizeHebrew(p.text || ""));

        const baseSim = cosineSimilarity(qv, p.vector);
        let score = baseSim;

        const isResultsPage =
          url.includes("/results-all/") ||
          url.includes("/search-results-");

        // 1. קדימות ל-results-all כששאלה כללית
        if (isResultsPage && queryHasCourseWord) {
          score += 0.6;
        } else if (isResultsPage) {
          score += 0.3;
        }

        // 2. הורדת קדימות ל-mosad-index
        if (url.includes("/mosad-index/")) {
          score -= 0.4;
        }

        // 3. חיזוק דפי קורס/מוסד עם "קורס" בכותרות
        const hasKursWord =
          title.includes("קורס") ||
          h1.includes("קורס") ||
          h2Text.includes("קורס");

        if (queryHasCourseWord && hasKursWord) {
          score += 0.35;
        }

        // 4. חיזוק לפי ערים מהשאלה
        if (citiesInQuery && citiesInQuery.length) {
          const pageTextForCity = `${title} ${h1} ${h2Text} ${description} ${text}`;
          const np = normalizeHebrew(pageTextForCity);
          let cityBoost = 0;
          for (const c of citiesInQuery) {
            if (np.includes(c)) cityBoost += 0.4;
          }
          score += cityBoost;
        }

        // 5. זיהוי "נפתחים בקרוב" + תאריך
        let isSoonCourse = false;
        const headerText = `${p.title || ""} ${p.h1 || ""} ${h2Arr.join(" ")}`;
        if (/(נפתח|יפתח|פתיחה|נפתחים בקרוב)/i.test(headerText)) {
          isSoonCourse = true;
          const d = extractStartDate(headerText);
          if (d) {
            const m = d.getMonth();
            const y = d.getFullYear();
            const isCurrent = (m === currentMonth && y === currentYear);
            const isNext =
              (y === currentYear && m === currentMonth + 1) ||
              (y === currentYear + 1 && currentMonth === 11 && m === 0);

            if (isCurrent || isNext) {
              score += 0.5;   // נפתח בקרוב בחודש הנוכחי / הבא
            } else {
              score -= 0.1;   // נפתח אבל רחוק בזמן
            }
          }
        }

        // 6. חיזוק לפי מילים מהשאלה בכותרת / תיאור
        const keyMatchScore = keywords.reduce((acc, kw) => {
          if (!kw) return acc;
          if (title.includes(kw)) acc += 0.25;
          if (h1.includes(kw)) acc += 0.2;
          if (h2Text.includes(kw)) acc += 0.2;
          if (description.includes(kw)) acc += 0.1;
          return acc;
        }, 0);

        score += keyMatchScore;

        return {
          ...p,
          score,
          isResultsPage,
          isSoonCourse
        };
      })
      .filter((p) => p.score > 0.25)
      .sort((a, b) => b.score - a.score);

    if (!ranked.length) {
      return res.status(200).json({ reply: "לא נמצאו תוצאות רלוונטיות." });
    }

    // "נפתחים בקרוב" – סינון לחודש נוכחי + הבא בלבד (משמש רק כחיזוק, לא נציין אם אין)
    const soonCoursesFiltered = ranked.filter((p) => p.isSoonCourse).filter((p) => {
      const h2Arr = Array.isArray(p.h2) ? p.h2 : [];
      const headerText = `${p.title || ""} ${p.h1 || ""} ${h2Arr.join(" ")}`;
      const d = extractStartDate(headerText);
      if (!d) return false;
      const m = d.getMonth();
      const y = d.getFullYear();
      const isCurrent = (m === currentMonth && y === currentYear);
      const isNext =
        (y === currentYear && m === currentMonth + 1) ||
        (y === currentYear + 1 && currentMonth === 11 && m === 0);
      return isCurrent || isNext;
    });
    // (אין כאן טקסט "אין קורסים נפתחים בקרוב" – רק חיזוק בדירוג)

    // סידור: קודם results-all, אחר כך שאר הדפים
    const resultsPages = ranked.filter((p) => p.isResultsPage);
    const nonResultsPages = ranked.filter((p) => !p.isResultsPage);
    const finalList = [...resultsPages, ...nonResultsPages].slice(0, 8);

    // === בניית קונטקסט HTML לכרטיסי קורסים/דפים ===
    const contextHtml = finalList.map((p) => {
      const displayTitle = pickDisplayTitle(p, keywords);
      const cleanedText = removeMenuText(p.text || "");
      const shortDescSource = p.description || cleanedText;
      const shortDesc = (shortDescSource || "").slice(0, 180).trim();
      const decodedUrl = decodeURI(p.url || "#");

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
            ${displayTitle}
          </div>
          <div style="font-size:0.95em; color:#444; line-height:1.5;">
            ${shortDesc}
          </div>
          <a href="${decodedUrl}" target="_blank" rel="noopener noreferrer"
            style="
              display:inline-block;
              margin-top:10px;
              background:#0078ff;
              color:white;
              padding:6px 12px;
              border-radius:8px;
              font-weight:bold;
              text-decoration:none;
            ">
            למידע נוסף ↗️
          </a>
        </div>
      `;
    }).join("");

    // === קריאה למודל – עם הוראות לגבי כפתורים / נפתחים בקרוב ===
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content: `
אתה עוזר חכם המספק תשובות על קורסים ודפי מידע ממאגרי "שבתון" ו-"Morim Boutique" בלבד.
ענה תמיד בעברית, בפסקאות קצרות וברורות.
אל תציג בשום אופן URL גולמי, אלא רק כפתור "למידע נוסף ↗️" כפי שמופיע בקונטקסט.
השתמש במבנה ה-HTML שקיבלת (כרטיסים וכפתור), אל תוסיף סוגריים מיותרים ואל תמציא עיצוב אחר.
אם אין בקונטקסט קורסים נפתחים בקרוב – אל תכתוב משפט על כך, פשוט אל תזכיר סעיף "קורסים הנפתחים בקרוב".
        `.trim()
        },
        {
          role: "user",
          content: `
שאלה של הגולש: ${message}

להלן דפים רלוונטיים בפורמט כרטיסים HTML, השתמש בהם כדי לענות:
${contextHtml}
          `.trim()
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
