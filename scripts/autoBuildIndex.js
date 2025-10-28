// scripts/autoBuildIndex.js
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ חסר מפתח OpenAI בקובץ .env");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===== פונקציות עזר =====
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getBrowserHeaders(url) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": new URL(url).origin
  };
}

async function getUrlsFromSitemap(sitemapUrl) {
  console.log(`📥 קורא sitemap: ${sitemapUrl}`);
  const res = await fetch(sitemapUrl, { headers: getBrowserHeaders(sitemapUrl) });
  if (!res.ok) throw new Error(`שגיאה בקריאת sitemap: ${res.status}`);

  const xml = await res.text();
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  const urls = matches.map(m => m[1].trim()).filter(Boolean);
  if (!urls.length) throw new Error("❌ לא נמצאו כתובות ב-sitemap");

  return urls;
}

function extractSmartContent(html) {
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const desc = $('meta[name="description"]').attr("content") || "";
  const h1 = $("h1").map((_, el) => $(el).text().trim()).get().join(". ");
  const p = $("p").map((_, el) => $(el).text().trim()).get().join(" ");
  const text = `${title} ${desc} ${h1} ${p}`.replace(/\s+/g, " ").trim().slice(0, 6000);
  return { title: title || h1 || "ללא כותרת", text };
}

async function safeFetch(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: getBrowserHeaders(url) });
      if (res.status === 403) {
        console.warn(`🚫 403: ${url} (${i + 1}/${retries})`);
        await delay(1500);
        continue;
      }
      if (!res.ok) throw new Error(`סטטוס ${res.status}`);
      return res;
    } catch (err) {
      console.warn(`⚠️ ${err.message}`);
      await delay(1000);
    }
  }
  throw new Error(`❌ נכשל לאחר ${retries} ניסיונות (${url})`);
}

// ===== אינדוקס עיקרי =====
async function buildIndex(name, sitemapUrl, maxBatch = 300) {
  console.log(`\n🌐 אינדוקס ${name} (עד ${maxBatch} דפים)`);

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

  const outputPath = path.join(dataDir, `${name.toLowerCase()}_index.json`);
  const donePath = path.join(dataDir, `${name.toLowerCase()}_done.json`);

  const urls = await getUrlsFromSitemap(sitemapUrl);
  console.log(`🔗 נמצאו ${urls.length} דפים ב-sitemap.`);

  let doneUrls = [];
  if (fs.existsSync(donePath)) {
    doneUrls = JSON.parse(fs.readFileSync(donePath, "utf8"));
    console.log(`📁 נמצאו ${doneUrls.length} דפים שכבר עובדו.`);
  }

  const pages = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, "utf8"))
    : [];

  const remaining = urls.filter(u => !doneUrls.includes(u));
  const toProcess = remaining.slice(0, maxBatch);

  console.log(`⚙️ מעבד עכשיו ${toProcess.length}/${remaining.length} דפים שנותרו...`);

  let blocked = 0, short = 0, errors = 0;

  for (const url of toProcess) {
    console.log(`📄 סורק: ${url}`);
    try {
      const res = await safeFetch(url);
      const html = await res.text();
      const { title, text } = extractSmartContent(html);
      if (!text || text.length < 50) {
        short++;
        continue;
      }

      const emb = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: text
      });

      pages.push({
        url,
        title,
        text: text.slice(0, 300),
        vector: emb.data[0].embedding
      });

      doneUrls.push(url);
      fs.writeFileSync(outputPath, JSON.stringify(pages, null, 2), "utf8");
      fs.writeFileSync(donePath, JSON.stringify(doneUrls, null, 2), "utf8");

      console.log(`✅ ${pages.length}/${urls.length}`);
      await delay(700 + Math.random() * 1300);
    } catch (err) {
      if (err.message.includes("403")) blocked++;
      else errors++;
      console.warn(`⚠️ ${err.message}`);
    }
  }

  if (doneUrls.length >= urls.length) {
    if (fs.existsSync(donePath)) fs.unlinkSync(donePath);
    console.log("🎯 אינדוקס מלא הושלם! הקובץ done.json נמחק.");
  }

  const logPath = path.join(logsDir, "index-log.txt");
  const logEntry = `
=== ${new Date().toLocaleString("he-IL")} ===
📁 אתר: ${name}
סה"כ ב-sitemap: ${urls.length}
✅ נוספו עכשיו: ${toProcess.length}
סה"כ מעובדים: ${doneUrls.length}/${urls.length}
🚫 חסומים: ${blocked}
⚠️ קצרים: ${short}
💥 שגיאות: ${errors}
----------------------------------------
`;
  fs.appendFileSync(logPath, logEntry, "utf8");
  console.log(`🪵 לוג נשמר: ${logPath}`);
}

export { buildIndex };

if (process.argv[1].includes("autoBuildIndex.js")) {
  (async () => {
    try {
      await buildIndex("Shabaton", "https://www.shabaton.online/sitemap.xml", 300);
      await buildIndex("Morim", "https://www.morim.boutique/sitemap.xml", 300);
      console.log("🎉 סיום הרצה");
    } catch (err) {
      console.error("❌ שגיאה כללית:", err.message);
    }
  })();
}
