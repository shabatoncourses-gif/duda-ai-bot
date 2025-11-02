import { buildIndex } from "../../scripts/autoBuildIndex.js";

export default async function handler(req, res) {
  console.log("🚀 Triggered /api/reindex");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET" || req.method === "POST") {
    const start = Date.now();

    try {
      console.log("🧩 Starting reindex...");
      await buildIndex("Shabaton", "https://www.shabaton.online/sitemap.xml", 40);
      await buildIndex("Morim", "https://www.morim.boutique/sitemap.xml", 40);

      const duration = ((Date.now() - start) / 60000).toFixed(1);
      console.log(`✅ Reindex completed in ${duration} min`);
      
      // ✅ תשובה מסודרת וברורה
      return res.status(200).json({
        success: true,
        message: `Reindex completed successfully in ${duration} minutes.`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("💥 Error during reindex:", err);
      return res.status(500).json({
        success: false,
        error: err.message || "Unknown error",
        timestamp: new Date().toISOString(),
      });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}
