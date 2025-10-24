import runIndexing from "../indexer.js";

export default async function handler(req, res) {
  try {
    console.log("🔄 התחלת אינדוקס שבועי...");
    await runIndexing();
    res.status(200).json({ message: "✅ אינדוקס הושלם בהצלחה" });
  } catch (error) {
    console.error("❌ שגיאה באינדוקס:", error);
    res.status(500).json({ error: error.message });
  }
}
