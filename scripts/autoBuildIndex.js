// scripts/autoBuildIndex.js
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// === הגדרות GitHub ===
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

// === OpenAI ===
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in .env");
  process.exit(1);
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// === עוזרים ===
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
  const response = await fetch(sitemapUrl, { headers: getBrowserHeaders(sitemapUrl) });
  if (!response.ok) throw new Error(`❌ Failed to fetch sitemap (${response.status})`);
  const xml = await response.text();
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  const urls = matches.map((m) => m[1].trim()).filter(Boolean);
  if (!urls.length) throw new Error("❌ No URLs found in sitemap.");
  console.log(`🔗 נמצאו ${urls.length} קישורים.`);
  return urls;
}

// === חילוץ תוכן רלוונטי ===
function extractSmartContent(html) {
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const desc = $('meta[name="description"]').attr("content") || "";
  const h1 = $("h1").map((_, el) => $(el).text().trim()).get().join(". ");
  const paragraphs = $("p").map((_, el) => $(el).text().trim()).get().join(" ");
  const combined = [title, desc, h1, paragraphs].join(" ").replace(/\s+/g, " ").trim();
  return { title: title || h1 || "Untitled", text: combined.slice(0, 6000) };
}

// === Fetch בטוח עם retry ===
async function safeFetch(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { headers: getBrowserHeaders(url) });
      if (response.status === 403) {
        console.warn(`🚫 403 Forbidden (${url}), retry ${i + 1}/${retries}`);
        await delay(2000 + Math.random() * 1500);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (err) {
      console.warn(`⚠️ Fetch error for ${url}: ${err.message}`);
      await delay(2000 + Math.random() * 1500);
    }
  }
  throw new Error(`❌ Failed after ${retries} attempts (${url})`);
}

// === העלאה ל־GitHub ===
async function uploadToGitHub(filePath, commitMessage) {
  try {
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      console.warn("⚠️ Missing GitHub token/repo — skipping upload.");
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
    const getRes = await fetch(url, { headers });
    if (getRes.ok) sha = (await getRes.json()).sha;

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
    console.log(`✅ Uploaded ${relativePath} successfully.`);
  } catch (err) {
    console.error(`❌ GitHub upload failed:`, err.message);
  }
}

// === יצירת embedding לדף ===
async function processPage(url) {
  try {
    const response = await safeFetch(url);
    const html = await response.text();
    const { title, text } = extractSmartContent(html);

    if (!text || text.length < 100) {
      console.log(`⚠️ Skipping short/empty page: ${url}`);
      return null;
    }

    const embedding = await client.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return { url, title, text: text.slice(0, 300), vector: embedding.data[0].embedding };
  } catch (err) {
    console.warn(`❌ Failed ${url}: ${err.message}`);
    return null;
  }
}

// === תהליך בנייה עם Resume ===
async function buildIndex(name, sitemapUrl, batchSize = 100, concurrency = 10) {
  console.log(`\n🌍 Indexing ${name}...`);
  const startTime = Date.now();

  const isVercel = !!process.env.VERCEL;
  const dataDir = isVercel ? "/tmp/data" : path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const outputPath = path.join(dataDir, `${name.toLowerCase()}_index.json`);
  const donePath = path.join(dataDir, `${name.toLowerCase()}_done.json`);
  const partialPath = path.join(dataDir, `${name.toLowerCase()}_partial.json`);

  const urls = await getUrlsFromSitemap(sitemapUrl);
  let done = fs.existsSync(donePath) ? JSON.parse(fs.readFileSync(donePath, "utf8")) : [];
  let pages = fs.existsSync(outputPath) ? JSON.parse(fs.readFileSync(outputPath, "utf8")) : [];

  // 🧩 טעינת partial resume אם קיים
  let partial = [];
  if (fs.existsSync(partialPath)) {
    try {
      partial = JSON.parse(fs.readFileSync(partialPath, "utf8"));
      console.log(`♻️ Found partial batch (${partial.length} URLs) — resuming...`);
    } catch {
      partial = [];
    }
  }

  const pending = [...partial, ...urls.filter((u) => !done.includes(u))];
  console.log(`🕓 ${pending.length} URLs pending.`);

  if (!pending.length) {
    console.log(`✅ ${name} already fully indexed.`);
    return false;
  }

  const batch = pending.slice(0, batchSize);
  console.log(`🚀 Processing ${batch.length} pages (concurrency ${concurrency})...`);

  let processed = 0;

  for (let i = 0; i < batch.length; i += concurrency) {
    const slice = batch.slice(i, i + concurrency);
    fs.writeFileSync(partialPath, JSON.stringify(batch.slice(i))); // ✅ שמירה דחוסה ללא שבירות שורה

    const results = await Promise.allSettled(slice.map((url) => processPage(encodeURI(url))));
    const valid = results
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => r.value);

    for (const v of valid) {
      if (!pages.find((p) => p.url === v.url)) pages.push(v);
    }

    done.push(...slice.filter((u) => !done.includes(u)));
    processed += valid.length;

    // ✅ שמירה דחוסה ללא ירידות שורה
    if (i % 5 === 0 || i + concurrency >= batch.length) {
      fs.writeFileSync(outputPath, JSON.stringify(pages), "utf8");
      fs.writeFileSync(donePath, JSON.stringify(done), "utf8");
      console.log(`💾 Progress saved (${done.length}/${urls.length})`);
    }

    await delay(1500 + Math.random() * 1500);
  }

  if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath); // ניקוי partial
  await uploadToGitHub(outputPath, `🤖 Auto index update: ${name} (${done.length}/${urls.length})`);

  const duration = ((Date.now() - startTime) / 60000).toFixed(1);
  console.log(`✅ ${name} batch done: ${processed} processed in ${duration} min`);
  return done.length < urls.length;
}

// === הרצה מלאה ===
async function runFullIndexing(name, sitemapUrl, batchSize = 100) {
  let more = true;
  let round = 1;
  while (more) {
    console.log(`\n🌀 Batch #${round} for ${name}`);
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
      await runFullIndexing("Shabaton", "https://www.shabaton.online/sitemap.xml", 150);
      await runFullIndexing("Morim", "https://www.morim.boutique/sitemap.xml", 150);
      console.log("🎉 All indexing complete!");
    } catch (err) {
      console.error("💥 Fatal error:", err.message);
    }
  })();
}

export { runFullIndexing, buildIndex };
