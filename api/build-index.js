// /api/build-index.js
import { buildIndex } from "../scripts/autoBuildIndex.js";

export default async function handler(req, res) {
  try {
    console.log("🚀 התחלת תהליך אינדוקס בשרת Vercel...");

    // ניתן לשלוט במספר הדפים דרך query (למשל ?max=200)
    const maxBatch = req.query?.max ? parseInt(req.query.max) : 300;

    await buildIndex("Shabaton", "https://www.shabaton.online/sitemap.xml", maxBatch);
    await buildIndex("Morim", "https://www.morim.boutique/sitemap.xml", maxBatch);

    res.status(200).json({
      success: true,
      message: `🎉 האינדוקס הופעל בהצלחה! (עד ${maxBatch} דפים בכל אתר)`,
      note: "אם יש יותר דפים, אפשר להפעיל שוב להמשך התהליך."
    });
  } catch (err) {
    console.error("❌ שגיאה באינדוקס:", err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}
