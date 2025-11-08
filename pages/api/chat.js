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

// ===== זיהוי אזורים ואונליין =====
const REGION_HINTS = [
  { key: "all", terms: ["כל הארץ","result all","results-all"], urlMatch: /results-all/i, boost: 0.35 },
  { key: "merkaz", terms: ["מרכז","תל אביב","תל־אביב","גוש דן"], urlMatch: /results-merkaz/i, boost: 0.25 },
  { key: "sharon", terms: ["שרון"], urlMatch: /results-sharon/i, boost: 0.22 },
  { key: "zafon", terms: ["צפון","חיפה"], urlMatch: /results-zafon/i, boost: 0.22 },
  { key: "darom", terms: ["דרום","שפלה"], urlMatch: /results-shfela-darom/i, boost: 0.22 },
  { key: "zoom", terms: ["זום","אונליין","און ליין","למידה מרחוק","מרחוק"], urlMatch: /(zoom|online|remote|מרחוק)/i, boost: 0.28 },
];

function detectRegionHints(q) {
  const nq = normalizeHebrew(q);
  const hits = new Set();
  for (const r of REGION_HINTS) {
    if (r.terms.some(t => nq.includes(normalizeHebrew(t)))) hits.add(r.key);
  }
  return hits;
}

// ===== מיון לפי תאריכי פתיחה =====
const MONTHS_MAP = {
  ינואר:1, פברואר:2, מרץ:3, אפריל:4, מאי:5, יוני:6,
  יולי:7, אוגוסט:8, ספטמבר:9, אוקטובר:10, נובמבר:11, דצמבר:12,
  jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12,
  דצמ:12, ינ:1, פבר:2, מר:3, אפר:4, יול:7, אוג:8, ספט:9, אוק:10, נוב:11
};

function extractStartDate(str) {
  if (!str) return null;
  const text = str.toLowerCase();
  let monthNum=null, yearNum=null;
  for (const [m,n] of Object.entries(MONTHS_MAP)) if (text.includes(m)) {monthNum=n;break;}
  const y=text.match(/20\d{2}/); if (y) yearNum=parseInt(y[0]);
  return (monthNum&&yearNum)?new Date(yearNum,monthNum-1,1):null;
}

// ===== ניקוי תפריטים =====
function removeMenuText(text) {
  if (!text) return "";
  return text
    .replace(/(\||›|»|<|>|\[|\]|\(|\)).{0,20}(https?:\/\/|www\.|shabaton|morim)/gi, "")
    .replace(/(קורסים|מאמרים|צרו קשר|אודות|כניסה|מורים)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ===== API =====
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") return res.status(200).json({ message: "✅ /api/chat פעיל." });

  try {
    const { message, debug } = req.body || {};
    if (!message) return res.status(400).json({ error: "❌ חסר message." });
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const cleanMsg = normalizeHebrew(message);
    const keywords = extractKeywordsHeb(cleanMsg);
    const regionHits = detectRegionHints(message);
    const infoIntent = /(ביטוח לאומי|שבתון|זכאות|זכויות|מענק|פנסיה|קרן|טופס|תשלום|מידע|FAQ|שאלות נפוצות)/i.test(message);

    const [embFull, embKeys] = await Promise.all([
      client.embeddings.create({ model:"text-embedding-3-small", input: cleanMsg }),
      client.embeddings.create({ model:"text-embedding-3-small", input: keywords.join(" ")||cleanMsg }),
    ]);
    const qvFull = embFull.data[0].embedding;
    const qvKeys = embKeys.data[0].embedding;

    const { shabatonIndex, morimIndex } = await loadIndexes();
    const allPages = [...shabatonIndex.map(p=>({...p,source:"Shabaton"})),...morimIndex.map(p=>({...p,source:"Morim"}))];

    const ranked = allPages.map(p=>{
      const fullText = removeMenuText(normalizeHebrew([
        p.title, p.h1, ...(p.h2||[]), p.description, p.text
      ].filter(Boolean).join(" ")));

      const sim = Math.max(cosineSimilarity(qvFull,p.vector),cosineSimilarity(qvKeys,p.vector));
      let score = sim;

      if (/results-all/i.test(p.url)) score += 0.35;
      if (regionHits.size===0 && /results-all/i.test(p.url)) score += 0.15;
      for (const r of REGION_HINTS) if(regionHits.has(r.key)&&r.urlMatch.test(p.url)) score += r.boost;
      if (infoIntent && p.type==="info") score += 0.3;

      const matched = keywords.filter(kw=>fullText.includes(kw));
      score += matched.length*0.03;
      return {...p,score,matched};
    })
    .filter(p=>p.score>0.25)
    .sort((a,b)=>b.score-a.score);

    let uniqueRanked = ranked.filter((p,i,a)=>a.findIndex(x=>x.url===p.url)===i).slice(0,8);

    // === מיון קורסים נפתחים בקרוב לפי חודשים ===
    const soonCourses = uniqueRanked.filter(p =>
      /(נפתח|יפתח|פתיחה|נפתחים בקרוב)/i.test([p.title,p.h1,...(p.h2||[])].join(" "))
    );
    if (soonCourses.length>0){
      soonCourses.sort((a,b)=>{
        const da=extractStartDate([a.title,a.h1,...(a.h2||[])].join(" "));
        const db=extractStartDate([b.title,b.h1,...(b.h2||[])].join(" "));
        if(!da&&!db)return 0;
        if(!da)return 1;
        if(!db)return -1;
        return da-db;
      });
      const others=uniqueRanked.filter(p=>!soonCourses.includes(p));
      uniqueRanked=[...soonCourses,...others];
    }

    if(uniqueRanked.length===0)
      return res.status(200).json({ reply:"לא נמצאו תוצאות רלוונטיות." });

    // === בניית קונטקסט להצגה ===
    const context = uniqueRanked.map(p=>{
      const H1 = p.h1 || p.title || "פרטים";
      const desc = p.description ? `<div style='font-size:13px;color:#444;'>${p.description}</div>` : "";
      const h2List = (p.h2||[]).filter(Boolean).slice(0,3)
        .map(h=>`• ${h}`).join("<br>");
      const h2Html = h2List?`<div style='margin-top:5px;font-size:13px;color:#333;'>${h2List}</div>`:"";
      return `
        <div style="margin:0 0 10px 0;">
          <div style="font-weight:700;">${H1}</div>
          ${desc}${h2Html}
          <a href="${decodeURI(p.url)}" target="_blank" rel="noopener noreferrer"
            style="display:inline-block;background:#0078ff;color:#fff;padding:6px 10px;
            border-radius:6px;font-weight:bold;text-decoration:none;margin-top:6px;">
            למידע נוסף ↗️
          </a>
        </div>`;
    }).join("");

    // === תשובת GPT ===
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        { role:"system", content:`אתה עוזר חכם המספק תשובות מדויקות מתוך מאגרי שבתון ומורים בלבד. 
        השב בעברית בלבד, בלי להזכיר את שם האתר. 
        הצג קורסים או דפים רלוונטיים עם H1, תיאור קצר וכפתור "למידע נוסף ↗️".
        סדר קורסים נפתחים לפי חודשים.` },
        { role:"user", content:`שאלה: ${cleanMsg}\n\nדפים רלוונטיים:\n${context}` }
      ]
    });

    const reply = completion.choices?.[0]?.message?.content || "לא נמצאה תשובה.";
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("💥 Error /api/chat:", err);
    return res.status(500).json({ error: err.message });
  }
}
