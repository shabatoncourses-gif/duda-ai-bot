// pages/api/status.js
import fs from "fs";
import path from "path";
import fetch from "node-fetch";

export default async function handler(req, res) {
  console.log("📊 Checking indexing status...");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const repo = process.env.GITHUB_REPO || "shabatoncourses-gif/duda-ai-bot";
    const branch = process.env.GITHUB_BRANCH || "main";

    // מיקומים בקבצי GitHub
    const baseUrl = `https://raw.githubusercontent.com/${repo}/${branch}/data`;
    const files = {
      shabatonIndex: `${baseUrl}/shabaton_index.json`,
      shabatonDone: `${baseUrl}/shabaton_done.json`,
      morimIndex: `${baseUrl}/morim_index.json`,
      morimDone: `${baseUrl}/morim_done.json`,
    };

    const results = {};

    for (const [key, url] of Object.entries(files)) {
      try {
        const resFile = await fetch(url);
        if (resFile.ok) {
          const json = await resFile.json();
          results[key] = Array.isArray(json) ? json.length : 0;
        } else {
          results[key] = 0;
        }
      } catch {
        results[key] = 0;
      }
    }

    // חישוב סטטוס עבור כל אתר
    const status = {
      Shabaton: {
        total: results.shabatonIndex,
        done: results.shabatonDone,
        progress: results.shabatonIndex
          ? ((results.shabatonDone / results.shabatonIndex) * 100).toFixed(1)
          : "0",
      },
      Morim: {
        total: results.morimIndex,
        done: results.morimDone,
        progress: results.morimIndex
          ? ((results.morimDone / results.morimIndex) * 100).toFixed(1)
          : "0",
      },
    };

    return res.status(200).json({
      success: true,
      updated: new Date().toLocaleString("he-IL"),
      status,
    });
  } catch (err) {
    console.error("❌ Error in /api/status:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
