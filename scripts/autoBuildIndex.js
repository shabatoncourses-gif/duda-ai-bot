// scripts/autoBuildIndex.js
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// בדיקה למפתח OpenAI
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ חסר מפתח OpenAI בקובץ .env");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * פונקציה להמתנה אקראית בין בקשות
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * קריאת sitemap כולל headers מתאימים
 */
async function getUrlsFromSitemap(sitemapUrl) {
  console.log(`📥 קורא sitemap: ${sitemapUrl}`);

  const response = await fetch(sitemapUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, כמו Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
      Accept: "application/xml,text/xml,*/*;q=0.9"
    }
  });

  if (!response.ok)
    throw new Error(`שגיאה בקריאת sitemap: ${response.status}`);

  const xml = await response.text();
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  const urls = matches.map(m => m[1].trim()).filter(Boolean);

  if (!urls.length) {
    fs.writeFileSync("debug_sitemap.xml", xml);
    throw new Error("❌ לא נמצאו כתובות ב-sitemap (נשמר debug_sitemap.xml לבדיקה)");
  }

  return urls;
}

/**
 * חילוץ תוכן סמנטי מעמוד HTML
 */
function extractSmartContent(html) {
  const $ = cheerio.load(html);

  const title = $("title").text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") || "";
  const metaKeywords = $('meta[name="keywords"]').attr("content") || "";

  const h1 = $("h1").map((_, el) => $(el).text().trim()).get().join(". ");
  const h2 = $("h2").map((_, el) => $(el).text().trim()).get().join(". ");
  const paragraphs = $("p").map((_, el) => $(el).text().trim()).get().join(" ");
  const lists = $("li").map((_, el) => $(el).text().trim()).get().join(", ");

  const combined = `
    ${title}
    ${metaDesc}
    ${metaKeywords}
    ${h1}
    ${h2}
    ${paragraphs}
    ${lists}
  `
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);

  return {
    title: title || h1 || "ללא כותרת",
    meta: { description: metaDesc, keywords: metaKeywords },
    text: combined
  };
}

/**
 * בקשה בטוחה עם retry למניעת 403
 */
async function safeFetch(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, כמו Gecko) Chrome/127.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
          "Connection": "keep-alive",
          "Upgrade-Insecure-Requests": "1"
        }
      });

      if (response.status === 403) {
        console.warn(`🚫 גישה נחסמה (403): ${url} — ניסיון ${i + 1}/${retries}`);
        await delay(1500 + Math.random() * 2000);
        continue;
      }

      if (!response.ok) throw new Error(`סטטוס ${response.status}`);
      return response;
    } catch (err) {
      console.warn(`⚠️ שגיאה בגישה ל-${url}: ${err.message}`);
      await delay(1500 + Math.random() * 2000);
    }
  }
  throw new Error(`❌ נכשל לאחר ${retries} ניסיונות (${url})`);
}

/**
 * בניית אינדקס עם אפשרות המשך מריצה קודמת
 */
async function buildIndex(name, sitemapUrl) {
  console.log(`\n🌐 בונה אינדקס לאתר ${name}...`);

  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  const logsDir = path.join(process.cwd(), "logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

  const outputPath = path.join(dataDir, `${name.toLowerCase()}_index.json`);
  const donePath = path.join(dataDir, `${name.toLowerCase()}_done.json`);

  let urls = await getUrlsFromSitemap(sitemapUrl);
  console.log(`🔗 נמצאו ${urls.length} עמודים.`);

  urls = urls.slice(0, 20); // מגביל ל-20 לבדיקה
  console.log(`📉 מגביל ל-${urls.length} עמודים לבדיקה.\n`);

  // טעינת רשימת כתובות שכבר עובדו
  let doneUrls = [];
  if (fs.existsSync(donePath)) {
    doneUrls = JSON.parse(fs.readFileSync(donePath, "utf8"));
    console.log(`📁 נמצא קובץ ריצה קודמת — ${doneUrls.length} עמודים כבר עובדו.`);
  }

  const pages = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, "utf8"))
    : [];

  let blocked403 = 0;
  let skippedShort = 0;
  let errors = 0;

  for (const url of urls) {
    if (doneUrls.includes(url)) {
      console.log(`⏩ מדלג (כבר עובד בעבר): ${url}`);
      continue;
    }

    console.log(`📄 סורק: ${url}`);
    try {
      const response = await safeFetch(url, 3);
      const html = await response.text();
      const { title, text, meta } = extractSmartContent(html);

      if (!text || text.length < 50) {
        console.log(`⚠️ תוכן קצר מדי, מדלג על: ${url}`);
        skippedShort++;
        continue;
      }

      const embedding = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: text
      });

      pages.push({
        url,
        title,
        meta,
        text: text.slice(0, 300),
        vector: embedding.data[0].embedding
      });

      doneUrls.push(url);

      fs.writeFileSync(outputPath, JSON.stringify(pages, null, 2), "utf8");
      fs.writeFileSync(donePath, JSON.stringify(doneUrls, null, 2), "utf8");

      console.log(`✅ נוסף לאינדקס (${pages.length}/${urls.length})`);
      await delay(700 + Math.random() * 1300);
    } catch (err) {
      if (err.message.includes("403")) blocked403++;
      else errors++;
      console.warn(`⚠️ ${err.message}`);
    }
  }

  // תיעוד ללוג
  const logPath = path.join(logsDir, "index-log.txt");
  const logEntry = `
=== ${new Date().toLocaleString("he-IL")} ===
📁 אתר: ${name}
סה״כ עמודים מקוריים: ${urls.length}
✅ נוצרו בהצלחה: ${pages.length}
🚫 חסומים (403): ${blocked403}
⚠️ תוכן קצר: ${skippedShort}
💥 שגיאות אחרות: ${errors}
📄 קובץ: ${outputPath}
----------------------------------------
`;
  fs.appendFileSync(logPath, logEntry, "utf8");

  console.log(`\n📊 סיכום אינדוקס לאתר ${name}:`);
  console.log(`✅ נוצר בהצלחה: ${outputPath}`);
  console.log(`📦 סה״כ עמודים באינדקס: ${pages.length}`);
  console.log(`🚫 נחסמו (403): ${blocked403}`);
  console.log(`⚠️ דילוגים על תוכן קצר: ${skippedShort}`);
  console.log(`💥 שגיאות אחרות: ${errors}`);
  console.log(`🪵 נשמר בלוג: ${logPath}\n`);
}

/**
 * הרצה בפועל
 */
(async () => {
  try {
    await buildIndex("Shabaton", "https://www.shabaton.online/sitemap.xml");
    await buildIndex("Morim", "https://www.morim.boutique/sitemap.xml");
    console.log("🎉 האינדוקס הושלם בהצלחה!");
  } catch (err) {
    console.error("❌ שגיאה כללית:", err.message);
  }
})();
