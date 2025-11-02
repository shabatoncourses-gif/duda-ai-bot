// pages/api/reindex.js
import { buildIndex } from "../../scripts/autoBuildIndex.js";

/**
 * 🔁 Endpoint להרצת אינדוקס הדרגתי (batch) עבור האתרים Shabaton ו-Morim
 * פועל גם ב-cron של Vercel וגם בהרצה ידנית מדפדפן
 */
export default async function handler(req, res) {
  console.log("🚀 Triggered /api/reindex");

  // 🧩 כותרות בסיסיות (CORS + JSON)
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ תמיכה בבדיקת OPTIONS (CORS Preflight)
  if (req.method === "OPTIONS") return res.status(200).end();

  // ✅ תומך גם בקריאה מדפדפן (GET) וגם מהרצה אוטומטית (POST / cron)
  if (req.method === "GET" || req.method === "POST") {
    const start = Date.now();

    try {
      console.log("🧩 Starting incremental reindex (safe batch mode)...");
      console.log("🕓 Time:", new Date().toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }));

      // ⚙️ גודל batch קטן כדי להימנע מ-timeout
      // בממוצע Vercel מאפשר 45-60 שניות לפני ניתוק
      const BATCH_SIZE = 10; // מומלץ ל-10–20 דפים לכל ריצה

      // 🧠 כל ריצה שומרת התקדמות (done.json), כך שבפעם הבאה תמשיך מהמקום האחרון
      console.log(`📦 Batch size per site: ${BATCH_SIZE} pages`);

      // 🏁 הפעלת האינדוקס לשני האתרים
      const shabatonPromise = buildIndex("Shabaton", "https://www.shabaton.online/sitemap.xml", BATCH_SIZE);
      const morimPromise = buildIndex("Morim", "https://www.morim.boutique/sitemap.xml", BATCH_SIZE);

      // מריץ ברקע — שניים במקביל
      await Promise.all([shabatonPromise, morimPromise]);

      const duration = ((Date.now() - start) / 60000).toFixed(1);
      console.log(`✅ Reindex batch completed in ${duration} min`);
      console.log("🎯 Saved progress — will resume automatically on next cron.");

      // 🔙 תשובה ל-API (גם לקריאה ידנית)
      return res.status(200).json({
        success: true,
        message: `Batch completed successfully (${BATCH_SIZE} pages per site, ${duration} min).`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("💥 Error during reindex:", err.message);
      return res.status(500).json({
        success: false,
        error: err.message || "Unknown error during reindex.",
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ❌ כל שיטה אחרת (PUT / DELETE וכו') תיחסם
  return res.status(405).json({ error: "Method not allowed." });
}
