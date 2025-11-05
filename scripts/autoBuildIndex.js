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

// === 🧩 טיפול מתקדם בכתובות עברית/אנגלית ===function normalizeUrl(url) {
  try {
    if (!url) return "";
    let clean = url.trim();

    // הוספת https אם חסר
    if (!/^https?:\/\//i.test(clean)) clean = "https://" + clean;

    // ניקוי רווחים, סימני שאלה מיותרים, תווים לא חוקיים
    clean = clean.replace(/\s+/g, "").replace(/(?<=https?:)\/{3,}/, "//");

    return clean;
  } catch (err) {
    console.warn("⚠️ normalizeUrl failed:", err.message, url);
    return url;
  }
}


// === קריאת Sitemap ===
async function getUrlsFromSitemap(sitemapUrl) {
  console.log(`📥 קורא sitemap: ${sitemapUrl}`);
  const res = await fetch(sitemapUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36",
      "Accept": "application/xml,text/xml,*/*;q=0.9",
      "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
      "Cache-Control": "no-cache",
    },
  });
  if (!res.ok) throw new Error(`❌ שגיאה בקריאת sitemap (${res.status})`);
  const xml = await res.text();
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  const urls = matches.map((m) => m[1].trim()).filter(Boolean);
  console.log(`🔗 נמצאו ${urls.length} דפים.`);
  return urls;
}

// === safeFetch יציב ===
async function safeFetch(url, retries = 3) {
  const cleaned = normalizeUrl(url);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await delay(1500 + Math.random() * 2500);

      const res = await fetch(cleaned, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "he,en-US;q=0.9,en;q=0.8",
          "Accept-Charset": "utf-8", // ✅ קריטי
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
        timeout: 20000,
      });

      if (res.status >= 500) throw new Error(`Server error ${res.status}`);
      if (res.status === 404) {
        console.warn(`🚫 דף לא נמצא (${res.status}): ${url}`);
        return null;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      return res;

    } catch (err) {
      console.warn(`⚠️ ניסיון ${attempt}/${retries} נכשל עבור ${url}: ${err.message}`);
      if (attempt < retries) await delay(4000 + Math.random() * 2000);
      else console.error(`❌ נכשל לצמיתות: ${url}`);
    }
  }
  return null;
}


// === חילוץ תוכן חכם עם סינון תפריטים ===
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
    if (t && t.length > 15 && !/^(\s*קורסים\s*|\s*מאמרים\s*|\s*כניסה\s*)$/i.test(t)) {
      parts.push(t);
    }
  });

  const unique = Array.from(new Set(parts));
  const fullText = [desc, ...unique].join(" ").replace(/\s+/g, " ").trim();
  return { title: title || "ללא כותרת", text: fullText.slice(0, 7000) };
}

// === יצירת embedding ===
async function processPage(url) {
  try {
    const res = await safeFetch(url);
    if (!res) return null;

    const html = await res.text();
    const { title, text } = extractSmartContent(html);
    if (!text || text.length < 50) {
      console.log(`⚠️ דילוג על דף קצר או ריק: ${url}`);
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

// === בניית אינדקס ===
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

// === ריצה מלאה עד לסיום ===
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
  const name = process.argv[2] || "Shabaton";
  const sitemap = process.argv[3] || "https://www.shabaton.online/sitemap.xml";
  const batchSize = Number(process.env.BATCH_SIZE) || 40;

  console.log(`🚀 מריץ אינדוקס ישיר עבור ${name}`);
  runFullIndexing(name, sitemap, batchSize);
}
