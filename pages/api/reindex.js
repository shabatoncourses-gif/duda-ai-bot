// pages/api/reindex.js
import { buildIndex } from "../../scripts/autoBuildIndex.js";

export default async function handler(req, res) {
  console.log("🚀 Triggered /api/reindex");

  // ✅ הגדרות בסיסיות (CORS + JSON)
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // ✅ מאפשר גם קריאה מדפדפן (GET) וגם מהריצה האוטומטית (POST / cron)
  if (req.method === "GET" || req.method === "POST") {
    const start = Date.now();

    try {
      console.log("🧩 Starting incremental reindex (safe batch mode)...");
      console.log("🕓", new Date().toLocaleString("he-IL"));

      // ⚙️ הגדרת גודל batch קטן כדי למנוע timeout
      const BATCH_SIZE = 40; // כל ריצה תעבד עד 40 דפים לכל אתר

      // 🧠 כל ריצה של cron תמשיך מהמקום האחרון
      await buildIndex("Shabaton", "https://www.shabaton.online/sitemap.xml", BATCH_SIZE);
      await buildIndex("Morim", "https://www.morim.boutique/sitemap.xml", BATCH_SIZE);

      const duration = ((Date.now() - start) / 60000).toFixed(1);
      console.log(`✅ Reindex batch completed in ${duration} min`);

      return res.status(200).json({
        success: true,
        message: `Batch indexing completed in ${duration} min — up to ${BATCH_SIZE} pages per site.`,
      });
    } catch (err) {
      console.error("💥 Error during reindex:", err.message);
      return res.status(500).json({
        success: false,
        error: err.message || "Unknown error during reindex.",
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed." });
}
