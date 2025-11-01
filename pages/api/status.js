// pages/api/status.js
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const dataDir = process.env.VERCEL ? "/tmp/data" : "data";

    const sites = ["Shabaton", "Morim"];
    const status = {};

    for (const site of sites) {
      const lower = site.toLowerCase();

      const indexPath = path.join(dataDir, `${lower}_index.json`);
      const donePath = path.join(dataDir, `${lower}_done.json`);

      const indexExists = fs.existsSync(indexPath);
      const doneExists = fs.existsSync(donePath);

      let indexed = 0;
      let done = 0;

      if (indexExists) {
        const indexData = JSON.parse(fs.readFileSync(indexPath, "utf8"));
        indexed = Array.isArray(indexData) ? indexData.length : 0;
      }

      if (doneExists) {
        const doneData = JSON.parse(fs.readFileSync(donePath, "utf8"));
        done = Array.isArray(doneData) ? doneData.length : 0;
      }

      status[site] = {
        indexed,
        done,
        indexFile: indexExists ? `${lower}_index.json` : "❌ missing",
        doneFile: doneExists ? `${lower}_done.json` : "❌ missing",
        progress: done > 0 ? `${((indexed / done) * 100).toFixed(1)}%` : "0%",
      };
    }

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      status,
    });
  } catch (err) {
    console.error("❌ Error reading status:", err);
    res.status(500).json({ success: false, error: err.message });
  }
}
