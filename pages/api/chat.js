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

// ===== ניקוי טקסט =====
function normalizeHebrew(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[\u0591-\u05C7]/g, "") // ניקוד
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ===== טעינת אינדקסים עם fallback =====
async function loadIndexes() {
  const now = Date.now();
  if (cache.data && now - cache.timestamp < cache.ttl) return cache.data;

  const repo = process.env.GITHUB_REPO || "shabatoncourses-gif/duda-ai-bot";
  const branch = process.env.GITHUB_BRANCH || "main";
  const token = process.env.GH_CONTENT_TOKEN || process.env.GITHUB_TOKEN || "";

  const baseAPI = `https://api.github.com/repos/${repo}/contents/data`;
  const baseRAW = `https://raw.githubusercontent.com/${repo}/${branch}/data`;

  const indexFiles = [
    "shabaton_index.json",
    "morim_index.json",
    ...Array.from({ length: 20 }, (_, i) => `shabaton_index_part${i + 1}.json`),
    ...Array.from({ length: 20 }, (_, i) => `morim_index_part${i + 1}.json`),
  ];

  async function fetchFile(url, headers = {}) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(res.statusText);
      return await res.json();
    } catch {
      return null;
    }
  }

  const shabatonAll = [];
  const morimAll = [];

  for (const file of indexFiles) {
    let data = null;

    // ניסיון ראשון – דרך GitHub API (דורש token)
    if (token) {
      const apiUrl = `${baseAPI}/${file}?ref=${branch}`;
      const res = await fetch(apiUrl, {
        headers: { Authorization: `token ${token}`, Accept: "application/vnd.github.v3.raw" },
      });
      if (res.ok) {
        data = await res.json();
      }
    }

    // fallback – דרך raw.githubusercontent
    if (!data) {
      const rawUrl = `${baseRAW}/${file}`;
      data = await fetchFile(rawUrl);
    }

    if (data && Array.isArray(data) && data.length > 0) {
      if (file.startsWith("shabaton")) shabatonAll.push(...data);
      if (file.startsWith("morim")) morimAll.push(...data);
      console.log(`📦 נטען ${file} (${data.length})`);
    }
  }

  if (shabatonAll.length === 0 && morimAll.length === 0)
    throw new Error("❌ Failed to load indexes from GitHub or RAW.");

  console.log(`✅ סה״כ שבתון: ${shabatonAll.length} | מורים: ${morimAll.length}`);

  cache.data = { shabatonIndex: shabatonAll, morimIndex: morimAll };
  cache.timestamp = now;
  return cache.data;
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
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: "❌ חסר message." });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const cleanMsg = normalizeHebrew(message);

    // === יצירת embedding לשאילתה ===
    const emb = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: cleanMsg,
    });
    const qv = emb.data[0].embedding;

    // === טעינת האינדקסים (כולל חלקים) ===
    const { shabatonIndex, morimIndex } = await loadIndexes();
    const allPages = [...shabatonIndex, ...morimIndex];

    // === חישוב דמיון ומיון ===
    const ranked = allPages
      .map((p) => {
        const sim = cosineSimilarity(qv, p.vector);
        return { ...p, score: sim };
      })
      .filter((p) => p.score > 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    if (ranked.length === 0)
      return res.status(200).json({ reply: "לא נמצאו תוצאות רלוונטיות." });

    // === בניית הקשר להצגה ===
    const context = ranked
      .map(
        (p) => `
        <div style="margin:0 0 10px 0;">
          <div style="font-weight:700;">${p.h1 || p.title}</div>
          <div style="font-size:13px;color:#444;">${p.description || ""}</div>
          <a href="${decodeURI(p.url)}" target="_blank" rel="noopener noreferrer"
            style="display:inline-block;background:#0078ff;color:#fff;padding:6px 10px;
            border-radius:6px;font-weight:bold;text-decoration:none;margin-top:6px;">
            למידע נוסף ↗️
          </a>
        </div>`
      )
      .join("");

    // === תשובה מסכמת של GPT ===
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.25,
      messages: [
        {
          role: "system",
          content: `אתה עוזר חכם המספק תשובות מתוך מאגרי שבתון ומורים בלבד. 
          השב בעברית בלבד, בלי להזכיר את שם האתר.`,
        },
        { role: "user", content: `שאלה: ${cleanMsg}\n\nדפים רלוונטיים:\n${context}` },
      ],
    });

    const reply = completion.choices?.[0]?.message?.content || "לא נמצאה תשובה.";
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("💥 Error during /api/chat:", err);
    return res.status(500).json({ error: err.message });
  }
}
