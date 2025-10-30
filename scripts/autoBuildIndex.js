// scripts/autoBuildIndex.js
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// 🔐 GitHub settings
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO; // לדוגמה: "shabatoncourses-gif/duda-ai-bot"
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";

// 🔑 OpenAI
if (!process.env.OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY in .env");
  process.exit(1);
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 🕒 Delay helper
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 🧠 Browser-like headers
function getBrowserHeaders(url) {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Accept":
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7",
    "Referer": new URL(url).origin,
    "Connection": "keep-alive"
  };
}

// 📜 Extract all <loc> from sitemap
async function getUrlsFromSitemap(sitemapUrl) {
  console.log(`📥 Reading sitemap: ${sitemapUrl}`);
  const response = await fetch(sitemapUrl, { headers: getBrowserHeaders(sitemapUrl) });
  if (!response.ok) throw new Error(`Failed to fetch sitemap (${response.status})`);

  const xml = await response.text();
  const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
  const urls = matches.map(m => m[1].trim()).filter(Boolean);

  if (!urls.length) {
    fs.writeFileSync("/tmp/debug_sitemap.xml", xml);
    throw new Error("❌ No URLs found in sitemap.");
  }

  console.log(`🔗 Found ${urls.length} URLs in sitemap.`);
  return urls;
}

// 🧩 Extract meaningful content from HTML
function extractSmartContent(html) {
  const $ = cheerio.load(html);
  const title = $("title").text().trim();
  const desc = $('meta[name="description"]').attr("content") || "";
  const h1 = $("h1").map((_, el) => $(el).text().trim()).get().join(". ");
  const paragraphs = $("p").map((_, el) => $(el).text().trim()).get().join(" ");
  const combined = [title, desc, h1, paragraphs]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 6000);

  return { title: title || h1 || "Untitled", text: combined };
}

// 🌐 Safe fetch with retry logic
async function safeFetch(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { headers: getBrowserHeaders(url) });
      if (response.status === 403) {
        console.warn(`🚫 403 Forbidden: ${url} (attempt ${i + 1}/${retries})`);
        await delay(1500 + Math.random() * 2000);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (err) {
      console.warn(`⚠️ Fetch error for ${url}: ${err.message}`);
      await delay(1500 + Math.random() * 2000);
    }
  }
  throw new Error(`❌ Failed after ${retries} attempts (${url})`);
}

// ✳️ Upload JSON file to GitHub
async function uploadToGitHub(filePath, commitMessage) {
  try {
    if (!GITHUB_TOKEN || !GITHUB_REPO) {
      console.warn("⚠️ Missing GITHUB_TOKEN or GITHUB_REPO in .env — skipping upload.");
      return;
    }

    const fileName = filePath.split("/").pop();
    const content = fs.readFileSync(filePath, "utf8");
    const encoded = Buffer.from(content).toString("base64");
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`;
    const headers = {
      Authorization: `token ${GITHUB_TOKEN}`,
      "Content-Type": "application/json"
    };

    let sha = null;
    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    }

    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: commitMessage,
        content: encoded,
        branch: GITHUB_BRANCH,
        sha
      })
    });

    if (!res.ok) throw new Error(await res.text());
    console.log(`✅ Uploaded ${fileName} to GitHub successfully.`);
  } catch (err) {
    console.error(`❌ GitHub upload failed for ${filePath}:`, err.message);
  }
}

// ✳️ Main indexing function
async function buildIndex(name, sitemapUrl, batchSize = 100) {
  const start = new Date();
  console.log(`\n🌍 Starting batch index for ${name} at ${start.toLocaleString()}...`);

  // ⚙️ detect environment (Vercel = read-only)
  const isVercel = !!process.env.VERCEL;
  const dataDir = isVercel ? "/tmp/data" : path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const outputPath = path.join(dataDir, `${name.toLowerCase()}_index.json`);
  const donePath = path.join(dataDir, `${name.toLowerCase()}_done.json`);

  const urls = await getUrlsFromSitemap(sitemapUrl);
  let doneUrls = fs.existsSync(donePath)
    ? JSON.parse(fs.readFileSync(donePath, "utf8"))
    : [];
  let pages = fs.existsSync(outputPath)
    ? JSON.parse(fs.readFileSync(outputPath, "utf8"))
    : [];

  const pendingUrls = urls.filter(u => !doneUrls.includes(u));
  console.log(`🕒 Pending: ${pendingUrls.length} URLs remaining.`);

  if (pendingUrls.length === 0) {
    console.log(`✅ All pages already indexed.`);
    return false;
  }

  const batch = pendingUrls.slice(0, batchSize);
  console.log(`🚀 Processing next ${batch.length} pages...`);

  let processed = 0;
  for (const url of batch) {
    console.log(`📄 Fetching: ${url}`);
    try {
      const response = await safeFetch(url);
      const html = await response.text();
      const { title, text } = extractSmartContent(html);

      if (!text || text.length < 50) {
        console.log(`⚠️ Skipping short page: ${url}`);
        continue;
      }

      const embedding = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: text
      });

      pages.push({
        url,
        title,
        text: text.slice(0, 300),
        vector: embedding.data[0].embedding
      });
      doneUrls.push(url);
      processed++;

      fs.writeFileSync(outputPath, JSON.stringify(pages, null, 2), "utf8");
      fs.writeFileSync(donePath, JSON.stringify(doneUrls, null, 2), "utf8");

      console.log(`✅ Indexed (${processed}/${batch.length})`);
      await delay(500 + Math.random() * 1000);
    } catch (err) {
      console.warn(`⚠️ Error: ${err.message}`);
    }
  }

  await uploadToGitHub(
    `data/${name.toLowerCase()}_index.json`,
    `🤖 Auto index update: ${name} (${doneUrls.length}/${urls.length})`
  );

  console.log(`📦 Batch complete: ${processed}/${batch.length} — ${doneUrls.length}/${urls.length} total`);

  return doneUrls.length < urls.length; // return true if more left
}

// 🔁 Run all batches automatically until done
async function runFullIndexing(name, sitemapUrl, batchSize = 100) {
  let more = true;
  let round = 1;

  while (more) {
    console.log(`\n🌀 Running batch #${round} for ${name}`);
    more = await buildIndex(name, sitemapUrl, batchSize);
    round++;
    if (more) {
      console.log(`⏳ Waiting before next batch...`);
      await delay(5000);
    }
  }

  console.log(`🎉 All batches completed for ${name}!`);
}

// 🧩 Local or manual run
if (process.argv[1].includes("autoBuildIndex.js")) {
  (async () => {
    try {
      await runFullIndexing("Shabaton", "https://www.shabaton.online/sitemap.xml", 100);
      await runFullIndexing("Morim", "https://www.morim.boutique/sitemap.xml", 100);
      console.log("🎯 All sites fully indexed!");
    } catch (err) {
      console.error("💥 Fatal error:", err.message);
    }
  })();
}

export { runFullIndexing, buildIndex };
