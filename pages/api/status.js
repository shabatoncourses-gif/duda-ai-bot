// pages/api/status.js

export default async function statusHandler(req, res) {
  console.log("📊 Checking indexing status...");

  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const repo = process.env.GITHUB_REPO || "shabatoncourses-gif/duda-ai-bot";
    const branch = process.env.GITHUB_BRANCH || "main";
    const baseUrl = `https://raw.githubusercontent.com/${repo}/${branch}/data`;

    const files = [
      "shabaton_index_part1.json",
      "shabaton_index_part2.json",
      "shabaton_index_part3.json",
      "morim_index_part1.json",
    ];

    const results = {};
    let totalShabaton = 0;
    let totalMorim = 0;

    for (const f of files) {
      const url = `${baseUrl}/${f}`;
      try {
        const resFile = await fetch(url); // ← fetch מובנה של Node/Vercel
        if (!resFile.ok) {
          console.warn(`⚠️ Failed to fetch ${f}: ${resFile.status}`);
          continue;
        }
        const json = await resFile.json();
        const count = Array.isArray(json) ? json.length : 0;

        if (f.startsWith("shabaton")) totalShabaton += count;
        if (f.startsWith("morim")) totalMorim += count;

        results[f] = count;
      } catch (err) {
        console.warn(`⚠️ Error reading ${f}: ${err.message}`);
        results[f] = 0;
      }
    }

    const status = {
      Shabaton: {
        parts: {
          part1: results["shabaton_index_part1.json"] || 0,
          part2: results["shabaton_index_part2.json"] || 0,
          part3: results["shabaton_index_part3.json"] || 0,
        },
        total: totalShabaton,
      },
      Morim: {
        parts: {
          part1: results["morim_index_part1.json"] || 0,
        },
        total: totalMorim,
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
