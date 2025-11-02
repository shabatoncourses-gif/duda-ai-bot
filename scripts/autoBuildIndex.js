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
  console.error("❌ חסר מפתח OPENAI_API_KEY");
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

// === חילוץ תוכן רלוונטי ===
function extractSmartContent(html) {
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const desc = $('meta[name="description"]').attr("content") || "";
  const h1 = $("h1").map((_, el) => $(el).text().trim()).get().join(". ");
  const text = $("p, h2, h3, li")
    .map((_, el) => $(el).text().trim())
    .get()
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { title: title || h1 || "ללא כותרת", text: [desc, h1, text].join(" ").slice(0, 7000) };
}

// === יצירת embedding ===
async function processPage(url) {
  try {
    const res = await safeFetch(url);
    if (!res) return null;
    const html = await res.text();
    const { title, text } = extractSmartContent(html);
    if (!text || text.length < 50) {
      console.log(`⚠️ דילוג על דף קצר/ריק: ${url}`);
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
    if (!GITHUB_TOKEN || !GITHUB_REPO) return console.warn("⚠️ חסרים פרטי GitHub");
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

// === תהליך אינדוקס ===
async function buildIndex(name, sitemapUrl, batchSize = 40) {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const indexPath = path.join(dataDir, `${name.toLowerCase()}_index.json`);
  const donePath = path.join(dataDir, `${name.toLowerCase()}_done.json`);

  const urls = await getUrlsFromSitemap(sitemapUrl);
  let done = fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, "utf8")) : [];
  let pages = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : [];

  const pending = urls.filter((u) => !done.includes(u));
  console.log(`🕓 נותרו ${pending.length} דפים לאינדוקס`);

  const batch = pending.slice(0, batchSize);
  let count = 0;

  for (const url of batch) {
    const page = await processPage(url);
    if (page) {
      pages.push(page);
      count++;
    }
    done.push(url);
    fs.writeFileSync(indexPath, JSON.stringify(pages));
    fs.writeFileSync(donePath, JSON.stringify(done));
  }

  await uploadToGitHub(indexPath, `🤖 עדכון ${name} (${done.length}/${urls.length})`);
  await uploadToGitHub(donePath, `📘 שמירת התקדמות ${name}`);

  console.log(`✅ ${name} הסתיים (${count} נוספו, ${done.length}/${urls.length})`);
}

// === הרצה מקומית ===
if (process.argv[1].includes("autoBuildIndex.js")) {
  (async () => {
    await buildIndex("Shabaton", "https://www.shabaton.online/sitemap.xml", 40);
    await buildIndex("Morim", "https://www.morim.boutique/sitemap.xml", 40);
    console.log("🎉 כל האינדוקסים הושלמו!");
  })();
}
