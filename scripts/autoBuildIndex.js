// scripts/autoBuildIndex.js
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// === ⚙️ הגדרות כלליות ===
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in .env");
  process.exit(1);
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === 🧩 עוזרים ===
const delay = (ms) => new Promise((res) => setTimeout(res, ms));

function getBrowserHeaders(url) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    Referer: new URL(url).origin,
    Connection: "keep-alive",
  };
}

// === Sitemap ===
async function getUrlsFromSitemap(sitemapUrl) {
  console.log(`📥 קורא sitemap: ${sitemapUrl}`);
  const res = await fetch(sitemapUrl, { headers: getBrowserHeaders(sitemapUrl) });
  if (!res.ok) throw new Error(`❌ שגיאה בקריאת sitemap (${res.status})`);
  const xml = await res.text();
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  const urls = matches.map((m) => m[1].trim()).filter(Boolean);
  console.log(`🔗 נמצאו ${urls.length} דפים.`);
  return urls;
}

// === חילוץ תוכן חכם (כולל כותרות ורשימות) ===
function extractSmartContent(html) {
  const $ = cheerio.load(html);

  const title = $("title").text().trim();
  const desc = $('meta[name="description"]').attr("content") || "";
  const h1 = $("h1").map((_, el) => $(el).text().trim()).get().join(". ");
  const h2 = $("h2").map((_, el) => $(el).text().trim()).get().join(". ");
  const h3 = $("h3").map((_, el) => $(el).text().trim()).get().join(". ");
  const strong = $("strong,b").map((_, el) => $(el).text().trim()).get().join(". ");
  const lists = $("ul li").map((_, el) => $(el).text().trim()).get().join(". ");
  const paragraphs = $("p").map((_, el) => $(el).text().trim()).get().join(" ");

  const combined = [title, desc, h1, h2, h3, strong, lists, paragraphs]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);

  return { title: title || h1 || h2 || "Untitled", text: combined };
}

// === Fetch בטוח עם retry ===
async function safeFetch(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: getBrowserHeaders(url) });
      if (res.status === 403) {
        console.warn(`🚫 403 Forbidden (${url}), retry ${i + 1}/${retries}`);
        await delay(2000 + Math.random() * 1500);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      console.warn(`⚠️ Fetch error for ${url}: ${err.message}`);
      await delay(2000 + Math.random() * 1500);
    }
  }
  throw new Error(`❌ Failed after ${retries} attempts (${url})`);
}

// === העלאה ל-GitHub ===
async function uploadToGitHub(filePath, commitMessage) {
  try {
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      console.warn("⚠️ Missing GitHub credentials — skipping upload.");
      return;
    }

    const content = fs.readFileSync(filePath, "utf8");
    const encoded = Buffer.from(content).toString("base64");
    const relativePath = `data/${path.basename(filePath)}`;
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${relativePath}?ref=${GITHUB_BRANCH}`;

    const headers = {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
    };

    let sha = null;
    const existing = await fetch(url, { headers });
    if (existing.ok) sha = (await existing.json()).sha;

    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: commitMessage,
        content: encoded,
        branch: GITHUB_BRANCH,
        sha,
      }),
    });

    if (!res.ok) throw new Error(await res.text());
    console.log(`✅ Uploaded ${path.basename(filePath)} successfully.`);
  } catch (err) {
    console.error(`❌ GitHub upload failed: ${err.message}`);
  }
}

// === יצירת embedding לדף ===
async function processPage(url) {
  try {
    const res = await safeFetch(url);
    const html = await res.text();
    const { title, text } = extractSmartContent(html);

    if (!text || text.length < 50) {
      console.log(`⚠️ Skipping short/empty page: ${url}`);
      return null;
    }

    const embedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return { url, title, text: text.slice(0, 300), vector: embedding.data[0].embedding };
  } catch (err) {
    console.warn(`❌ Failed to process ${url}: ${err.message}`);
    return null;
  }
}

// === בניית אינדקס עם אחוזי התקדמות ===
async function buildIndex(name, sitemapUrl, batchSize = 50, concurrency = 5) {
  console.log(`\n🌍 Indexing ${name}...`);
  const startTime = Date.now();

  const isVercel = !!process.env.VERCEL;
  const dataDir = isVercel ? "/tmp/data" : path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const outputPath = path.join(dataDir, `${name.toLowerCase()}_index.json`);
  const donePath = path.join(dataDir, `${name.toLowerCase()}_done.json`);

  const urls = await getUrlsFromSitemap(sitemapUrl);
  let done = fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, "utf8")) : [];
  let pages = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, "utf8")) : [];

  const pending = urls.filter((u) => !done.includes(u));
  if (!pending.length) {
    console.log(`✅ ${name}: Index already complete (${urls.length} pages).`);
    return false;
  }

  const batch = pending.slice(0, batchSize);
  console.log(`🚀 Processing ${batch.length} pages (concurrency ${concurrency})...`);

  let processed = 0;
  for (let i = 0; i < batch.length; i += concurrency) {
    const slice = batch.slice(i, i + concurrency);
    const results = await Promise.allSettled(slice.map((url) => processPage(encodeURI(url))));
    const valid = results.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);

    for (const v of valid) {
      if (!pages.find((p) => p.url === v.url)) pages.push(v);
    }

    done.push(...slice.filter((u) => !done.includes(u)));
    processed += valid.length;

    const percent = ((done.length / urls.length) * 100).toFixed(1);
    console.log(`💾 Saved progress (${done.length}/${urls.length}) — ${percent}% done`);

    fs.writeFileSync(outputPath, JSON.stringify(pages));
    fs.writeFileSync(donePath, JSON.stringify(done));

    await delay(1000 + Math.random() * 500);
  }

  await uploadToGitHub(outputPath, `🤖 Auto index update: ${name} (${done.length}/${urls.length})`);
  await uploadToGitHub(donePath, `📘 Progress checkpoint for ${name} (${done.length}/${urls.length})`);

  const duration = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`✅ ${name} batch done: ${processed} processed in ${duration} min — ${(done.length / urls.length * 100).toFixed(1)}% total`);
  return done.length < urls.length;
}

// === ריצה מלאה ===
async function runFullIndexing(name, sitemapUrl, batchSize = 50) {
  let more = true;
  let round = 1;
  while (more) {
    console.log(`\n🌀 Batch #${round} (${name})`);
    more = await buildIndex(name, sitemapUrl, batchSize);
    round++;
    if (more) {
      console.log("⏳ Waiting before next batch...");
      await delay(5000);
    }
  }
  console.log(`🎯 ${name} indexing fully complete!`);
}

// === הרצה מקומית ===
if (process.argv[1].includes("autoBuildIndex.js")) {
  (async () => {
    try {
      await runFullIndexing("Shabaton", "https://www.shabaton.online/sitemap.xml", 50);
      await runFullIndexing("Morim", "https://www.morim.boutique/sitemap.xml", 50);
      console.log("🎉 All indexing complete!");
    } catch (err) {
      console.error("💥 Fatal error:", err.message);
    }
  })();
}

export { runFullIndexing, buildIndex };
