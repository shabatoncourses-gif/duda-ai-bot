// pages/api/reindex.js
export default async function handler(req, res) {
  console.log("📡 /api/reindex called — but indexing runs ONLY on GitHub");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  return res.status(200).json({
    ok: true,
    message: "Indexing does NOT run on Vercel. It runs only in GitHub Actions.",
    timestamp: new Date().toISOString(),
  });
}
