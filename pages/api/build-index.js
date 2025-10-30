// pages/api/build-index.js
import { exec } from "child_process";
import path from "path";
import fs from "fs";

export default async function handler(req, res) {
  console.log("🚀 Triggered /api/build-index");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    console.log("🟢 Manual GET trigger received — starting build...");
  }

  try {
    // נוודא שיש תיקייה ללוגים
    const logsDir = path.join(process.cwd(), "logs");
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);

    const logFile = path.join(logsDir, "index_log.txt");
    const scriptPath = path.join(process.cwd(), "scripts", "autoBuildIndex.js");
    console.log("🧩 Running script:", scriptPath);

    // הפעלה של הסקריפט עם Timeout 5 דקות
    exec(`node "${scriptPath}"`, { timeout: 1000 * 60 * 5 }, (error, stdout, stderr) => {
      const timestamp = new Date().toLocaleString();
      const logEntry = `\n[${timestamp}] Build triggered manually\n${stdout}\n${stderr}\n`;
      fs.appendFileSync(logFile, logEntry);

      if (error) {
        console.error("❌ Error during index build:", error.message);
        return res.status(500).json({
          success: false,
          error: error.message,
          log: stdout.split("\n").slice(-20).join("\n")
        });
      }

      if (stderr) console.warn("⚠️ stderr:", stderr);
      console.log(stdout);

      res.status(200).json({
        success: true,
        message: "🎉 Indexing process completed successfully on Vercel!",
        log: stdout.split("\n").slice(-20).join("\n")
      });
    });
  } catch (err) {
    console.error("💥 Unexpected error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
