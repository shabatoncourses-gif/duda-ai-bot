// pages/api/reindex.js
import { buildIndex } from "../../scripts/autoBuildIndex.js";

export default async function handler(req, res) {
  console.log("🚀 Triggered /api/reindex");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // מאפשר גם GET להרצה ידנית מדפדפן
  if (req.method === "GET" || req.method === "POST") {
    try {
      console.log("🧩 Starting reindex for Shabaton and Morim...");
      await buildIndex("Shabaton", "https://www.shabaton.online/sitemap.xml", 100);
      await buildIndex("Morim", "https://www.morim.boutique/sitemap.xml", 100);
      console.log("✅ Reindex completed successfully!");
      return res.status(200).json({ success: true, message: "Reindex completed successfully!" });
    } catch (err) {
      console.error("❌ Error during reindex:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed." });
}
