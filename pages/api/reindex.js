// pages/api/reindex.js
export default async function handler(req, res) {
  console.log("🔄 /api/reindex called");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // מאחר והאינדוקס רץ ב-GitHub — כאן רק מחזירים הודעה
  if (req.method === "GET" || req.method === "POST") {
    return res.status(200).json({
      success: true,
      message: "Reindex request acknowledged. Indexing is performed via GitHub Actions, not on Vercel.",
      timestamp: new Date().toISOString(),
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
