// pages/api/chat.js
export const config = { runtime: "nodejs" };
export const dynamic = "force-dynamic";

import dotenv from "dotenv";
dotenv.config();
import OpenAI from "openai";

/* ---------------------------------------------------
   Utility Functions
--------------------------------------------------- */

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
  let dot = 0, na = 0, nb = 0;
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
      .replace(/(למידה מרחוק|קורסים בלמידה מרחוק)/gi, "")
      .replace(/(קורסים|מאמרים|צרו קשר|אודות|כניסה|מורים)/gi, "")
  );
}

/* ---------------------------------------------------
   Load Index Files
--------------------------------------------------- */

async function loadIndexes() {
  const base =
    "https://raw.githubusercontent.com/shabatoncourses-gif/duda-ai-bot/main/data";

  const files = [
    "shabaton_index_part1.json",
    "shabaton_index_part2.json",
    "shabaton_index_part3.json",
    "morim_index_part1.json",
  ];

  const sh = [];
  const mo = [];

  for (const f of files) {
    try {
      const res = await fetch(`${base}/${f}`);
      if (!res.ok) continue;
      const arr = await res.json();
      if (Array.isArray(arr)) {
        if (f.startsWith("shabaton")) sh.push(...arr);
        else mo.push(...arr);
      }
    } catch (e) {}
  }

  return [...sh, ...mo];
}

/* ---------------------------------------------------
   Page Type Classification
--------------------------------------------------- */

function classify(p) {
  const u = (p.url || "").toLowerCase();

  if (u.includes("/results-all/")) return "results";
  if (u.includes("thank") || u.includes("contact")) return "blocked";
  if (u.includes("/mosad-index/")) return "blocked";

  const t = normalizeHebrew(p.title || "");
  const h1 = normalizeHebrew(p.h1 || "");

  if (t.includes("מאמר") || h1.includes("מאמר") || u.includes("/article"))
    return "article";

  return "course";
}

/* ---------------------------------------------------
   Soon Courses Detection
--------------------------------------------------- */

const MONTHS = {
  ינואר: 0, פברואר: 1, מרץ: 2, אפריל: 3, מאי: 4, יוני: 5,
  יולי: 6, אוגוסט: 7, ספטמבר: 8, אוקטובר: 9, נובמבר: 10, דצמבר: 11
};

function extractStartDate(text) {
  if (!text) return null;
  const t = text.toLowerCase();

  let month = null;
  for (const [name, num] of Object.entries(MONTHS)) {
    if (t.includes(name)) {
      month = num;
      break;
    }
  }

  const y = /20\d{2}/.exec(t);
  if (!y || month === null) return null;

  return new Date(parseInt(y[0]), month, 1);
}

function isSoon(d) {
  if (!d) return false;
  const now = new Date();
  const m = now.getMonth();
  const next = (m + 1) % 12;
  return d.getMonth() === m || d.getMonth() === next;
}

/* ---------------------------------------------------
   MAIN API HANDLER
--------------------------------------------------- */

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.json({ ok: true });
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "missing message" });

    const cleanMsg = normalizeHebrew(message);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // embedding for ranking
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg,
    });
    const qv = emb.data[0].embedding;

    const all = await loadIndexes();

    /* ---------------------------------------------------
       Rank pages
    --------------------------------------------------- */

    const enriched = all.map((p) => {
      const type = classify(p);
      const fullTitle = [p.title, p.h1, ...(p.h2 || [])]
        .filter(Boolean)
        .join(" ");
      const text = cleanText((p.description || "") + " " + (p.text || ""));
      const score = cosineSimilarity(qv, p.vector || []);
      return { ...p, type, fullTitle, clean: text, score };
    });

    /* -----------------------
       Select best results-all
    ------------------------ */

    const resultsAll = enriched
      .filter((p) => p.type === "results")
      .sort((a, b) => b.score - a.score);

    const bestResults = resultsAll.length ? [resultsAll[0]] : [];

    /* -----------------------
       Courses / Institutions
    ------------------------ */

    const courses = enriched
      .filter((p) => p.type === "course")
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    /* -----------------------
       Soon courses
    ------------------------ */

    const soon = courses
      .filter((p) => /(נפתחים בקרוב|פתיחה|נפתח)/i.test(p.fullTitle))
      .map((p) => ({
        ...p,
        date: extractStartDate(p.fullTitle + " " + p.clean),
      }))
      .filter((p) => isSoon(p.date))
      .sort((a, b) => a.date - b.date);

    const hasSoon = soon.length > 0;

    /* -----------------------
       Articles
    ------------------------ */

    const articles = enriched
      .filter((p) => p.type === "article")
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    /* ---------------------------------------------------
       Build Context (STRICT)
    --------------------------------------------------- */

    const pack = [...bestResults, ...courses, ...soon, ...articles];

    const context = pack
      .map((p, i) => {
        return `
# פריט ${i + 1}
סוג: ${p.type}
כותרת: ${p.fullTitle}
תיאור: ${p.clean}
קישור: ${p.url}
`.trim();
      })
      .join("\n\n");

    /* ---------------------------------------------------
       STRICT SYSTEM MESSAGE — LOCKS THE MODEL
    --------------------------------------------------- */

    const systemPrompt = `
אתה מספק תשובות אך ורק מתוך רשימת הפריטים שסופקו לך.

🔒 חוקים נוקשים:
- אתה רשאי להשתמש אך ורק בפריטים שמופיעים בקונטקסט.
- אסור להמציא פריטים חדשים.
- אסור להמציא results-all נוספים.
- אסור ליצור קישורים שלא ניתנו בקונטקסט.
- אסור להציג URL גולמי – רק כקישור מעוצב.
- אם אין פריט results-all – אל תיצור אחד.
- אם אין פריטי soon – אל תציג שום טקסט על "קורסים הנפתחים בקרוב".
- אסור לכתוב:
  "אין מידע על...", 
  "אין כרגע...", 
  "נכון לעכשיו...", 
  "מומלץ לבדוק...".
- אל תכלול דפי תודה, צור קשר, mosad-index או article לפני קורסים.
- הצג לכל פריט:
  * כותרת מודגשת
  * 1–2 משפטי תיאור
  * כפתור HTML:
    <a href="URL" class="ai-main-btn">למידע נוסף</a>

🔒 סדר מחייב:
1) אם יש results-all – הצג את הראשון בלבד.
2) אחריו – קורסים/מוסדות (type=course).
3) אם יש soon – הצג אותם.
4) לבסוף – מאמרים (type=article).

אתה מציג רק מה שקיבלתי בקונטקסט – שום דבר מעבר.
`;

    /* ---------------------------------------------------
       Model Completion
    --------------------------------------------------- */

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `השאלה: ${message}\n\nדפים רלוונטיים:\n${context}`,
        },
      ],
    });

    const finalAnswer = completion.choices?.[0]?.message?.content || "";

    return res.json({ reply: finalAnswer });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
