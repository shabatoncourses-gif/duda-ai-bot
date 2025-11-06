// scripts/autoBuildIndex.js
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// === הגדרות כלליות ===
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_CONTENT_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ חסר מפתח OPENAI_API_KEY בקובץ .env");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// === 🧩 טיפול נכון בכתובות עברית/אנגלית ===
function normalizeUrl(url) {
  try {
    url = url.trim().replace(/\s+/g, "");
    const u = new URL(url);
    u.pathname = encodeURI(decodeURI(u.pathname));
    return u.toString();
  } catch {
    return encodeURI(url);
  }
}

// === קריאת Sitemap עם headers אמינים ===
async function getUrlsFromSitemap(sitemapUrl) {
  console.log(`📥 קורא sitemap: ${sitemapUrl}`);
  const res = await fetch(sitemapUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
      "Accept": "application/xml,text/xml,*/*;q=0.9",
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Connection": "keep-alive",
    },
  });

  if (res.status === 403) {
    console.warn(`🚫 חסימת גישה ל-sitemap (${sitemapUrl}) — ייתכן שהאתר חוסם בוטים`);
  }

  if (!res.ok) throw new Error(`❌ שגיאה בקריאת sitemap (${res.status})`);

  const xml = await res.text();
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  const urls = matches.map((m) => m[1].trim()).filter(Boolean);
  console.log(`🔗 נמצאו ${urls.length} דפים.`);
  return urls;
}

// === Fetch בטוח עם תמיכה בעברית וחסימות ===
async function safeFetch(url, retries = 3) {
  const cleaned = normalizeUrl(url);
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(cleaned, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "he,en;q=0.9",
          "Connection": "keep-alive",
        },
      });

      if (res.status === 404) {
        const altUrl = encodeURI(url);
        if (altUrl !== cleaned) {
          console.warn(`🌀 ניסיון נוסף ל-${altUrl}`);
          const retry = await fetch(altUrl);
          if (retry.ok) return retry;
        }
        console.warn(`🚫 דף לא נמצא (${res.status}): ${url}`);
        return null;
      }

      if (res.status === 403) {
        console.warn(`⚠️ חסימה זמנית ב-${url} — ממתין ל-retry`);
        await delay(3000);
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      console.warn(`⚠️ שגיאת חיבור (${i + 1}/${retries}) עבור ${url}: ${err.message}`);
      await delay(3000 + Math.random() * 1500);
    }
  }

  // 🔁 Fallback: ניסיון דרך proxy פשוט (אם קיים)
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleaned)}`;
    console.log(`🔁 ניסיון גיבוי דרך proxy: ${proxyUrl}`);
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      return { ok: true, text: async () => json.contents };
    }
  } catch (proxyErr) {
    console.warn(`❌ גם proxy נכשל (${url}): ${proxyErr.message}`);
  }

  console.error(`❌ נכשל לאחר ${retries} ניסיונות (${url})`);
  return null;
}

// === חילוץ טקסט משמעותי בלבד ===
function extractSmartContent(html) {
  const $ = cheerio.load(html);
  [
    "header", "footer", "nav", ".menu", ".breadcrumb", ".breadcrumbs",
    ".sidebar", ".footer", ".header", ".navbar", ".topbar",
    "script", "style", "noscript", "form"
  ].forEach((sel) => $(sel).remove());

  $("a").each((_, el) => {
    const txt = $(el).text().trim();
    if (txt.length < 3 || /^[|›»•\s]+$/.test(txt)) $(el).remove();
  });

  const title = $("title").text().trim() || $("h1").first().text().trim();
  const desc = $('meta[name="description"]').attr("content") || "";

  const parts = [];
  $("h1,h2,h3,h4,h5,h6,p,li,blockquote").each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length > 15) parts.push(t);
  });

  const unique = Array.from(new Set(parts));
  const fullText = [desc, ...unique].join(" ").replace(/\s+/g, " ").trim();
  return { title: title || "ללא כותרת", text: fullText.slice(0, 7000) };
}

// === יצירת embedding לכל דף ===
async function processPage(url) {
  try {
    const res = await safeFetch(url);
    if (!res) return null;

    const html = await res.text();
    const { title, text } = extractSmartContent(html);

    if (!text || text.length < 80) {
      console.log(`⚠️ דף קצר מדי: ${url}`);
      return null;
    }

    const embedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    console.log(`✅ ${url}`);
    return { url, title, text: text.slice(0, 300), vector: embedding.data[0].embedding };
  } catch (err) {
    console.warn(`❌ ${url} => ${err.message}`);
    return null;
  }
}

// === העלאה ל-GitHub ===
async function uploadToGitHub(filePath, message) {
  try {
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      console.warn("⚠️ חסרים פרטי GitHub (לא יועלה)");
      return;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const encoded = Buffer.from(content).toString("base64");
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/data/${path.basename(filePath)}?ref=${GITHUB_BRANCH}`;
    const headers = { Authorization: `token ${GITHUB_TOKEN}`, "Content-Type": "application/json" };

    let sha = null;
    const existing = await fetch(url, { headers });
    if (existing.ok) sha = (await existing.json()).sha;

    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ message, content: encoded, branch: GITHUB_BRANCH, sha }),
    });

    if (!res.ok) throw new Error(await res.text());
    console.log(`📤 הועלה ל-GitHub: ${path.basename(filePath)}`);
  } catch (err) {
    console.error("❌ שגיאת העלאה:", err.message);
  }
}

// === תהליך האינדוקס בפועל ===
export async function buildIndex(name, sitemapUrl, batchSize = 40) {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const indexPath = path.join(dataDir, `${name.toLowerCase()}_index.json`);
  const donePath = path.join(dataDir, `${name.toLowerCase()}_done.json`);
  const failedPath = path.join(dataDir, `${name.toLowerCase()}_failed.json`);

  const urls = await getUrlsFromSitemap(sitemapUrl);
  let done = fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, "utf8")) : [];
  let failed = fs.existsSync(failedPath) ? JSON.parse(fs.readFileSync(failedPath, "utf8")) : [];
  let pages = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : [];

  const pending = urls.filter((u) => !done.includes(u) && !failed.includes(u));
  console.log(`🕓 נותרו ${pending.length} דפים לאינדוקס`);

  const batch = pending.slice(0, batchSize);
  let count = 0;

  for (const url of batch) {
    const page = await processPage(url);
    if (page) {
      pages.push(page);
      count++;
      done.push(url);
    } else {
      failed.push(url);
    }

    fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
    fs.writeFileSync(donePath, JSON.stringify(done, null, 2));
    fs.writeFileSync(failedPath, JSON.stringify(failed, null, 2));
  }

  await uploadToGitHub(indexPath, `🤖 עדכון ${name} (${done.length}/${urls.length})`);
  await uploadToGitHub(donePath, `📘 שמירת התקדמות ${name}`);
  await uploadToGitHub(failedPath, `❗ רשימת כשלונות ${name}`);

  console.log(`✅ ${name} הסתיים (${count} נוספו, ${done.length}/${urls.length})`);
  return pending.length > batchSize;
}

// === ריצה מלאה ===
export async function runFullIndexing(name, sitemapUrl, batchSize = 40) {
  console.log(`🏁 מתחיל אינדוקס מלא ל-${name}`);
  let more = true;
  while (more) {
    more = await buildIndex(name, sitemapUrl, batchSize);
    if (more) {
      console.log("⏳ מחכה 5 שניות לפני קבוצה הבאה...");
      await delay(5000);
    }
  }
  console.log(`✅ אינדוקס ${name} הסתיים בהצלחה`);
}

// === זיהוי ריצה ישירה ===
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const name = process.argv[2] || "Shabaton";
    const sitemap = process.argv[3] || "https://www.shabaton.online/sitemap.xml";
    const batchSize = Number(process.env.BATCH_SIZE) || 40;
    console.log(`🚀 מריץ אינדוקס ישיר עבור ${name}`);
    await runFullIndexing(name, sitemap, batchSize);
  })();
}
