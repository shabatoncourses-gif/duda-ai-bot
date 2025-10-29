import { exec } from "child_process";

export default async function handler(req, res) {
  console.log("🔄 התחיל תהליך אינדוקס מחדש...");

  try {
    exec("node scripts/autoBuildIndex.js", (error, stdout, stderr) => {
      if (error) {
        console.error("❌ שגיאה בהרצת הסקריפט:", error);
        return res.status(500).json({ error: "שגיאה בהרצת האינדוקס", details: error.message });
      }
      console.log("📄 stdout:", stdout);
      console.error("⚠️ stderr:", stderr);
      return res.status(200).json({ message: "✅ האינדוקס הושלם בהצלחה", output: stdout });
    });
  } catch (err) {
    console.error("❌ שגיאה כללית:", err);
    return res.status(500).json({ error: "שגיאה כללית", details: err.message });
  }
}
