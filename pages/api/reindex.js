// pages/api/reindex.js
import { buildIndex } from "../../scripts/autoBuildIndex.js";

export default async function handler(req, res) {
  console.log("🚀 Triggered /api/reindex");

  // כותרות בסיסיות
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ✅ מאפשר גם קריאה מדפדפן וגם מ-cron
  if (req.method === "GET" || req.method === "POST") {
    try {
      console.log("🧩 Starting incremental reindex for Shabaton & Morim...");

      // 🧠 מריץ batch קטן בכל ריצה (כדי למנוע timeout)
      await buildIndex("Shabaton", "https://www.shabaton.online/sitemap.xml", 50);
      await buildIndex("Morim", "https://www.morim.boutique/sitemap.xml", 50);

      console.log("✅ Batch indexing completed successfully.");

      return res.status(200).json({
        success: true,
        message: "Batch indexing completed successfully (50 pages per site)."
      });
    } catch (err) {
      console.error("❌ Error during reindex:", err);
      return res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed." });
}
