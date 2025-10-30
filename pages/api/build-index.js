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
  if (req.method === "GET") console.log("🟢 Manual GET trigger received — starting build...");

  try {
    // מזהה אם זה ריצה ב-Vercel (מערכת קבצים נעולה)
    const isVercel = !!process.env.VERCEL;
    const scriptPath = path.join(process.cwd(), "scripts", "autoBuildIndex.js");
    console.log("🧩 Running script:", scriptPath);

    // אם זה מקומי — נכין תיקיית לוגים
    let logFile = null;
    if (!isVercel) {
      const logsDir = path.join(process.cwd(), "logs");
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
      logFile = path.join(logsDir, "index_log.txt");
    }

    // הפעלה של הסקריפט עם Timeout של 5 דקות
    exec(`node "${scriptPath}"`, { timeout: 1000 * 60 * 5 }, (error, stdout, stderr) => {
      const timestamp = new Date().toLocaleString();
      const logEntry = `\n[${timestamp}] Build triggered\n${stdout}\n${stderr}\n`;

      // שמירה רק בסביבה מקומית
      if (!isVercel && logFile) {
        fs.appendFileSync(logFile, logEntry);
      }

      // טיפול בשגיאה
      if (error) {
        console.error("❌ Error during index build:", error.message);
        return res.status(500).json({
          success: false,
          error: error.message,
          log: stdout + "\n" + stderr
        });
      }

      if (stderr) console.warn("⚠️ stderr:", stderr);
      console.log(stdout);

      // ב-Vercel מחזירים את הפלט ישירות
      res.status(200).json({
        success: true,
        message: "🎉 Indexing process completed successfully!",
        log: stdout + "\n" + stderr
      });
    });
  } catch (err) {
    console.error("💥 Unexpected error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
