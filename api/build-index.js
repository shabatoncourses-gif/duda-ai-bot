import { exec } from "child_process";

export default async function handler(req, res) {
  try {
    console.log("🚀 Starting index build...");

    // מפעיל את הסקריפט שלך בדיוק כמו בלוקאלי
    exec("node scripts/autoBuildIndex.js", (error, stdout, stderr) => {
      if (error) {
        console.error("❌ Error:", error.message);
        res.status(500).json({ error: error.message });
        return;
      }
      if (stderr) console.warn("⚠️ stderr:", stderr);
      console.log(stdout);

      res.status(200).json({
        message: "🎉 Indexing process started successfully on Vercel!",
        output: stdout.split("\n").slice(-20).join("\n") // רק שורות אחרונות
      });
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
