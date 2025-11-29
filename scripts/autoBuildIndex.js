// scripts/autoBuildIndex.js
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

// ============================================
// 🔧 הגדרות ואימות
// ============================================
const CONFIG = {
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || process.env.GH_CONTENT_TOKEN,
  GITHUB_REPO: process.env.GITHUB_REPO,
  GITHUB_BRANCH: process.env.GITHUB_BRANCH || "main",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  BATCH_SIZE: Number(process.env.BATCH_SIZE) || 40,
  MAX_PER_FILE: 500,
  RETRY_ATTEMPTS: 3,
  BASE_DELAY: 4000,
};

// אימות API Key
if (!CONFIG.OPENAI_API_KEY?.startsWith("sk-")) {
  console.error("❌ חסר או לא תקין OPENAI_API_KEY");
  process.exit(1);
}

const client = new OpenAI({ apiKey: CONFIG.OPENAI_API_KEY });
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// ============================================
// 🌐 טיפול ב-URLs (עברית + אנגלית)
// ============================================
function normalizeUrl(url) {
  try {
    url = url.trim();
    
    // וידוא שיש protocol
    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }
    
    // פענוח מלא של ה-URL אם הוא כבר מקודד
    let decoded = url;
    try {
      // ננסה לפענח עד שאין יותר מה לפענח
      let prev = "";
      while (decoded !== prev) {
        prev = decoded;
        decoded = decodeURIComponent(decoded);
      }
    } catch {
      // אם הפענוח נכשל, נשאר עם המקורי
      decoded = url;
    }
    
    // פיצול ל-parts
    const urlObj = new URL(decoded);
    const pathname = urlObj.pathname;
    
    // קידוד מחדש של ה-pathname בלבד
    const encodedPathname = pathname
      .split('/')
      .filter(Boolean)
      .map(segment => encodeURIComponent(segment))
      .join('/');
    
    // בניית URL חדש
    urlObj.pathname = '/' + encodedPathname;
    
    const result = urlObj.toString();
    
    // לוג אם היה שינוי
    if (result !== url) {
      console.log(`🔗 ${url.substring(0, 80)}...`);
      console.log(`   → ${result.substring(0, 80)}...`);
    }
    
    return result;
    
  } catch (err) {
    console.warn(`⚠️ שגיאה בנרמול URL: ${url.substring(0, 50)}... → ${err.message}`);
    // אם כל השאר נכשל, פשוט נחזיר את המקורי
    return url;
  }
}

// ============================================
// 🎭 User-Agents רנדומליים
// ============================================
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ============================================
// 📡 קריאת Sitemap
// ============================================
async function getUrlsFromSitemap(sitemapUrl) {
  console.log(`\n📥 קורא sitemap: ${sitemapUrl}`);
  
  try {
    const res = await fetch(sitemapUrl, {
      headers: {
        "User-Agent": getRandomUA(),
        "Accept": "application/xml,text/xml,*/*",
        "Accept-Language": "he,en-US;q=0.9,en;q=0.8",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const xml = await res.text();
    
    // תמיכה ב-sitemap index וגם ב-sitemap רגיל
    const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
    const urls = matches
      .map((m) => m[1].trim())
      .filter(Boolean)
      .filter((url) => {
        // סינון URLs לא רלוונטיים
        const lower = url.toLowerCase();
        return !lower.includes("/tag/") && 
               !lower.includes("/author/") &&
               !lower.includes("/page/");
      });

    console.log(`✅ נמצאו ${urls.length} URLs תקינים מה-sitemap`);
    return urls;
  } catch (err) {
    console.error(`❌ שגיאה בקריאת sitemap: ${err.message}`);
    return [];
  }
}

// ============================================
// 🔄 Fetch מתקדם עם retry logic
// ============================================
async function safeFetch(url, retries = CONFIG.RETRY_ATTEMPTS) {
  const cleanUrl = normalizeUrl(url);
  
  // לוג לדיבאג
  if (cleanUrl !== url) {
    console.log(`🔗 URL מנורמל: ${url} → ${cleanUrl}`);
  }
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(cleanUrl, {
        headers: {
          "User-Agent": getRandomUA(),
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "he,en-US;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "Connection": "keep-alive",
          "Cache-Control": "no-cache",
        },
        signal: AbortSignal.timeout(30000), // timeout של 30 שניות
      });

      // טיפול בסטטוסים שונים
      if (res.status === 404) {
        console.log(`🚫 404: ${url}`);
        return { status: 404, ok: false };
      }

      if (res.status === 403 || res.status === 429) {
        const waitTime = Math.pow(2, attempt) * 2000 + Math.random() * 2000;
        console.warn(`⏸️ חסימה זמנית (${res.status}), ממתין ${Math.round(waitTime/1000)}s...`);
        await delay(waitTime);
        continue;
      }

      if (res.status >= 500) {
        throw new Error(`שגיאת שרת ${res.status}`);
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      return res;

    } catch (err) {
      const isLastAttempt = attempt === retries;
      console.warn(
        `⚠️ ניסיון ${attempt}/${retries} נכשל עבור ${url}: ${err.message}`
      );

      if (!isLastAttempt) {
        const waitTime = Math.pow(2, attempt) * CONFIG.BASE_DELAY + Math.random() * 2000;
        await delay(waitTime);
      }
    }
  }

  // ניסיון אחרון דרך proxy
  console.log(`🔁 מנסה דרך proxy: ${url}`);
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`;
    const proxyRes = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(45000),
    });

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      return {
        ok: true,
        text: async () => json.contents,
        status: 200,
      };
    }
  } catch (proxyErr) {
    console.error(`❌ גם proxy נכשל: ${proxyErr.message}`);
  }

  return null;
}

// ============================================
// 🧠 זיהוי חכם של סוג דף
// ============================================
function identifyPageType(url, $) {
  const lower = url.toLowerCase();
  const path = new URL(url).pathname.toLowerCase();

  // דפי תוצאות/חיפוש (רשימות קורסים)
  if (
    path.includes("/results") ||
    path.includes("/search-results") ||
    path.includes("/courses-per-month")
  ) {
    return "course-list";
  }

  // דפי מידע ספציפיים
  if (
    path.includes("/btl") ||
    path.includes("/luz") ||
    path.includes("/shabaton") ||
    path.includes("/rights") ||
    path.includes("/forms") ||
    path.includes("/tofes") ||
    lower.includes("info")
  ) {
    return "info-page";
  }

  // דף מוסד לימוד
  if ($("ul li a").length > 10 && $("h2").length > 3) {
    return "institution-page";
  }

  // דף קורס בודד
  if (
    $("table").length > 0 ||
    $(".course-details").length > 0 ||
    ($("h1").length === 1 && $("p").length > 5)
  ) {
    return "course-detail";
  }

  return "general";
}

// ============================================
// 🧹 סינון מתקדם של אלמנטים לא רלוונטיים
// ============================================
function cleanDom($) {
  // הסרת אלמנטים טכניים
  const removeSelectors = [
    "header",
    "footer",
    "nav",
    ".navbar",
    ".nav",
    ".menu",
    ".breadcrumb",
    ".breadcrumbs",
    ".sidebar",
    ".widget",
    "script",
    "style",
    "noscript",
    "iframe",
    "form",
    ".cookie",
    ".popup",
    ".modal",
    ".advertisement",
    ".ad",
    ".social-share",
    ".comments",
  ];

  removeSelectors.forEach((sel) => $(sel).remove());

  // הסרת קטגוריות וקישורים פנימיים (רק מתוך פסקאות, לא כותרות)
  $("p, div").each((_, el) => {
    const text = $(el).text();
    if (
      text.includes("קורסים נוספים") ||
      text.includes("קטגוריות") ||
      text.includes("תגיות") ||
      (text.includes("קורסי") && text.length < 200 && $(el).find("a").length > 3)
    ) {
      $(el).remove();
    }
  });

  // הסרת meta keywords
  $('meta[name="keywords"]').remove();

  return $;
}

// ============================================
// 📝 חילוץ תוכן מתקדם
// ============================================
function extractSmartContent(html, url) {
  let $ = cheerio.load(html);
  $ = cleanDom($);

  const pageType = identifyPageType(url, $);

  // חילוץ מטא-דאטה
  const title = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() || "";
  const h1 = $("h1").first().text().trim();
  
  const h2s = $("h2")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 3);
  
  const h3s = $("h3")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 3);

  // חילוץ רשימות (ul/ol)
  const lists = [];
  $("ul, ol").each((_, list) => {
    const items = $(list)
      .find("li")
      .map((_, li) => $(li).text().trim())
      .get()
      .filter((t) => t.length > 10 && !t.includes("קורסים נוספים"));
    
    if (items.length > 0 && items.length < 50) {
      // לא רשימות ענקיות של קישורים
      lists.push(...items);
    }
  });

  // חילוץ טבלאות (לדפי קורסים)
  const tables = [];
  if (pageType === "course-detail" || pageType === "institution-page") {
    $("table").each((_, table) => {
      const rows = $(table).find("tr");
      if (rows.length > 0 && rows.length < 30) {
        rows.each((_, row) => {
          const cells = $(row)
            .find("td, th")
            .map((_, cell) => $(cell).text().trim())
            .get()
            .join(" | ");
          if (cells) tables.push(cells);
        });
      }
    });
  }

  // חילוץ פסקאות
  const paragraphs = [];
  $("p, blockquote, article").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20 && text.length < 2000) {
      paragraphs.push(text);
    }
  });

  // בניית טקסט סופי עם משקלות
  const parts = [];
  
  // משקל גבוה לכותרות
  if (title) parts.push(title, title); // כפול למשקל
  if (h1 && h1 !== title) parts.push(h1, h1);
  if (description) parts.push(description);
  
  // כותרות משנה
  parts.push(...h2s, ...h3s);
  
  // תוכן עיקרי
  parts.push(...lists.slice(0, 20)); // מוגבל ל-20 פריטים ברשימה
  parts.push(...tables.slice(0, 10));
  parts.push(...paragraphs);

  // ניקוי והסרת כפילויות
  const uniqueParts = [...new Set(parts)].filter(Boolean);
  const cleanText = uniqueParts
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/(\||›|»|·|•|→|←)/g, " ")
    .replace(/\[.*?\]/g, "")
    .trim();

  return {
    url,
    title: title || h1 || "ללא כותרת",
    h1,
    h2: h2s.slice(0, 5),
    h3: h3s.slice(0, 5),
    description,
    type: pageType,
    text: cleanText.slice(0, 8000), // הגבלה ל-8000 תווים
    wordCount: cleanText.split(/\s+/).length,
  };
}

// ============================================
// 🤖 עיבוד דף בודד + Embedding
// ============================================
async function processPage(url) {
  console.log(`\n🔍 מעבד: ${url}`);

  const res = await safeFetch(url);
  
  if (!res) {
    console.log(`❌ כישלון בטעינת ${url}`);
    return null;
  }

  if (res.status === 404) {
    return "404";
  }

  const html = await res.text();
  const content = extractSmartContent(html, url);

  // בדיקות תקינות
  const isInfoPage = content.type === "info-page";
  const minLength = isInfoPage ? 30 : 50;

  if (!content.text || content.text.length < minLength) {
    console.log(`⚠️ תוכן קצר מדי (${content.text.length} תווים): ${url}`);
    return null;
  }

  if (content.wordCount < 10) {
    console.log(`⚠️ מעט מדי מילים (${content.wordCount}): ${url}`);
    return null;
  }

  // יצירת embedding
  try {
    const embedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: content.text,
    });

    console.log(
      `✅ הצלחה: ${content.type} | ${content.wordCount} מילים | ${content.title.slice(0, 50)}...`
    );

    return {
      url: content.url,
      title: content.title,
      h1: content.h1,
      h2: content.h2,
      h3: content.h3,
      description: content.description,
      type: content.type,
      text: content.text.slice(0, 500), // שמירת 500 תווים ראשונים
      vector: embedding.data[0].embedding,
      wordCount: content.wordCount,
      indexedAt: new Date().toISOString(),
    };
  } catch (embeddingError) {
    console.error(`❌ שגיאת embedding עבור ${url}: ${embeddingError.message}`);
    return null;
  }
}

// ============================================
// 📤 העלאה ל-GitHub
// ============================================
async function uploadToGitHub(filePath, message) {
  if (!CONFIG.GITHUB_TOKEN || !CONFIG.GITHUB_REPO) {
    console.warn("⚠️ חסרים פרטי GitHub - דילוג על העלאה");
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const encoded = Buffer.from(content).toString("base64");
    const fileName = path.basename(filePath);
    const url = `https://api.github.com/repos/${CONFIG.GITHUB_REPO}/contents/data/${fileName}?ref=${CONFIG.GITHUB_BRANCH}`;

    const headers = {
      Authorization: `token ${CONFIG.GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
    };

    // בדיקה אם הקובץ קיים
    let sha = null;
    try {
      const existing = await fetch(url, { headers });
      if (existing.ok) {
        sha = (await existing.json()).sha;
      }
    } catch {}

    // העלאה/עדכון
    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message,
        content: encoded,
        branch: CONFIG.GITHUB_BRANCH,
        ...(sha && { sha }),
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`HTTP ${res.status}: ${error}`);
    }

    console.log(`📤 הועלה ל-GitHub: ${fileName}`);
    return true;
  } catch (err) {
    console.error(`❌ שגיאת העלאה ל-GitHub: ${err.message}`);
    return false;
  }
}

// ============================================
// 🏗️ בניית אינדקס עם פיצול אוטומטי
// ============================================
export async function buildIndex(name, sitemapUrl, batchSize = CONFIG.BATCH_SIZE, manualUrls = []) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`🚀 מתחיל בניית אינדקס: ${name}`);
  console.log(`${"=".repeat(60)}`);

  // הכנת תיקיית data
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // נתיבי קבצים
  const baseName = name.toLowerCase().replace(/\s+/g, "_");
  const indexPath = path.join(dataDir, `${baseName}_index.json`);
  const donePath = path.join(dataDir, `${baseName}_done.json`);
  const failedPath = path.join(dataDir, `${baseName}_failed.json`);
  const notFoundPath = path.join(dataDir, `${baseName}_404.json`);

  // טעינת URLs מה-sitemap
  const sitemapUrls = await getUrlsFromSitemap(sitemapUrl);
  const allUrls = Array.from(new Set([...sitemapUrls, ...manualUrls]));

  console.log(`\n📊 סטטיסטיקה:`);
  console.log(`   • Sitemap: ${sitemapUrls.length} URLs`);
  console.log(`   • ידניים: ${manualUrls.length} URLs`);
  console.log(`   • סה"כ: ${allUrls.length} URLs`);

  let done = fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, "utf8")) : [];
  let failed = fs.existsSync(failedPath) ? JSON.parse(fs.readFileSync(failedPath, "utf8")) : [];
  let notFound = fs.existsSync(notFoundPath) ? JSON.parse(fs.readFileSync(notFoundPath, "utf8")) : [];
  let pages = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : [];

  // 🔄 אם יש משתנה סביבה RETRY_404, נסה מחדש את הדפים שהיו 404
  const retry404 = process.env.RETRY_404 === "true";
  if (retry404 && notFound.length > 0) {
    console.log(`\n🔄 מנסה שוב ${notFound.length} דפים שהיו 404 בעבר...`);
    notFound = [];
    fs.writeFileSync(notFoundPath, JSON.stringify(notFound, null, 2));
  }

  // חישוב דפים ממתינים
  const pending = allUrls.filter(
    (u) => !done.includes(u) && !failed.includes(u) && !notFound.includes(u)
  );

  console.log(`\n📋 מצב נוכחי:`);
  console.log(`   ✅ הושלמו: ${done.length}`);
  console.log(`   ⏳ ממתינים: ${pending.length}`);
  console.log(`   🚫 404: ${notFound.length}`);
  console.log(`   ⚠️ כשלונות: ${failed.length}`);

  if (pending.length === 0) {
    console.log(`\n🎉 כל הדפים כבר עובדו!`);
    return false;
  }

  // עיבוד Batch נוכחי
  const batch = pending.slice(0, batchSize);
  console.log(`\n🔄 מעבד ${batch.length} דפים בסבב זה...`);

  let successCount = 0;
  let failCount = 0;
  let notFoundCount = 0;

  for (let i = 0; i < batch.length; i++) {
    const url = batch[i];
    console.log(`\n[${i + 1}/${batch.length}] ${url}`);

    const result = await processPage(url);

    if (result && result !== "404") {
      pages.push(result);
      done.push(url);
      successCount++;
    } else if (result === "404") {
      notFound.push(url);
      notFoundCount++;
    } else {
      failed.push(url);
      failCount++;
    }

    // שמירה מיידית אחרי כל דף
    fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
    fs.writeFileSync(donePath, JSON.stringify(done, null, 2));
    fs.writeFileSync(failedPath, JSON.stringify(failed, null, 2));
    fs.writeFileSync(notFoundPath, JSON.stringify(notFound, null, 2));

    // המתנה קצרה בין דפים
    if (i < batch.length - 1) {
      await delay(1000 + Math.random() * 1000);
    }
  }

  // ============================================
  // 📦 פיצול לקבצים
  // ============================================
  console.log(`\n📦 מפצל לקבצים...`);
  const chunks = [];
  for (let i = 0; i < pages.length; i += CONFIG.MAX_PER_FILE) {
    chunks.push(pages.slice(i, i + CONFIG.MAX_PER_FILE));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunkPath = path.join(dataDir, `${baseName}_index_part${i + 1}.json`);
    fs.writeFileSync(chunkPath, JSON.stringify(chunks[i], null, 2));
    await uploadToGitHub(
      chunkPath,
      `🤖 ${name} - חלק ${i + 1}/${chunks.length} (${chunks[i].length} דפים)`
    );
  }

  // העלאת קבצי מצב
  await uploadToGitHub(donePath, `📊 ${name} - דפים שהושלמו`);
  await uploadToGitHub(failedPath, `⚠️ ${name} - כשלונות`);
  await uploadToGitHub(notFoundPath, `🚫 ${name} - 404`);

  // ============================================
  // 📊 סיכום
  // ============================================
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 סיכום סבב:`);
  console.log(`   ✅ הצליחו: ${successCount}`);
  console.log(`   🚫 404: ${notFoundCount}`);
  console.log(`   ⚠️ כשלו: ${failCount}`);
  console.log(`   📈 סה"כ באינדקס: ${pages.length}`);
  console.log(`   ⏳ נותרו: ${pending.length - batch.length}`);
  console.log(`${"=".repeat(60)}\n`);

  // האם יש עוד דפים?
  return pending.length > batchSize;
}

// ============================================
// 🔁 ריצה מלאה עם לולאה
// ============================================
export async function runFullIndexing(name, sitemapUrl, batchSize = CONFIG.BATCH_SIZE) {
  console.log(`\n🏁 מתחיל אינדוקס מלא ל-${name}\n`);

  // דפי מידע ידניים (סטטיים)
  const manualUrls = [
    "https://www.shabaton.online/btl_shabaton",
    "https://www.shabaton.online/shabaton-video",
    "https://www.shabaton.online/learning_programs_shabaton",
    "https://www.shabaton.online/luz_shabaton",
    "https://www.shabaton.online/end_shabaton",
    "https://www.shabaton.online/halforfull_shabaton",
    "https://www.shabaton.online/phones_shabaton",
    "https://www.shabaton.online/forms_shabaton",
    "https://www.shabaton.online/Payments_shabaton",
    "https://www.shabaton.online/tlush_maanak_shabaton",
    "https://www.shabaton.online/kabalot_shabaton",
    "https://www.shabaton.online/tuition_reimbursement",
    "https://www.shabaton.online/shabaton-maanak",
    "https://www.shabaton.online/birth_shabatgon",
    "https://www.shabaton.online/pension_shabaton",
    "https://www.shabaton.online/keren_makor_mishor",
    "https://www.shabaton.online/tofes_101",
    "https://www.morim.boutique/rights",
  ];

  console.log(`📘 נוספו ${manualUrls.length} דפי מידע ידניים\n`);

  let round = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(`\n🔄 סבב ${round}`);
    hasMore = await buildIndex(name, sitemapUrl, batchSize, manualUrls);

    if (hasMore) {
      const waitTime = 8000 + Math.random() * 4000;
      console.log(`⏳ ממתין ${Math.round(waitTime / 1000)}s לפני הסבב הבא...\n`);
      await delay(waitTime);
      round++;
    }
  }

  console.log(`\n🎉 אינדוקס ${name} הסתיים בהצלחה!\n`);
}

// ============================================
// 🎯 ריצה ישירה מ-CLI
// ============================================
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const name = process.argv[2] || "Shabaton";
    const sitemap = process.argv[3] || "https://www.shabaton.online/sitemap.xml";
    const batchSize = Number(process.env.BATCH_SIZE) || CONFIG.BATCH_SIZE;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`🚀 ריצה ישירה של אינדוקס`);
    console.log(`   📛 שם: ${name}`);
    console.log(`   🌐 Sitemap: ${sitemap}`);
    console.log(`   📦 גודל Batch: ${batchSize}`);
    console.log(`${"=".repeat(60)}\n`);

    await runFullIndexing(name, sitemap, batchSize);
  })();
}
