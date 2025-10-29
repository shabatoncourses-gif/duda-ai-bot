import { exec } from "child_process";
import path from "path";

export default async function handler(req, res) {
  console.log("🚀 Starting index build on Vercel...");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method === "GET") console.log("🟢 Manual GET trigger received — running build...");

  try {
    // 👇 נשתמש בנתיב מלא כדי ש-Vercel ימצא את הסקריפט שלך
    const scriptPath = path.join(process.cwd(), "scripts", "autoBuildIndex.js");
    console.log("🧩 Script path:", scriptPath);

    // 👇 מאפשר ריצה של עד 5 דקות (Vercel סוגר אחרי 10 שניות כברירת מחדל)
    exec(`node "${scriptPath}"`, { timeout: 1000 * 60 * 5 }, (error, stdout, stderr) => {
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
