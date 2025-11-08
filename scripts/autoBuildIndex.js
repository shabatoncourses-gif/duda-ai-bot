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

if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_API_KEY.startsWith("sk-")) {
  console.error("❌ חסר או לא תקין OPENAI_API_KEY");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

// === 🧩 טיפול נכון בעברית/אנגלית ===
function normalizeUrl(url) {
  try {
    url = url.trim();
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    const u = new URL(url);
    u.pathname = u.pathname
      .split("/")
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join("/");
    return u.toString().replace(/\s+/g, "");
  } catch (err) {
    console.warn("⚠️ normalizeUrl error:", err.message, "→", url);
    return encodeURI(url);
  }
}

// === מערך User-Agents למניעת חסימות ===
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) Chrome/129 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1) Safari/605.1.15",
];
function randomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// === קריאת Sitemap ===
async function getUrlsFromSitemap(sitemapUrl) {
  console.log(`📥 קורא sitemap: ${sitemapUrl}`);
  const res = await fetch(sitemapUrl, {
    headers: {
      "User-Agent": randomUA(),
      Accept: "application/xml,text/xml,*/*;q=0.9",
      "Accept-Language": "he,en;q=0.9",
    },
  });
  if (!res.ok) throw new Error(`❌ שגיאה בקריאת sitemap (${res.status})`);
  const xml = await res.text();
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  const urls = matches.map((m) => m[1].trim()).filter(Boolean);
  console.log(`🔗 נמצאו ${urls.length} דפים.`);
  return urls;
}

// === Fetch בטוח עם ניסיונות חוזרים ===
async function safeFetch(url, retries = 3) {
  const cleaned = normalizeUrl(url);
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(cleaned, {
        headers: {
          "User-Agent": randomUA(),
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "he,en;q=0.9",
          Connection: "keep-alive",
          "Cache-Control": "no-cache",
        },
      });

      if (res.status === 404) return { status: 404, ok: false };
      if (res.status === 403) {
        console.warn(`⚠️ חסימה זמנית ב-${url}`);
        await delay(4000 + Math.random() * 2000);
        continue;
      }
      if (res.status >= 500) throw new Error(`שרת ${res.status}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      console.warn(`⚠️ ניסיון ${i}/${retries} נכשל עבור ${url}: ${err.message}`);
      await delay(4000 + Math.random() * 5000);
    }
  }

  // fallback דרך proxy
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleaned)}`;
    console.log(`🔁 ניסיון דרך proxy: ${proxyUrl}`);
    const proxyRes = await fetch(proxyUrl);
    if (proxyRes.ok) {
      const json = await proxyRes.json();
      return { ok: true, text: async () => json.contents };
    }
  } catch (proxyErr) {
    console.warn(`❌ גם proxy נכשל (${url}): ${proxyErr.message}`);
  }
  return null;
}

// === חילוץ תוכן כולל title, description, h1, h2 — מתעלם מ-Page Keywords ===
function extractSmartContent(html, url) {
  const $ = cheerio.load(html);
  [
    "header", "footer", "nav", ".menu", ".breadcrumb", ".breadcrumbs",
    ".sidebar", ".navbar", "script", "style", "noscript", "form"
  ].forEach(sel => $(sel).remove());

  // ❌ הסרת תגיות meta keywords
  $('meta[name="keywords"]').remove();

  const title = $("title").text().trim();
  const description = $('meta[name="description"]').attr("content")?.trim() || "";
  const h1 = $("h1").first().text().trim();
  const h2s = $("h2").map((_, el) => $(el).text().trim()).get();
  const h3s = $("h3").map((_, el) => $(el).text().trim()).get();

  const bodyParts = [];
  $("p,li,blockquote").each((_, el) => {
    const t = $(el).text().trim();
    if (t && t.length > 20) bodyParts.push(t);
  });

  const uniqueParts = [...new Set([title, description, h1, ...h2s, ...h3s, ...bodyParts])];
  const cleanText = uniqueParts.join(" ").replace(/\s+/g, " ").replace(/(\||›|»|·|•)/g, "").trim();

  const lowerUrl = url.toLowerCase();
  let type = "general";
  if (lowerUrl.includes("results") || lowerUrl.includes("course") || lowerUrl.includes("search")) type = "course";
  else if (lowerUrl.includes("blog") || lowerUrl.includes("article")) type = "article";
  else if (lowerUrl.includes("btl") || lowerUrl.includes("info") || lowerUrl.includes("faq") || lowerUrl.includes("שבתון"))
    type = "info";

  return { title: title || h1 || "ללא כותרת", h1, h2: h2s, description, text: cleanText.slice(0, 7000), type };
}

// === Embedding לדף ===
async function processPage(url) {
  const res = await safeFetch(url);
  if (!res || res.status === 404) return res?.status === 404 ? "404" : null;

  const html = await res.text();
  const { title, h1, h2, description, text, type } = extractSmartContent(html, url);
  const isInfoPage = /(btl|info|faq|gimel|שבתון)/i.test(url);
  if (!text || (!isInfoPage && text.length < 50)) {
    console.log(`⚠️ דף קצר מדי: ${url}`);
    return null;
  }

  const embedding = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });

  console.log(`✅ ${url} (${type})`);
  return {
    url,
    title,
    h1,
    h2,
    description,
    type,
    text: text.slice(0, 300),
    vector: embedding.data[0].embedding,
  };
}

// === העלאה ל-GitHub ===
async function uploadToGitHub(filePath, message) {
  try {
    if (!GITHUB_TOKEN || !GITHUB_REPO) return console.warn("⚠️ חסרים פרטי GitHub (לא יועלה)");
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

// === אינדוקס כולל דפי מידע ידניים ===
export async function buildIndex(name, sitemapUrl, batchSize = 40, manualUrls = []) {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const indexPath = path.join(dataDir, `${name.toLowerCase()}_index.json`);
  const donePath = path.join(dataDir, `${name.toLowerCase()}_done.json`);
  const failedPath = path.join(dataDir, `${name.toLowerCase()}_failed.json`);
  const notFoundPath = path.join(dataDir, `${name.toLowerCase()}_404.json`);

  const urls = await getUrlsFromSitemap(sitemapUrl);
  const allUrls = Array.from(new Set([...urls, ...manualUrls]));
  console.log(`📘 נוספו ${manualUrls.length} דפי מידע ידניים`);

  let done = fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, "utf8")) : [];
  let failed = fs.existsSync(failedPath) ? JSON.parse(fs.readFileSync(failedPath, "utf8")) : [];
  let notFound = fs.existsSync(notFoundPath) ? JSON.parse(fs.readFileSync(notFoundPath, "utf8")) : [];
  let pages = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, "utf8")) : [];

  const pending = allUrls.filter(u => !done.includes(u) && !failed.includes(u) && !notFound.includes(u));
  console.log(`🕓 נותרו ${pending.length} דפים לאינדוקס (כולל דפים ידניים)`);

  const batch = pending.slice(0, batchSize);
  let count = 0;

  for (const url of batch) {
    const result = await processPage(url);
    if (result && result !== "404") {
      pages.push(result);
      done.push(url);
      count++;
    } else if (result === "404") {
      notFound.push(url);
    } else {
      failed.push(url);
    }

    fs.writeFileSync(indexPath, JSON.stringify(pages, null, 2));
    fs.writeFileSync(donePath, JSON.stringify(done, null, 2));
    fs.writeFileSync(failedPath, JSON.stringify(failed, null, 2));
    fs.writeFileSync(notFoundPath, JSON.stringify(notFound, null, 2));
  }

  console.log(`📊 סיכום: ✅ ${count} הצליחו | 🚫 ${notFound.length} 404 | ⚠️ ${failed.length} כשלו`);

  await uploadToGitHub(indexPath, `🤖 עדכון ${name} (${done.length}/${allUrls.length})`);
  await uploadToGitHub(donePath, `📘 שמירת התקדמות ${name}`);
  await uploadToGitHub(failedPath, `❗ רשימת כשלונות ${name}`);
  await uploadToGitHub(notFoundPath, `🚫 רשימת 404 ${name}`);

  console.log(`✅ ${name} הסתיים (${count} נוספו, ${done.length}/${allUrls.length})`);
  return pending.length > batchSize;
}

// === ריצה מלאה ===
export async function runFullIndexing(name, sitemapUrl, batchSize = 40) {
  console.log(`🏁 מתחיל אינדוקס מלא ל-${name}`);

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
    "https://www.morim.online/rights",
  ];

  console.log(`📘 דפי מידע ידניים נטענו (${manualUrls.length})`);

  let more = true;
  while (more) {
    more = await buildIndex(name, sitemapUrl, batchSize, manualUrls);
    if (more) {
      console.log("⏳ מחכה 6 שניות לפני קבוצה הבאה...");
      await delay(6000 + Math.random() * 4000);
    }
  }

  console.log(`✅ אינדוקס ${name} הסתיים בהצלחה`);
}

// === ריצה ישירה ===
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const name = process.argv[2] || "Shabaton";
    const sitemap = process.argv[3] || "https://www.shabaton.online/sitemap.xml";
    const batchSize = Number(process.env.BATCH_SIZE) || 40;
    console.log(`🚀 מריץ אינדוקס ישיר עבור ${name}`);
    await runFullIndexing(name, sitemap, batchSize);
  })();
}
