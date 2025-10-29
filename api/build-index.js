import { exec } from "child_process";

export default async function handler(req, res) {
  console.log("🚀 Starting index build on Vercel...");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // מאפשר גם קריאה ב-GET
  if (req.method === "GET") {
    console.log("🟢 Manual GET trigger received — running build...");
  }

  try {
    // מריץ את הקובץ שלך בדיוק כמו בלוקאלי
    exec("node scripts/autoBuildIndex.js", (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Error during index build:", error.message);
        return res.status(500).json({ error: error.message });
      }

      if (stderr) console.warn("⚠️ stderr:", stderr);
      console.log(stdout);

      res.status(200).json({
        message: "🎉 Indexing process started successfully on Vercel!",
        log: stdout.split("\n").slice(-20).join("\n"),
      });
    });
  } catch (err) {
    console.error("💥 Unexpected error:", err);
    res.status(500).json({ error: err.message });
  }
}
