import axios from "axios";
import { parseStringPromise } from "xml2js";
import * as fs from "fs";

// נגדיר מראש headers שגורמים לאתר לחשוב שמדובר בדפדפן רגיל
const axiosInstance = axios.create({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  },
  timeout: 10000,
});

async function indexSite(sitemapUrl, outputFile) {
  console.log(`📥 טוען Sitemap מתוך ${sitemapUrl}...`);

  try {
    const { data } = await axiosInstance.get(sitemapUrl);
    const sitemap = await parseStringPromise(data);
    const urls = sitemap.urlset.url.map((u) => u.loc[0]);

    console.log(`🔗 נמצאו ${urls.length} כתובות.`);

    const pages = [];

    for (const url of urls) {
      try {
        const page = await axiosInstance.get(url);
        const text = page.data
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        pages.push({ url, text });
        console.log(`✅ אינדקס של: ${url}`);
      } catch (err) {
        console.log(`⚠️ לא ניתן לטעון: ${url}`);
      }
    }

    fs.writeFileSync(
      outputFile,
      JSON.stringify(
        { source: sitemapUrl, content: pages.map((p) => p.text) },
        null,
        2
      ),
      "utf8"
    );

    console.log(`📦 נשמר לקובץ ${outputFile}`);
  } catch (err) {
    console.error(`❌ שגיאה בטעינת ${sitemapUrl}: ${err.message}`);
  }
}

export default async function runIndexing() {
  await indexSite(
    "https://www.shabaton.online/sitemap.xml",
    "./data/shabaton.json"
  );
  await indexSite(
    "https://www.morim.boutique/sitemap.xml",
    "./data/morim.json"
  );
  console.log("✅ האינדוקס הושלם בהצלחה");
}

// אם מריצים מקומית (node indexer.js)
if (process.argv[1].includes("indexer.js")) {
  runIndexing();
}
