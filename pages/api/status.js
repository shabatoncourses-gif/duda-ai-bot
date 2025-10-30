// pages/api/status.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  console.log("📊 Checking indexing status...");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const logsDir = path.join(process.cwd(), "logs");
    const logFile = path.join(logsDir, "index_log.txt");

    if (!fs.existsSync(logFile)) {
      return res.status(200).json({
        status: "no_logs",
        message: "❌ No index log found. Try running /api/build-index first."
      });
    }

    // קורא את הלוג ומנתח את השורה האחרונה
    const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
    const lastEntries = lines.slice(-20).join("\n"); // לשם תצוגה
    const lastLine = lines.reverse().find(l => l.includes("processed")) || "";

    let lastRun = null;
    let total = null;
    let processed = null;
    let site = null;

    // מנסה לחלץ מידע בסיסי מהלוג
    const match = lastLine.match(/\[(.*?)\]\s*(\w+):\s*processed\s*(\d+)\/(\d+)/);
    if (match) {
      lastRun = match[1];
      site = match[2];
      processed = match[3];
      total = match[4];
    }

    const status = lastLine.includes("🎉")
      ? "success"
      : lastLine.includes("⚠️")
      ? "warning"
      : "running";

    res.status(200).json({
      status,
      lastRun,
      site,
      processed,
      total,
      message:
        status === "success"
          ? "✅ Indexing completed successfully"
          : "🕒 Indexing in progress or incomplete",
      logPreview: lastEntries
    });
  } catch (err) {
    console.error("❌ Error reading index log:", err);
    res.status(500).json({ error: "Failed to read index log", details: err.message });
  }
}
